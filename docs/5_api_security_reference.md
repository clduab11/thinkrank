# 🔐 Security Services API Reference

## Overview

This document provides comprehensive API documentation for ThinkRank's security services, including authentication, token management, security middleware, and configuration services. All security services implement industry-leading security practices with RSA256 JWT tokens, bcrypt password hashing, and comprehensive audit logging.

**Base URL:** `https://api.thinkrank.io/v1`

**Security Features:**
- RSA256 JWT token generation and verification
- bcrypt password hashing with configurable rounds
- Account lockout protection against brute force attacks
- Rate limiting with progressive delays
- Multi-factor authentication (TOTP) support
- Comprehensive security audit logging

## Table of Contents

1. [Authentication Service](#authentication-service)
   - [Register User](#register-user)
   - [Login](#login)
   - [Refresh Token](#refresh-token)
   - [Logout](#logout)
   - [Password Reset](#password-reset)
   - [Two-Factor Authentication](#two-factor-authentication)

2. [Token Management Service](#token-management-service)
   - [Generate Token](#generate-token)
   - [Verify Token](#verify-token)
   - [Revoke Token](#revoke-token)
   - [Token Introspection](#token-introspection)

3. [Security Middleware](#security-middleware)
   - [JWT Authentication Middleware](#jwt-authentication-middleware)
   - [Rate Limiting Middleware](#rate-limiting-middleware)
   - [CORS Configuration](#cors-configuration)
   - [Security Headers](#security-headers)

4. [Configuration Service](#configuration-service)
   - [Get Security Configuration](#get-security-configuration)
   - [Update Security Settings](#update-security-settings)
   - [Validate Configuration](#validate-configuration)

5. [Error Responses](#error-responses)
6. [Security Best Practices](#security-best-practices)

---

## 🔐 Authentication Service

Core authentication service implementing secure user authentication with RSA256 JWT tokens and comprehensive security controls.

### Register User

Creates a new user account with secure password hashing and validation.

**Endpoint:** `POST /auth/register`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

**Response (200):**
```json
{
  "user": {
    "userId": "user_1640995200000_abc123def",
    "email": "user@example.com",
    "role": "user",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Validation Rules:**
- Email: Must be valid email format
- Password: Minimum 8 characters, must contain uppercase, lowercase, and number
- First/Last Name: Minimum 2 characters each
- Role: Optional, defaults to 'user' (allowed: 'user', 'admin', 'moderator')

**Security Features:**
- Password hashed with bcrypt (12 rounds minimum)
- Account automatically activated upon registration
- Audit log entry created for registration event

---

### Login

Authenticates user credentials with comprehensive security controls.

**Endpoint:** `POST /auth/login`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "user": {
    "userId": "user_1640995200000_abc123def",
    "email": "user@example.com",
    "role": "user",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Security Features:**
- Account lockout after 5 failed attempts
- 15-minute lockout duration
- Progressive rate limiting
- Comprehensive audit logging with IP and User-Agent tracking
- Password verification with bcrypt
- Automatic failed attempt counter reset on success

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `423 Locked`: Account temporarily locked due to failed attempts
- `429 Too Many Requests`: Rate limit exceeded

---

### Refresh Token

Generates new access token using valid refresh token.

**Endpoint:** `POST /auth/refresh`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Security Features:**
- Validates refresh token signature and expiration
- Verifies user account is still active
- Generates new access token with fresh expiration
- Maintains security audit trail

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token
- `403 Forbidden`: User account deactivated

---

### Logout

Invalidates user tokens and clears session.

**Endpoint:** `POST /auth/logout`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

**Security Features:**
- Blacklists refresh token to prevent reuse
- Clears server-side session data
- Audit log entry for logout event

---

### Password Reset

Implements secure password reset flow with token-based verification.

**Request Password Reset**

**Endpoint:** `POST /auth/password-reset/request`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset instructions sent to email"
}
```

**Reset Password**

**Endpoint:** `POST /auth/password-reset/confirm`

**Request Body:**
```json
{
  "token": "reset-token-here",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password successfully reset"
}
```

**Security Features:**
- Time-limited reset tokens (1 hour expiration)
- Secure token generation using cryptographically strong random bytes
- Old password invalidation
- Audit logging for all password operations
- Rate limiting on reset requests

---

### Two-Factor Authentication

Implements TOTP-based multi-factor authentication for enhanced security.

**Setup 2FA**

**Endpoint:** `POST /auth/2fa/setup`

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "qrCode": "otpauth://totp/ThinkRank:user@example.com?secret=ABC123&issuer=ThinkRank",
  "secret": "ABC123DEF456GHI789JKL012MNO345PQR678STU901",
  "backupCodes": [
    "1a2b-3c4d",
    "5e6f-7g8h",
    "9i0j-1k2l",
    "3m4n-5o6p",
    "7q8r-9s0t",
    "1u2v-3w4x",
    "5y6z-7a8b",
    "9c0d-1e2f"
  ]
}
```

**Verify 2FA**

**Endpoint:** `POST /auth/2fa/verify`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "2FA successfully enabled"
}
```

**Security Features:**
- TOTP standard implementation with 30-second windows
- 2-window tolerance for clock drift
- Backup codes for account recovery
- Secure secret generation using cryptographically strong random bytes
- Comprehensive audit logging for 2FA events

---

## 🎫 Token Management Service

Manages JWT token lifecycle with RSA256 signing and comprehensive validation.

### Generate Token

Creates signed JWT tokens with configurable expiration and claims.

**Endpoint:** `POST /auth/tokens/generate`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user_1640995200000_abc123def",
  "email": "user@example.com",
  "role": "user",
  "tokenType": "access",
  "customClaims": {
    "permissions": ["read", "write"]
  },
  "expiresIn": "15m"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenId": "token_1640995200000_xyz789"
}
```

**Token Types:**
- `access`: Short-lived token for API access (15 minutes)
- `refresh`: Long-lived token for obtaining new access tokens (30 days)
- `reset`: Password reset token (1 hour)
- `email_verification`: Email verification token (24 hours)

---

### Verify Token

Validates JWT token signature and claims.

**Endpoint:** `POST /auth/tokens/verify`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "valid": true,
  "payload": {
    "userId": "user_1640995200000_abc123def",
    "email": "user@example.com",
    "role": "user",
    "tokenType": "access",
    "iat": 1640995200,
    "exp": 1640996100
  },
  "tokenId": "token_1640995200000_xyz789"
}
```

**Security Features:**
- RSA256 signature verification
- Token expiration validation
- Issuer and audience verification
- Custom claims validation

---

### Revoke Token

Invalidates tokens to prevent unauthorized access.

**Endpoint:** `POST /auth/tokens/revoke`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "tokenId": "token_1640995200000_xyz789",
  "reason": "User requested logout"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token successfully revoked"
}
```

**Security Features:**
- Immediate token blacklist addition
- Cascade revocation for refresh token families
- Audit logging with revocation reason

---

### Token Introspection

Provides detailed token information for debugging and monitoring.

**Endpoint:** `GET /auth/tokens/introspect/{tokenId}`

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "tokenId": "token_1640995200000_xyz789",
  "userId": "user_1640995200000_abc123def",
  "status": "active",
  "issuedAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-01T00:15:00Z",
  "lastUsed": "2024-01-01T00:05:00Z",
  "useCount": 3,
  "ipAddresses": ["192.168.1.100"],
  "userAgents": ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"]
}
```

---

## 🛡️ Security Middleware

Comprehensive security middleware for request protection and validation.

### JWT Authentication Middleware

Validates JWT tokens on protected routes with comprehensive error handling.

```typescript
// Middleware Implementation Example
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token required'
        }
      });
      return;
    }

    // Verify token with TokenManagementService
    const decoded = await tokenService.verifyToken(token);

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired'
        }
      });
    } else if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token'
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication service error'
        }
      });
    }
  }
};
```

**Security Features:**
- Bearer token extraction and validation
- Comprehensive error handling with appropriate HTTP status codes
- User context injection into request object
- Audit logging for all authentication events

---

### Rate Limiting Middleware

Implements progressive rate limiting with Redis-backed counters.

```typescript
// Rate Limiting Configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: {
    authenticated: 1000,
    unauthenticated: 100
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
};
```

**Rate Limiting Strategies:**
- **Global Rate Limiting**: 1000 requests per 15 minutes for authenticated users
- **IP-based Limiting**: 100 requests per 15 minutes for unauthenticated users
- **Progressive Delays**: Increasing delays for repeated violations
- **Redis Storage**: Distributed rate limiting across service instances

---

### CORS Configuration

Secure Cross-Origin Resource Sharing configuration with environment-specific origins.

```typescript
// CORS Configuration
const corsOptions = {
  origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://thinkrank.com',
      'https://www.thinkrank.com'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      const msg = `CORS policy violation: Origin ${origin} not allowed`;
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
};
```

**Security Features:**
- Environment-specific origin validation
- Support for mobile applications (no origin)
- Comprehensive header validation
- Rate limit header exposure for client awareness

---

### Security Headers

Comprehensive security headers for protection against common web vulnerabilities.

```typescript
// Security Headers Middleware
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy for privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (customize based on your needs)
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );

  // HTTP Strict Transport Security (only over HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};
```

**Security Headers Implemented:**
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables XSS filtering
- **Referrer-Policy**: Controls referrer information
- **Content-Security-Policy**: Controls resource loading
- **Strict-Transport-Security**: Enforces HTTPS

---

## ⚙️ Configuration Service

Manages security configuration with environment abstraction and validation.

### Get Security Configuration

Retrieves current security settings and configuration.

**Endpoint:** `GET /auth/config/security`

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200):**
```json
{
  "bcryptRounds": 12,
  "passwordMinLength": 8,
  "maxLoginAttempts": 5,
  "lockoutDurationMinutes": 15,
  "sessionTimeoutMinutes": 60,
  "refreshTokenExpiryDays": 30,
  "requireMfaForAdmins": true,
  "allowedOrigins": [
    "https://thinkrank.com",
    "https://www.thinkrank.com"
  ],
  "rateLimiting": {
    "enabled": true,
    "windowMs": 900000,
    "maxRequests": {
      "authenticated": 1000,
      "unauthenticated": 100
    }
  },
  "securityHeaders": {
    "enabled": true,
    "hsts": {
      "enabled": true,
      "maxAge": 31536000
    }
  }
}
```

**Configuration Categories:**
- **Password Policies**: Strength requirements and hashing configuration
- **Account Security**: Lockout settings and session management
- **Network Security**: CORS, rate limiting, and header configuration
- **Token Management**: Expiration times and security settings

---

### Update Security Settings

Modifies security configuration with validation and audit logging.

**Endpoint:** `PUT /auth/config/security`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "passwordMinLength": 10,
  "maxLoginAttempts": 3,
  "requireMfaForAdmins": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Security configuration updated successfully",
  "updatedSettings": {
    "passwordMinLength": 10,
    "maxLoginAttempts": 3,
    "requireMfaForAdmins": true
  },
  "updatedAt": "2024-01-01T00:00:00Z",
  "updatedBy": "admin_user_id"
}
```

**Validation Rules:**
- All numeric values must be positive integers
- Password minimum length: 6-32 characters
- Maximum login attempts: 3-10 attempts
- Lockout duration: 5-60 minutes
- Session timeout: 15-480 minutes

---

### Validate Configuration

Tests security configuration for potential issues and compliance.

**Endpoint:** `POST /auth/config/validate`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "testPassword": "TestPassword123!",
  "testToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "testOrigin": "https://example.com"
}
```

**Response (200):**
```json
{
  "valid": true,
  "results": {
    "passwordValidation": {
      "passed": true,
      "strength": "strong",
      "requirements": {
        "length": true,
        "uppercase": true,
        "lowercase": true,
        "numbers": true,
        "special": false
      }
    },
    "tokenValidation": {
      "passed": true,
      "expiresIn": 900,
      "algorithm": "RS256"
    },
    "corsValidation": {
      "passed": false,
      "error": "Origin https://example.com not in allowed list"
    }
  },
  "recommendations": [
    "Consider enabling special character requirement for passwords",
    "Review CORS allowed origins list",
    "Consider implementing security monitoring alerts"
  ]
}
```

---

## ❌ Error Responses

Comprehensive error response format with security-focused error codes.

### Error Response Format

```json
{
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid email or password",
    "details": {
      "field": "password",
      "attemptsRemaining": 2,
      "lockoutWarning": false
    },
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_1640995200000_xyz789",
    "path": "/auth/login",
    "method": "POST"
  }
}
```

### Common Security Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `MISSING_TOKEN` | 401 | No authentication token provided |
| `INVALID_TOKEN` | 401 | Malformed or invalid token |
| `TOKEN_EXPIRED` | 401 | Token has exceeded expiration time |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `ACCOUNT_LOCKED` | 423 | Account temporarily locked |
| `ACCOUNT_DISABLED` | 403 | User account deactivated |
| `PASSWORD_TOO_WEAK` | 400 | Password doesn't meet requirements |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INVALID_2FA_CODE` | 401 | Invalid two-factor code |
| `SECURITY_VIOLATION` | 403 | Security policy violation |

---

## 🛡️ Security Best Practices

### For API Consumers

1. **Token Management**
   - Store tokens securely (not in localStorage for web apps)
   - Implement automatic token refresh logic
   - Clear tokens on logout
   - Use HTTPS for all API calls

2. **Error Handling**
   - Don't expose sensitive information in error messages
   - Implement exponential backoff for rate limits
   - Log security events for monitoring

3. **Mobile Applications**
   - Use certificate pinning for enhanced security
   - Implement root/jailbreak detection
   - Secure token storage in KeyStore/Keychain

### For Developers

1. **Environment Security**
   - Never commit secrets to version control
   - Use environment variables for all configuration
   - Implement proper secret rotation
   - Regular security audits and updates

2. **Monitoring & Alerting**
   - Monitor authentication failures
   - Alert on suspicious patterns
   - Track token usage and anomalies
   - Regular security log review

### Security Contact

For security-related inquiries or to report vulnerabilities:
- **Email**: security@thinkrank.com
- **Response Time**: < 24 hours for critical issues
- **Bug Bounty**: Available through HackerOne

---

*This documentation is automatically generated and reflects the current security implementation. Last updated: January 1, 2024*