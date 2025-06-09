-- ThinkRank Database Schema - Initial Migration
-- This migration creates all core tables for the ThinkRank application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'pro');
CREATE TYPE problem_type AS ENUM ('bias_detection', 'alignment', 'context_evaluation');
CREATE TYPE validation_status AS ENUM ('pending', 'validated', 'rejected');
CREATE TYPE social_interaction_type AS ENUM ('like', 'comment', 'share', 'follow');

-- Users table - Core user information and authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier subscription_tier DEFAULT 'free',
    profile_data JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table - Subscription management
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier_type subscription_tier NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    auto_renewal BOOLEAN DEFAULT false,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game progress table - Player progression and achievements
CREATE TABLE game_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 1,
    total_score BIGINT DEFAULT 0,
    experience_points BIGINT DEFAULT 0,
    completed_challenges JSONB DEFAULT '[]',
    skill_assessments JSONB DEFAULT '{}',
    achievements JSONB DEFAULT '[]',
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- AI Research Problems table - Research problems from institutions
CREATE TABLE ai_research_problems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id VARCHAR(255) UNIQUE NOT NULL,
    institution_id VARCHAR(255),
    institution_name VARCHAR(255),
    problem_type problem_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 10),
    problem_data JSONB NOT NULL,
    validation_criteria JSONB NOT NULL,
    expected_solution_format JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    total_contributions INTEGER DEFAULT 0,
    quality_threshold DECIMAL(3,2) DEFAULT 0.7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Research Contributions table - User submissions to research problems
CREATE TABLE research_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contribution_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES ai_research_problems(id) ON DELETE CASCADE,
    solution_data JSONB NOT NULL,
    validation_status validation_status DEFAULT 'pending',
    quality_score DECIMAL(3,2) CHECK (quality_score BETWEEN 0 AND 1),
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    time_spent_seconds INTEGER,
    submission_method VARCHAR(50) DEFAULT 'game',
    peer_reviews JSONB DEFAULT '[]',
    research_impact JSONB DEFAULT '{}',
    feedback_received JSONB DEFAULT '{}',
    points_awarded INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Interactions table - Social features and interactions
CREATE TABLE social_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interaction_type social_interaction_type NOT NULL,
    target_type VARCHAR(50), -- 'user', 'achievement', 'contribution', etc.
    target_id UUID,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate interactions for certain types
    UNIQUE(user_id, target_user_id, interaction_type, target_type, target_id)
);

-- Game Sessions table - Individual game sessions for analytics
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    problems_attempted INTEGER DEFAULT 0,
    problems_completed INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    average_response_time DECIMAL(6,2),
    platform VARCHAR(50), -- 'ios', 'android'
    app_version VARCHAR(20),
    device_info JSONB DEFAULT '{}',
    session_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Events table - General analytics and tracking
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    platform VARCHAR(20),
    app_version VARCHAR(20),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_game_progress_user_id ON game_progress(user_id);
CREATE INDEX idx_game_progress_level ON game_progress(level);
CREATE INDEX idx_game_progress_total_score ON game_progress(total_score);
CREATE INDEX idx_game_progress_last_activity ON game_progress(last_activity);

CREATE INDEX idx_ai_research_problems_problem_type ON ai_research_problems(problem_type);
CREATE INDEX idx_ai_research_problems_difficulty_level ON ai_research_problems(difficulty_level);
CREATE INDEX idx_ai_research_problems_active ON ai_research_problems(active);
CREATE INDEX idx_ai_research_problems_created_at ON ai_research_problems(created_at);

CREATE INDEX idx_research_contributions_user_id ON research_contributions(user_id);
CREATE INDEX idx_research_contributions_problem_id ON research_contributions(problem_id);
CREATE INDEX idx_research_contributions_validation_status ON research_contributions(validation_status);
CREATE INDEX idx_research_contributions_quality_score ON research_contributions(quality_score);
CREATE INDEX idx_research_contributions_submitted_at ON research_contributions(submitted_at);

CREATE INDEX idx_social_interactions_user_id ON social_interactions(user_id);
CREATE INDEX idx_social_interactions_target_user_id ON social_interactions(target_user_id);
CREATE INDEX idx_social_interactions_interaction_type ON social_interactions(interaction_type);
CREATE INDEX idx_social_interactions_created_at ON social_interactions(created_at);

CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_start_time ON game_sessions(start_time);
CREATE INDEX idx_game_sessions_platform ON game_sessions(platform);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_progress_updated_at BEFORE UPDATE ON game_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_research_problems_updated_at BEFORE UPDATE ON ai_research_problems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_research_contributions_updated_at BEFORE UPDATE ON research_contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for data protection
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic user data access)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own game progress" ON game_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own game progress" ON game_progress FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own contributions" ON research_contributions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own contributions" ON research_contributions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own social interactions" ON social_interactions FOR SELECT USING (user_id = auth.uid() OR target_user_id = auth.uid());
CREATE POLICY "Users can insert own social interactions" ON social_interactions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own sessions" ON game_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sessions" ON game_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sessions" ON game_sessions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own analytics events" ON analytics_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own analytics events" ON analytics_events FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow public read access to research problems (they're not user-specific)
CREATE POLICY "Anyone can view active research problems" ON ai_research_problems FOR SELECT USING (active = true);
