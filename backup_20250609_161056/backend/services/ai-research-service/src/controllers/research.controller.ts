import { Request, Response } from 'express';
import {
  AlignmentType,
  BiasType,
  ContextType,
  ContributionSolution,
  GameType,
  ProblemType
} from '../models/research-problem.model';
import { ContributionService } from '../services/contribution.service';
import { ResearchService } from '../services/research.service';

export class ResearchController {
  private researchService: ResearchService;
  private contributionService: ContributionService;

  constructor() {
    this.researchService = new ResearchService();
    this.contributionService = new ContributionService();
  }

  /**
   * Get available research problems for user
   */
  async getProblems(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        });
        return;
      }

      const {
        problemType,
        difficultyLevel,
        limit = 10
      } = req.query;

      const problems = await this.researchService.getProblemsForUser(
        userId,
        problemType as ProblemType,
        difficultyLevel ? parseInt(difficultyLevel as string) : undefined,
        parseInt(limit as string)
      );

      res.status(200).json({
        success: true,
        data: {
          problems,
          count: problems.length
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error fetching research problems', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PROBLEMS_ERROR',
          message: 'Failed to fetch research problems'
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    }
  }

  /**
   * Get specific research problem by ID
   */
  async getProblemById(req: Request, res: Response): Promise<void> {
    try {
      const { problemId } = req.params;

      // This would fetch a specific problem - implementing basic structure
      res.status(200).json({
        success: true,
        data: {
          problemId,
          message: 'Problem details would be returned here'
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error fetching problem by ID', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PROBLEM_ERROR',
          message: 'Failed to fetch research problem'
        }
      });
    }
  }

  /**
   * Generate new research problem
   */
  async generateProblem(req: Request, res: Response): Promise<void> {
    try {
      const { problemType, subType, difficultyLevel = 1 } = req.body;

      let problem;

      switch (problemType) {
        case ProblemType.BIAS_DETECTION:
          problem = await this.researchService.generateBiasDetectionProblem(
            subType as BiasType,
            difficultyLevel
          );
          break;
        case ProblemType.ALIGNMENT:
          problem = await this.researchService.generateAlignmentProblem(
            subType as AlignmentType,
            difficultyLevel
          );
          break;
        case ProblemType.CONTEXT_EVALUATION:
          problem = await this.researchService.generateContextEvaluationProblem(
            subType as ContextType,
            difficultyLevel
          );
          break;
        default:
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PROBLEM_TYPE',
              message: 'Invalid problem type specified'
            }
          });
          return;
      }

      res.status(201).json({
        success: true,
        data: { problem },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error generating research problem', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_PROBLEM_ERROR',
          message: 'Failed to generate research problem'
        }
      });
    }
  }

  /**
   * Transform research problem to game format
   */
  async transformToGame(req: Request, res: Response): Promise<void> {
    try {
      const { problemId } = req.params;
      const { gameType, playerLevel = 1 } = req.body;

      // First get the research problem
      const problems = await this.researchService.getProblemsForUser(
        req.user?.id || '',
        undefined,
        undefined,
        1
      );

      if (problems.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PROBLEM_NOT_FOUND',
            message: 'Research problem not found'
          }
        });
        return;
      }

      const gameProblem = await this.researchService.transformToGameProblem(
        problems[0],
        gameType as GameType,
        playerLevel
      );

      res.status(200).json({
        success: true,
        data: { gameProblem },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error transforming problem to game', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRANSFORM_PROBLEM_ERROR',
          message: 'Failed to transform problem to game format'
        }
      });
    }
  }

  /**
   * Submit research contribution
   */
  async submitContribution(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        });
        return;
      }

      const {
        problemId,
        solutionData,
        submissionMethod = 'game'
      } = req.body;

      const contribution = await this.contributionService.submitContribution(
        userId,
        problemId,
        solutionData as ContributionSolution,
        submissionMethod
      );

      res.status(201).json({
        success: true,
        data: { contribution },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error submitting contribution', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBMIT_CONTRIBUTION_ERROR',
          message: 'Failed to submit research contribution'
        }
      });
    }
  }

  /**
   * Get user's research progress and statistics
   */
  async getUserProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        });
        return;
      }

      const [contributions, stats] = await Promise.all([
        this.contributionService.getUserContributions(userId, 20),
        this.contributionService.getUserContributionStats(userId)
      ]);

      res.status(200).json({
        success: true,
        data: {
          recentContributions: contributions,
          statistics: stats
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error fetching user progress', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PROGRESS_ERROR',
          message: 'Failed to fetch user progress'
        }
      });
    }
  }

  /**
   * Get research leaderboard
   */
  async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      // Mock leaderboard data - would implement real leaderboard logic
      const leaderboard = [
        { rank: 1, username: 'researcher1', totalPoints: 5000, validatedContributions: 50 },
        { rank: 2, username: 'researcher2', totalPoints: 4500, validatedContributions: 45 },
        { rank: 3, username: 'researcher3', totalPoints: 4000, validatedContributions: 40 }
      ];

      res.status(200).json({
        success: true,
        data: { leaderboard },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error fetching leaderboard', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_LEADERBOARD_ERROR',
          message: 'Failed to fetch leaderboard'
        }
      });
    }
  }

  /**
   * Get research problem categories and types
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = {
        problemTypes: Object.values(ProblemType),
        biasTypes: Object.values(BiasType),
        alignmentTypes: Object.values(AlignmentType),
        contextTypes: Object.values(ContextType),
        gameTypes: Object.values(GameType),
        difficultyLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      };

      res.status(200).json({
        success: true,
        data: { categories },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
          version: '1.0.0'
        }
      });
    } catch (error) {
      req.logger?.error('Error fetching categories', {}, error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_CATEGORIES_ERROR',
          message: 'Failed to fetch categories'
        }
      });
    }
  }
}
