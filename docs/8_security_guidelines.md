# Security Guidelines

## Overview

This document outlines comprehensive security guidelines for ThinkRank's Phase 1 security implementation, covering authentication bypass fixes, environment security, modular architecture benefits, and mobile Unity client integration patterns.

## Table of Contents

- [Authentication Security](#authentication-security)
- [Environment & Configuration Security](#environment--configuration-security)
- [API Security](#api-security)
- [Mobile Security](#mobile-security)
- [OWASP Compliance](#owasp-compliance)
- [Security Testing](#security-testing)
- [Incident Response](#incident-response)

## Authentication Security

### RSA256 JWT Implementation

**Purpose**: Secure token generation with RSA256 signatures and verification to prevent authentication bypass vulnerabilities.

**Guidelines**:

```typescript
// ✅ CORRECT: RSA256 JWT with proper key management
const token = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  expiresIn: '1h',
  issuer: 'thinkrank-auth',
  audience: 'thinkrank-api'
});

// ❌ INCORRECT: Weak algorithms or missing validation
const badToken = jwt.sign(payload, 'secret'); // No algorithm specified
```

**Key Requirements**:
- Minimum RSA 2048-bit keys for token signing
- Private keys must be stored in encrypted environment variables
- Token expiration must be enforced (maximum 1 hour for access tokens)
- Include issuer and audience claims for additional validation

### bcrypt Password Hashing

**Configuration Requirements**:
- Minimum 12 bcrypt rounds (configurable via environment)
- Automatic salt generation (16 bytes minimum)
- Progressive lockout: 5 failed attempts trigger 15-minute lockout

**Implementation**:
```typescript
// ✅ CORRECT: Proper bcrypt configuration
const hashedPassword = await bcrypt.hash(plainPassword, 12);
const isValid = await bcrypt.compare(plainPassword, hashedPassword);

// ❌ INCORRECT: Insufficient rounds or weak hashing
const weakHash = crypto.createHash('md5').update(password).digest('hex');
```

### Account Security Controls

**Progressive Lockout Strategy**:
1. Track failed login attempts per IP/user combination
2. Exponential backoff: 1min → 5min → 15min → permanent
3. Require admin intervention after permanent lockout
4. Comprehensive audit logging of all authentication events

## Environment & Configuration Security

### Sealed Secrets Pattern

**Environment Variable Security**:
- All secrets must be encrypted using sealed-secrets or similar
- Runtime validation of required environment variables
- No hardcoded secrets in configuration files
- Automatic secret rotation for production environments

**Configuration Structure**:
```yaml
# ✅ CORRECT: Environment-abstracted configuration
database:
  host: ${DB_HOST}
  port: ${DB_PORT}
  password: ${DB_PASSWORD} # Injected at runtime

# ❌ INCORRECT: Hardcoded sensitive values
database:
  host: localhost
  password: "mySecretPassword123"
```

### Security Middleware Implementation

**Required Headers**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`

## API Security

### Rate Limiting Implementation

**Redis-Backed Distributed Rate Limiting**:
- Sliding window algorithm for accurate rate calculation
- Per-endpoint limits with hierarchical configuration
- Automatic cleanup of expired rate limit entries
- Graceful degradation under high load

**Rate Limit Configuration**:
```typescript
// ✅ CORRECT: Hierarchical rate limiting
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
};
```

### Input Validation & Sanitization

**Server-Side Validation Requirements**:
- All input must be validated against strict schemas
- SQL injection prevention through parameterized queries
- XSS prevention through proper output encoding
- File upload restrictions (type, size, content validation)

## Mobile Security

### Unity Client Integration Patterns

**Secure API Communication**:
```csharp
// ✅ CORRECT: Secure Unity client implementation
public class SecureApiClient : MonoBehaviour
{
    private string _jwtToken;
    private string _refreshToken;

    public async Task<bool> Authenticate(string username, string password)
    {
        var response = await HttpPost("/auth/login", new
        {
            username,
            password,
            deviceId = SystemInfo.deviceUniqueIdentifier
        });

        if (response.IsSuccessStatusCode)
        {
            var authData = JsonConvert.DeserializeObject<AuthResponse>(response.Content);
            _jwtToken = authData.accessToken;
            _refreshToken = authData.refreshToken;
            return true;
        }
        return false;
    }
}
```

**Token Storage Guidelines**:
- Store tokens securely using platform-specific keychain/keystore
- Implement automatic token refresh before expiration
- Clear tokens on app uninstall/logout
- Encrypt locally cached data

### Offline Security Patterns

**Conflict Resolution Security**:
- Cryptographic verification of data integrity
- Secure timestamp validation to prevent replay attacks
- Encrypted local storage for offline data
- Secure sync when connection is restored

## OWASP Compliance

### OWASP Top 10 Mitigation

| Risk | Mitigation Strategy | Implementation Status |
|------|---------------------|----------------------|
| **A01: Broken Access Control** | RBAC with JWT authorization | ✅ Implemented |
| **A02: Cryptographic Failures** | RSA256 + AES-256 encryption | ✅ Implemented |
| **A03: Injection** | Parameterized queries + input validation | ✅ Implemented |
| **A04: Insecure Design** | Zero-trust architecture | ✅ Implemented |
| **A05: Security Misconfiguration** | Sealed secrets + runtime validation | ✅ Implemented |
| **A06: Vulnerable Components** | Dependency scanning + SBOM | ✅ Implemented |
| **A07: Identification/Authentication Failures** | MFA + progressive lockout | ✅ Implemented |
| **A08: Software/Data Integrity Failures** | Cryptographic signatures | ✅ Implemented |
| **A09: Security Logging Failures** | Comprehensive audit logging | ✅ Implemented |
| **A10: Server-Side Request Forgery** | URL validation + network segmentation | ✅ Implemented |

### SOC 2 Readiness

**Security Controls**:
- Access controls with least privilege principle
- Encryption at rest and in transit
- Comprehensive logging and monitoring
- Regular security assessments and penetration testing
- Incident response procedures

## Security Testing

### Testing Strategy

**Unit Testing**:
```typescript
// ✅ CORRECT: Security-focused unit tests
describe('AuthenticationService', () => {
  describe('JWT Token Generation', () => {
    it('should generate valid RSA256 tokens', () => {
      const token = authService.generateToken(user);
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      expect(decoded.userId).toBe(user.id);
    });

    it('should reject tokens with wrong algorithm', () => {
      const maliciousToken = jwt.sign(payload, secret, { algorithm: 'HS256' });
      expect(() => authService.verifyToken(maliciousToken))
        .toThrow('invalid algorithm');
    });
  });
});
```

**Integration Testing**:
- End-to-end authentication flows
- Rate limiting verification
- Security header validation
- Error handling and information leakage prevention

**Penetration Testing**:
- Regular automated security scanning
- Manual penetration testing (quarterly)
- Dependency vulnerability assessment
- Container security scanning

### Security Testing Tools

**Recommended Tools**:
- **OWASP ZAP**: Dynamic application security testing
- **sqlmap**: SQL injection testing
- **Burp Suite**: Web vulnerability scanning
- **Trivy**: Container image scanning
- **npm audit**: Dependency vulnerability checking

## Incident Response

### Security Incident Procedures

**Detection & Analysis**:
1. Real-time monitoring alerts trigger investigation
2. Log analysis to determine scope and impact
3. Forensic evidence collection and preservation
4. Root cause analysis and vulnerability assessment

**Response & Recovery**:
1. Immediate containment of affected systems
2. Eradication of threats and vulnerabilities
3. System recovery with enhanced security
4. Post-incident review and process improvement

**Communication Protocol**:
- Internal notification within 1 hour of detection
- Customer notification for data breaches (as required by law)
- Regulatory reporting within required timeframes
- Public communication for major incidents

### Security Monitoring

**Key Metrics**:
- Failed authentication attempts per minute
- Unusual API access patterns
- Rate limit violations
- Security header compliance
- Dependency vulnerability status

**Alert Thresholds**:
- >10 failed logins per minute from single IP
- API response time degradation >50%
- Security scan failures
- Unauthorized configuration changes

## Deployment Security

### Production Deployment Checklist

**Pre-Deployment**:
- [ ] Security scan of all container images
- [ ] Dependency vulnerability assessment
- [ ] Environment variable validation
- [ ] Secret rotation and validation
- [ ] Network policy verification

**Post-Deployment**:
- [ ] Security header verification
- [ ] SSL/TLS certificate validation
- [ ] Rate limiting functionality test
- [ ] Authentication flow verification
- [ ] Log aggregation confirmation

### Container Security

**Docker Security Best Practices**:
```dockerfile
# ✅ CORRECT: Secure container configuration
FROM node:20-alpine AS base
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs
WORKDIR /app

# Copy package files first for better caching
COPY --chown=nextjs:nodejs package*.json ./

# Install dependencies before copying source
RUN npm ci --only=production && npm cache clean --force

# ❌ INCORRECT: Running as root with insecure permissions
FROM node:20
USER root
COPY . .
RUN npm install
```

## Mobile Security Standards

### Unity-Specific Security

**Code Obfuscation**:
- Enable Unity's built-in code stripping
- Implement string encryption for sensitive data
- Use IL2CPP for native compilation
- Enable anti-tampering measures

**Network Security**:
- Certificate pinning for API endpoints
- Encrypted local storage for tokens
- Secure WebSocket connections (WSS)
- Network state validation before API calls

### App Store Security

**iOS Security**:
- Enable App Transport Security (ATS)
- Implement proper certificate validation
- Use Keychain for sensitive data storage
- Enable background app refresh securely

**Android Security**:
- Implement proper keystore management
- Use Android Keystore for cryptographic operations
- Enable network security configuration
- Implement secure backup restrictions

## Security Maintenance

### Regular Security Tasks

**Daily**:
- Review security logs for anomalies
- Monitor authentication failure rates
- Check rate limiting effectiveness

**Weekly**:
- Review and update security dependencies
- Analyze security metrics and trends
- Test security controls and responses

**Monthly**:
- Conduct security awareness training
- Review and update security policies
- Perform vulnerability assessments

**Quarterly**:
- External penetration testing
- Security architecture review
- Incident response drill execution

### Security Documentation Updates

- Update this document after any security changes
- Review and validate all security configurations
- Document security decisions and rationale
- Maintain security incident history

---

**Last Updated**: September 2025
**Version**: 1.0.0
**Security Contact**: security@thinkrank.com