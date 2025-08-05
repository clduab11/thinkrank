import { BaseAggregate } from '../base-aggregate';
import { DomainEvent, ResearchProblems } from '../../types/domain.types';

export class ResearchProblemAggregate extends BaseAggregate {
  private problems: Map<string, ResearchProblems.ResearchProblem> = new Map();
  private gameTransformations: Map<string, any> = new Map();

  public createProblem(
    problemId: string,
    institutionId: string,
    problemType: ResearchProblems.ProblemType,
    title: string,
    description: string,
    difficultyLevel: number,
    problemData: any,
    validationCriteria: ResearchProblems.ValidationCriteria,
    tags: string[],
    metadata: ResearchProblems.ProblemMetadata
  ): void {
    const event = this.createEvent('ProblemCreated', {
      problemId,
      institutionId,
      problemType,
      title,
      description,
      difficultyLevel,
      problemData,
      validationCriteria,
      tags,
      metadata
    });

    this.applyEvent(event);
  }

  public transformToGame(
    problemId: string,
    gameType: string,
    playerLevel: number,
    mechanicsConfig: any,
    difficultyProgression: any
  ): string {
    const problem = this.problems.get(problemId);
    if (!problem) {
      throw new Error(`Research problem ${problemId} not found`);
    }

    const gameProblemId = `game_${problemId}_${Date.now()}`;
    
    const event = this.createEvent('ProblemTransformed', {
      problemId,
      gameType,
      playerLevel,
      gameProblemId,
      mechanicsConfig,
      difficultyProgression
    });

    this.applyEvent(event);
    return gameProblemId;
  }

  public updateContributions(problemId: string, contributionCount: number): void {
    const problem = this.problems.get(problemId);
    if (!problem) {
      throw new Error(`Research problem ${problemId} not found`);
    }

    const event = this.createEvent('ContributionsUpdated', {
      problemId,
      contributionCount,
      previousCount: problem.totalContributions
    });

    this.applyEvent(event);
  }

  public deactivateProblem(problemId: string, reason: string): void {
    const problem = this.problems.get(problemId);
    if (!problem) {
      throw new Error(`Research problem ${problemId} not found`);
    }

    const event = this.createEvent('ProblemDeactivated', {
      problemId,
      reason,
      deactivatedAt: new Date()
    });

    this.applyEvent(event);
  }

  public getProblem(problemId: string): ResearchProblems.ResearchProblem | undefined {
    return this.problems.get(problemId);
  }

  public getActiveProblems(): ResearchProblems.ResearchProblem[] {
    return Array.from(this.problems.values()).filter(p => p.active);
  }

  public getProblemsByType(type: ResearchProblems.ProblemType): ResearchProblems.ResearchProblem[] {
    return Array.from(this.problems.values()).filter(p => p.problemType === type);
  }

  public getGameTransformation(gameProblemId: string): any {
    return this.gameTransformations.get(gameProblemId);
  }

  protected when(event: DomainEvent): void {
    switch (event.eventType) {
      case 'ProblemCreated':
        this.onProblemCreated(event as ResearchProblems.ProblemCreatedEvent);
        break;
      case 'ProblemTransformed':
        this.onProblemTransformed(event as ResearchProblems.ProblemTransformedEvent);
        break;
      case 'ContributionsUpdated':
        this.onContributionsUpdated(event);
        break;
      case 'ProblemDeactivated':
        this.onProblemDeactivated(event);
        break;
    }
  }

  private onProblemCreated(event: ResearchProblems.ProblemCreatedEvent): void {
    const data = event.eventData;
    
    const problem: ResearchProblems.ResearchProblem = {
      id: event.aggregateId,
      problemId: data.problemId,
      institutionId: data.institutionId,
      problemType: data.problemType,
      title: data.title,
      description: data.description,
      difficultyLevel: data.difficultyLevel,
      problemData: data.problemData,
      validationCriteria: data.validationCriteria,
      tags: data.tags,
      metadata: data.metadata,
      active: true,
      totalContributions: 0,
      qualityThreshold: data.validationCriteria.requiredAccuracy,
      createdAt: event.timestamp,
      updatedAt: event.timestamp
    };

    this.problems.set(data.problemId, problem);
  }

  private onProblemTransformed(event: ResearchProblems.ProblemTransformedEvent): void {
    const { problemId, gameType, playerLevel, gameProblemId, mechanicsConfig, difficultyProgression } = event.eventData;
    
    const gameTransformation = {
      id: gameProblemId,
      researchProblemId: problemId,
      gameType,
      playerLevel,
      mechanicsConfig,
      difficultyProgression,
      transformedAt: event.timestamp
    };

    this.gameTransformations.set(gameProblemId, gameTransformation);
  }

  private onContributionsUpdated(event: DomainEvent): void {
    const { problemId, contributionCount } = event.eventData;
    const problem = this.problems.get(problemId);
    
    if (problem) {
      problem.totalContributions = contributionCount;
      problem.updatedAt = event.timestamp;
      this.problems.set(problemId, problem);
    }
  }

  private onProblemDeactivated(event: DomainEvent): void {
    const { problemId } = event.eventData;
    const problem = this.problems.get(problemId);
    
    if (problem) {
      problem.active = false;
      problem.updatedAt = event.timestamp;
      this.problems.set(problemId, problem);
    }
  }
}