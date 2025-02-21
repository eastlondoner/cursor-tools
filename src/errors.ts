// Base error class for all cursor-tools errors
export class CursorToolsError extends Error {
  constructor(
    message: string,
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
    super(message);
    this.name = 'ProviderError';
    if (details instanceof Error) {
      this.cause = details;
    } else if (details) {
      console.error(message, details);
    }
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
  constructor(provider: string) {
    let message = `No model specified for ${provider}.`;
    
    // Add model suggestions based on provider
    switch (provider) {
      case 'openai':
        message += '\nSuggested models:\n- gpt-4o\n- o3-mini';
        break;
      case 'anthropic':
        message += '\nSuggested models:\n- claude-3-5-opus-latest\n- claude-3-5-sonnet-latest';
        break;
      case 'gemini':
        message += '\nSuggested models:\n- gemini-2.0-flash-thinking-exp\n- gemini-2.0-flash\n- gemini-2.0-pro-exp';
        break;
      case 'perplexity':
        message += '\nSuggested models:\n- sonar-pro\n- sonar-reasoning-pro';
        break;
      case 'openrouter':
        message += '\nSuggested models:\n- openai/gpt-4o\n- anthropic/claude-3.5-sonnet\n- deepseek/deepseek-chat\n- deepseek/deepseek-r1:free\n- google/gemini-2.0-pro-exp-02-05:free\n- mistral/mistral-large\n- groq/llama2-70b';
        break;
      case 'modelbox':
        message += '\nSuggested models:\n- openai/gpt-4o\n- anthropic/claude-3-5-sonnet';
        break;
    }
    
    message += '\nUse --model to specify a model.';
    
    super(message, { provider, model: undefined });
    this.name = 'ModelNotFoundError';
  }
}

export class NetworkError extends ProviderError {
  constructor(message: string, details?: unknown) {
    super(`Network error: ${message}`, details);
    this.name = 'NetworkError';
  }
}

export class GeminiRecitationError extends ProviderError {
  constructor(message?: string) {
    super(
      message || 'Gemini was unable to provide an original response and may be reciting the prompt. Please rephrase your query.',
      { finishReason: 'RECITATION' }
    );
    this.name = 'GeminiRecitationError';
  }
}

// File-related errors
export class FileError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'FileError';
  }
}
