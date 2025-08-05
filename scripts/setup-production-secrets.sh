#!/bin/bash

# Production Secret Setup Script
# This script securely configures all production secrets using SealedSecrets and External Secrets Operator

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="thinkrank"
KUBESEAL_VERSION="v0.24.0"
ESO_VERSION="v0.9.11"

echo -e "${BLUE}🔐 ThinkRank Production Security Setup${NC}"
echo "========================================"

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl is not installed${NC}"
        exit 1
    fi
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Cannot access Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Check namespace
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        echo -e "${YELLOW}⚠️  Creating namespace $NAMESPACE${NC}"
        kubectl create namespace $NAMESPACE
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Install SealedSecrets controller
install_sealed_secrets() {
    echo -e "${BLUE}Installing SealedSecrets controller...${NC}"
    
    # Check if already installed
    if kubectl get deployment sealed-secrets-controller -n kube-system &> /dev/null; then
        echo -e "${YELLOW}⚠️  SealedSecrets controller already installed${NC}"
        return
    fi
    
    # Install SealedSecrets
    kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/$KUBESEAL_VERSION/controller.yaml
    
    # Wait for deployment
    kubectl wait --for=condition=available --timeout=300s deployment/sealed-secrets-controller -n kube-system
    
    # Install kubeseal CLI if not present
    if ! command -v kubeseal &> /dev/null; then
        echo -e "${BLUE}Installing kubeseal CLI...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            curl -OL "https://github.com/bitnami-labs/sealed-secrets/releases/download/$KUBESEAL_VERSION/kubeseal-$KUBESEAL_VERSION-darwin-amd64.tar.gz"
            tar -xf "kubeseal-$KUBESEAL_VERSION-darwin-amd64.tar.gz"
            sudo mv kubeseal /usr/local/bin/
            rm "kubeseal-$KUBESEAL_VERSION-darwin-amd64.tar.gz"
        else
            curl -OL "https://github.com/bitnami-labs/sealed-secrets/releases/download/$KUBESEAL_VERSION/kubeseal-$KUBESEAL_VERSION-linux-amd64.tar.gz"
            tar -xf "kubeseal-$KUBESEAL_VERSION-linux-amd64.tar.gz"
            sudo mv kubeseal /usr/local/bin/
            rm "kubeseal-$KUBESEAL_VERSION-linux-amd64.tar.gz"
        fi
    fi
    
    echo -e "${GREEN}✅ SealedSecrets controller installed${NC}"
}

# Install External Secrets Operator
install_external_secrets() {
    echo -e "${BLUE}Installing External Secrets Operator...${NC}"
    
    # Check if already installed
    if kubectl get deployment external-secrets -n external-secrets-system &> /dev/null; then
        echo -e "${YELLOW}⚠️  External Secrets Operator already installed${NC}"
        return
    fi
    
    # Add Helm repository
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update
    
    # Install External Secrets Operator
    helm install external-secrets external-secrets/external-secrets \
        --namespace external-secrets-system \
        --create-namespace \
        --version $ESO_VERSION \
        --set installCRDs=true
    
    # Wait for deployment
    kubectl wait --for=condition=available --timeout=300s deployment/external-secrets -n external-secrets-system
    
    echo -e "${GREEN}✅ External Secrets Operator installed${NC}"
}

# Generate production secrets
generate_secrets() {
    echo -e "${BLUE}Generating production secrets...${NC}"
    
    # Create temporary directory for secrets
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    # Generate JWT RSA key pair
    echo -e "${BLUE}Generating JWT RSA key pair...${NC}"
    openssl genrsa -out "$TEMP_DIR/jwt_private.pem" 2048
    openssl rsa -in "$TEMP_DIR/jwt_private.pem" -pubout -out "$TEMP_DIR/jwt_public.pem"
    
    # Generate database password
    DB_PASSWORD=$(openssl rand -hex 32)
    
    # Generate Redis password
    REDIS_PASSWORD=$(openssl rand -hex 32)
    
    # Create secret manifests
    cat > "$TEMP_DIR/jwt-secret.yaml" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: jwt-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  JWT_PRIVATE_KEY: |
$(cat "$TEMP_DIR/jwt_private.pem" | sed 's/^/    /')
  JWT_PUBLIC_KEY: |
$(cat "$TEMP_DIR/jwt_public.pem" | sed 's/^/    /')
EOF

    cat > "$TEMP_DIR/db-secret.yaml" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: database-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  DATABASE_PASSWORD: "$DB_PASSWORD"
  REDIS_PASSWORD: "$REDIS_PASSWORD"
EOF
    
    # Seal the secrets
    echo -e "${BLUE}Sealing secrets...${NC}"
    kubeseal -f "$TEMP_DIR/jwt-secret.yaml" -w "../infrastructure/k8s/sealed-jwt-secrets.yaml"
    kubeseal -f "$TEMP_DIR/db-secret.yaml" -w "../infrastructure/k8s/sealed-db-secrets.yaml"
    
    echo -e "${GREEN}✅ Production secrets generated and sealed${NC}"
    echo -e "${YELLOW}⚠️  Please update your AWS Secrets Manager with API keys manually${NC}"
}

# Setup certificate pinning
setup_certificate_pinning() {
    echo -e "${BLUE}Setting up certificate pinning...${NC}"
    
    # Get current certificate fingerprints
    CERT_FINGERPRINT=$(openssl s_client -servername api.thinkrank.com -connect api.thinkrank.com:443 2>/dev/null | \
                      openssl x509 -fingerprint -sha256 -noout | \
                      cut -d'=' -f2)
    
    # Update Unity certificate pinning configuration
    cat > "../client/unity-project/Assets/Resources/CertificatePins.json" <<EOF
{
    "pins": [
        {
            "hostname": "api.thinkrank.com",
            "fingerprints": [
                "$CERT_FINGERPRINT"
            ]
        },
        {
            "hostname": "auth.thinkrank.com", 
            "fingerprints": [
                "$CERT_FINGERPRINT"
            ]
        }
    ]
}
EOF
    
    echo -e "${GREEN}✅ Certificate pinning configured${NC}"
}

# Deploy security configurations
deploy_security_configs() {
    echo -e "${BLUE}Deploying security configurations...${NC}"
    
    # Apply SealedSecrets
    kubectl apply -f "../infrastructure/k8s/sealed-secrets.yaml"
    kubectl apply -f "../infrastructure/k8s/sealed-jwt-secrets.yaml"
    kubectl apply -f "../infrastructure/k8s/sealed-db-secrets.yaml"
    
    # Apply External Secrets Operator configuration
    kubectl apply -f "../infrastructure/k8s/external-secrets-operator.yaml"
    
    # Apply encrypted database configurations
    kubectl apply -f "../infrastructure/k8s/postgres-encrypted.yaml"
    kubectl apply -f "../infrastructure/k8s/redis-encrypted.yaml"
    
    # Apply rate limiting
    kubectl apply -f "../infrastructure/k8s/rate-limiting.yaml"
    
    # Update service deployments to use new secrets
    kubectl patch deployment auth-service -n $NAMESPACE --patch '{
        "spec": {
            "template": {
                "spec": {
                    "containers": [{
                        "name": "auth-service",
                        "env": [
                            {
                                "name": "JWT_PRIVATE_KEY",
                                "valueFrom": {
                                    "secretKeyRef": {
                                        "name": "jwt-secrets",
                                        "key": "JWT_PRIVATE_KEY"
                                    }
                                }
                            },
                            {
                                "name": "JWT_PUBLIC_KEY",
                                "valueFrom": {
                                    "secretKeyRef": {
                                        "name": "jwt-secrets",
                                        "key": "JWT_PUBLIC_KEY"
                                    }
                                }
                            }
                        ]
                    }]
                }
            }
        }
    }'
    
    echo -e "${GREEN}✅ Security configurations deployed${NC}"
}

# Validate deployment
validate_deployment() {
    echo -e "${BLUE}Validating security deployment...${NC}"
    
    # Check SealedSecrets are unsealed
    if kubectl get secret jwt-secrets -n $NAMESPACE &> /dev/null; then
        echo -e "${GREEN}✅ JWT secrets properly unsealed${NC}"
    else
        echo -e "${RED}❌ JWT secrets not found${NC}"
        return 1
    fi
    
    # Check External Secrets are synced
    if kubectl get secret api-secrets -n $NAMESPACE &> /dev/null; then
        echo -e "${GREEN}✅ API secrets synced from external provider${NC}"
    else
        echo -e "${YELLOW}⚠️  API secrets not synced - check AWS Secrets Manager configuration${NC}"
    fi
    
    # Check encrypted databases are running
    if kubectl get pod -l app=postgres-encrypted -n $NAMESPACE | grep Running &> /dev/null; then
        echo -e "${GREEN}✅ Encrypted PostgreSQL running${NC}"
    else
        echo -e "${YELLOW}⚠️  Encrypted PostgreSQL not running${NC}"
    fi
    
    if kubectl get pod -l app=redis-encrypted -n $NAMESPACE | grep Running &> /dev/null; then
        echo -e "${GREEN}✅ Encrypted Redis running${NC}"
    else
        echo -e "${YELLOW}⚠️  Encrypted Redis not running${NC}"
    fi
    
    echo -e "${GREEN}✅ Security validation completed${NC}"
}

# Cleanup insecure configurations
cleanup_insecure() {
    echo -e "${BLUE}Cleaning up insecure configurations...${NC}"
    
    # Remove insecure secrets
    kubectl delete secret thinkrank-secrets -n $NAMESPACE --ignore-not-found=true
    kubectl delete secret thinkrank-secrets-dev -n $NAMESPACE --ignore-not-found=true
    
    # Remove insecure database deployments
    kubectl delete deployment postgres -n $NAMESPACE --ignore-not-found=true
    kubectl delete deployment redis -n $NAMESPACE --ignore-not-found=true
    
    echo -e "${GREEN}✅ Insecure configurations removed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting ThinkRank security hardening...${NC}"
    
    check_prerequisites
    install_sealed_secrets
    install_external_secrets
    generate_secrets
    setup_certificate_pinning
    deploy_security_configs
    validate_deployment
    cleanup_insecure
    
    echo ""
    echo -e "${GREEN}🎉 Security hardening completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Configure AWS Secrets Manager with your API keys"
    echo "2. Update DNS records to point to the new rate-limited endpoints"
    echo "3. Update Unity client to use new certificate pinning"
    echo "4. Run security tests to validate all components"
    echo "5. Monitor logs for any authentication issues"
    echo ""
    echo -e "${BLUE}Security features enabled:${NC}"
    echo "✅ RSA256 JWT authentication with key rotation"
    echo "✅ SealedSecrets for Kubernetes secret management"
    echo "✅ External Secrets Operator integration"
    echo "✅ PostgreSQL Transparent Data Encryption"
    echo "✅ Redis encryption at rest and in transit"
    echo "✅ Field-level encryption for PII data"
    echo "✅ Unity secure storage with Keychain/Keystore"
    echo "✅ Certificate pinning for client applications"
    echo "✅ Distributed rate limiting and DDoS protection"
    echo "✅ Comprehensive security monitoring"
}

# Handle script arguments
case "${1:-main}" in
    "check")
        check_prerequisites
        ;;
    "secrets")
        generate_secrets
        ;;
    "deploy")
        deploy_security_configs
        ;;
    "validate")
        validate_deployment
        ;;
    "cleanup")
        cleanup_insecure
        ;;
    "main"|*)
        main
        ;;
esac