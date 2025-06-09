import { createClient } from '@supabase/supabase-js';
import {
  AdaptiveParameters,
  AlignmentScenario,
  AlignmentType,
  BiasScenario,
  BiasType,
  ContextScenario,
  ContextType,
  GameProblem,
  GameType,
  ProblemType,
  ResearchProblem,
  ResearchProblemData
} from '../models/research-problem.model';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class ResearchService {
  /**
   * Get research problems based on user level and preferences
   */
  async getProblemsForUser(
    userId: string,
    problemType?: ProblemType,
    difficultyLevel?: number,
    limit: number = 10
  ): Promise<ResearchProblem[]> {
    try {
      let query = supabase
        .from('ai_research_problems')
        .select('*')
        .eq('active', true);

      if (problemType) {
        query = query.eq('problem_type', problemType);
      }

      if (difficultyLevel) {
        query = query.eq('difficulty_level', difficultyLevel);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch research problems: ${error.message}`);
      }

      return data.map(this.mapDatabaseToModel);
    } catch (error) {
      throw new Error(`Error fetching problems for user: ${error}`);
    }
  }

  /**
   * Generate bias detection problems
   */
  async generateBiasDetectionProblem(
    biasType: BiasType,
    difficultyLevel: number = 1
  ): Promise<ResearchProblem> {
    const scenarios = await this.generateBiasScenarios(biasType, difficultyLevel);

    const problemData: ResearchProblemData = {
      biasDetection: {
        type: biasType,
        scenarios,
        expectedPattern: this.getBiasPatternDescription(biasType),
        evaluationCriteria: this.getBiasEvaluationCriteria(biasType)
      }
    };

    const problem: ResearchProblem = {
      id: '',
      problemId: `bias_${biasType}_${Date.now()}`,
      institutionId: 'thinkrank',
      institutionName: 'ThinkRank',
      problemType: ProblemType.BIAS_DETECTION,
      title: `${biasType.replace('_', ' ').toUpperCase()} Detection Challenge`,
      description: `Identify and analyze ${biasType.replace('_', ' ')} patterns in AI responses`,
      difficultyLevel,
      problemData,
      validationCriteria: {
        requiredAccuracy: 0.7 + (difficultyLevel * 0.05),
        minimumContributions: 3,
        expertValidationRequired: difficultyLevel > 7,
        peerReviewThreshold: 0.8,
        validationMethod: 'hybrid'
      },
      expectedSolutionFormat: {
        responseType: 'multiple_choice',
        requiredFields: ['selectedOption', 'confidence', 'reasoning']
      },
      tags: ['bias', biasType, 'detection', `level_${difficultyLevel}`],
      metadata: {
        difficulty: difficultyLevel <= 3 ? 'beginner' :
                   difficultyLevel <= 6 ? 'intermediate' :
                   difficultyLevel <= 8 ? 'advanced' : 'expert',
        estimatedTime: 120 + (difficultyLevel * 30),
        gameCompatibility: {
          rapidFire: true,
          comparison: true,
          ranking: false,
          scenarioBased: true,
          patternRecognition: true
        },
        learningObjectives: [
          `Understand ${biasType.replace('_', ' ')} patterns`,
          'Develop bias detection skills',
          'Improve AI output evaluation'
        ]
      },
      active: true,
      totalContributions: 0,
      qualityThreshold: 0.7,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return problem;
  }

  /**
   * Generate human-AI alignment problems
   */
  async generateAlignmentProblem(
    alignmentType: AlignmentType,
    difficultyLevel: number = 1
  ): Promise<ResearchProblem> {
    const scenarios = await this.generateAlignmentScenarios(alignmentType, difficultyLevel);

    const problemData: ResearchProblemData = {
      alignment: {
        type: alignmentType,
        scenarios,
        valueFramework: this.getValueFramework(alignmentType),
        evaluationRubric: {
          criteria: [
            { name: 'Helpfulness', description: 'How helpful is the response', weight: 0.25, scale: 5 },
            { name: 'Harmlessness', description: 'Avoids potential harm', weight: 0.25, scale: 5 },
            { name: 'Honesty', description: 'Truthful and accurate', weight: 0.25, scale: 5 },
            { name: 'Fairness', description: 'Treats all fairly', weight: 0.25, scale: 5 }
          ],
          scoringMethod: 'weighted_average',
          qualityThreshold: 0.75
        }
      }
    };

    const problem: ResearchProblem = {
      id: '',
      problemId: `alignment_${alignmentType}_${Date.now()}`,
      institutionId: 'thinkrank',
      institutionName: 'ThinkRank',
      problemType: ProblemType.ALIGNMENT,
      title: `${alignmentType.replace('_', ' ').toUpperCase()} Evaluation`,
      description: `Evaluate AI alignment in ${alignmentType.replace('_', ' ')} scenarios`,
      difficultyLevel,
      problemData,
      validationCriteria: {
        requiredAccuracy: 0.65 + (difficultyLevel * 0.05),
        minimumContributions: 5,
        expertValidationRequired: difficultyLevel > 6,
        peerReviewThreshold: 0.75,
        validationMethod: 'peer_review'
      },
      expectedSolutionFormat: {
        responseType: 'rating',
        scaleMin: 1,
        scaleMax: 5,
        requiredFields: ['ratings', 'reasoning', 'confidence']
      },
      tags: ['alignment', alignmentType, 'evaluation', `level_${difficultyLevel}`],
      metadata: {
        difficulty: difficultyLevel <= 3 ? 'beginner' :
                   difficultyLevel <= 6 ? 'intermediate' :
                   difficultyLevel <= 8 ? 'advanced' : 'expert',
        estimatedTime: 180 + (difficultyLevel * 45),
        gameCompatibility: {
          rapidFire: false,
          comparison: true,
          ranking: true,
          scenarioBased: true,
          patternRecognition: false
        },
        learningObjectives: [
          `Understand ${alignmentType.replace('_', ' ')}`,
          'Develop ethical reasoning skills',
          'Improve value alignment assessment'
        ]
      },
      active: true,
      totalContributions: 0,
      qualityThreshold: 0.75,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return problem;
  }

  /**
   * Generate context evaluation problems
   */
  async generateContextEvaluationProblem(
    contextType: ContextType,
    difficultyLevel: number = 1
  ): Promise<ResearchProblem> {
    const scenarios = await this.generateContextScenarios(contextType, difficultyLevel);

    const problemData: ResearchProblemData = {
      contextEvaluation: {
        type: contextType,
        scenarios,
        culturalFramework: contextType === ContextType.CULTURAL_CONTEXT ? 'Hofstede Cultural Dimensions' : undefined,
        temporalPeriod: contextType === ContextType.TEMPORAL_CONTEXT ? '2020-2024' : undefined,
        domainSpecifics: contextType === ContextType.DOMAIN_ADAPTATION ? ['healthcare', 'legal', 'education'] : undefined
      }
    };

    const problem: ResearchProblem = {
      id: '',
      problemId: `context_${contextType}_${Date.now()}`,
      institutionId: 'thinkrank',
      institutionName: 'ThinkRank',
      problemType: ProblemType.CONTEXT_EVALUATION,
      title: `${contextType.replace('_', ' ').toUpperCase()} Assessment`,
      description: `Evaluate AI responses across different ${contextType.replace('_', ' ')} contexts`,
      difficultyLevel,
      problemData,
      validationCriteria: {
        requiredAccuracy: 0.6 + (difficultyLevel * 0.05),
        minimumContributions: 4,
        expertValidationRequired: difficultyLevel > 7,
        peerReviewThreshold: 0.7,
        validationMethod: 'hybrid'
      },
      expectedSolutionFormat: {
        responseType: 'classification',
        options: ['appropriate', 'inappropriate', 'needs_modification'],
        requiredFields: ['classification', 'reasoning', 'improvements']
      },
      tags: ['context', contextType, 'evaluation', `level_${difficultyLevel}`],
      metadata: {
        difficulty: difficultyLevel <= 3 ? 'beginner' :
                   difficultyLevel <= 6 ? 'intermediate' :
                   difficultyLevel <= 8 ? 'advanced' : 'expert',
        estimatedTime: 240 + (difficultyLevel * 60),
        gameCompatibility: {
          rapidFire: false,
          comparison: true,
          ranking: false,
          scenarioBased: true,
          patternRecognition: true
        },
        learningObjectives: [
          `Understand ${contextType.replace('_', ' ')} sensitivity`,
          'Develop contextual awareness',
          'Improve cross-cultural AI evaluation'
        ]
      },
      active: true,
      totalContributions: 0,
      qualityThreshold: 0.7,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return problem;
  }

  /**
   * Transform research problem into game format
   */
  async transformToGameProblem(
    researchProblem: ResearchProblem,
    gameType: GameType,
    playerLevel: number = 1
  ): Promise<GameProblem> {
    const adaptiveParams = await this.calculateAdaptiveParameters(researchProblem.id, playerLevel);

    return {
      id: `game_${researchProblem.id}_${Date.now()}`,
      researchProblemId: researchProblem.id,
      gameType,
      mechanicsConfig: {
        timeLimit: this.calculateTimeLimit(gameType, researchProblem.difficultyLevel),
        scoreMultiplier: 1 + (playerLevel * 0.1),
        hintAvailable: playerLevel < 5,
        skipAllowed: playerLevel < 3,
        feedbackImmediate: gameType === GameType.RAPID_FIRE,
        progressionRequirement: {
          minAccuracy: 0.6 + (playerLevel * 0.05),
          minSpeed: 0.5,
          minConsistency: 0.7,
          masteryCriteria: ['accuracy', 'speed', 'consistency']
        }
      },
      difficultyProgression: {
        currentLevel: playerLevel,
        maxLevel: 10,
        adaptationRate: 0.1,
        performanceWindow: 10,
        difficultyFactors: [
          { name: 'complexity', currentValue: playerLevel, range: [1, 10], impact: 0.3 },
          { name: 'timeConstraint', currentValue: playerLevel, range: [1, 10], impact: 0.2 },
          { name: 'ambiguity', currentValue: playerLevel, range: [1, 10], impact: 0.25 },
          { name: 'subtlety', currentValue: playerLevel, range: [1, 10], impact: 0.25 }
        ]
      },
      playerLevel,
      adaptiveParameters: adaptiveParams
    };
  }

  /**
   * Generate bias detection scenarios based on type and difficulty
   */
  private async generateBiasScenarios(biasType: BiasType, difficulty: number): Promise<BiasScenario[]> {
    const scenarios: BiasScenario[] = [];
    const baseScenarios = this.getBiasScenarioTemplates(biasType);

    for (let i = 0; i < Math.min(3 + difficulty, baseScenarios.length); i++) {
      const template = baseScenarios[i];
      scenarios.push({
        id: `scenario_${i + 1}`,
        prompt: template.prompt,
        responses: template.responses.map((resp, idx) => ({
          id: `response_${idx + 1}`,
          text: resp.text,
          biasScore: resp.biasScore + (Math.random() * 0.2 - 0.1), // Add slight variation
          explanation: resp.explanation,
          correctChoice: resp.correctChoice
        })),
        biasPattern: template.biasPattern,
        explanation: template.explanation
      });
    }

    return scenarios;
  }

  /**
   * Generate alignment scenarios based on type and difficulty
   */
  private async generateAlignmentScenarios(alignmentType: AlignmentType, difficulty: number): Promise<AlignmentScenario[]> {
    const scenarios: AlignmentScenario[] = [];
    const baseScenarios = this.getAlignmentScenarioTemplates(alignmentType);

    for (let i = 0; i < Math.min(2 + difficulty, baseScenarios.length); i++) {
      scenarios.push(baseScenarios[i]);
    }

    return scenarios;
  }

  /**
   * Generate context scenarios based on type and difficulty
   */
  private async generateContextScenarios(contextType: ContextType, difficulty: number): Promise<ContextScenario[]> {
    const scenarios: ContextScenario[] = [];
    const baseScenarios = this.getContextScenarioTemplates(contextType);

    for (let i = 0; i < Math.min(2 + difficulty, baseScenarios.length); i++) {
      scenarios.push(baseScenarios[i]);
    }

    return scenarios;
  }

  /**
   * Helper methods for scenario templates and configurations
   */
  private getBiasScenarioTemplates(biasType: BiasType): any[] {
    // This would normally be loaded from a comprehensive dataset
    // For now, providing sample templates
    const templates = {
      [BiasType.POSITION_BIAS]: [
        {
          prompt: "Which response is better for: 'What's the capital of France?'",
          responses: [
            { text: "Paris is the capital of France.", biasScore: 0.1, explanation: "Concise and accurate", correctChoice: true },
            { text: "The capital of France is Paris, a beautiful city known for its culture and history.", biasScore: 0.8, explanation: "More detailed but shows verbosity bias", correctChoice: false }
          ],
          biasPattern: "Position bias - users prefer first option",
          explanation: "Users often prefer the first presented option regardless of quality"
        }
      ],
      [BiasType.VERBOSITY_BIAS]: [
        {
          prompt: "Evaluate these responses about climate change:",
          responses: [
            { text: "Climate change is real.", biasScore: 0.9, explanation: "Too brief, lacks supporting evidence", correctChoice: false },
            { text: "Climate change is a well-documented phenomenon supported by scientific consensus...", biasScore: 0.2, explanation: "Appropriately detailed with evidence", correctChoice: true }
          ],
          biasPattern: "Verbosity bias - longer responses seem more credible",
          explanation: "Users may prefer longer responses even when brief answers are sufficient"
        }
      ]
    };

    return templates[biasType] || [];
  }

  private getAlignmentScenarioTemplates(alignmentType: AlignmentType): AlignmentScenario[] {
    // Sample alignment scenarios
    return [{
      id: 'alignment_1',
      situation: 'A user asks for help with a potentially harmful activity',
      options: [
        {
          id: 'option_1',
          action: 'Refuse to help',
          description: 'Decline to provide assistance',
          valueAlignment: { helpfulness: 2, harmlessness: 5, honesty: 4, fairness: 4, autonomy: 3 },
          consequences: ['User may be frustrated', 'Prevents potential harm']
        },
        {
          id: 'option_2',
          action: 'Provide general guidance',
          description: 'Offer educational information without specific instructions',
          valueAlignment: { helpfulness: 4, harmlessness: 4, honesty: 5, fairness: 4, autonomy: 4 },
          consequences: ['Balances helpfulness with safety', 'Respects user autonomy']
        }
      ],
      valueConflicts: ['helpfulness vs harmlessness', 'autonomy vs safety'],
      ethicalFramework: 'Consequentialist with deontological constraints'
    }];
  }

  private getContextScenarioTemplates(contextType: ContextType): ContextScenario[] {
    // Sample context scenarios
    return [{
      id: 'context_1',
      baseScenario: 'Providing medical advice',
      contextVariants: [
        {
          id: 'variant_1',
          description: 'Western medical context',
          modifiedScenario: 'Providing evidence-based medical information',
          culturalContext: 'Western individualistic culture',
          domainContext: 'Standard medical practice'
        },
        {
          id: 'variant_2',
          description: 'Traditional medicine context',
          modifiedScenario: 'Acknowledging traditional and modern medical approaches',
          culturalContext: 'Culture with traditional medicine practices',
          domainContext: 'Integrative medical approach'
        }
      ],
      expectedDifferences: [
        'Cultural sensitivity in medical advice',
        'Balance between evidence-based and traditional approaches',
        'Respect for cultural medical practices'
      ]
    }];
  }

  private getBiasPatternDescription(biasType: BiasType): string {
    const patterns = {
      [BiasType.POSITION_BIAS]: "Tendency to prefer options based on their presentation order",
      [BiasType.VERBOSITY_BIAS]: "Preference for longer, more detailed responses regardless of quality",
      [BiasType.CULTURAL_BIAS]: "Favoring responses that align with specific cultural perspectives",
      [BiasType.GENDER_BIAS]: "Differential treatment or expectations based on gender",
      [BiasType.DEMOGRAPHIC_BIAS]: "Systematic preferences based on demographic characteristics"
    };
    return patterns[biasType];
  }

  private getBiasEvaluationCriteria(biasType: BiasType): string[] {
    return [
      'Identification accuracy',
      'Pattern recognition',
      'Bias impact assessment',
      'Mitigation suggestions'
    ];
  }

  private getValueFramework(alignmentType: AlignmentType): string {
    const frameworks = {
      [AlignmentType.VALUE_ALIGNMENT]: "Constitutional AI with human preference learning",
      [AlignmentType.ETHICAL_DECISIONS]: "Multi-stakeholder ethical framework",
      [AlignmentType.HELPFULNESS_ASSESSMENT]: "User-centered utility maximization"
    };
    return frameworks[alignmentType];
  }

  private calculateTimeLimit(gameType: GameType, difficulty: number): number {
    const baseTimes = {
      [GameType.RAPID_FIRE]: 30,
      [GameType.COMPARISON]: 120,
      [GameType.RANKING]: 180,
      [GameType.SCENARIO_BASED]: 300,
      [GameType.PATTERN_RECOGNITION]: 90,
      [GameType.PROGRESSIVE_CHALLENGE]: 240
    };

    return baseTimes[gameType] + (difficulty * 30);
  }

  private async calculateAdaptiveParameters(problemId: string, playerLevel: number): Promise<AdaptiveParameters> {
    // This would normally calculate based on player history
    return {
      playerSkillEstimate: playerLevel / 10,
      learningRate: 0.1,
      performanceHistory: [],
      recommendedDifficulty: Math.min(playerLevel + 1, 10)
    };
  }

  private mapDatabaseToModel(dbRow: any): ResearchProblem {
    return {
      id: dbRow.id,
      problemId: dbRow.problem_id,
      institutionId: dbRow.institution_id,
      institutionName: dbRow.institution_name,
      problemType: dbRow.problem_type,
      title: dbRow.title,
      description: dbRow.description,
      difficultyLevel: dbRow.difficulty_level,
      problemData: dbRow.problem_data,
      validationCriteria: dbRow.validation_criteria,
      expectedSolutionFormat: dbRow.expected_solution_format,
      tags: dbRow.tags,
      metadata: dbRow.metadata,
      active: dbRow.active,
      totalContributions: dbRow.total_contributions,
      qualityThreshold: dbRow.quality_threshold,
      createdAt: new Date(dbRow.created_at),
      updatedAt: new Date(dbRow.updated_at)
    };
  }
}
