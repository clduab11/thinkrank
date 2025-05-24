import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { createValidationError } from './error.middleware';

const analyticsEventSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  eventType: Joi.string().max(100).required(),
  eventData: Joi.object().required(),
  timestamp: Joi.date().iso().optional(),
  sessionId: Joi.string().uuid().optional()
});

const sessionSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  sessionStart: Joi.date().iso().optional(),
  deviceInfo: Joi.object().optional()
});

const performanceMetricSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  metricType: Joi.string().valid('fps', 'load_time', 'memory_usage', 'network_latency').required(),
  value: Joi.number().min(0).required(),
  context: Joi.object().optional()
});

const errorEventSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  errorType: Joi.string().max(100).required(),
  errorMessage: Joi.string().max(1000).required(),
  stackTrace: Joi.string().max(5000).optional(),
  context: Joi.object().optional()
});

const businessEventSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  eventType: Joi.string().valid('subscription_start', 'subscription_cancel', 'purchase', 'refund').required(),
  revenue: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  metadata: Joi.object().optional()
});

export const validateAnalyticsEvent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = analyticsEventSchema.validate(req.body);
  if (error) {
    throw createValidationError(error.details);
  }
  next();
};

export const validateSession = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = sessionSchema.validate(req.body);
  if (error) {
    throw createValidationError(error.details);
  }
  next();
};

export const validatePerformanceMetric = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = performanceMetricSchema.validate(req.body);
  if (error) {
    throw createValidationError(error.details);
  }
  next();
};

export const validateErrorEvent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = errorEventSchema.validate(req.body);
  if (error) {
    throw createValidationError(error.details);
  }
  next();
};

export const validateBusinessEvent = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = businessEventSchema.validate(req.body);
  if (error) {
    throw createValidationError(error.details);
  }
  next();
};

// Generic validation middleware factory
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      throw createValidationError(error.details);
    }
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);
    if (error) {
      throw createValidationError(error.details);
    }
    next();
  };
};

// URL parameter validation
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params);
    if (error) {
      throw createValidationError(error.details);
    }
    next();
  };
};
