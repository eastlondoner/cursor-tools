/**
 * Custom error classes for the MCP client
 */

export class MCPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}

export class MCPServerError extends MCPError {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'MCPServerError';
  }
}

export class MCPToolError extends MCPError {
  constructor(
    message: string,
    public toolName: string
  ) {
    super(message);
    this.name = 'MCPToolError';
  }
}

export class MCPConfigError extends MCPError {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConfigError';
  }
}

export class MCPAuthError extends MCPError {
  constructor(message: string) {
    super(message);
    this.name = 'MCPAuthError';
  }
}

export class MCPInvalidProviderError extends MCPError {
  constructor(message: string) {
    super(message);
    this.name = 'MCPInvalidProviderError';
  }
}

export class MCPOpenRouterError extends MCPError {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'MCPOpenRouterError';
  }
}

export class MCPOpenRouterModelError extends MCPOpenRouterError {
  constructor(message: string, public model?: string, originalError?: any) {
    super(message, originalError);
    this.name = 'MCPOpenRouterModelError';
  }
}

export class MCPOpenRouterRateLimitError extends MCPOpenRouterError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'MCPOpenRouterRateLimitError';
  }
}

export class MCPOpenRouterAuthError extends MCPOpenRouterError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'MCPOpenRouterAuthError';
  }
}

export class MCPConnectionClosedError extends MCPConnectionError {
  constructor(message: string, public serverName?: string) {
    super(message);
    this.name = 'MCPConnectionClosedError';
  }
}

export class MCPModelError extends MCPError {
  constructor(message: string, public model?: string) {
    super(message);
    this.name = 'MCPModelError';
  }
}

/**
 * Error handling utilities
 */

export function handleOpenRouterError(error: any): MCPError {
  console.error('OpenRouter error:', error);
  
  // Check for specific OpenRouter error types
  if (error.status === 401 || error.status === 403) {
    return new MCPOpenRouterAuthError('Authentication failed with OpenRouter. Please check your API key.', error);
  }
  
  if (error.status === 429) {
    return new MCPOpenRouterRateLimitError('Rate limit exceeded with OpenRouter. Please try again later.', error);
  }
  
  if (error.status === 404 && error.error?.code === 'model_not_found') {
    return new MCPOpenRouterModelError(
      `Model not found: ${error.error?.message || error.error?.param || 'unknown model'}. Please check the model name and try again.`, 
      error.error?.param, 
      error
    );
  }
  
  // Handle connection closed errors
  if (error.message?.includes('Connection closed') || error.code === -32000) {
    return new MCPConnectionClosedError(
      'Connection to MCP server was closed unexpectedly. This may be due to compatibility issues between OpenRouter and this MCP server. Try using the Filesystem MCP server or switch to the Anthropic provider.',
      error.serverName
    );
  }
  
  // Handle other OpenRouter-specific errors
  if (error.status && error.error) {
    return new MCPOpenRouterError(`OpenRouter API error: ${error.error.message || 'Unknown error'}`, error);
  }
  
  // Default to generic MCP error for unexpected errors
  return new MCPError(`Unexpected error with OpenRouter: ${error.message || 'Unknown error'}`);
}

export function handleMCPError(error: unknown): MCPError {
  if (error instanceof MCPError) {
    return error;
  }

  if (error instanceof Error) {
    // Check if this is an OpenRouter error
    if (error.message?.includes('openrouter') || 
        (error as any)?.baseURL?.includes('openrouter.ai')) {
      return handleOpenRouterError(error);
    }

    // Handle connection closed errors
    if (error.message?.includes('Connection closed') || (error as any)?.code === -32000) {
      return new MCPConnectionClosedError(
        'Connection to MCP server was closed unexpectedly. This may be due to server configuration issues or compatibility problems. Try using a different MCP server or check server logs for more details.'
      );
    }

    // Handle specific error types from the MCP SDK
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED')) {
      return new MCPConnectionError('Could not connect to MCP server. Is the server running?');
    }

    // Handle authentication errors
    if (error.message.includes('401') || error.message.includes('authentication')) {
      return new MCPAuthError('Authentication failed. Please check your API key.');
    }

    // Handle server errors
    if (error.message.includes('500')) {
      return new MCPServerError('The MCP server encountered an internal error.');
    }

    // Handle tool errors
    if (error.message.includes('tool not found') || error.message.includes('unknown tool')) {
      return new MCPToolError('The requested tool was not found on the server.', 'unknown');
    }

    // Handle model errors
    if (error.message.includes('model') && (error.message.includes('not found') || error.message.includes('invalid'))) {
      return new MCPModelError('The specified model is not valid or not available. Please check the model name and try again.', error.message.includes('model') ? error.message.split(' ')[1] : undefined);
    }

    // Handle other errors
    return new MCPError(error.message);
  }

  // Handle unknown errors
  return new MCPError('An unknown error occurred');
}
