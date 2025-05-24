// Validation schemas and utilities using Joi
import Joi from 'joi';

// Base validation schemas
export const uuidSchema = Joi.string().uuid().required();
export const emailSchema = Joi.string().email().required();
export const usernameSchema = Joi.string().alphanum().min(3).max(30).required();
export const passwordSchema = Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
  .messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  });

// Enum schemas
export const subscriptionTierSchema = Joi.string().valid('free', 'premium', 'pro');
export const problemTypeSchema = Joi.string().valid('bias_detection', 'alignment', 'context_evaluation');
export const validationStatusSchema = Joi.string().valid('pending', 'validated', 'rejected');

// Authentication validation schemas
export const loginRequestSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required(),
  remember_me: Joi.boolean().optional()
});

export const registerRequestSchema = Joi.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  confirm_password: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords must match' }),
  terms_accepted: Joi.boolean().valid(true).required()
});

export const refreshTokenRequestSchema = Joi.object({
  refresh_token: Joi.string().required()
});

export const passwordResetRequestSchema = Joi.object({
  email: emailSchema
});

export const passwordResetConfirmRequestSchema = Joi.object({
  token: Joi.string().required(),
  new_password: passwordSchema
});

// User management validation schemas
export const updateProfileRequestSchema = Joi.object({
  profile_data: Joi.object({
    displayName: Joi.string().max(100).optional(),
    avatar: Joi.string().uri().optional(),
    bio: Joi.string().max(500).optional()
  }).optional(),
  preferences: Joi.object({
    notifications: Joi.boolean().optional(),
    privacy: Joi.string().valid('public', 'friends', 'private').optional(),
    theme: Joi.string().valid('light', 'dark').optional()
  }).optional()
});

// Game validation schemas
export const startGameSessionRequestSchema = Joi.object({
  platform: Joi.string().valid('ios', 'android').required(),
  app_version: Joi.string().required(),
  device_info: Joi.object().required()
});

export const updateGameSessionRequestSchema = Joi.object({
  problems_attempted: Joi.number().integer().min(0).optional(),
  problems_completed: Joi.number().integer().min(0).optional(),
  total_score: Joi.number().integer().min(0).optional(),
  session_data: Joi.object().optional()
});

export const endGameSessionRequestSchema = Joi.object({
  final_score: Joi.number().integer().min(0).required(),
  problems_completed: Joi.number().integer().min(0).required(),
  session_data: Joi.object().required()
});

export const gameProgressUpdateRequestSchema = Joi.object({
  level: Joi.number().integer().min(1).optional(),
  experience_points: Joi.number().integer().min(0).optional(),
  completed_challenges: Joi.array().items(Joi.string()).optional(),
  skill_assessments: Joi.object().pattern(Joi.string(), Joi.number().min(0).max(1)).optional(),
  achievements: Joi.array().items(Joi.string()).optional()
});

// Research validation schemas
export const submitSolutionRequestSchema = Joi.object({
  problem_id: uuidSchema,
  solution_data: Joi.object().required(),
  confidence_score: Joi.number().min(0).max(1).required(),
  time_spent_seconds: Joi.number().integer().min(0).required()
});

export const researchProblemFiltersSchema = Joi.object({
  problem_type: problemTypeSchema.optional(),
  difficulty_level: Joi.number().integer().min(1).max(10).optional(),
  institution_id: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  active_only: Joi.boolean().optional()
});

// Social validation schemas
export const followUserRequestSchema = Joi.object({
  target_user_id: uuidSchema
});

export const createCommentRequestSchema = Joi.object({
  target_type: Joi.string().valid('user', 'contribution', 'achievement').required(),
  target_id: uuidSchema,
  content: Joi.string().max(1000).required()
});

export const shareAchievementRequestSchema = Joi.object({
  achievement_id: Joi.string().required(),
  platform: Joi.string().valid('twitter', 'linkedin', 'facebook').required(),
  message: Joi.string().max(280).optional()
});

// Analytics validation schemas
export const trackEventRequestSchema = Joi.object({
  event_type: Joi.string().max(100).required(),
  event_name: Joi.string().max(100).required(),
  event_data: Joi.object().required(),
  session_id: uuidSchema.optional()
});

// Subscription validation schemas
export const createSubscriptionRequestSchema = Joi.object({
  tier: subscriptionTierSchema.required(),
  payment_method_id: Joi.string().required(),
  billing_period: Joi.string().valid('monthly', 'yearly').required()
});

export const updateSubscriptionRequestSchema = Joi.object({
  tier: subscriptionTierSchema.optional(),
  auto_renewal: Joi.boolean().optional()
});

// Query validation schemas
export const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sort_by: Joi.string().optional(),
  sort_order: Joi.string().valid('asc', 'desc').default('desc')
});

// Validation utility functions
export class ValidationUtils {
  // Validate request body against schema
  static validateRequest<T>(data: any, schema: Joi.ObjectSchema): { value: T; error?: string } {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return { value: data, error: errorMessage };
    }

    return { value };
  }

  // Validate UUID format
  static isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const { error } = emailSchema.validate(email);
    return !error;
  }

  // Sanitize user input for SQL injection prevention
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/['";]/g, '') // Remove SQL injection characters
      .trim();
  }

  // Validate JSON structure
  static isValidJson(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  // Validate file size (in bytes)
  static isValidFileSize(size: number, maxSize: number = 5 * 1024 * 1024): boolean {
    return size > 0 && size <= maxSize;
  }

  // Validate file type
  static isValidFileType(contentType: string, allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif']): boolean {
    return allowedTypes.includes(contentType.toLowerCase());
  }

  // Validate URL format
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Validate phone number (basic E.164 format)
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  // Validate date range
  static isValidDateRange(startDate: string, endDate: string): boolean {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start.getTime() < end.getTime();
  }

  // Password strength validation
  static getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (password.length < 8) return 'weak';

    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    if (password.length >= 12) score++;

    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
  }

  // Rate limiting validation
  static createRateLimitKey(identifier: string, action: string): string {
    return `rate_limit:${identifier}:${action}`;
  }
}

// Custom validation decorators for classes
export function ValidateBody(schema: Joi.ObjectSchema) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const [req] = args;
      const { error, value } = ValidationUtils.validateRequest(req.body, schema);

      if (error) {
        throw new Error(`Validation error: ${error}`);
      }

      req.body = value;
      return method.apply(this, args);
    };
  };
}

export function ValidateQuery(schema: Joi.ObjectSchema) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const [req] = args;
      const { error, value } = ValidationUtils.validateRequest(req.query, schema);

      if (error) {
        throw new Error(`Query validation error: ${error}`);
      }

      req.query = value;
      return method.apply(this, args);
    };
  };
}
