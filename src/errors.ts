// Base error class for all cursor-tools errors
export class CursorToolsError extends Error {
  constructor(message: string, public readonly details?: unknown) {
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
    super(message);
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
    super(message);
    this.name = 'FileError';
  }
}