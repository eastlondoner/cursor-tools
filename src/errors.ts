// Base error class for all vibe-tools errors
export class CursorToolsError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.cause = details;
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
      `API key for ${provider} is not set. Please set the ${provider.toUpperCase()}_API_KEY environment variable in your .vibe-tools.env file located in your home directory (~/.vibe-tools/.env).

For more information on setting up API keys, visit: https://github.com/cursor-ai/vibe-tools#api-keys`,
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
        message += '\nSuggested models:\n- claude-3-5-opus-latest\n- claude-3-7-sonnet-latest';
        break;
      case 'gemini':
        message +=
          '\nSuggested models:\n- gemini-2.0-flash\n- gemini-2.5-pro-exp\n- gemini-2.5-pro-exp-03-25';
        break;
      case 'perplexity':
        message += '\nSuggested models:\n- sonar-pro\n- sonar-reasoning-pro';
        break;
      case 'openrouter':
        message +=
          '\nSuggested models:\n- perplexity/sonar\n- openai/gpt-4o\n- anthropic/claude-3.7-sonnet\n- deepseek/deepseek-r1:free\n- google/gemini-2.5-pro-exp-03-25:free\n- mistral/mistral-large\n- groq/llama2-70b';
        break;
      case 'modelbox':
        message +=
          '\nSuggested models:\n- perplexity/sonar-pro\n- openai/gpt-4o\n- anthropic/claude-3-7-sonnet'; // it's 3-7 on modelbox
        break;
      case 'xai':
        message += '\nSuggested models:\n- grok-3-latest\n- grok-3-mini-latest';
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
      message ||
        'Gemini was unable to provide an original response and may be reciting the prompt. Please rephrase your query.',
      { finishReason: 'RECITATION' }
    );
    this.name = 'GeminiRecitationError';
  }
}

// File-related errors
export class FileError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'FileError';
  }
}

// Test-related errors
export class TestError extends CursorToolsError {
  constructor(message: string, details?: unknown) {
    super(`Test error: ${message}`, details);
    this.name = 'TestError';
  }
}

export class FeatureFileParseError extends TestError {
  constructor(filePath: string, details?: unknown) {
    super(`Failed to parse feature behavior file: ${filePath}`, details);
    this.name = 'FeatureFileParseError';
  }
}

export class TestExecutionError extends TestError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'TestExecutionError';
  }
}

export class TestTimeoutError extends TestError {
  constructor(scenario: string, timeoutSeconds: number, details?: unknown) {
    super(`Test scenario '${scenario}' timed out after ${timeoutSeconds} seconds`, details);
    this.name = 'TestTimeoutError';
  }
}
