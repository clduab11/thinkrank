-- ThinkRank Development Seed Data
-- This file contains sample data for development and testing

-- Insert sample users
INSERT INTO users (id, email, username, password_hash, subscription_tier, profile_data, preferences, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', 'johndoe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'premium', '{"displayName": "John Doe", "avatar": "default", "bio": "AI research enthusiast"}', '{"notifications": true, "privacy": "public", "theme": "dark"}', true),
('550e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', 'janesmith', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'free', '{"displayName": "Jane Smith", "avatar": "default", "bio": "Student researcher"}', '{"notifications": true, "privacy": "friends", "theme": "light"}', true),
('550e8400-e29b-41d4-a716-446655440003', 'alex.wilson@example.com', 'alexwilson', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pro', '{"displayName": "Alex Wilson", "avatar": "default", "bio": "Professional researcher"}', '{"notifications": false, "privacy": "private", "theme": "dark"}', true),
('550e8400-e29b-41d4-a716-446655440004', 'demo.user@example.com', 'demouser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'free', '{"displayName": "Demo User", "avatar": "default", "bio": "Test account for demonstrations"}', '{}', true);

-- Insert sample subscriptions
INSERT INTO subscriptions (user_id, tier_type, start_date, end_date, auto_renewal, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'premium', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', true, 'active'),
('550e8400-e29b-41d4-a716-446655440003', 'pro', NOW() - INTERVAL '60 days', NOW() + INTERVAL '305 days', true, 'active');

-- Insert sample game progress
INSERT INTO game_progress (user_id, level, total_score, experience_points, completed_challenges, skill_assessments, achievements, current_streak, best_streak) VALUES
('550e8400-e29b-41d4-a716-446655440001', 15, 12750, 8500, '["bias_detection_basics", "context_evaluation_intro", "alignment_fundamentals", "advanced_bias_patterns"]', '{"bias_detection": 0.85, "context_evaluation": 0.72, "alignment": 0.68}', '["first_contribution", "streak_master", "accuracy_expert", "community_helper"]', 7, 15),
('550e8400-e29b-41d4-a716-446655440002', 8, 4250, 3200, '["bias_detection_basics", "context_evaluation_intro"]', '{"bias_detection": 0.65, "context_evaluation": 0.58}', '["first_contribution", "beginner_badge"]', 3, 8),
('550e8400-e29b-41d4-a716-446655440003', 22, 18900, 14200, '["bias_detection_basics", "context_evaluation_intro", "alignment_fundamentals", "advanced_bias_patterns", "expert_challenges", "research_collaboration"]', '{"bias_detection": 0.92, "context_evaluation": 0.88, "alignment": 0.85}', '["first_contribution", "streak_master", "accuracy_expert", "community_helper", "research_pioneer", "expert_badge"]', 12, 20),
('550e8400-e29b-41d4-a716-446655440004', 1, 0, 0, '[]', '{}', '[]', 0, 0);

-- Insert sample AI research problems
INSERT INTO ai_research_problems (problem_id, institution_id, institution_name, problem_type, title, description, difficulty_level, problem_data, validation_criteria, expected_solution_format, tags, active) VALUES
('BIAS_001', 'MIT_AI_LAB', 'MIT AI Laboratory', 'bias_detection', 'Gender Bias in Resume Screening', 'Identify potential gender bias in AI-powered resume screening systems by analyzing hiring patterns and decision trees.', 3, '{"dataset": "resume_screening_data_2024", "sample_size": 1000, "features": ["name", "experience", "education", "skills"], "ground_truth": "human_evaluator_scores"}', '{"accuracy_threshold": 0.75, "bias_detection_sensitivity": 0.8, "false_positive_rate": 0.15}', '{"bias_indicators": "array", "confidence_scores": "number", "recommendations": "string"}', '["gender_bias", "hiring", "nlp", "fairness"]', true),

('ALIGN_001', 'STANFORD_HAI', 'Stanford Human-Centered AI Institute', 'alignment', 'Value Alignment in Customer Service Chatbots', 'Evaluate how well customer service chatbots align with human values when handling sensitive customer complaints.', 5, '{"conversation_logs": "customer_service_2024", "sample_size": 500, "scenarios": ["refund_requests", "privacy_concerns", "accessibility_issues"], "human_judgments": "value_alignment_scores"}', '{"alignment_score_threshold": 0.7, "consistency_rate": 0.85, "ethical_violation_tolerance": 0.05}', '{"alignment_scores": "object", "ethical_concerns": "array", "improvement_suggestions": "string"}', '["value_alignment", "chatbots", "ethics", "customer_service"]', true),

('CONTEXT_001', 'BERKELEY_AI', 'UC Berkeley AI Research', 'context_evaluation', 'Contextual Understanding in Medical Diagnosis AI', 'Assess how well AI systems understand context when making medical diagnosis recommendations, particularly edge cases.', 7, '{"medical_cases": "diagnosis_scenarios_2024", "sample_size": 200, "case_types": ["rare_diseases", "comorbidities", "atypical_presentations"], "expert_diagnoses": "medical_professional_consensus"}', '{"diagnostic_accuracy": 0.85, "context_awareness_score": 0.8, "false_negative_rate": 0.1}', '{"context_factors": "array", "diagnostic_confidence": "number", "reasoning_explanation": "string"}', '["medical_ai", "context_understanding", "diagnosis", "healthcare"]', true),

('BIAS_002', 'CMU_ETHICS_LAB', 'Carnegie Mellon Ethics in AI Lab', 'bias_detection', 'Racial Bias in Criminal Justice AI', 'Detect and quantify racial bias in AI systems used for criminal justice risk assessment and sentencing recommendations.', 8, '{"case_records": "criminal_justice_data_2024", "sample_size": 2000, "demographics": ["race", "age", "socioeconomic_status"], "outcomes": "recidivism_rates"}', '{"bias_detection_accuracy": 0.9, "fairness_metrics": ["demographic_parity", "equalized_odds"], "statistical_significance": 0.95}', '{"bias_measurements": "object", "fairness_violations": "array", "mitigation_strategies": "string"}', '["racial_bias", "criminal_justice", "fairness", "policy"]', true),

('ALIGN_002', 'OXFORD_AI_ETHICS', 'Oxford AI Ethics Institute', 'alignment', 'AI Assistant Goal Alignment', 'Evaluate whether AI assistants maintain alignment with user goals when faced with conflicting instructions or ethical dilemmas.', 6, '{"interaction_logs": "ai_assistant_conversations_2024", "sample_size": 800, "conflict_scenarios": ["privacy_vs_helpfulness", "safety_vs_efficiency", "honesty_vs_politeness"], "human_preferences": "alignment_ratings"}', '{"goal_alignment_score": 0.8, "ethical_consistency": 0.85, "user_satisfaction": 0.75}', '{"alignment_analysis": "object", "ethical_decisions": "array", "recommendation_quality": "number"}', '["goal_alignment", "ai_assistants", "ethics", "human_preferences"]', true);

-- Insert sample research contributions
INSERT INTO research_contributions (contribution_id, user_id, problem_id, solution_data, validation_status, quality_score, confidence_score, time_spent_seconds, points_awarded, submitted_at) VALUES
('CONTRIB_001', '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM ai_research_problems WHERE problem_id = 'BIAS_001'), '{"bias_indicators": ["name_based_discrimination", "education_institution_bias"], "confidence_scores": 0.87, "recommendations": "Implement blind review process and diverse training data"}', 'validated', 0.89, 0.91, 1800, 250, NOW() - INTERVAL '5 days'),

('CONTRIB_002', '550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM ai_research_problems WHERE problem_id = 'BIAS_001'), '{"bias_indicators": ["gender_name_patterns"], "confidence_scores": 0.72, "recommendations": "Review name-based filtering algorithms"}', 'validated', 0.74, 0.68, 1200, 150, NOW() - INTERVAL '3 days'),

('CONTRIB_003', '550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM ai_research_problems WHERE problem_id = 'ALIGN_001'), '{"alignment_scores": {"empathy": 0.85, "helpfulness": 0.92, "respect": 0.78}, "ethical_concerns": ["privacy_handling"], "improvement_suggestions": "Enhanced privacy-aware response training"}', 'validated', 0.94, 0.96, 2400, 350, NOW() - INTERVAL '2 days'),

('CONTRIB_004', '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM ai_research_problems WHERE problem_id = 'CONTEXT_001'), '{"context_factors": ["patient_history", "symptom_interactions", "demographic_considerations"], "diagnostic_confidence": 0.83, "reasoning_explanation": "Strong correlation between context awareness and diagnostic accuracy in rare disease cases"}', 'pending', NULL, 0.88, 3600, 0, NOW() - INTERVAL '1 day');

-- Insert sample social interactions
INSERT INTO social_interactions (user_id, target_user_id, interaction_type, target_type, target_id, content) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'follow', 'user', '550e8400-e29b-41d4-a716-446655440002', NULL),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'follow', 'user', '550e8400-e29b-41d4-a716-446655440001', NULL),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'follow', 'user', '550e8400-e29b-41d4-a716-446655440001', NULL),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'like', 'contribution', (SELECT id FROM research_contributions WHERE contribution_id = 'CONTRIB_003'), NULL),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'comment', 'contribution', (SELECT id FROM research_contributions WHERE contribution_id = 'CONTRIB_003'), 'Excellent analysis of the alignment metrics!');

-- Insert sample game sessions
INSERT INTO game_sessions (user_id, session_token, start_time, end_time, duration_seconds, problems_attempted, problems_completed, total_score, average_response_time, platform, app_version, device_info) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'sess_' || gen_random_uuid(), NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 900, 5, 4, 320, 180.5, 'ios', '1.0.0', '{"model": "iPhone 14", "os_version": "17.1", "screen_size": "390x844"}'),
('550e8400-e29b-41d4-a716-446655440002', 'sess_' || gen_random_uuid(), NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 30 minutes', 1800, 8, 6, 480, 225.3, 'android', '1.0.0', '{"model": "Samsung Galaxy S23", "os_version": "14", "screen_size": "393x851"}'),
('550e8400-e29b-41d4-a716-446655440003', 'sess_' || gen_random_uuid(), NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 15 minutes', 2700, 12, 11, 880, 165.2, 'ios', '1.0.0', '{"model": "iPad Pro", "os_version": "17.1", "screen_size": "834x1194"}');

-- Insert sample analytics events
INSERT INTO analytics_events (user_id, session_id, event_type, event_name, event_data, platform, app_version) VALUES
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM game_sessions WHERE user_id = '550e8400-e29b-41d4-a716-446655440001' LIMIT 1), 'gameplay', 'problem_attempted', '{"problem_type": "bias_detection", "difficulty": 3, "success": true, "time_taken": 180}', 'ios', '1.0.0'),
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM game_sessions WHERE user_id = '550e8400-e29b-41d4-a716-446655440001' LIMIT 1), 'gameplay', 'achievement_unlocked', '{"achievement": "accuracy_expert", "score": 320}', 'ios', '1.0.0'),
('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM game_sessions WHERE user_id = '550e8400-e29b-41d4-a716-446655440002' LIMIT 1), 'social', 'user_followed', '{"target_user": "johndoe", "mutual_friends": 0}', 'android', '1.0.0'),
('550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM game_sessions WHERE user_id = '550e8400-e29b-41d4-a716-446655440003' LIMIT 1), 'research', 'contribution_submitted', '{"problem_id": "ALIGN_001", "submission_quality": 0.94, "time_spent": 2400}', 'ios', '1.0.0');

-- Update total_contributions count for research problems
UPDATE ai_research_problems SET total_contributions = (
    SELECT COUNT(*) FROM research_contributions WHERE research_contributions.problem_id = ai_research_problems.id
);

-- Set last_activity for game_progress based on most recent session
UPDATE game_progress SET last_activity = (
    SELECT MAX(end_time) FROM game_sessions WHERE game_sessions.user_id = game_progress.user_id
) WHERE EXISTS (SELECT 1 FROM game_sessions WHERE game_sessions.user_id = game_progress.user_id);
