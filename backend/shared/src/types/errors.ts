// Error type definitions for better type safety

// Joi validation error structure
export interface JoiValidationDetail {
  path: (string | number)[];
  message: string;
  type: string;
  context?: Record<string, unknown>;
}

export interface JoiValidationError extends Error {
  isJoi: true;
  details: JoiValidationDetail[];
}

// Database error types (PostgreSQL/Supabase)
export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  column?: string;
  table?: string;
  schema?: string;
}

// Supabase error structure
export interface SupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
}

// Type guards for error identification
export function isJoiValidationError(error: unknown): error is JoiValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isJoi' in error &&
    (error as any).isJoi === true &&
    'details' in error &&
    Array.isArray((error as any).details)
  );
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    error instanceof Error &&
    ('code' in error || 'details' in error || 'hint' in error)
  );
}

// JSON syntax error with body property
export interface JsonSyntaxError extends SyntaxError {
  body: string;
  status: number;
  statusCode: number;
}