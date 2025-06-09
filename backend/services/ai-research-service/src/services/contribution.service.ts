import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.service';
import {
  ContributionSolution,
  PeerReview,
  ResearchContribution,
  ValidationStatus
} from '../models/research-problem.model';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class ContributionService {
  /**
   * Submit a research contribution
   */
  async submitContribution(
    userId: string,
    problemId: string,
    solutionData: ContributionSolution,
    submissionMethod: 'game' | 'direct' | 'api' = 'game'
  ): Promise<ResearchContribution> {
    try {
      const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const contribution: Omit<ResearchContribution, 'id' | 'createdAt' | 'updatedAt'> = {
        contributionId,
        userId,
        problemId,
        solutionData,
        validationStatus: ValidationStatus.PENDING,
        timeSpentSeconds: solutionData.timeBreakdown ?
          Object.values(solutionData.timeBreakdown).reduce((a, b) => a + b, 0) : 0,
        submissionMethod,
        peerReviews: [],
        researchImpact: {
          citationCount: 0,
          validationCount: 0,
          replicationCount: 0,
          improvementSuggestions: []
        },
        feedbackReceived: {
          peerFeedback: [],
          improvementSuggestions: [],
          recognitions: []
        },
        pointsAwarded: 0,
        submittedAt: new Date()
      };

      // Store in database
      const { data, error } = await supabase
        .from('research_contributions')
        .insert([{
          contribution_id: contribution.contributionId,
          user_id: contribution.userId,
          problem_id: contribution.problemId,
          solution_data: contribution.solutionData,
          validation_status: contribution.validationStatus,
          time_spent_seconds: contribution.timeSpentSeconds,
          submission_method: contribution.submissionMethod,
          peer_reviews: contribution.peerReviews,
          research_impact: contribution.researchImpact,
          feedback_received: contribution.feedbackReceived,
          points_awarded: contribution.pointsAwarded,
          submitted_at: contribution.submittedAt
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to submit contribution: ${error.message}`);
      }

      const savedContribution = this.mapDatabaseToContribution(data);

      // Trigger validation process
      await this.initiateValidation(savedContribution);

      return savedContribution;
    } catch (error) {
      throw new Error(`Error submitting contribution: ${error}`);
    }
  }

  /**
   * Get contributions for a user
   */
  async getUserContributions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ResearchContribution[]> {
    try {
      const { data, error } = await supabase
        .from('research_contributions')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch user contributions: ${error.message}`);
      }

      return data.map(this.mapDatabaseToContribution);
    } catch (error) {
      throw new Error(`Error fetching user contributions: ${error}`);
    }
  }

  /**
   * Get contributions for a specific problem
   */
  async getProblemContributions(
    problemId: string,
    validationStatus?: ValidationStatus,
    limit: number = 100
  ): Promise<ResearchContribution[]> {
    try {
      let query = supabase
        .from('research_contributions')
        .select('*')
        .eq('problem_id', problemId);

      if (validationStatus) {
        query = query.eq('validation_status', validationStatus);
      }

      query = query.order('submitted_at', { ascending: false }).limit(limit);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch problem contributions: ${error.message}`);
      }

      return data.map(this.mapDatabaseToContribution);
    } catch (error) {
      throw new Error(`Error fetching problem contributions: ${error}`);
    }
  }

  /**
   * Submit peer review for a contribution
   */
  async submitPeerReview(
    contributionId: string,
    reviewerId: string,
    review: Omit<PeerReview, 'reviewedAt'>
  ): Promise<void> {
    try {
      // Get current contribution
      const { data: contribution, error: fetchError } = await supabase
        .from('research_contributions')
        .select('peer_reviews')
        .eq('contribution_id', contributionId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch contribution: ${fetchError.message}`);
      }

      // Add new review
      const peerReview: PeerReview = {
        ...review,
        reviewerId,
        reviewedAt: new Date()
      };

      const updatedReviews = [...(contribution.peer_reviews || []), peerReview];

      // Update contribution with new review
      const { error: updateError } = await supabase
        .from('research_contributions')
        .update({
          peer_reviews: updatedReviews,
          updated_at: new Date()
        })
        .eq('contribution_id', contributionId);

      if (updateError) {
        throw new Error(`Failed to submit peer review: ${updateError.message}`);
      }

      // Check if enough reviews to trigger validation update
      await this.checkValidationStatus(contributionId);
    } catch (error) {
      throw new Error(`Error submitting peer review: ${error}`);
    }
  }

  /**
   * Update contribution validation status
   */
  async updateValidationStatus(
    contributionId: string,
    status: ValidationStatus,
    qualityScore?: number,
    feedback?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        validation_status: status,
        updated_at: new Date()
      };

      if (qualityScore !== undefined) {
        updateData.quality_score = qualityScore;
      }

      if (status === ValidationStatus.VALIDATED) {
        updateData.validated_at = new Date();
        // Calculate points based on quality score
        updateData.points_awarded = this.calculatePoints(qualityScore || 0.7);
      }

      const { error } = await supabase
        .from('research_contributions')
        .update(updateData)
        .eq('contribution_id', contributionId);

      if (error) {
        throw new Error(`Failed to update validation status: ${error.message}`);
      }

      // Update user progress if validated
      if (status === ValidationStatus.VALIDATED) {
        await this.updateUserProgress(contributionId, updateData.points_awarded);
      }
    } catch (error) {
      throw new Error(`Error updating validation status: ${error}`);
    }
  }

  /**
   * Get contribution statistics for a user
   */
  async getUserContributionStats(userId: string): Promise<{
    totalContributions: number;
    validatedContributions: number;
    pendingContributions: number;
    rejectedContributions: number;
    totalPoints: number;
    averageQualityScore: number;
    contributionsByType: Record<string, number>;
  }> {
    try {
      const { data, error } = await supabase
        .from('research_contributions')
        .select('validation_status, points_awarded, quality_score')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to fetch contribution stats: ${error.message}`);
      }

      const stats = {
        totalContributions: data.length,
        validatedContributions: data.filter(c => c.validation_status === 'validated').length,
        pendingContributions: data.filter(c => c.validation_status === 'pending').length,
        rejectedContributions: data.filter(c => c.validation_status === 'rejected').length,
        totalPoints: data.reduce((sum, c) => sum + (c.points_awarded || 0), 0),
        averageQualityScore: data.length > 0 ?
          data.reduce((sum, c) => sum + (c.quality_score || 0), 0) / data.length : 0,
        contributionsByType: {} as Record<string, number>
      };

      return stats;
    } catch (error) {
      throw new Error(`Error fetching contribution stats: ${error}`);
    }
  }

  /**
   * Initiate validation process for a contribution
   */
  private async initiateValidation(contribution: ResearchContribution): Promise<void> {
    try {
      // Get problem validation criteria
      const { data: problem, error } = await supabase
        .from('ai_research_problems')
        .select('validation_criteria')
        .eq('id', contribution.problemId)
        .single();

      if (error || !problem) {
        throw new Error('Problem not found for validation');
      }

      const criteria = problem.validation_criteria;

      // Automatic validation for simple problems
      if (criteria.validationMethod === 'automatic') {
        const qualityScore = await this.performAutomaticValidation(contribution);

        if (qualityScore >= criteria.requiredAccuracy) {
          await this.updateValidationStatus(
            contribution.contributionId,
            ValidationStatus.VALIDATED,
            qualityScore
          );
        } else {
          await this.updateValidationStatus(
            contribution.contributionId,
            ValidationStatus.REJECTED,
            qualityScore
          );
        }
      }
      // For peer review or expert review, mark as pending and queue for review
      else {
        // Could implement queuing system here
        logger.info('Contribution queued for validation', {
          contributionId: contribution.contributionId,
          validationMethod: criteria.validationMethod
        });
      }
    } catch (error) {
      logger.error('Error initiating validation', {
        contributionId: contribution.contributionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error as Error);
    }
  }

  /**
   * Perform automatic validation based on known correct answers
   */
  private async performAutomaticValidation(contribution: ResearchContribution): Promise<number> {
    // This would implement automatic validation logic
    // For now, return a mock score based on confidence
    const avgConfidence = contribution.solutionData.answers.reduce(
      (sum, answer) => sum + answer.confidence, 0
    ) / contribution.solutionData.answers.length;

    return Math.min(0.95, avgConfidence + (Math.random() * 0.2 - 0.1));
  }

  /**
   * Check if contribution has enough reviews for validation
   */
  private async checkValidationStatus(contributionId: string): Promise<void> {
    try {
      const { data: contribution, error } = await supabase
        .from('research_contributions')
        .select('peer_reviews, problem_id')
        .eq('contribution_id', contributionId)
        .single();

      if (error || !contribution) return;

      const { data: problem, error: problemError } = await supabase
        .from('ai_research_problems')
        .select('validation_criteria')
        .eq('id', contribution.problem_id)
        .single();

      if (problemError || !problem) return;

      const peerReviews = contribution.peer_reviews || [];
      const criteria = problem.validation_criteria;

      if (peerReviews.length >= criteria.minimumContributions) {
        const averageScore = peerReviews.reduce((sum: number, review: any) => sum + review.score, 0) / peerReviews.length;

        if (averageScore >= criteria.peerReviewThreshold) {
          await this.updateValidationStatus(contributionId, ValidationStatus.VALIDATED, averageScore);
        } else {
          await this.updateValidationStatus(contributionId, ValidationStatus.REJECTED, averageScore);
        }
      }
    } catch (error) {
      console.error('Error checking validation status:', error);
    }
  }

  /**
   * Calculate points awarded for a contribution
   */
  private calculatePoints(qualityScore: number): number {
    const basePoints = 100;
    const qualityMultiplier = qualityScore;
    return Math.round(basePoints * qualityMultiplier);
  }

  /**
   * Update user progress after successful contribution
   */
  private async updateUserProgress(contributionId: string, pointsAwarded: number): Promise<void> {
    try {
      const { data: contribution, error } = await supabase
        .from('research_contributions')
        .select('user_id')
        .eq('contribution_id', contributionId)
        .single();

      if (error || !contribution) return;

      // Update user's game progress
      const { error: updateError } = await supabase
        .from('game_progress')
        .update({
          total_score: supabase.sql`total_score + ${pointsAwarded}`,
          experience_points: supabase.sql`experience_points + ${Math.round(pointsAwarded * 0.1)}`,
          updated_at: new Date()
        })
        .eq('user_id', contribution.user_id);

      if (updateError) {
        console.error('Error updating user progress:', updateError);
      }
    } catch (error) {
      console.error('Error updating user progress:', error);
    }
  }

  /**
   * Map database row to ResearchContribution model
   */
  private mapDatabaseToContribution(dbRow: any): ResearchContribution {
    return {
      id: dbRow.id,
      contributionId: dbRow.contribution_id,
      userId: dbRow.user_id,
      problemId: dbRow.problem_id,
      solutionData: dbRow.solution_data,
      validationStatus: dbRow.validation_status,
      qualityScore: dbRow.quality_score,
      confidenceScore: dbRow.confidence_score,
      timeSpentSeconds: dbRow.time_spent_seconds,
      submissionMethod: dbRow.submission_method,
      peerReviews: dbRow.peer_reviews || [],
      researchImpact: dbRow.research_impact || {
        citationCount: 0,
        validationCount: 0,
        replicationCount: 0,
        improvementSuggestions: []
      },
      feedbackReceived: dbRow.feedback_received || {
        peerFeedback: [],
        improvementSuggestions: [],
        recognitions: []
      },
      pointsAwarded: dbRow.points_awarded || 0,
      submittedAt: new Date(dbRow.submitted_at),
      validatedAt: dbRow.validated_at ? new Date(dbRow.validated_at) : undefined,
      createdAt: new Date(dbRow.created_at),
      updatedAt: new Date(dbRow.updated_at)
    };
  }
}
