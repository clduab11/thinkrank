import { Injectable, Logger } from '@nestjs/common';
import {
  ComplianceReport,
  ValidationContext,
  ValidationResult,
  ComplianceEngineOptions,
  ComplianceMetrics,
  ValidationRequest,
  ValidationResponse,
  Platform,
  ComplianceStatus,
  ComplianceCategory,
  ComplianceIssue
} from '../types/compliance.types';
import { MetadataValidator } from '../validators/metadata.validator';
import { LegalComplianceChecker } from '../validators/legal-compliance.checker';
import { TechnicalComplianceValidator } from '../validators/technical-compliance.validator';
import { ContentPolicyManager } from '../validators/content-policy.manager';
import { SecurityComplianceValidator } from '../validators/security-compliance.validator';
import { ReportGenerator } from '../utils/report-generator';
import { CacheManager } from '../utils/cache-manager';

/**
 * Core compliance validation engine that orchestrates all compliance checks
 * across multiple platforms and categories
 */
@Injectable()
export class ComplianceEngine {
  private readonly logger = new Logger(ComplianceEngine.name);
  private readonly metrics: ComplianceMetrics;
  private readonly cacheManager: CacheManager;
  private readonly validators: Map<ComplianceCategory, any[]>;

  constructor(
    private readonly metadataValidator: MetadataValidator,
    private readonly legalChecker: LegalComplianceChecker,
    private readonly technicalValidator: TechnicalComplianceValidator,
    private readonly contentManager: ContentPolicyManager,
    private readonly securityValidator: SecurityComplianceValidator,
    private readonly reportGenerator: ReportGenerator,
    private readonly options: ComplianceEngineOptions
  ) {
    this.metrics = {
      totalValidations: 0,
      averageValidationTime: 0,
      cacheHitRate: 0,
      issuesByCategory: {} as Record<ComplianceCategory, number>,
      issuesByPlatform: {} as Record<Platform, number>,
      issuesBySeverity: {},
      lastUpdated: new Date()
    };

    this.cacheManager = new CacheManager(options.enableCaching, options.cacheTimeout);

    // Initialize validators map
    this.validators = new Map([
      [ComplianceCategory.METADATA, [metadataValidator]],
      [ComplianceCategory.LEGAL, [legalChecker]],
      [ComplianceCategory.TECHNICAL, [technicalValidator]],
      [ComplianceCategory.CONTENT, [contentManager]],
      [ComplianceCategory.SECURITY, [securityValidator]]
    ]);
  }

  /**
   * Main validation entry point
   */
  async validate(request: ValidationRequest): Promise<ValidationResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      this.logger.log(`Starting compliance validation for ${request.platform} (ID: ${requestId})`);

      // Check cache first
      if (this.options.enableCaching) {
        const cached = await this.cacheManager.get(request);
        if (cached) {
          this.logger.log(`Cache hit for request ${requestId}`);
          this.updateMetrics('cache_hit');
          return {
            ...cached,
            executionTime: Date.now() - startTime
          };
        }
      }

      // Create validation context
      const context = await this.createValidationContext(request);

      // Run all validations
      const results = await this.runValidations(context);

      // Generate report
      const report = await this.generateReport(context, results);

      // Cache result if enabled
      if (this.options.enableCaching) {
        await this.cacheManager.set(request, { success: true, report, results });
      }

      // Update metrics
      this.updateMetrics('validation_completed', results);

      const executionTime = Date.now() - startTime;
      this.logger.log(`Validation completed in ${executionTime}ms for request ${requestId}`);

      return {
        success: true,
        report,
        results,
        metrics: this.options.enableMetrics ? this.metrics : undefined,
        executionTime
      };

    } catch (error) {
      this.logger.error(`Validation failed for request ${requestId}`, error);
      this.updateMetrics('validation_failed');

      return {
        success: false,
        error: error.message || 'Unknown validation error',
        results: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate specific category only
   */
  async validateCategory(
    platform: Platform,
    category: ComplianceCategory,
    context: Partial<ValidationContext>
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const validators = this.validators.get(category) || [];
      const issues: ComplianceIssue[] = [];

      // Run all validators for the category
      for (const validator of validators) {
        const categoryIssues = await validator.validate(context);
        issues.push(...categoryIssues);
      }

      const passed = !issues.some(issue => issue.status === ComplianceStatus.FAIL);
      const executionTime = Date.now() - startTime;

      return {
        platform,
        category,
        status: passed ? ComplianceStatus.PASS : ComplianceStatus.FAIL,
        issues,
        executionTime,
        passed
      };

    } catch (error) {
      this.logger.error(`Category validation failed for ${category}`, error);
      return {
        platform,
        category,
        status: ComplianceStatus.ERROR,
        issues: [],
        executionTime: Date.now() - startTime,
        passed: false
      };
    }
  }

  /**
   * Get compliance metrics
   */
  getMetrics(): ComplianceMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear validation cache
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
    this.logger.log('Validation cache cleared');
  }

  /**
   * Health check for the compliance engine
   */
  async healthCheck(): Promise<{ status: string; metrics: ComplianceMetrics }> {
    return {
      status: 'healthy',
      metrics: this.metrics
    };
  }

  /**
   * Create validation context from request
   */
  private async createValidationContext(request: ValidationRequest): Promise<ValidationContext> {
    // This would typically involve reading build files, extracting metadata, etc.
    // For now, we'll create a basic context structure
    return {
      platform: request.platform,
      buildInfo: {
        platform: request.platform,
        buildPath: request.buildPath,
        buildSize: 0, // Would be calculated from actual build
        permissions: [],
        // ... other build info
      } as any,
      metadata: request.metadata as any,
      config: {
        strictMode: true,
        allowedPermissions: [],
        maxBundleSize: 150 * 1024 * 1024, // 150MB
        minDescriptionLength: 10,
        maxDescriptionLength: 4000,
        requiredMetadata: ['name', 'version', 'description'],
        ...request.config
      },
      timestamp: new Date()
    };
  }

  /**
   * Run all validation categories
   */
  private async runValidations(context: ValidationContext): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const categories = Object.values(ComplianceCategory);

    if (this.options.parallelValidation && this.options.maxConcurrency > 1) {
      // Run validations in parallel
      const promises = categories.map(category =>
        this.validateCategory(context.platform, category, context)
      );
      results.push(...await Promise.all(promises));
    } else {
      // Run validations sequentially
      for (const category of categories) {
        const result = await this.validateCategory(context.platform, category, context);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Generate comprehensive compliance report
   */
  private async generateReport(
    context: ValidationContext,
    results: ValidationResult[]
  ): Promise<ComplianceReport> {
    const allIssues = results.flatMap(result => result.issues);
    const criticalIssues = allIssues.filter(issue => issue.severity === 'critical');
    const highIssues = allIssues.filter(issue => issue.severity === 'high');

    // Calculate compliance score (0-100)
    const score = this.calculateComplianceScore(allIssues);

    const report: ComplianceReport = {
      id: this.generateReportId(),
      timestamp: new Date(),
      platform: context.platform,
      buildInfo: context.buildInfo,
      metadata: context.metadata,
      issues: allIssues,
      summary: {
        totalIssues: allIssues.length,
        criticalIssues: criticalIssues.length,
        highIssues: highIssues.length,
        mediumIssues: allIssues.filter(i => i.severity === 'medium').length,
        lowIssues: allIssues.filter(i => i.severity === 'low').length,
        passed: criticalIssues.length === 0 && highIssues.length === 0,
        score
      },
      recommendations: this.generateRecommendations(allIssues),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    return report;
  }

  /**
   * Calculate compliance score based on issues
   */
  private calculateComplianceScore(issues: ComplianceIssue[]): number {
    if (issues.length === 0) return 100;

    const severityWeights = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 1
    };

    const totalWeight = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
    const maxPossibleWeight = 100; // Assume max 4 critical issues for 0 score

    return Math.max(0, 100 - totalWeight);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      if (issue.fixRecommendation) {
        recommendations.add(issue.fixRecommendation);
      }
    }

    return Array.from(recommendations);
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(event: string, results?: ValidationResult[]): void {
    this.metrics.totalValidations++;
    this.metrics.lastUpdated = new Date();

    if (event === 'validation_completed' && results) {
      // Update category metrics
      for (const result of results) {
        const category = result.category;
        const platform = result.platform;

        if (!this.metrics.issuesByCategory[category]) {
          this.metrics.issuesByCategory[category] = 0;
        }
        if (!this.metrics.issuesByPlatform[platform]) {
          this.metrics.issuesByPlatform[platform] = 0;
        }

        this.metrics.issuesByCategory[category] += result.issues.length;
        this.metrics.issuesByPlatform[platform] += result.issues.length;

        // Update severity metrics
        for (const issue of result.issues) {
          const severity = issue.severity;
          if (!this.metrics.issuesBySeverity[severity]) {
            this.metrics.issuesBySeverity[severity] = 0;
          }
          this.metrics.issuesBySeverity[severity]++;
        }
      }

      // Update average validation time (simple moving average)
      const totalTime = results.reduce((sum, result) => sum + result.executionTime, 0);
      const currentAvg = this.metrics.averageValidationTime;
      const totalValidations = this.metrics.totalValidations;

      this.metrics.averageValidationTime = (currentAvg * (totalValidations - 1) + (totalTime / results.length)) / totalValidations;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}