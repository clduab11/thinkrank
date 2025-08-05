// Analytics type definitions for better type safety

// Device information structure
export interface DeviceInfo {
  platform: string;
  os: string;
  osVersion: string;
  browser?: string;
  browserVersion?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

// Event data structures for different event types
export interface GameEventData {
  level?: number;
  score?: number;
  action: string;
  result?: 'success' | 'failure';
  duration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface UserActionEventData {
  action: 'click' | 'scroll' | 'keypress' | 'submit' | 'focus' | 'blur';
  element?: string;
  elementId?: string;
  value?: string | number;
  coordinates?: { x: number; y: number };
}

export interface NavigationEventData {
  fromPage: string;
  toPage: string;
  method: 'direct' | 'link' | 'button' | 'back' | 'forward';
  referrer?: string;
}

export interface PerformanceEventData {
  loadTime: number;
  renderTime?: number;
  apiResponseTime?: number;
  memoryUsage?: number;
  networkLatency?: number;
}

export interface ErrorEventData {
  errorCode?: string;
  errorCategory: 'ui' | 'api' | 'network' | 'validation' | 'authentication';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  additionalInfo?: Record<string, string | number | boolean>;
}

// Union type for all possible event data
export type EventData = 
  | GameEventData 
  | UserActionEventData 
  | NavigationEventData 
  | PerformanceEventData 
  | ErrorEventData 
  | Record<string, unknown>;

// Context information for performance metrics
export interface PerformanceContext {
  page?: string;
  component?: string;
  userAgent?: string;
  connectionType?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  additionalInfo?: Record<string, string | number | boolean>;
}

// Context information for error events
export interface ErrorContext {
  page?: string;
  component?: string;
  userAction?: string;
  sessionDuration?: number;
  previousErrors?: string[];
  browserInfo?: Pick<DeviceInfo, 'browser' | 'browserVersion' | 'os'>;
}

// Metadata for business events
export interface BusinessEventMetadata {
  campaignId?: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
  conversionType?: 'signup' | 'purchase' | 'subscription' | 'upgrade';
  customerSegment?: string;
  additionalInfo?: Record<string, string | number | boolean>;
}

// User summary statistics interface
export interface UserAnalyticsSummary {
  userId: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  events: {
    total: number;
    byType: Record<string, number>;
  };
  sessions: {
    total: number;
    averageDuration: number;
  };
  performance: Record<string, number[]>;
}

// Type guards for event data
export function isGameEventData(data: unknown): data is GameEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    typeof (data as any).action === 'string'
  );
}

export function isUserActionEventData(data: unknown): data is UserActionEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    ['click', 'scroll', 'keypress', 'submit', 'focus', 'blur'].includes((data as any).action)
  );
}

export function isPerformanceEventData(data: unknown): data is PerformanceEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'loadTime' in data &&
    typeof (data as any).loadTime === 'number'
  );
}

export function isErrorEventData(data: unknown): data is ErrorEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'errorCategory' in data &&
    'severity' in data &&
    ['ui', 'api', 'network', 'validation', 'authentication'].includes((data as any).errorCategory)
  );
}