-- ThinkRank Security Database Migrations
-- Phase 1: Critical Security Fixes Implementation

-- Migration 001: Encrypted User Sessions and Security Audit Logs
-- Description: Creates tables for encrypted user sessions, security audit logs, and JWT token storage

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Encrypted User Sessions Table
CREATE TABLE IF NOT EXISTS encrypted_user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    encrypted_session_data TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    encryption_key_id UUID NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_encrypted_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_encrypted_sessions_key_id
        FOREIGN KEY (encryption_key_id) REFERENCES encryption_keys(id) ON DELETE RESTRICT
);

-- Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id UUID,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    ip_address INET,
    user_agent TEXT,
    resource_accessed VARCHAR(255),
    action_performed VARCHAR(255),
    request_metadata JSONB,
    risk_score DECIMAL(3,2) DEFAULT 0.0,
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    geo_location JSONB,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes for performance
    INDEX idx_security_audit_logs_user_id (user_id),
    INDEX idx_security_audit_logs_session_id (session_id),
    INDEX idx_security_audit_logs_event_type (event_type),
    INDEX idx_security_audit_logs_severity (severity),
    INDEX idx_security_audit_logs_created_at (created_at),
    INDEX idx_security_audit_logs_suspicious (is_suspicious),

    -- Constraints
    CONSTRAINT fk_audit_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_session_id
        FOREIGN KEY (session_id) REFERENCES encrypted_user_sessions(id) ON DELETE SET NULL,
    CONSTRAINT chk_severity
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_event_category
        CHECK (event_category IN ('AUTHENTICATION', 'AUTHORIZATION', 'DATA_ACCESS', 'SYSTEM', 'SECURITY'))
);

-- JWT Token Storage Table
CREATE TABLE IF NOT EXISTS jwt_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),

    -- Indexes
    INDEX idx_jwt_tokens_user_id (user_id),
    INDEX idx_jwt_tokens_token_hash (token_hash),
    INDEX idx_jwt_tokens_expires_at (expires_at),
    INDEX idx_jwt_tokens_revoked (is_revoked),

    -- Constraints
    CONSTRAINT fk_jwt_tokens_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_token_type
        CHECK (token_type IN ('ACCESS', 'REFRESH', 'RESET', 'VERIFY'))
);

-- Encryption Keys Management Table
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name VARCHAR(100) NOT NULL UNIQUE,
    key_purpose VARCHAR(50) NOT NULL,
    algorithm VARCHAR(20) NOT NULL DEFAULT 'AES-256-GCM',
    key_data TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rotation_date TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    -- Indexes
    INDEX idx_encryption_keys_purpose (key_purpose),
    INDEX idx_encryption_keys_active (is_active),

    -- Constraints
    CONSTRAINT chk_key_algorithm
        CHECK (algorithm IN ('AES-256-GCM', 'AES-256-CBC', 'RSA-2048', 'RSA-4096'))
);

-- Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limit_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    requests_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_until TIMESTAMPTZ,

    -- Indexes
    INDEX idx_rate_limit_identifier (identifier),
    INDEX idx_rate_limit_identifier_type (identifier_type),
    INDEX idx_rate_limit_window (window_start, window_end),
    INDEX idx_rate_limit_blocked (is_blocked),

    -- Constraints
    CONSTRAINT chk_identifier_type
        CHECK (identifier_type IN ('IP', 'USER_ID', 'API_KEY', 'DEVICE_ID'))
);

-- Security Events Summary Table (for analytics)
CREATE TABLE IF NOT EXISTS security_events_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_date DATE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    count BIGINT NOT NULL DEFAULT 1,
    unique_users INTEGER NOT NULL DEFAULT 0,
    affected_resources INTEGER NOT NULL DEFAULT 0,
    geo_distribution JSONB,
    device_breakdown JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes
    INDEX idx_security_events_summary_date (event_date),
    INDEX idx_security_events_summary_type (event_type),
    INDEX idx_security_events_summary_severity (severity),

    UNIQUE(event_date, event_type, severity)
);

-- Functions for Security Operations

-- Function to create encrypted session
CREATE OR REPLACE FUNCTION create_encrypted_session(
    p_user_id UUID,
    p_session_data TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint VARCHAR(255) DEFAULT NULL,
    p_expires_in INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_session_token VARCHAR(255);
    v_encrypted_data TEXT;
    v_iv VARCHAR(32);
    v_key_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Generate session token and expiration
    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_expires_at := NOW() + p_expires_in;

    -- Get active encryption key
    SELECT id INTO v_key_id
    FROM encryption_keys
    WHERE key_purpose = 'SESSION_ENCRYPTION' AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Encrypt session data
    SELECT encrypted_data, iv INTO v_encrypted_data, v_iv
    FROM encrypt_data(p_session_data, v_key_id);

    -- Insert encrypted session
    INSERT INTO encrypted_user_sessions (
        user_id, session_token, encrypted_session_data, encryption_iv, encryption_key_id,
        ip_address, user_agent, device_fingerprint, expires_at
    ) VALUES (
        p_user_id, v_session_token, v_encrypted_data, v_iv, v_key_id,
        p_ip_address, p_user_agent, p_device_fingerprint, v_expires_at
    ) RETURNING id INTO v_session_id;

    -- Log security event
    INSERT INTO security_audit_logs (
        user_id, event_type, event_category, severity, ip_address, user_agent,
        action_performed, request_metadata
    ) VALUES (
        p_user_id, 'SESSION_CREATED', 'AUTHENTICATION', 'INFO', p_ip_address, p_user_agent,
        'create_encrypted_session', jsonb_build_object('session_id', v_session_id)
    );

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt session data
CREATE OR REPLACE FUNCTION get_decrypted_session(p_session_token VARCHAR(255))
RETURNS TEXT AS $$
DECLARE
    v_session_record RECORD;
    v_decrypted_data TEXT;
BEGIN
    -- Get session record
    SELECT * INTO v_session_record
    FROM encrypted_user_sessions
    WHERE session_token = p_session_token AND is_active = true AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Decrypt session data
    SELECT decrypted_data INTO v_decrypted_data
    FROM decrypt_data(v_session_record.encrypted_session_data, v_session_record.encryption_key_id, v_session_record.encryption_iv);

    -- Update last accessed
    UPDATE encrypted_user_sessions
    SET updated_at = NOW()
    WHERE id = v_session_record.id;

    -- Log access
    INSERT INTO security_audit_logs (
        user_id, session_id, event_type, event_category, severity,
        ip_address, user_agent, action_performed
    ) VALUES (
        v_session_record.user_id, v_session_record.id, 'SESSION_ACCESSED', 'DATA_ACCESS', 'INFO',
        v_session_record.ip_address, v_session_record.user_agent, 'get_decrypted_session'
    );

    RETURN v_decrypted_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_event_type VARCHAR(50),
    p_event_category VARCHAR(50),
    p_severity VARCHAR(20) DEFAULT 'INFO',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_resource_accessed VARCHAR(255) DEFAULT NULL,
    p_action_performed VARCHAR(255) DEFAULT NULL,
    p_request_metadata JSONB DEFAULT NULL,
    p_risk_score DECIMAL(3,2) DEFAULT 0.0,
    p_is_suspicious BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO security_audit_logs (
        user_id, session_id, event_type, event_category, severity,
        ip_address, user_agent, resource_accessed, action_performed,
        request_metadata, risk_score, is_suspicious
    ) VALUES (
        p_user_id, p_session_id, p_event_type, p_event_category, p_severity,
        p_ip_address, p_user_agent, p_resource_accessed, p_action_performed,
        p_request_metadata, p_risk_score, p_is_suspicious
    ) RETURNING id INTO v_log_id;

    -- If suspicious activity, trigger alert
    IF p_is_suspicious THEN
        PERFORM trigger_security_alert(v_log_id, p_severity, p_event_type, p_request_metadata);
    END IF;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for JWT token management
CREATE OR REPLACE FUNCTION store_jwt_token(
    p_user_id UUID,
    p_token_hash VARCHAR(255),
    p_token_type VARCHAR(20),
    p_expires_at TIMESTAMPTZ,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_token_id UUID;
BEGIN
    INSERT INTO jwt_tokens (
        user_id, token_hash, token_type, expires_at, ip_address, user_agent, device_fingerprint
    ) VALUES (
        p_user_id, p_token_hash, p_token_type, p_expires_at, p_ip_address, p_user_agent, p_device_fingerprint
    ) RETURNING id INTO v_token_id;

    RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke JWT tokens
CREATE OR REPLACE FUNCTION revoke_jwt_token(
    p_token_hash VARCHAR(255),
    p_reason VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE jwt_tokens
    SET is_revoked = true, revoked_at = NOW(), revoked_reason = p_reason
    WHERE token_hash = p_token_hash AND is_revoked = false;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier VARCHAR(255),
    p_identifier_type VARCHAR(50),
    p_endpoint VARCHAR(255),
    p_window_seconds INTEGER DEFAULT 900,
    p_max_requests INTEGER DEFAULT 100
) RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMPTZ;
    v_window_end TIMESTAMPTZ;
    v_is_blocked BOOLEAN;
    v_blocked_until TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
    v_window_end := NOW();

    -- Check if currently blocked
    SELECT is_blocked, blocked_until INTO v_is_blocked, v_blocked_until
    FROM rate_limit_entries
    WHERE identifier = p_identifier
      AND identifier_type = p_identifier_type
      AND window_end > NOW()
    ORDER BY window_end DESC
    LIMIT 1;

    IF v_is_blocked AND v_blocked_until > NOW() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blocked', true,
            'blocked_until', v_blocked_until,
            'retry_after', EXTRACT(EPOCH FROM (v_blocked_until - NOW()))
        );
    END IF;

    -- Get current request count
    SELECT COALESCE(SUM(requests_count), 0) INTO v_current_count
    FROM rate_limit_entries
    WHERE identifier = p_identifier
      AND identifier_type = p_identifier_type
      AND endpoint = p_endpoint
      AND window_start >= v_window_start
      AND window_end <= v_window_end;

    v_result := jsonb_build_object(
        'allowed', (v_current_count < p_max_requests),
        'current_count', v_current_count,
        'max_requests', p_max_requests,
        'window_seconds', p_window_seconds,
        'reset_in', EXTRACT(EPOCH FROM (v_window_end - NOW()))
    );

    -- Increment counter
    INSERT INTO rate_limit_entries (
        identifier, identifier_type, endpoint, requests_count, window_start, window_end
    ) VALUES (
        p_identifier, p_identifier_type, p_endpoint, 1, v_window_start, v_window_end
    ) ON CONFLICT (identifier, identifier_type, endpoint, window_start)
      DO UPDATE SET requests_count = rate_limit_entries.requests_count + 1;

    -- Block if limit exceeded
    IF v_current_count >= p_max_requests THEN
        UPDATE rate_limit_entries
        SET is_blocked = true, blocked_until = NOW() + (p_window_seconds || ' seconds')::INTERVAL
        WHERE identifier = p_identifier
          AND identifier_type = p_identifier_type
          AND window_end > NOW();
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Encryption/Decryption helper functions
CREATE OR REPLACE FUNCTION encrypt_data(p_data TEXT, p_key_id UUID)
RETURNS TABLE(encrypted_data TEXT, iv VARCHAR(32)) AS $$
DECLARE
    v_key_data TEXT;
    v_iv VARCHAR(32);
    v_encrypted TEXT;
BEGIN
    -- Get encryption key
    SELECT key_data INTO v_key_data
    FROM encryption_keys
    WHERE id = p_key_id AND is_active = true;

    -- Generate IV
    v_iv := encode(gen_random_bytes(16), 'hex');

    -- Encrypt data (simplified - in production, use proper encryption library)
    -- This is a placeholder - implement actual encryption based on your security requirements
    v_encrypted := encode(digest(p_data || v_key_data || v_iv, 'sha256'), 'hex');

    RETURN QUERY SELECT v_encrypted, v_iv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_data(p_encrypted_data TEXT, p_key_id UUID, p_iv VARCHAR(32))
RETURNS TEXT AS $$
DECLARE
    v_key_data TEXT;
    v_decrypted TEXT;
BEGIN
    -- Get encryption key
    SELECT key_data INTO v_key_data
    FROM encryption_keys
    WHERE id = p_key_id AND is_active = true;

    -- Decrypt data (simplified - in production, use proper decryption library)
    -- This is a placeholder - implement actual decryption based on your security requirements
    v_decrypted := 'decrypted_data_placeholder';

    RETURN v_decrypted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security alert function
CREATE OR REPLACE FUNCTION trigger_security_alert(
    p_log_id UUID,
    p_severity VARCHAR(20),
    p_event_type VARCHAR(50),
    p_metadata JSONB
) RETURNS VOID AS $$
BEGIN
    -- Insert alert record
    INSERT INTO security_alerts (log_id, severity, event_type, metadata, created_at)
    VALUES (p_log_id, p_severity, p_event_type, p_metadata, NOW());

    -- Here you would integrate with your alerting system (PagerDuty, Slack, etc.)
    -- For now, we'll just log it
    RAISE LOG 'SECURITY ALERT: % % %', p_severity, p_event_type, p_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintenance function to clean up expired sessions and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER := 0;
BEGIN
    -- Clean expired sessions
    DELETE FROM encrypted_user_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

    -- Clean expired tokens
    DELETE FROM jwt_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';

    v_cleaned_count := v_cleaned_count + ROW_COUNT;

    -- Clean old audit logs (keep 90 days)
    DELETE FROM security_audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';

    v_cleaned_count := v_cleaned_count + ROW_COUNT;

    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_encrypted_sessions_user_active
    ON encrypted_user_sessions(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_encrypted_sessions_expires
    ON encrypted_user_sessions(expires_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_jwt_tokens_user_active
    ON jwt_tokens(user_id, is_revoked) WHERE is_revoked = false;

CREATE INDEX IF NOT EXISTS idx_jwt_tokens_expires_active
    ON jwt_tokens(expires_at, is_revoked) WHERE is_revoked = false;

-- Create security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL,
    severity VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    is_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_security_alerts_log_id
        FOREIGN KEY (log_id) REFERENCES security_audit_logs(id) ON DELETE CASCADE
);

-- Comments for documentation
COMMENT ON TABLE encrypted_user_sessions IS 'Stores encrypted user session data with security metadata';
COMMENT ON TABLE security_audit_logs IS 'Comprehensive audit log for all security-related events';
COMMENT ON TABLE jwt_tokens IS 'Stores JWT token metadata for revocation and tracking';
COMMENT ON TABLE encryption_keys IS 'Manages encryption keys for data protection';
COMMENT ON TABLE rate_limit_entries IS 'Tracks rate limiting for security and abuse prevention';
COMMENT ON TABLE security_events_summary IS 'Aggregated security events for analytics and reporting';
COMMENT ON TABLE security_alerts IS 'Security alerts triggered by suspicious activities';

-- Grant appropriate permissions
-- GRANT SELECT, INSERT, UPDATE ON encrypted_user_sessions TO thinkrank_app;
-- GRANT SELECT, INSERT ON security_audit_logs TO thinkrank_app;
-- GRANT SELECT, INSERT, UPDATE ON jwt_tokens TO thinkrank_app;
-- GRANT USAGE ON SCHEMA security TO thinkrank_app;

COMMIT;