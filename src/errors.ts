// Error codes for common scenarios
export enum ErrorCode {
  API_KEY_MISSING = 'API_KEY_MISSING',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  REPO_ERROR = 'REPO_ERROR',
  DOC_ERROR = 'DOC_ERROR',
  PLAN_ERROR = 'PLAN_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Base error class for all cursor-tools errors
export class CursorToolsError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CursorToolsError';
  }

  // Format error message for user display
  public formatUserMessage(debug = false): string {
    let message = `${this.message}`;
    
    if (debug && this.details) {
      message += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    
    return message;
  }
}

// Provider-related errors
export class ProviderError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.PROVIDER_ERROR, details);
    this.name = 'ProviderError';
  }
}

export class ApiKeyMissingError extends ProviderError {
  constructor(provider: string) {
    super(
      `API key for ${provider} is not set. Please set the ${provider.toUpperCase()}_API_KEY environment variable.`,
      { provider }
    );
    this.name = 'ApiKeyMissingError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(provider: string, model?: string) {
    super(
      `No model specified for ${provider}${model ? ` (requested model: ${model})` : ''}.`,
      { provider, model }
    );
    this.name = 'ModelNotFoundError';
  }
}

export class NetworkError extends ProviderError {
  constructor(message: string, details?: unknown) {
    super(`Network error: ${message}`, details);
    this.name = 'NetworkError';
  }
}

// File-related errors
export class FileError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.FILE_ERROR, details);
    this.name = 'FileError';
  }
}

// Repository-related errors
export class RepoError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.REPO_ERROR, details);
    this.name = 'RepoError';
  }
}

export class RepoAnalysisError extends RepoError {
  constructor(message: string, details?: unknown) {
    super(`Failed to analyze repository: ${message}`, details);
    this.name = 'RepoAnalysisError';
  }
}

// Documentation-related errors
export class DocError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.DOC_ERROR, details);
    this.name = 'DocError';
  }
}

export class DocGenerationError extends DocError {
  constructor(message: string, details?: unknown) {
    super(`Failed to generate documentation: ${message}`, details);
    this.name = 'DocGenerationError';
  }
}

// Plan-related errors
export class PlanError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.PLAN_ERROR, details);
    this.name = 'PlanError';
  }
}

export class FileFilterError extends PlanError {
  constructor(message: string, details?: unknown) {
    super(`Failed to identify relevant files: ${message}`, details);
    this.name = 'FileFilterError';
  }
}

export class PlanGenerationError extends PlanError {
  constructor(message: string, details?: unknown) {
    super(`Failed to generate implementation plan: ${message}`, details);
    this.name = 'PlanGenerationError';
  }
} 