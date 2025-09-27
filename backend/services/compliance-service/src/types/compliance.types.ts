/**
 * Core compliance validation types and interfaces
 */

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  BOTH = 'both'
}

export enum ComplianceStatus {
  PASS = 'pass',
  FAIL = 'fail',
  WARNING = 'warning',
  ERROR = 'error',
  PENDING = 'pending'
}

export enum ComplianceCategory {
  METADATA = 'metadata',
  LEGAL = 'legal',
  TECHNICAL = 'technical',
  CONTENT = 'content',
  SECURITY = 'security'
}

export interface ComplianceIssue {
  category: ComplianceCategory;
  platform: Platform;
  status: ComplianceStatus;
  code: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixRecommendation?: string;
  referenceUrl?: string;
  affectedFiles?: string[];
  metadata?: Record<string, any>;
}

export interface AppMetadata {
  name: string;
  version: string;
  bundleId: string;
  description: string;
  keywords?: string[];
  category: string;
  subcategory?: string;
  screenshots: string[];
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  supportUrl?: string;
  marketingUrl?: string;
}

export interface BuildInfo {
  platform: Platform;
  buildPath: string;
  buildSize: number;
  unityVersion?: string;
  minOSVersion?: string;
  targetSDKVersion?: string;
  permissions: string[];
  entitlements?: string[];
  capabilities?: string[];
}

export interface ComplianceReport {
  id: string;
  timestamp: Date;
  platform: Platform;
  buildInfo: BuildInfo;
  metadata: AppMetadata;
  issues: ComplianceIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    passed: boolean;
    score: number; // 0-100
  };
  recommendations: string[];
  generatedAt: Date;
  expiresAt?: Date;
}

export interface ValidationContext {
  platform: Platform;
  buildInfo: BuildInfo;
  metadata: AppMetadata;
  config: ComplianceConfig;
  timestamp: Date;
}

export interface ComplianceConfig {
  strictMode: boolean;
  allowedPermissions: string[];
  maxBundleSize: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
  requiredMetadata: string[];
  customRules?: ComplianceRule[];
}

export interface ComplianceRule {
  id: string;
  category: ComplianceCategory;
  platform: Platform;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  validator: (context: ValidationContext) => Promise<ComplianceIssue[]>;
}

export interface ValidationResult {
  platform: Platform;
  category: ComplianceCategory;
  status: ComplianceStatus;
  issues: ComplianceIssue[];
  executionTime: number;
  passed: boolean;
}

export interface ComplianceEngineOptions {
  enableCaching: boolean;
  cacheTimeout: number;
  parallelValidation: boolean;
  maxConcurrency: number;
  enableMetrics: boolean;
  config: ComplianceConfig;
}

export interface ComplianceMetrics {
  totalValidations: number;
  averageValidationTime: number;
  cacheHitRate: number;
  issuesByCategory: Record<ComplianceCategory, number>;
  issuesByPlatform: Record<Platform, number>;
  issuesBySeverity: Record<string, number>;
  lastUpdated: Date;
}

export interface ValidationRequest {
  platform: Platform;
  buildPath: string;
  metadata: Partial<AppMetadata>;
  config?: Partial<ComplianceConfig>;
  includeReports?: boolean;
  generateFixes?: boolean;
}

export interface ValidationResponse {
  success: boolean;
  report?: ComplianceReport;
  results: ValidationResult[];
  metrics?: ComplianceMetrics;
  error?: string;
  executionTime: number;
}

export interface AppStoreConfig {
  ios: {
    appStoreConnect: {
      apiKey: string;
      issuerId: string;
      keyId: string;
    };
    teamId: string;
    bundleId: string;
  };
  android: {
    playStore: {
      serviceAccountKey: string;
      packageName: string;
    };
    signingConfig?: {
      keystorePath: string;
      keystorePassword: string;
      keyAlias: string;
      keyPassword: string;
    };
  };
}

// API Gateway Integration Types
export interface ComplianceAPIRequest {
  action: 'validate' | 'report' | 'config' | 'health';
  platform: Platform;
  buildInfo?: BuildInfo;
  metadata?: Partial<AppMetadata>;
  config?: Partial<ComplianceConfig>;
  reportId?: string;
}

export interface ComplianceAPIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: Date;
    version: string;
    executionTime: number;
  };
}

// Event Types for Integration
export interface ComplianceEvent {
  type: 'validation_started' | 'validation_completed' | 'issue_detected' | 'report_generated';
  platform: Platform;
  reportId: string;
  data: any;
  timestamp: Date;
}

export interface WebhookPayload {
  event: ComplianceEvent;
  report: ComplianceReport;
  metadata: {
    source: string;
    version: string;
    environment: string;
  };
}