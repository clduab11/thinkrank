output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
}

output "eks_cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "eks_node_groups" {
  description = "EKS node groups"
  value       = module.eks.eks_managed_node_groups
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_instance_name
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

output "s3_bucket_id" {
  description = "S3 bucket ID"
  value       = module.s3.s3_bucket_id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3.s3_bucket_arn
}

output "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = module.s3.s3_bucket_bucket_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.s3.cloudfront_distribution_id
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.s3.cloudfront_distribution_domain_name
}

# Environment-specific outputs
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

# Connection strings (for application configuration)
output "database_url" {
  description = "Database connection URL"
  value       = "postgresql://${var.db_username}:${var.db_password}@${module.rds.db_instance_endpoint}:${module.rds.db_instance_port}/${module.rds.db_instance_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "redis://${module.redis.cache_nodes[0].address}:${module.redis.port}"
}

# Kubernetes config
output "kubectl_config" {
  description = "kubectl config command to connect to the cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}"
}
