/**
 * Perplexity AI Adapter - November 2025 Standards
 * Real-time research assistance with citation support
 *
 * FEATURES:
 * - Academic paper search
 * - Real-time web search with citations
 * - Research question generation
 * - Literature review assistance
 */

import { Logger } from '@thinkrank/shared';
import fetch from 'node-fetch';

export interface PerplexityConfig {
  apiKey: string;
  model?: string;
}

export interface SearchRequest {
  query: string;
  searchDomainFilter?: string[];
  returnImages?: boolean;
  returnRelatedQuestions?: boolean;
  searchRecencyFilter?: 'day' | 'week' | 'month' | 'year';
}

export interface SearchResult {
  answer: string;
  citations: Citation[];
  images?: string[];
  relatedQuestions?: string[];
  followupQuestions?: string[];
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
  relevance: number;
}

export interface ResearchPaper {
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  venue: string;
  citations: number;
  url: string;
  pdfUrl?: string;
}

export class PerplexityAdapter {
  private logger: Logger;
  private config: PerplexityConfig;
  private readonly API_BASE = 'https://api.perplexity.ai';

  constructor(config: PerplexityConfig) {
    this.config = {
      model: config.model || 'llama-3.1-sonar-large-128k-online',
      ...config
    };

    this.logger = Logger.create({
      service: 'perplexity-adapter',
      level: 'INFO',
      console_enabled: true,
      file_enabled: false,
      structured: true
    });
  }

  /**
   * Search for research papers and web content
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant specialized in AI literacy and machine learning. Provide accurate, cited information with academic rigor.'
            },
            {
              role: 'user',
              content: request.query
            }
          ],
          max_tokens: 2048,
          temperature: 0.2,
          top_p: 0.9,
          return_citations: true,
          return_images: request.returnImages || false,
          return_related_questions: request.returnRelatedQuestions || false,
          search_domain_filter: request.searchDomainFilter,
          search_recency_filter: request.searchRecencyFilter
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json() as any;

      const result: SearchResult = {
        answer: data.choices[0].message.content,
        citations: this.parseCitations(data.citations || []),
        images: data.images,
        relatedQuestions: data.related_questions,
        followupQuestions: this.extractFollowupQuestions(data.choices[0].message.content)
      };

      this.logger.info('Perplexity search completed', {
        duration: Date.now() - startTime,
        citationsCount: result.citations.length,
        query: request.query
      });

      return result;

    } catch (error) {
      this.logger.error('Perplexity search failed', { query: request.query }, error);
      throw error;
    }
  }

  /**
   * Search specifically for academic papers
   */
  async searchAcademicPapers(params: {
    query: string;
    maxResults?: number;
    yearFrom?: number;
    yearTo?: number;
  }): Promise<ResearchPaper[]> {
    const searchQuery = this.buildAcademicSearchQuery(params);

    const result = await this.search({
      query: searchQuery,
      searchDomainFilter: ['arxiv.org', 'scholar.google.com', 'semanticscholar.org'],
      searchRecencyFilter: params.yearFrom ? this.getRecencyFilter(params.yearFrom) : undefined
    });

    // Parse academic paper information from the response
    return this.parseAcademicPapers(result);
  }

  /**
   * Generate research questions based on a topic
   */
  async generateResearchQuestions(params: {
    topic: string;
    difficulty: number; // 1-10
    count: number;
    category: string;
  }): Promise<Array<{
    question: string;
    difficulty: number;
    keywords: string[];
    expectedApproach: string;
  }>> {
    const query = `Generate ${params.count} research questions about ${params.topic} in the ${params.category} category at difficulty level ${params.difficulty}/10.

For each question, provide:
1. The research question
2. Key concepts tested
3. Expected approach to answer

Format as a numbered list.`;

    const result = await this.search({
      query,
      returnRelatedQuestions: true
    });

    return this.parseResearchQuestions(result.answer, params.difficulty);
  }

  /**
   * Get latest AI research trends
   */
  async getLatestTrends(category: string): Promise<{
    trends: string[];
    papers: ResearchPaper[];
    summary: string;
  }> {
    const result = await this.search({
      query: `What are the latest research trends and breakthroughs in ${category} AI as of November 2025? Include recent papers and key developments.`,
      searchRecencyFilter: 'month',
      searchDomainFilter: ['arxiv.org', 'ai.googleblog.com', 'openai.com', 'anthropic.com']
    });

    return {
      trends: this.extractTrends(result.answer),
      papers: this.parseAcademicPapers(result),
      summary: result.answer
    };
  }

  /**
   * Fact-check AI-related claims
   */
  async factCheck(claim: string): Promise<{
    verdict: 'true' | 'false' | 'partially_true' | 'unverified';
    confidence: number;
    explanation: string;
    evidence: Citation[];
  }> {
    const result = await this.search({
      query: `Fact-check this claim about AI: "${claim}". Provide evidence from academic sources and recent research. Rate the accuracy and explain.`,
      searchDomainFilter: ['arxiv.org', 'scholar.google.com', 'nature.com', 'science.org']
    });

    return this.parseFactCheckResult(result);
  }

  /**
   * Explain AI concepts with citations
   */
  async explainConcept(params: {
    concept: string;
    complexity: number; // 1-10
    includeExamples: boolean;
  }): Promise<{
    explanation: string;
    examples?: string[];
    citations: Citation[];
    relatedConcepts: string[];
  }> {
    const complexityMap: Record<number, string> = {
      1: 'Explain like I\'m 5',
      3: 'High school level',
      5: 'Undergraduate level',
      7: 'Graduate level',
      10: 'Research/expert level'
    };

    const complexityLevel = complexityMap[Math.min(10, Math.max(1, params.complexity))] || complexityMap[5];

    const query = `Explain "${params.concept}" in AI at ${complexityLevel}. ${params.includeExamples ? 'Include practical examples.' : ''} Use citations from academic sources.`;

    const result = await this.search({
      query,
      returnRelatedQuestions: true
    });

    return {
      explanation: result.answer,
      examples: params.includeExamples ? this.extractExamples(result.answer) : undefined,
      citations: result.citations,
      relatedConcepts: result.relatedQuestions || []
    };
  }

  /**
   * Parse citations from API response
   */
  private parseCitations(citations: any[]): Citation[] {
    return citations.map(c => ({
      url: c.url || c,
      title: c.title || this.extractTitleFromUrl(c.url || c),
      snippet: c.snippet || '',
      relevance: c.relevance || 1.0
    }));
  }

  /**
   * Extract title from URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Extract follow-up questions from response
   */
  private extractFollowupQuestions(text: string): string[] {
    const questions: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.trim().endsWith('?')) {
        questions.push(line.trim());
      }
    }

    return questions.slice(0, 5); // Return up to 5 questions
  }

  /**
   * Build academic search query
   */
  private buildAcademicSearchQuery(params: {
    query: string;
    yearFrom?: number;
    yearTo?: number;
  }): string {
    let query = `Find academic papers about: ${params.query}`;

    if (params.yearFrom || params.yearTo) {
      query += ` published`;
      if (params.yearFrom) query += ` from ${params.yearFrom}`;
      if (params.yearTo) query += ` to ${params.yearTo}`;
    }

    query += '. Include title, authors, abstract, citations, and publication venue.';

    return query;
  }

  /**
   * Get recency filter based on year
   */
  private getRecencyFilter(yearFrom: number): 'day' | 'week' | 'month' | 'year' {
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - yearFrom;

    if (yearDiff <= 1) return 'year';
    return 'year'; // Default to year for academic papers
  }

  /**
   * Parse academic papers from search result
   */
  private parseAcademicPapers(result: SearchResult): ResearchPaper[] {
    const papers: ResearchPaper[] = [];

    // Parse paper information from citations and answer
    for (const citation of result.citations) {
      if (this.isAcademicSource(citation.url)) {
        papers.push({
          title: citation.title,
          authors: this.extractAuthors(citation.snippet),
          abstract: citation.snippet,
          year: this.extractYear(citation.snippet),
          venue: this.extractVenue(citation.url),
          citations: 0, // Would need separate API call to get citation count
          url: citation.url,
          pdfUrl: this.findPdfUrl(citation.url)
        });
      }
    }

    return papers;
  }

  /**
   * Check if URL is from academic source
   */
  private isAcademicSource(url: string): boolean {
    const academicDomains = ['arxiv.org', 'scholar.google', 'semanticscholar', 'acm.org', 'ieee.org', 'nature.com', 'science.org'];
    return academicDomains.some(domain => url.includes(domain));
  }

  /**
   * Extract authors from text (heuristic)
   */
  private extractAuthors(text: string): string[] {
    // Simple heuristic - would be improved with better parsing
    const matches = text.match(/([A-Z][a-z]+ [A-Z][a-z]+(?:, [A-Z][a-z]+ [A-Z][a-z]+)*)/g);
    return matches ? matches.slice(0, 5) : [];
  }

  /**
   * Extract year from text
   */
  private extractYear(text: string): number {
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : new Date().getFullYear();
  }

  /**
   * Extract venue from URL
   */
  private extractVenue(url: string): string {
    if (url.includes('arxiv')) return 'arXiv';
    if (url.includes('acm.org')) return 'ACM';
    if (url.includes('ieee.org')) return 'IEEE';
    if (url.includes('nature.com')) return 'Nature';
    return 'Unknown';
  }

  /**
   * Find PDF URL for paper
   */
  private findPdfUrl(url: string): string | undefined {
    if (url.includes('arxiv.org')) {
      return url.replace('/abs/', '/pdf/') + '.pdf';
    }
    return undefined;
  }

  /**
   * Parse research questions from text
   */
  private parseResearchQuestions(text: string, difficulty: number): Array<{
    question: string;
    difficulty: number;
    keywords: string[];
    expectedApproach: string;
  }> {
    const questions: any[] = [];
    const lines = text.split('\n');
    let currentQuestion: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^\d+\./.test(trimmed)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          question: trimmed.replace(/^\d+\.\s*/, ''),
          difficulty,
          keywords: [],
          expectedApproach: ''
        };
      } else if (currentQuestion && trimmed.length > 0) {
        if (trimmed.toLowerCase().includes('keyword') || trimmed.toLowerCase().includes('concept')) {
          currentQuestion.keywords = this.extractKeywords(trimmed);
        } else if (trimmed.toLowerCase().includes('approach') || trimmed.toLowerCase().includes('expected')) {
          currentQuestion.expectedApproach = trimmed;
        }
      }
    }

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return questions;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.split(/[,;]/).map(w => w.trim()).filter(w => w.length > 3);
    return words.slice(0, 5);
  }

  /**
   * Extract trends from text
   */
  private extractTrends(text: string): string[] {
    const trends: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.match(/^[\d\-\*•]/) || line.toLowerCase().includes('trend')) {
        const cleaned = line.replace(/^[\d\-\*•.\s]+/, '').trim();
        if (cleaned.length > 10) {
          trends.push(cleaned);
        }
      }
    }

    return trends.slice(0, 10);
  }

  /**
   * Extract examples from explanation
   */
  private extractExamples(text: string): string[] {
    const examples: string[] = [];
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('example') ||
          sentence.toLowerCase().includes('for instance') ||
          sentence.toLowerCase().includes('such as')) {
        examples.push(sentence.trim());
      }
    }

    return examples.slice(0, 3);
  }

  /**
   * Parse fact-check result
   */
  private parseFactCheckResult(result: SearchResult): {
    verdict: 'true' | 'false' | 'partially_true' | 'unverified';
    confidence: number;
    explanation: string;
    evidence: Citation[];
  } {
    const text = result.answer.toLowerCase();

    let verdict: 'true' | 'false' | 'partially_true' | 'unverified' = 'unverified';

    if (text.includes('true') && !text.includes('false') && !text.includes('partially')) {
      verdict = 'true';
    } else if (text.includes('false') && !text.includes('partially')) {
      verdict = 'false';
    } else if (text.includes('partially')) {
      verdict = 'partially_true';
    }

    // Calculate confidence based on number of citations
    const confidence = Math.min(100, result.citations.length * 20);

    return {
      verdict,
      confidence,
      explanation: result.answer,
      evidence: result.citations
    };
  }
}
