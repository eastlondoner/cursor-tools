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

/**
 * Error handling utilities
 */

export function handleMCPError(error: unknown): MCPError {
  if (error instanceof MCPError) {
    return error;
  }

  if (error instanceof Error) {
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

    // Handle other errors
    return new MCPError(error.message);
  }

  // Handle unknown errors
  return new MCPError('An unknown error occurred');
}
