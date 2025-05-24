// Logging utilities for ThinkRank backend services
export interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

export interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  service: string;
  context?: any;
  request_id?: string;
  user_id?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  service: string;
  level: keyof LogLevel;
  console_enabled: boolean;
  file_enabled: boolean;
  structured: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private static instance: Logger;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  public static create(config: LoggerConfig): Logger {
    return new Logger(config);
  }

  public static getInstance(service?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger({
        service: service || 'unknown',
        level: 'INFO',
        console_enabled: true,
        file_enabled: false,
        structured: true
      });
    }
    return Logger.instance;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: keyof LogLevel, message: string, context?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      context
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (this.config.console_enabled) {
      if (this.config.structured) {
        console.log(JSON.stringify(entry));
      } else {
        const colorMap = {
          ERROR: '\x1b[31m', // Red
          WARN: '\x1b[33m',  // Yellow
          INFO: '\x1b[36m',  // Cyan
          DEBUG: '\x1b[90m'  // Gray
        };
        const reset = '\x1b[0m';
        const color = colorMap[entry.level] || '';

        console.log(
          `${color}[${entry.timestamp}] ${entry.level} [${entry.service}]: ${entry.message}${reset}`,
          entry.context ? entry.context : ''
        );
      }
    }
  }

  public error(message: string, context?: any, error?: Error): void {
    if (this.shouldLog('ERROR')) {
      const entry = this.formatMessage('ERROR', message, context, error);
      this.output(entry);
    }
  }

  public warn(message: string, context?: any): void {
    if (this.shouldLog('WARN')) {
      const entry = this.formatMessage('WARN', message, context);
      this.output(entry);
    }
  }

  public info(message: string, context?: any): void {
    if (this.shouldLog('INFO')) {
      const entry = this.formatMessage('INFO', message, context);
      this.output(entry);
    }
  }

  public debug(message: string, context?: any): void {
    if (this.shouldLog('DEBUG')) {
      const entry = this.formatMessage('DEBUG', message, context);
      this.output(entry);
    }
  }

  public child(additionalContext: any): Logger {
    const childLogger = new Logger(this.config);
    const originalFormatMessage = childLogger.formatMessage.bind(childLogger);

    childLogger.formatMessage = (level: keyof LogLevel, message: string, context?: any, error?: Error) => {
      const mergedContext = { ...additionalContext, ...context };
      return originalFormatMessage(level, message, mergedContext, error);
    };

    return childLogger;
  }

  public setRequestId(requestId: string): Logger {
    return this.child({ request_id: requestId });
  }

  public setUserId(userId: string): Logger {
    return this.child({ user_id: userId });
  }

  public setContext(context: any): Logger {
    return this.child(context);
  }
}

// Performance monitoring utilities
export class PerformanceLogger {
  private static timers: Map<string, number> = new Map();

  public static startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
  }

  public static endTimer(operation: string, logger: Logger, context?: any): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      logger.warn(`Timer not found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);

    logger.info(`Operation completed: ${operation}`, {
      operation,
      duration_ms: duration,
      ...context
    });

    return duration;
  }

  public static async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    logger: Logger,
    context?: any
  ): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      this.endTimer(operation, logger, { ...context, success: true });
      return result;
    } catch (error) {
      this.endTimer(operation, logger, { ...context, success: false, error: (error as Error).message });
      throw error;
    }
  }

  public static measure<T>(
    operation: string,
    fn: () => T,
    logger: Logger,
    context?: any
  ): T {
    this.startTimer(operation);
    try {
      const result = fn();
      this.endTimer(operation, logger, { ...context, success: true });
      return result;
    } catch (error) {
      this.endTimer(operation, logger, { ...context, success: false, error: (error as Error).message });
      throw error;
    }
  }
}

// Request logging middleware helper
export interface RequestLogContext {
  method: string;
  url: string;
  user_agent?: string;
  ip_address?: string;
  user_id?: string;
  request_id?: string;
}

export class RequestLogger {
  public static logRequest(
    logger: Logger,
    context: RequestLogContext,
    startTime: number
  ): void {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      ...context,
      duration_ms: duration,
      type: 'request'
    });
  }

  public static logError(
    logger: Logger,
    context: RequestLogContext,
    error: Error,
    startTime: number
  ): void {
    const duration = Date.now() - startTime;

    logger.error('Request failed', {
      ...context,
      duration_ms: duration,
      type: 'request_error'
    }, error);
  }
}

// Database query logging
export class QueryLogger {
  public static logQuery(
    logger: Logger,
    query: string,
    params?: any[],
    duration?: number,
    error?: Error
  ): void {
    const logData = {
      query: this.sanitizeQuery(query),
      params_count: params?.length || 0,
      duration_ms: duration,
      type: 'database_query'
    };

    if (error) {
      logger.error('Database query failed', logData, error);
    } else {
      logger.debug('Database query executed', logData);
    }
  }

  private static sanitizeQuery(query: string): string {
    // Remove sensitive data from query logging
    return query
      .replace(/password['\s]*=['\s]*'[^']*'/gi, "password='***'")
      .replace(/token['\s]*=['\s]*'[^']*'/gi, "token='***'")
      .replace(/secret['\s]*=['\s]*'[^']*'/gi, "secret='***'");
  }
}

// System health logging
export class HealthLogger {
  public static logHealthCheck(
    logger: Logger,
    service: string,
    status: 'healthy' | 'unhealthy' | 'degraded',
    checks: Record<string, any>,
    duration: number
  ): void {
    logger.info('Health check completed', {
      service,
      status,
      checks,
      duration_ms: duration,
      type: 'health_check'
    });
  }

  public static logSystemMetrics(
    logger: Logger,
    metrics: {
      memory_usage?: number;
      cpu_usage?: number;
      response_time?: number;
      active_connections?: number;
    }
  ): void {
    logger.info('System metrics', {
      ...metrics,
      type: 'system_metrics'
    });
  }
}

// Audit logging for security events
export class AuditLogger {
  public static logSecurityEvent(
    logger: Logger,
    event: 'login' | 'logout' | 'password_change' | 'permission_denied' | 'suspicious_activity',
    userId?: string,
    context?: any
  ): void {
    logger.info('Security event', {
      event,
      user_id: userId,
      ...context,
      type: 'security_audit'
    });
  }

  public static logDataAccess(
    logger: Logger,
    operation: 'read' | 'create' | 'update' | 'delete',
    resource: string,
    userId?: string,
    resourceId?: string
  ): void {
    logger.info('Data access', {
      operation,
      resource,
      resource_id: resourceId,
      user_id: userId,
      type: 'data_audit'
    });
  }
}

// Export default logger instance
export const defaultLogger = Logger.getInstance('thinkrank');
