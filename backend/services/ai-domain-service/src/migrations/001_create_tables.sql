-- AI Domain Service Database Schema
-- Migration 001: Create base tables for event sourcing and aggregates

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table for event sourcing
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    version INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, version)
);

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events (aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type ON events (aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_version ON events (aggregate_id, version);

-- Content generation aggregates snapshot table
CREATE TABLE IF NOT EXISTS content_generation_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version INTEGER NOT NULL DEFAULT 0,
    requests JSONB DEFAULT '{}',
    generated_content JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Indexes for content generation aggregates
CREATE INDEX IF NOT EXISTS idx_content_aggregates_updated_at ON content_generation_aggregates (updated_at);
CREATE INDEX IF NOT EXISTS idx_content_aggregates_active ON content_generation_aggregates (active);

-- Research problem aggregates snapshot table
CREATE TABLE IF NOT EXISTS research_problem_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version INTEGER NOT NULL DEFAULT 0,
    problems JSONB DEFAULT '{}',
    game_transformations JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Indexes for research problem aggregates
CREATE INDEX IF NOT EXISTS idx_research_aggregates_updated_at ON research_problem_aggregates (updated_at);
CREATE INDEX IF NOT EXISTS idx_research_aggregates_active ON research_problem_aggregates (active);

-- AI detection aggregates snapshot table (for future use)
CREATE TABLE IF NOT EXISTS ai_detection_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version INTEGER NOT NULL DEFAULT 0,
    detection_requests JSONB DEFAULT '{}',
    detection_results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Indexes for AI detection aggregates
CREATE INDEX IF NOT EXISTS idx_detection_aggregates_updated_at ON ai_detection_aggregates (updated_at);
CREATE INDEX IF NOT EXISTS idx_detection_aggregates_active ON ai_detection_aggregates (active);

-- Event store optimization: Partition events table by aggregate_type and timestamp
-- This helps with performance for large numbers of events
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events (aggregate_type, timestamp DESC);

-- Read model tables for optimized queries
-- These are updated by event handlers and provide fast read access

-- Content generation read model
CREATE TABLE IF NOT EXISTS content_generation_read_model (
    id UUID PRIMARY KEY,
    request_id VARCHAR(100) NOT NULL,
    content_id VARCHAR(100),
    user_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    topic VARCHAR(200),
    difficulty INTEGER,
    provider VARCHAR(50),
    model VARCHAR(50),
    content_length INTEGER,
    is_valid BOOLEAN,
    validation_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'requested'
);

-- Indexes for content generation read model
CREATE INDEX IF NOT EXISTS idx_content_read_user_id ON content_generation_read_model (user_id);
CREATE INDEX IF NOT EXISTS idx_content_read_type ON content_generation_read_model (content_type);
CREATE INDEX IF NOT EXISTS idx_content_read_status ON content_generation_read_model (status);
CREATE INDEX IF NOT EXISTS idx_content_read_created_at ON content_generation_read_model (created_at DESC);

-- Research problems read model
CREATE TABLE IF NOT EXISTS research_problems_read_model (
    id UUID PRIMARY KEY,
    problem_id VARCHAR(100) NOT NULL UNIQUE,
    institution_id VARCHAR(100) NOT NULL,
    institution_name VARCHAR(200),
    problem_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    difficulty_level INTEGER NOT NULL,
    tags TEXT[],
    active BOOLEAN DEFAULT true,
    total_contributions INTEGER DEFAULT 0,
    quality_threshold DECIMAL(3,2),
    estimated_time INTEGER,
    game_compatible_rapid_fire BOOLEAN DEFAULT false,
    game_compatible_comparison BOOLEAN DEFAULT false,
    game_compatible_ranking BOOLEAN DEFAULT false,
    game_compatible_scenario_based BOOLEAN DEFAULT false,
    game_compatible_pattern_recognition BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for research problems read model
CREATE INDEX IF NOT EXISTS idx_research_read_problem_type ON research_problems_read_model (problem_type);
CREATE INDEX IF NOT EXISTS idx_research_read_difficulty ON research_problems_read_model (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_research_read_institution ON research_problems_read_model (institution_id);
CREATE INDEX IF NOT EXISTS idx_research_read_active ON research_problems_read_model (active);
CREATE INDEX IF NOT EXISTS idx_research_read_tags ON research_problems_read_model USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_research_read_created_at ON research_problems_read_model (created_at DESC);

-- Game transformations read model
CREATE TABLE IF NOT EXISTS game_transformations_read_model (
    id UUID PRIMARY KEY,
    game_problem_id VARCHAR(100) NOT NULL UNIQUE,
    research_problem_id VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    player_level INTEGER NOT NULL,
    time_limit INTEGER,
    score_multiplier DECIMAL(4,2),
    hint_available BOOLEAN DEFAULT false,
    skip_allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (research_problem_id) REFERENCES research_problems_read_model(problem_id)
);

-- Indexes for game transformations read model
CREATE INDEX IF NOT EXISTS idx_game_transform_research_id ON game_transformations_read_model (research_problem_id);
CREATE INDEX IF NOT EXISTS idx_game_transform_game_type ON game_transformations_read_model (game_type);
CREATE INDEX IF NOT EXISTS idx_game_transform_player_level ON game_transformations_read_model (player_level);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_perf_service_operation ON performance_metrics (service_name, operation_name);
CREATE INDEX IF NOT NULL idx_perf_timestamp ON performance_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_perf_success ON performance_metrics (success);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_generation_aggregates_updated_at 
    BEFORE UPDATE ON content_generation_aggregates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_problem_aggregates_updated_at 
    BEFORE UPDATE ON research_problem_aggregates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_detection_aggregates_updated_at 
    BEFORE UPDATE ON ai_detection_aggregates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_generation_read_model_updated_at 
    BEFORE UPDATE ON content_generation_read_model 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_problems_read_model_updated_at 
    BEFORE UPDATE ON research_problems_read_model 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE events IS 'Event store for domain events using event sourcing pattern';
COMMENT ON TABLE content_generation_aggregates IS 'Snapshot table for content generation aggregates';
COMMENT ON TABLE research_problem_aggregates IS 'Snapshot table for research problem aggregates';
COMMENT ON TABLE content_generation_read_model IS 'Optimized read model for content generation queries';
COMMENT ON TABLE research_problems_read_model IS 'Optimized read model for research problem queries';
COMMENT ON TABLE game_transformations_read_model IS 'Read model for game problem transformations';
COMMENT ON TABLE performance_metrics IS 'Performance monitoring and metrics collection';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_domain_service_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_domain_service_user;