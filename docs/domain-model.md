# ThinkRank Domain Model - Security-First Architecture

## Core Domain Entities

### 1. User Entity
**Primary Entity**: Central authentication and user management
```typescript
interface User {
  id: string;                    // UUID primary key
  email: string;                 // Unique email address
  username: string;              // Unique username
  password_hash: string;         // bcrypt hashed password
  subscription_tier: SubscriptionTier; // free, premium, enterprise
  profile_data: UserProfile;     // Extended profile information
  preferences: UserPreferences;  // User settings and preferences
  is_active: boolean;            // Account status flag
  email_verified: boolean;       // Email verification status
  last_login_at?: Date;         // Last successful login
  created_at: Date;             // Account creation timestamp
  updated_at: Date;             // Last profile update
}
```

### 2. Authentication Session Entity
**Security Entity**: Manages user authentication state
```typescript
interface AuthSession {
  id: string;                    // UUID primary key
  user_id: string;              // Foreign key to User
  refresh_token_id: string;     // Token identifier for blacklisting
  device_info: DeviceInfo;      // Device fingerprint
  ip_address: string;           // Login IP address
  location?: GeoLocation;       // Geographic location data
  is_active: boolean;           // Session validity flag
  expires_at: Date;             // Session expiration time
  last_activity: Date;          // Last API activity timestamp
  created_at: Date;             // Session creation time
}
```

### 3. JWT Token Entity
**Security Entity**: Cryptographic token management
```typescript
interface JwtToken {
  token_id: string;             // Unique token identifier
  user_id: string;              // Token owner
  token_type: TokenType;        // access | refresh
  algorithm: CryptoAlgorithm;   // RS256 | ES256
  key_id: string;               // Reference to signing key
  payload: TokenPayload;        // JWT claims
  issued_at: Date;              // Token issuance time
  expires_at: Date;             // Token expiration time
  is_revoked: boolean;          // Revocation flag
  revoked_at?: Date;            // Revocation timestamp
  revoked_reason?: RevocationReason; // Reason for revocation
}
```

### 4. Security Audit Event Entity
**Security Entity**: Immutable security event logging
```typescript
interface SecurityAuditEvent {
  id: string;                   // UUID primary key
  event_id: string;             // Unique event identifier
  user_id?: string;             // Associated user (if applicable)
  session_id?: string;          // Associated session
  event_type: AuditEventType;   // login, logout, token_refresh, etc.
  event_category: AuditCategory; // authentication, authorization, etc.
  severity: SecurityLevel;      // low, medium, high, critical
  ip_address: string;           // Source IP address
  user_agent?: string;          // Client user agent
  location?: GeoLocation;       // Geographic location
  resource?: string;            // Affected resource/endpoint
  action: string;               // Action performed
  result: AuditResult;          // success | failure | error
  details: AuditDetails;        // Structured event details
  risk_score?: number;          // Calculated security risk (0-100)
  timestamp: Date;              // Immutable event timestamp
  signature: string;            // Cryptographic proof of integrity
}
```

## Domain Relationships

### User Relationships
```
User (1) ──── (many) AuthSession
User (1) ──── (many) SecurityAuditEvent
User (1) ──── (many) JwtToken
User (1) ──── (1) UserProfile
User (1) ──── (1) UserPreferences
```

### Session Relationships
```
AuthSession (1) ──── (many) SecurityAuditEvent
AuthSession (1) ──── (1) User
AuthSession (1) ──── (1) DeviceInfo
```

### Token Relationships
```
JwtToken (1) ──── (1) User
JwtToken (many) ──── (1) CryptoKey
JwtToken (many) ──── (many) SecurityAuditEvent
```

## Data Structures and Types

### Core Data Types
```typescript
// Subscription tiers
enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// Token types
enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

// Cryptographic algorithms
enum CryptoAlgorithm {
  RS256 = 'RS256',
  ES256 = 'ES256',
  HS256 = 'HS256'  // Legacy only
}

// Audit event types
enum AuditEventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_REGISTER = 'user_register',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKE = 'token_revoke',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

// Security levels
enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Complex Data Structures
```typescript
// User profile data
interface UserProfile {
  display_name: string;
  avatar_url?: string;
  bio?: string;
  date_of_birth?: Date;
  timezone: string;
  language: string;
  social_links?: SocialLinks;
  custom_fields?: Record<string, any>;
}

// User preferences
interface UserPreferences {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  gameplay: GameplaySettings;
  accessibility: AccessibilitySettings;
}

// Device information
interface DeviceInfo {
  device_id: string;
  device_type: DeviceType;     // mobile, tablet, desktop
  os_name: string;             // iOS, Android, Windows, etc.
  os_version: string;
  app_version: string;
  device_fingerprint: string;  // Hash of device characteristics
}

// Geographic location
interface GeoLocation {
  country_code: string;
  country_name: string;
  region?: string;
  city?: string;
  coordinates?: Coordinates;
  timezone: string;
  isp?: string;
}

// Audit event details
interface AuditDetails {
  user_agent?: string;
  request_headers?: Record<string, string>;
  request_body?: any;
  response_status?: number;
  error_message?: string;
  metadata?: Record<string, any>;
  risk_factors?: RiskFactor[];
}

// Risk factors for security scoring
interface RiskFactor {
  factor_type: RiskType;
  severity: SecurityLevel;
  description: string;
  confidence: number;  // 0-1
  indicators: string[];
}
```

## Domain Services

### 1. Authentication Service
**Responsibility**: Core authentication business logic
```typescript
interface IAuthenticationService {
  // User lifecycle management
  registerUser(request: RegisterUserRequest): Promise<UserRegistrationResult>;
  authenticateUser(request: LoginRequest): Promise<AuthenticationResult>;
  refreshUserSession(request: RefreshTokenRequest): Promise<TokenRefreshResult>;

  // Password management
  changeUserPassword(request: ChangePasswordRequest): Promise<void>;
  resetUserPassword(request: PasswordResetRequest): Promise<void>;
  validatePasswordStrength(password: string): Promise<PasswordValidationResult>;

  // Session management
  revokeUserSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  getActiveUserSessions(userId: string): Promise<AuthSession[]>;

  // Security monitoring
  detectSuspiciousActivity(userId: string): Promise<SecurityAlert[]>;
  calculateUserRiskScore(userId: string): Promise<RiskAssessment>;
}
```

### 2. Token Management Service
**Responsibility**: JWT token lifecycle and validation
```typescript
interface ITokenManagementService {
  // Token generation
  generateAccessToken(user: User, session: AuthSession): Promise<JwtToken>;
  generateRefreshToken(user: User, session: AuthSession): Promise<JwtToken>;

  // Token validation
  validateAccessToken(token: string): Promise<TokenValidationResult>;
  validateRefreshToken(token: string): Promise<TokenValidationResult>;

  // Token lifecycle
  revokeToken(tokenId: string): Promise<void>;
  revokeUserTokens(userId: string): Promise<void>;
  cleanupExpiredTokens(): Promise<number>;

  // Key management
  rotateSigningKeys(): Promise<KeyRotationResult>;
  getCurrentSigningKey(): Promise<CryptoKey>;
  getKeyById(keyId: string): Promise<CryptoKey>;
}
```

### 3. Security Audit Service
**Responsibility**: Security event logging and analysis
```typescript
interface ISecurityAuditService {
  // Event logging
  logSecurityEvent(event: SecurityAuditEvent): Promise<void>;
  logAuthenticationEvent(userId: string, eventType: AuditEventType, result: AuditResult): Promise<void>;

  // Event querying
  getUserAuditEvents(userId: string, filters: AuditFilter): Promise<SecurityAuditEvent[]>;
  getSecurityEventsByRisk(minRiskScore: number): Promise<SecurityAuditEvent[]>;
  getFailedAuthenticationEvents(timeRange: TimeRange): Promise<SecurityAuditEvent[]>;

  // Security analysis
  analyzeUserBehavior(userId: string): Promise<BehaviorAnalysis>;
  detectAnomalousActivity(userId: string): Promise<AnomalyDetectionResult>;
  generateSecurityReport(userId: string, period: ReportPeriod): Promise<SecurityReport>;
}
```

### 4. User Management Service
**Responsibility**: User profile and preference management
```typescript
interface IUserManagementService {
  // Profile management
  getUserProfile(userId: string): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: ProfileUpdate): Promise<UserProfile>;
  deleteUserAccount(userId: string, passwordConfirmation: string): Promise<void>;

  // Preference management
  getUserPreferences(userId: string): Promise<UserPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void>;

  // Account verification
  verifyUserEmail(userId: string, token: string): Promise<void>;
  resendVerificationEmail(userId: string): Promise<void>;

  // Account status
  activateUserAccount(userId: string): Promise<void>;
  deactivateUserAccount(userId: string): Promise<void>;
  suspendUserAccount(userId: string, reason: string): Promise<void>;
}
```

## Domain Events and State Transitions

### Authentication Events
```typescript
// Authentication state machine
enum AuthenticationState {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  TOKEN_REFRESHING = 'token_refreshing',
  AUTHENTICATION_FAILED = 'authentication_failed',
  LOGGED_OUT = 'logged_out'
}

// State transitions
interface AuthenticationStateTransition {
  from_state: AuthenticationState;
  to_state: AuthenticationState;
  trigger: AuthenticationTrigger;
  conditions: TransitionCondition[];
  actions: TransitionAction[];
}

// Transition triggers
enum AuthenticationTrigger {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_EXPIRED = 'token_expired',
  LOGOUT = 'logout',
  SESSION_TIMEOUT = 'session_timeout'
}
```

### Security Event Flow
```typescript
// Security event processing pipeline
interface SecurityEventPipeline {
  event_ingestion: EventIngestionStage;
  event_validation: EventValidationStage;
  risk_assessment: RiskAssessmentStage;
  event_storage: EventStorageStage;
  alert_generation: AlertGenerationStage;
  response_coordination: ResponseCoordinationStage;
}

// Event processing stages
interface EventIngestionStage {
  receiveRawEvent(rawEvent: any): Promise<NormalizedEvent>;
  validateEventFormat(event: any): Promise<boolean>;
  normalizeEventData(event: any): Promise<NormalizedEvent>;
}

interface RiskAssessmentStage {
  calculateEventRisk(event: NormalizedEvent): Promise<number>;
  identifyRiskFactors(event: NormalizedEvent): Promise<RiskFactor[]>;
  correlateWithHistoricalData(event: NormalizedEvent): Promise<CorrelationResult>;
}
```

## Domain Invariants and Business Rules

### Authentication Invariants
- **AI-001**: User must have exactly one active session per device
- **AI-002**: Access tokens must expire within 15 minutes maximum
- **AI-003**: Refresh tokens must expire within 30 days maximum
- **AI-004**: Password hashes must use bcrypt with salt rounds >= 12
- **AI-005**: Failed login attempts must be rate limited per user/IP

### Security Invariants
- **SI-001**: All security events must be immutably logged
- **SI-002**: Audit log integrity must be cryptographically verifiable
- **SI-003**: Security event timestamps must be monotonically increasing
- **SI-004**: Risk scores must be calculated consistently across events
- **SI-005**: Security alerts must trigger within 60 seconds of detection

### Data Consistency Rules
- **DC-001**: User profile updates must be atomic transactions
- **DC-002**: Session state changes must be immediately reflected
- **DC-003**: Token revocation must cascade to all user sessions
- **DC-004**: Audit events must maintain referential integrity
- **DC-005**: Security metrics must be calculated in real-time

## Query Models and Read Patterns

### Authentication Queries
```typescript
interface AuthenticationQueries {
  // User queries
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(userId: string): Promise<User | null>;
  findActiveUserSessions(userId: string): Promise<AuthSession[]>;

  // Token queries
  findValidAccessToken(tokenId: string): Promise<JwtToken | null>;
  findValidRefreshToken(tokenId: string): Promise<JwtToken | null>;
  findTokensByUser(userId: string): Promise<JwtToken[]>;

  // Security queries
  findRecentSecurityEvents(userId: string, hours: number): Promise<SecurityAuditEvent[]>;
  findFailedLoginsByIP(ipAddress: string, timeframe: TimeRange): Promise<SecurityAuditEvent[]>;
  findSuspiciousActivityPatterns(userId: string): Promise<SuspiciousActivity[]>;
}
```

### Security Analytics Queries
```typescript
interface SecurityAnalyticsQueries {
  // Risk analysis
  calculateUserRiskScore(userId: string, timeRange: TimeRange): Promise<RiskScore>;
  identifyAnomalousLoginPatterns(userId: string): Promise<AnomalyPattern[]>;

  // Threat intelligence
  getTopRiskyIPAddresses(limit: number): Promise<RiskyIP[]>;
  getMostActiveThreatActors(timeRange: TimeRange): Promise<ThreatActor[]>;

  // Compliance reporting
  generateComplianceReport(reportType: ComplianceType): Promise<ComplianceReport>;
  getAuditTrailForUser(userId: string, timeRange: TimeRange): Promise<AuditTrail>;
}
```

## Domain Validation Rules

### User Validation
```typescript
interface UserValidationRules {
  email: {
    required: true;
    format: 'email';
    unique: true;
    maxLength: 254;
  };
  username: {
    required: true;
    format: 'alphanumeric';
    minLength: 3;
    maxLength: 30;
    unique: true;
  };
  password: {
    required: true;
    minLength: 12;
    complexity: {
      uppercase: true;
      lowercase: true;
      numbers: true;
      specialChars: true;
    };
  };
}
```

### Token Validation
```typescript
interface TokenValidationRules {
  format: {
    header: 'Bearer';
    structure: 'header.payload.signature';
    algorithm: 'RS256';
  };
  claims: {
    required: ['userId', 'email', 'type', 'iat', 'exp'];
    optional: ['scope', 'permissions', 'session_id'];
  };
  expiration: {
    accessToken: { maxAge: '15m' };
    refreshToken: { maxAge: '30d' };
  };
}
```

### Security Validation
```typescript
interface SecurityValidationRules {
  ipAddress: {
    format: 'ipv4|ipv6';
    reputation: 'not_blacklisted';
  };
  userAgent: {
    format: 'browser|mobile|api';
    suspicious: 'not_malicious';
  };
  location: {
    consistency: 'within_reasonable_bounds';
    anomaly: 'not_suspicious';
  };
}
```

## Aggregate Boundaries

### Authentication Aggregate
**Boundary**: Single user authentication session
```typescript
interface AuthenticationAggregate {
  root: User;
  entities: [
    AuthSession[],
    JwtToken[],
    SecurityAuditEvent[]
  ];
  valueObjects: [
    UserProfile,
    UserPreferences,
    DeviceInfo
  ];
  invariants: [
    'Single active session per device',
    'Valid token associations',
    'Complete audit trail'
  ];
}
```

### Security Monitoring Aggregate
**Boundary**: Security events for threat analysis
```typescript
interface SecurityMonitoringAggregate {
  root: SecurityAuditEvent;
  entities: [
    RiskFactor[],
    AnomalyDetectionResult[],
    SecurityAlert[]
  ];
  valueObjects: [
    RiskScore,
    BehaviorAnalysis,
    ThreatIntelligence
  ];
  invariants: [
    'Chronological event ordering',
    'Immutable event records',
    'Consistent risk calculations'
  ];
}
```

## Domain Glossary

**Aggregate Root**: Entity that maintains consistency boundaries and encapsulates business rules
**Value Object**: Immutable object representing a descriptive aspect without identity
**Domain Event**: Something significant that happened in the domain
**Invariant**: Business rule that must always be true
**Entity**: Object with distinct identity that can change over time
**Repository**: Abstraction for data persistence and retrieval
**Factory**: Encapsulates complex object creation logic
**Service**: Stateless operation that implements domain logic
**Policy**: Set of rules that govern domain behavior
**Specification**: Business rule that can be evaluated against objects

## Integration Points

### External System Dependencies
- **Supabase Database**: Primary data persistence
- **Redis Cache**: Session storage and rate limiting
- **Email Service**: User notifications and verification
- **SMS Service**: Multi-factor authentication
- **Threat Intelligence API**: External threat data
- **Geolocation Service**: IP geolocation data
- **Device Detection API**: Device fingerprinting

### Cross-Domain Communication
- **Game Service**: User progress and achievements
- **Social Service**: User interactions and leaderboards
- **Analytics Service**: Usage metrics and reporting
- **AI Research Service**: User research contributions
- **Realtime Service**: Live game sessions and chat

---

*This domain model establishes the foundation for secure, modular authentication architecture with comprehensive audit capabilities and mobile-first performance optimization.*