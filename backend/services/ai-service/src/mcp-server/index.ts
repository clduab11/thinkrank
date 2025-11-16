/**
 * Model Context Protocol (MCP) Server for ThinkRank
 * Enables agentic workflows and AI-powered assistance
 *
 * FEATURES:
 * - Research workflow orchestration
 * - Content generation with Claude/GPT-4
 * - Real-time AI interactions via streaming
 * - Tool integration for AI agents
 * - Memory and context management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '@thinkrank/shared';
import { AIOrchestrator } from '../orchestrator/ai-orchestrator';
import { ResearchAgent } from '../agents/research-agent';
import { ContentAgent } from '../agents/content-agent';

export class ThinkRankMCPServer {
  private server: Server;
  private logger: Logger;
  private aiOrchestrator: AIOrchestrator;
  private researchAgent: ResearchAgent;
  private contentAgent: ContentAgent;

  // Define available tools for AI agents
  private readonly TOOLS: Tool[] = [
    {
      name: 'generate_research_question',
      description: 'Generate AI literacy research questions based on difficulty level and category',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Category of research (bias_detection, llm_fundamentals, prompt_engineering, etc.)',
            enum: ['bias_detection', 'llm_fundamentals', 'prompt_engineering', 'ai_ethics', 'model_evaluation']
          },
          difficulty: {
            type: 'number',
            description: 'Difficulty level from 1 (beginner) to 10 (expert)',
            minimum: 1,
            maximum: 10
          },
          count: {
            type: 'number',
            description: 'Number of questions to generate',
            default: 5,
            minimum: 1,
            maximum: 20
          }
        },
        required: ['category', 'difficulty']
      }
    },
    {
      name: 'analyze_response_quality',
      description: 'Analyze the quality of a user response to an AI literacy question',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The original research question'
          },
          userResponse: {
            type: 'string',
            description: 'User provided answer'
          },
          referenceAnswer: {
            type: 'string',
            description: 'Reference answer for comparison (optional)'
          }
        },
        required: ['question', 'userResponse']
      }
    },
    {
      name: 'generate_adaptive_content',
      description: 'Generate personalized learning content based on user performance and preferences',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier'
          },
          currentLevel: {
            type: 'number',
            description: 'Current skill level',
            minimum: 1,
            maximum: 10
          },
          weakAreas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Topics where user needs improvement'
          },
          learningStyle: {
            type: 'string',
            description: 'Preferred learning style',
            enum: ['visual', 'textual', 'interactive', 'gamified']
          }
        },
        required: ['userId', 'currentLevel']
      }
    },
    {
      name: 'search_research_papers',
      description: 'Search for relevant AI research papers and literature',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          source: {
            type: 'string',
            description: 'Source to search (arxiv, semantic_scholar, perplexity)',
            enum: ['arxiv', 'semantic_scholar', 'perplexity'],
            default: 'perplexity'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10,
            minimum: 1,
            maximum: 50
          }
        },
        required: ['query']
      }
    },
    {
      name: 'generate_challenge',
      description: 'Generate an interactive AI literacy challenge',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Challenge type',
            enum: ['multiple_choice', 'code_analysis', 'bias_detection', 'prompt_crafting', 'model_comparison']
          },
          difficulty: {
            type: 'number',
            description: 'Difficulty level 1-10',
            minimum: 1,
            maximum: 10
          },
          topic: {
            type: 'string',
            description: 'Specific topic to focus on'
          }
        },
        required: ['type', 'difficulty']
      }
    },
    {
      name: 'provide_hint',
      description: 'Provide contextual hints for challenges without giving away the answer',
      inputSchema: {
        type: 'object',
        properties: {
          challengeId: {
            type: 'string',
            description: 'Challenge identifier'
          },
          userAttempts: {
            type: 'number',
            description: 'Number of attempts user has made'
          },
          previousHints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Hints already provided'
          }
        },
        required: ['challengeId', 'userAttempts']
      }
    },
    {
      name: 'explain_concept',
      description: 'Explain AI concepts at appropriate complexity level',
      inputSchema: {
        type: 'object',
        properties: {
          concept: {
            type: 'string',
            description: 'Concept to explain (e.g., "transformer architecture", "attention mechanism")'
          },
          complexityLevel: {
            type: 'number',
            description: 'Explanation complexity: 1=ELI5, 5=college level, 10=research level',
            minimum: 1,
            maximum: 10
          },
          includeExamples: {
            type: 'boolean',
            description: 'Whether to include practical examples',
            default: true
          }
        },
        required: ['concept', 'complexityLevel']
      }
    }
  ];

  constructor() {
    this.logger = Logger.create({
      service: 'mcp-server',
      level: 'INFO',
      console_enabled: true,
      file_enabled: false,
      structured: true
    });

    this.server = new Server(
      {
        name: 'thinkrank-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize AI components
    this.aiOrchestrator = new AIOrchestrator();
    this.researchAgent = new ResearchAgent();
    this.contentAgent = new ContentAgent();

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info('Tool called', { name, args });

      try {
        switch (name) {
          case 'generate_research_question':
            return await this.handleGenerateResearchQuestion(args);

          case 'analyze_response_quality':
            return await this.handleAnalyzeResponseQuality(args);

          case 'generate_adaptive_content':
            return await this.handleGenerateAdaptiveContent(args);

          case 'search_research_papers':
            return await this.handleSearchResearchPapers(args);

          case 'generate_challenge':
            return await this.handleGenerateChallenge(args);

          case 'provide_hint':
            return await this.handleProvideHint(args);

          case 'explain_concept':
            return await this.handleExplainConcept(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error('Tool execution failed', { name, args }, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Generate research questions
   */
  private async handleGenerateResearchQuestion(args: any) {
    const { category, difficulty, count = 5 } = args;

    const questions = await this.researchAgent.generateQuestions({
      category,
      difficulty,
      count
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(questions, null, 2),
        },
      ],
    };
  }

  /**
   * Analyze response quality
   */
  private async handleAnalyzeResponseQuality(args: any) {
    const { question, userResponse, referenceAnswer } = args;

    const analysis = await this.aiOrchestrator.analyzeResponse({
      question,
      userResponse,
      referenceAnswer
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  /**
   * Generate adaptive content
   */
  private async handleGenerateAdaptiveContent(args: any) {
    const { userId, currentLevel, weakAreas = [], learningStyle = 'gamified' } = args;

    const content = await this.contentAgent.generateAdaptiveContent({
      userId,
      currentLevel,
      weakAreas,
      learningStyle
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  }

  /**
   * Search research papers
   */
  private async handleSearchResearchPapers(args: any) {
    const { query, source = 'perplexity', maxResults = 10 } = args;

    const results = await this.researchAgent.searchPapers({
      query,
      source,
      maxResults
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Generate challenge
   */
  private async handleGenerateChallenge(args: any) {
    const { type, difficulty, topic } = args;

    const challenge = await this.contentAgent.generateChallenge({
      type,
      difficulty,
      topic
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(challenge, null, 2),
        },
      ],
    };
  }

  /**
   * Provide hint
   */
  private async handleProvideHint(args: any) {
    const { challengeId, userAttempts, previousHints = [] } = args;

    const hint = await this.aiOrchestrator.generateHint({
      challengeId,
      userAttempts,
      previousHints
    });

    return {
      content: [
        {
          type: 'text',
          text: hint,
        },
      ],
    };
  }

  /**
   * Explain concept
   */
  private async handleExplainConcept(args: any) {
    const { concept, complexityLevel, includeExamples = true } = args;

    const explanation = await this.contentAgent.explainConcept({
      concept,
      complexityLevel,
      includeExamples
    });

    return {
      content: [
        {
          type: 'text',
          text: explanation,
        },
      ],
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('ThinkRank MCP Server started', {
      tools: this.TOOLS.map(t => t.name)
    });
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ThinkRankMCPServer();
  server.start().catch(console.error);
}

export default ThinkRankMCPServer;
