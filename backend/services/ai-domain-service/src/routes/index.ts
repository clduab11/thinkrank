// API Routes for AI Domain Service
// RESTful endpoints with proper error handling and validation

import { Router } from 'express';
import { Logger } from 'pino';
import { UnifiedAIService } from '../services/unified-ai.service';
import Joi from 'joi';

// Validation schemas
const contentGenerationSchema = Joi.object({
  type: Joi.string().valid('text', 'image').required(),
  difficulty: Joi.number().integer().min(1).max(10).required(),
  topic: Joi.string().max(200).required(),
  userId: Joi.string().required(),
  provider: Joi.string().valid('openai', 'anthropic').optional(),
  metadata: Joi.object().optional()
});

const aiDetectionSchema = Joi.object({
  type: Joi.string().valid('text', 'image').required(),
  content: Joi.string().required(),
  userId: Joi.string().required()
});

const researchProblemSchema = Joi.object({
  problemType: Joi.string().valid('bias_detection', 'alignment', 'context_evaluation').required(),
  title: Joi.string().max(500).required(),
  description: Joi.string().required(),
  difficultyLevel: Joi.number().integer().min(1).max(10).required(),
  institutionId: Joi.string().required(),
  institutionName: Joi.string().max(200).required(),
  problemData: Joi.object().required(),
  tags: Joi.array().items(Joi.string()).required(),
  metadata: Joi.object().required()
});

const gameTransformSchema = Joi.object({
  problemId: Joi.string().required(),
  gameType: Joi.string().required(),
  playerLevel: Joi.number().integer().min(1).max(10).required(),
  mechanicsConfig: Joi.object().required(),
  difficultyProgression: Joi.object().required()
});

// Middleware for validation
const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

// Middleware for error handling
const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create routes
export function createRoutes(unifiedService: UnifiedAIService, logger: Logger): Router {
  const router = Router();

  // Content Generation Routes
  router.post('/ai/content', 
    validateRequest(contentGenerationSchema),
    asyncHandler(async (req: any, res: any) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || 'unknown';

      try {
        logger.info({
          correlationId,
          userId: req.body.userId,
          type: req.body.type,
          difficulty: req.body.difficulty
        }, 'Content generation requested');

        const result = await unifiedService.generateContent(req.body);
        const processingTime = Date.now() - startTime;

        logger.info({
          correlationId,
          status: result.status,
          processingTime
        }, 'Content generation completed');

        res.status(result.status === 'completed' ? 200 : 202).json({
          ...result,
          processingTime,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error({ error, correlationId }, 'Content generation failed');
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Content generation failed',
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    })
  );

  // AI Detection Routes
  router.post('/ai/detection',
    validateRequest(aiDetectionSchema),
    asyncHandler(async (req: any, res: any) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || 'unknown';

      try {
        logger.info({
          correlationId,
          userId: req.body.userId,
          type: req.body.type,
          contentLength: req.body.content.length
        }, 'AI detection requested');

        const result = await unifiedService.detectAIContent(req.body);
        const processingTime = Date.now() - startTime;

        logger.info({
          correlationId,
          isAIGenerated: result.isAIGenerated,
          confidence: result.confidence,
          processingTime
        }, 'AI detection completed');

        res.json({
          ...result,
          processingTime,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error({ error, correlationId }, 'AI detection failed');
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'AI detection failed',
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    })
  );

  // Research Problem Routes
  router.post('/ai/research',
    validateRequest(researchProblemSchema),
    asyncHandler(async (req: any, res: any) => {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';

      try {
        logger.info({
          correlationId,
          problemType: req.body.problemType,
          difficultyLevel: req.body.difficultyLevel,
          institutionId: req.body.institutionId
        }, 'Research problem creation requested');

        const result = await unifiedService.createResearchProblem(req.body);

        logger.info({
          correlationId,
          problemId: result.problemId,
          aggregateId: result.aggregateId
        }, 'Research problem created');

        res.status(201).json({
          ...result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error({ error, correlationId }, 'Research problem creation failed');
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Research problem creation failed',
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    })
  );

  // Game Transformation Routes
  router.post('/ai/research/transform',
    validateRequest(gameTransformSchema),
    asyncHandler(async (req: any, res: any) => {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';

      try {
        logger.info({
          correlationId,
          problemId: req.body.problemId,
          gameType: req.body.gameType,
          playerLevel: req.body.playerLevel
        }, 'Game transformation requested');

        const result = await unifiedService.transformToGameProblem(req.body);

        logger.info({
          correlationId,
          gameProblemId: result.gameProblemId
        }, 'Game transformation completed');

        res.status(201).json({
          ...result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error({ error, correlationId }, 'Game transformation failed');
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Game transformation failed',
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    })
  );

  // Health Check Routes
  router.get('/ai/health', asyncHandler(async (req: any, res: any) => {
    const health = await unifiedService.healthCheck();
    
    res.status(health.status === 'healthy' ? 200 : 503).json({
      service: 'ai-domain-service',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      ...health
    });
  }));

  // Metrics endpoint
  router.get('/ai/metrics', asyncHandler(async (req: any, res: any) => {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };

    res.json(metrics);
  }));

  // API Documentation endpoint
  router.get('/ai/docs', (req: any, res: any) => {
    res.json({
      service: 'AI Domain Service',
      version: '2.0.0',
      description: 'Unified AI service consolidating content generation, research problems, and detection capabilities',
      endpoints: {
        'POST /ai/content': 'Generate AI content (text or image)',
        'POST /ai/detection': 'Detect AI-generated content',
        'POST /ai/research': 'Create research problems',
        'POST /ai/research/transform': 'Transform research problems to game format',
        'GET /ai/health': 'Service health check',
        'GET /ai/metrics': 'Service metrics',
        'GET /ai/docs': 'API documentation'
      },
      schemas: {
        contentGeneration: contentGenerationSchema.describe(),
        aiDetection: aiDetectionSchema.describe(),
        researchProblem: researchProblemSchema.describe(),
        gameTransform: gameTransformSchema.describe()
      }
    });
  });

  return router;
}