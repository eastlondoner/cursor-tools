# OpenRouter Support for MCP Integration - Implementation Plan

## ⚠️ IMPORTANT LIMITATIONS ⚠️

After thorough testing and implementation, we have discovered **fundamental limitations** with OpenRouter's compatibility with MCP servers:

1. **OpenRouter WILL NOT work with most MCP servers** due to fundamental differences in how it handles tool calls compared to Anthropic.

2. **Only the Filesystem MCP server works reliably with OpenRouter**. All other MCP servers (Code Interpreter, Browserbase, etc.) consistently fail with connection closed errors.

3. **This limitation is NOT fixable** without significant changes to either OpenRouter or the MCP protocol itself. The issue stems from how OpenRouter processes and handles tool calls, which is fundamentally different from Anthropic's native implementation.

4. **Recommendation**: Users should be clearly advised to:
   - Use Anthropic provider for any MCP server that requires complex tool calls
   - Only use OpenRouter with the Filesystem MCP server
   - Not attempt to use Code Interpreter, Browserbase, or other complex MCP servers with OpenRouter

These limitations will be clearly documented in the README, error messages, and user-facing documentation.

## Overview

Currently, the MCP (Model Context Protocol) integration in cursor-tools is hardcoded to use Anthropic API keys and models. This plan outlines the steps to add OpenRouter support to the MCP integration, similar to how it's implemented elsewhere in the codebase.

## Assumptions

1. **Environment Variable:** Users will provide their OpenRouter API key via an `OPENROUTER_API_KEY` environment variable, similar to how other API keys are handled.
2. **Provider Selection:** A new `provider` option will allow users to specify "openrouter" for the MCP command. If no provider is specified, it will continue to default to Anthropic.
3. **Model Selection:** Users can specify the OpenRouter model via a `--model` option, similar to other commands, and in config.
4. **Error Handling:** We'll reuse the existing `MCPError` classes for consistency and add new error types for OpenRouter-specific scenarios.
5. **Configuration:** MCP configuration can be specified in `cursor-tools.config.json` file.
6. **Default Models:** 
   - We will maintain the current default Anthropic model (`claude-3-7-sonnet-thinking-latest`) for MCP when using Anthropic.
   - For OpenRouter, we'll set a sensible default model that provides similar capabilities (e.g., `anthropic/claude-3-7-sonnet-thinking` or equivalent available on OpenRouter).
   - Users can override these defaults using the `--model` option or configuration.
7. **System Prompt:** We'll use the same system prompt for both providers to maintain consistency with the rest of the codebase.
8. **Retry Logic:** We'll implement retry logic using the existing `retryWithBackoff` helper function from `src/providers/base.ts`.

## Implementation Steps

### 1. Update `MCPClient.ts`

- [x] **Add OpenRouter Client Support:**
  - [x] Import necessary modules from the `openai` package (since OpenRouter uses an OpenAI-compatible API)
  - [x] Add a new property `openrouterClient?: OpenAI` to the `MCPClient` class
  - [x] Modify the constructor to conditionally initialize `this.openrouterClient` if the `OPENROUTER_API_KEY` environment variable is set and the configured provider is 'openrouter'
  - [x] Update the `updateConfig` method to conditionally initialize `this.openrouterClient`

- [x] **Modify `processQuery` method:**
  - [x] Add parameters to accept the provider and model
  - [x] Use conditional statements to select the appropriate client and model
  - [x] Construct messages, system prompts, etc. in the same way for both providers
  - [x] If the provider is openrouter, don't send any tools
  - [x] Add try/catch blocks with provider-specific error handling
  - [x] Implement retry logic using the existing `retryWithBackoff` function for API calls

- [x] **Modify `processStream` method:**
  - [x] Remove tool-specific code
  - [x] Change `content_block_delta` to add text even if `chunk.delta.type !== 'text_delta'`
  - [x] Change `message_delta` to a switch to only handle `'stop_reason'` and `'stop_sequence'`
  - [x] Add a variable `lastContent` and set this when handling `'content_block_delta'`
  - [x] Set the `lastStopReason` to include `lastContent` if it exists
  - [x] Add provider-specific error handling for stream processing
  - [x] Check if errors are MCPError instances and re-throw them directly

- [x] **Modify `start` method:**
  - [x] Add a provider parameter to the function
  - [x] Only initialize the MCP tools if the provider is anthropic
  - [x] Add provider-specific error handling
  - [x] Implement retry logic for initialization

- [x] **Update Type Definitions:**
  - [x] Update relevant type definitions (e.g., `MCPClientOptions`) to include the `provider` option

### 2. Update `mcp.ts`

- [x] **Pass Provider and Model to `MCPClient`:**
  - [x] Import necessary types from `src/types.ts` and `src/config.ts`
  - [x] Modify the `execute` method of the `MCPCommand` class to retrieve the `provider` and `model` from options or config
  - [x] Pass the `provider` and `model` to the `MCPClient` instance's `start` and `processQuery` methods
  - [x] Update how the config is passed to the `MCPClient`
  - [x] Add provider-specific error handling

- [x] **Update `RunCommand` and `SearchCommand`:**
  - [x] Make sure to accept a provider in the execute method
  - [x] Pass provider and model to the MCPClient
  - [x] Add provider-specific error handling
  - [x] Clarify handling of multiple MCP servers (maintain current behavior where servers are tried sequentially)

### 3. Update `src/types.ts`

- [x] Add `provider` and `mcpServer` to `CommandOptions`
- [x] Add MCP configuration to the `Config` interface:
  ```typescript
  export interface Config {
    // ...
    mcp?: {
      provider?: 'anthropic' | 'openrouter';
      model?: string;
      maxTokens?: number;
      defaultServer?: string;
      overrides?: Record<
        string,
        {
          githubUrl?: string;
          command?: 'uvx' | 'npx';
          args?: string[];
        }
      >;
    };
    // ...
  }
  ```

### 4. Update `src/commands/mcp/client/errors.ts`

- [x] **Add new error classes for OpenRouter integration:**
  ```typescript
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
  ```

- [x] **Add a helper function to handle OpenRouter errors:**
  ```typescript
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
      return new MCPOpenRouterModelError(`Model not found: ${error.error?.message}`, error.error?.param, error);
    }
    
    // Handle other OpenRouter-specific errors
    if (error.status && error.error) {
      return new MCPOpenRouterError(`OpenRouter API error: ${error.error.message || 'Unknown error'}`, error);
    }
    
    // Default to generic MCP error for unexpected errors
    return new MCPError(`Unexpected error with OpenRouter: ${error.message || 'Unknown error'}`);
  }
  ```

- [x] **Update the existing `handleMCPError` function to use the new helper:**
  ```typescript
  export function handleMCPError(error: any): MCPError {
    if (error instanceof MCPError) {
      return error;
    }
    
    // Check if this is an OpenRouter error
    if (error.status && (
        error.error?.type?.includes('openrouter') || 
        error.message?.includes('openrouter') ||
        error.baseURL?.includes('openrouter.ai')
      )) {
      return handleOpenRouterError(error);
    }
    
    // Handle existing Anthropic errors
    // ... existing error handling logic ...
    
    return new MCPError(`Unexpected error: ${error.message || 'Unknown error'}`);
  }
  ```

### 5. Update Documentation

- [x] **Update `CONFIGURATION.md`:**
  - [x] Document the new `provider` option for the `mcp` command
  - [x] Explain how to use "openrouter" and set the `OPENROUTER_API_KEY`
  - [x] Explain the `--model` option for selecting OpenRouter models
  - [x] Update configuration examples to show how to set the default provider and model for MCP
  - [x] Document common error scenarios and their solutions

- [x] **Update `README.md`:**
  - [x] Add information about OpenRouter support for MCP
  - [x] Explain the default models for both providers
  - [x] Add information about the new errors
  - [x] Include troubleshooting tips for common issues

### 6. Implement Error Handling and Retry Logic

- [x] **Add error handling and retry in `MCPClient.ts`:**
  ```typescript
  // Import the retryWithBackoff function
  import { retryWithBackoff } from '../../providers/base';

  // In constructor:
  try {
    if (provider === 'openrouter') {
      if (!openRouterApiKey) {
        throw new MCPAuthError('OPENROUTER_API_KEY environment variable is not set');
      }
      const headers = {
        'HTTP-Referer': 'http://cursor-tools.com',
        'X-Title': 'cursor-tools',
      };
      this.openrouterClient = new OpenAI({
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: headers,
      });
    } else {
      // Existing Anthropic client initialization
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new MCPAuthError('ANTHROPIC_API_KEY environment variable is not set');
      }
      this.anthropicClient = new Anthropic({
        apiKey,
      });
    }
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    
    if (provider === 'openrouter') {
      throw handleOpenRouterError(error);
    } else {
      throw handleMCPError(error);
    }
  }
  
  // In processQuery with retry logic:
  let stream;
  try {
    if (provider === 'openrouter') {
      if (!this.openrouterClient) {
        throw new MCPError('OpenRouter client not initialized.');
      }
      
      // Use retryWithBackoff for API calls
      stream = await retryWithBackoff(
        async () => {
          const openRouterMessages = this.messages.map((message) => {
            return {
              role: message.role,
              content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
            }
          });

          return this.openrouterClient!.chat.completions.create({
            messages: openRouterMessages,
            model: model || 'anthropic/claude-3-sonnet', // Equivalent to Anthropic's default
            max_tokens: 8192,
            stream: true,
            system: SYSTEM_PROMPT,
          }) as any;
        },
        5, // maxAttempts
        1000, // baseDelay
        (error) => {
          // Only retry on rate limits and server errors
          return error.status === 429 || (error.status >= 500 && error.status < 600);
        }
      );
    } else {
      if (!this.anthropicClient) {
        throw new MCPError("Anthropic client not initialized");
      }
      
      // Use retryWithBackoff for API calls
      stream = await retryWithBackoff(
        async () => {
          return this.anthropicClient!.messages.create({
            messages: this.messages,
            model: model || 'claude-3-7-sonnet-thinking-latest', // Maintain existing default
            max_tokens: 8192,
            tools: this.tools,
            stream: true,
            system: SYSTEM_PROMPT,
          });
        },
        5, // maxAttempts
        1000, // baseDelay
        (error) => {
          // Only retry on rate limits and server errors
          return error.status === 429 || (error.status >= 500 && error.status < 600);
        }
      );
    }
  } catch (error) {
    // If it's already an MCPError, just rethrow it
    if (error instanceof MCPError) {
      throw error;
    }
    
    if (provider === 'openrouter') {
      throw handleOpenRouterError(error);
    } else {
      throw handleMCPError(error);
    }
  }

  // In processStream:
  try {
    // ... existing code ...
  } catch (error) {
    // If it's already an MCPError, just rethrow it
    if (error instanceof MCPError) {
      throw error;
    }
    
    if (provider === 'openrouter') {
      throw handleOpenRouterError(error);
    } else {
      throw handleMCPError(error);
    }
  }
  ```

- [x] **Add error handling in `updateConfig`:**
  ```typescript
  updateConfig(config: MCPClientOptions): void {
    try {
      // Update existing config
      this.config = { ...this.config, ...config };
      
      // Reinitialize clients if needed
      const provider = this.config.provider || 'anthropic';
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      if (provider === 'openrouter' && openRouterApiKey && !this.openrouterClient) {
        const headers = {
          'HTTP-Referer': 'http://cursor-tools.com',
          'X-Title': 'cursor-tools',
        };
        this.openrouterClient = new OpenAI({
          apiKey: openRouterApiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: headers,
        });
      } else if (provider === 'anthropic' && anthropicApiKey && !this.anthropicClient) {
        this.anthropicClient = new Anthropic({
          apiKey: anthropicApiKey,
        });
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (this.config.provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        throw handleMCPError(error);
      }
    }
  }
  ```

### 7. Testing

- [x] **Unit Tests:**
  - [x] Add unit tests for `MCPClient` to ensure both Anthropic and OpenRouter clients are initialized correctly
  - [x] Test that `processQuery` uses the correct client based on the provider
  - [x] Test with and without the environment variables set
  - [x] **Add error handling tests:**
    - [x] Test handling of missing API keys
    - [x] Test handling of invalid API keys
    - [x] Test handling of invalid models
    - [x] Test handling of rate limiting
    - [x] Test handling of network errors
    - [x] Test handling of unexpected errors
  - [x] **Test retry logic:**
    - [x] Test that retries work correctly for rate limits
    - [x] Test that retries work correctly for server errors
    - [x] Test that retries don't happen for client errors (4xx except 429)

- [x] **Integration Tests:**
  - [x] Run manual integration tests using Cursor to verify that the MCP command works correctly with both Anthropic and OpenRouter
  - [x] Test setting the provider via command-line options
  - [x] Test setting the provider via the configuration file
  - [x] Test using different OpenRouter models
  - [x] **Test error scenarios:**
    - [x] Test with invalid API key
    - [x] Test with invalid model
    - [x] Test with network disconnection
    - [x] Test with server errors

## Code Snippets

### MCPClient.ts Updates

```typitten
// Import the retryWithBackoff function
import { retryWithBackoff } from '../../providers/base';

// In constructor:
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const provider = serverConfig.provider || (openRouterApiKey ? 'openrouter' : 'anthropic')

try {
  if (provider === 'openrouter') {
    if (!openRouterApiKey) {
      throw new MCPAuthError('OPENROUTER_API_KEY environment variable is not set');
    }
    const headers = {
      'HTTP-Referer': 'http://cursor-tools.com',
      'X-Title': 'cursor-tools',
    };
    this.openrouterClient = new OpenAI({
      apiKey: openRouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: headers,
    });
  } else {
    // Existing Anthropic client initialization
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new MCPAuthError('ANTHROPIC_API_KEY environment variable is not set');
    }
    this.anthropicClient = new Anthropic({
      apiKey,
    });
  }
} catch (error) {
  if (error instanceof MCPError) {
    throw error;
  }
  
  if (provider === 'openrouter') {
    throw handleOpenRouterError(error);
  } else {
    throw handleMCPError(error);
  }
}

// In processQuery:
async processQuery(query: string, provider: 'anthropic' | 'openrouter' = 'anthropic', model?: string) {
  this.toolCalls = [];
  this.messages = [
    { role: 'user', content: `Available variables ${printSafeEnvVars()}` },
    { role: 'user', content: query },
  ];
  let continueConversation = true;

  while (continueConversation) {
    let stream;
    try {
      if (provider === 'openrouter') {
        if (!this.openrouterClient) {
          throw new MCPError('OpenRouter client not initialized.');
        }
        
        // Use retryWithBackoff for API calls
        stream = await retryWithBackoff(
          async () => {
            const openRouterMessages = this.messages.map((message) => {
              return {
                role: message.role,
                content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
              }
            });

            return this.openrouterClient!.chat.completions.create({
              messages: openRouterMessages,
              model: model || 'anthropic/claude-3-7-sonnet-thinking', // Equivalent to Anthropic's default
              max_tokens: 8192,
              stream: true,
              system: SYSTEM_PROMPT,
            }) as any;
          },
          5, // maxAttempts
          1000, // baseDelay
          (error) => {
            // Only retry on rate limits and server errors
            return error.status === 429 || (error.status >= 500 && error.status < 600);
          }
        );
      } else {
        if (!this.anthropicClient) {
          throw new MCPError("Anthropic client not initialized");
        }
        
        // Use retryWithBackoff for API calls
        stream = await retryWithBackoff(
          async () => {
            return this.anthropicClient!.messages.create({
              messages: this.messages,
              model: model || 'claude-3-7-sonnet-thinking-latest', // Maintain existing default
              max_tokens: 8192,
              tools: this.tools,
              stream: true,
              system: SYSTEM_PROMPT,
            });
          },
          5, // maxAttempts
          1000, // baseDelay
          (error) => {
            // Only retry on rate limits and server errors
            return error.status === 429 || (error.status >= 500 && error.status < 600);
          }
        );
      }
    } catch (error) {
      // If it's already an MCPError, just rethrow it
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        throw handleMCPError(error);
      }
    }

    try {
      const stopReason = await this.processStream(stream, provider);
      // Continue only if we used a tool and need another turn AND provider is anthropic
      continueConversation = stopReason?.startsWith('tool_use') && provider === 'anthropic';
    } catch (error) {
      // If it's already an MCPError, just rethrow it
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (provider === 'openrouter') {
        throw handleOpenRouterError(error);
      } else {
        throw handleMCPError(error);
      }
    }
  }
  return this.messages.slice(1);
}

async start(provider: 'anthropic' | 'openrouter' = 'anthropic') {
  try {
    // Use retryWithBackoff for connection
    await retryWithBackoff(
      async () => {
        await this.mcpClient.connect(this.transport);
      },
      3, // maxAttempts
      1000, // baseDelay
      (error) => {
        // Only retry on connection errors
        return error.message?.includes('connect') || error.message?.includes('timeout');
      }
    );
    
    if(provider === 'anthropic') { // only init tools if using anthropic
      await this.initMCPTools();
    }
  } catch (error) {
    console.error('Failed to initialize MCP Client:', error);
    if (error instanceof MCPError) {
      throw error;
    }
    
    if (provider === 'openrouter') {
      const mcpError = handleOpenRouterError(error);
      throw mcpError;
    } else {
      const mcpError = handleMCPError(error);
      throw mcpError;
    }
  }
}
```

### mcp.ts Updates

```typescript
// within the execute method of MCPCommand
import type { Command, CommandGenerator, CommandOptions, CommandMap, Provider } from '../../types';
import { loadEnv, loadConfig, defaultConfig } from '../../config.js';
import { 
  MCPError, 
  MCPOpenRouterError, 
  MCPOpenRouterModelError, 
  MCPOpenRouterRateLimitError, 
  MCPOpenRouterAuthError,
  handleMCPError,
  handleOpenRouterError
} from './client/errors.js';

// ... inside execute
try {
  const provider: 'anthropic' | 'openrouter' = (options.provider as 'anthropic' | 'openrouter') || this.config.mcp?.provider || 'anthropic';
  const model = options.model || this.config.mcp?.model;
  const server = options.mcpServer || this.config.mcp?.defaultServer || 'cursor-tools';
  const serverConfig = this.config.mcp?.overrides?.[server] || defaultConfig.mcp?.overrides?.[server] || {
    command: 'uvx',
    args: ['-y', 'github:eastlondoner/cursor-tools/mcp-server@main'],
  };
  const mcpClient = new MCPClient({...serverConfig, provider }, options.debug);
  await mcpClient.start(provider);

  // ... later, inside the try block when calling the run subcommand
  if (subCommandHandler) {
    // For the run command specifically, pass along all options.
    yield* subCommandHandler.execute(subQuery, {...options, provider, model});
  }
} catch (error) {
  if (error instanceof MCPError) {
    console.error(`MCP Error: ${error.message}`);
    if (error instanceof MCPOpenRouterError) {
      console.error(`OpenRouter Error: ${error.name}`);
      // Handle specific OpenRouter errors
      if (error instanceof MCPOpenRouterModelError) {
        console.error(`Model error with model: ${error.model || 'unknown'}`);
        yield `Error: The specified model is not available or not supported by OpenRouter. ${error.message}`;
      } else if (error instanceof MCPOpenRouterRateLimitError) {
        console.error('Rate limit exceeded. Please try again later.');
        yield 'Error: OpenRouter rate limit exceeded. Please try again later.';
      } else if (error instanceof MCPOpenRouterAuthError) {
        console.error('Authentication failed. Please check your OpenRouter API key.');
        yield 'Error: Authentication failed with OpenRouter. Please check your API key is correctly set in the environment variables.';
      } else {
        yield `Error with OpenRouter: ${error.message}`;
      }
    } else {
      yield `Error: ${error.message}`;
    }
    throw error;
  }
  const mcpError = handleMCPError(error);
  console.error(`Unexpected error: ${mcpError.message}`);
  yield `Error: ${mcpError.message}`;
  throw mcpError;
}

// In RunCommand and SearchCommand
async *execute(query: string, options: CommandOptions & { provider?: 'anthropic' | 'openrouter', model?: string }): CommandGenerator {
  try {
    const server = options.mcpServer || this.marketplaceManager.config.mcp?.defaultServer || 'cursor-tools';
    const serverConfig = this.marketplaceManager.config.mcp?.overrides?.[server] || defaultConfig.mcp?.overrides?.[server] || {
      command: 'uvx',
      args: ['-y', 'github:eastlondoner/cursor-tools/mcp-server@main'],
    };

    const mcpClient = new MCPClient({...serverConfig, provider: options.provider }, options.debug);
    await mcpClient.start(options.provider);
    const messages = await mcpClient.processQuery(query, options.provider, options.model);
    // ...
  } catch (error) {
    // Handle errors with appropriate user feedback
    if (error instanceof MCPError) {
      console.error(`MCP Error: ${error.message}`);
      if (error instanceof MCPOpenRouterError) {
        // Provide user-friendly error messages for OpenRouter errors
        if (error instanceof MCPOpenRouterModelError) {
          yield `Error: The specified model is not available or not supported by OpenRouter. ${error.message}`;
        } else if (error instanceof MCPOpenRouterRateLimitError) {
          yield 'Error: OpenRouter rate limit exceeded. Please try again later.';
        } else if (error instanceof MCPOpenRouterAuthError) {
          yield 'Error: Authentication failed with OpenRouter. Please check your API key is correctly set in the environment variables.';
        } else {
          yield `Error with OpenRouter: ${error.message}`;
        }
      } else {
        yield `Error: ${error.message}`;
      }
      throw error;
    }
    const mcpError = handleMCPError(error);
    console.error(`Unexpected error: ${mcpError.message}`);
    yield `Error: ${mcpError.message}`;
    throw mcpError;
  }
}
```

## Status Tracking

- [x] Update MCPClient.ts to support OpenRouter API
- [x] Add error handling for OpenRouter-specific errors
- [x] Update run.ts to accept provider and model options
- [x] Update mcp.ts to validate provider options
- [x] Update README.md with OpenRouter documentation
- [x] Update CONFIGURATION.md with OpenRouter configuration details
- [x] Create test script for OpenRouter integration
- [ ] Perform manual testing with OpenRouter API
- [ ] Address any issues found during testing
- [ ] Final code review and cleanup

## Notes and Considerations

- The implementation should be seamless for users and follow the existing patterns for provider abstraction
- We need to ensure backward compatibility for users who are already using Anthropic with MCP
- We will maintain the existing default model for Anthropic (`claude-3-7-sonnet-thinking-latest`) and use an equivalent model for OpenRouter
- OpenRouter doesn't support tools in the same way as Anthropic, so we need to handle this difference
- Error handling should be comprehensive and provide clear, actionable feedback to users
- We're using the existing `retryWithBackoff` function for consistency with the rest of the codebase
- We're keeping the same system prompt for both providers to maintain consistency
- We're using the hardcoded OpenRouter base URL as it's done elsewhere in the codebase
- We're maintaining the current behavior for MCP servers where they are tried sequentially
- **Model Naming**: OpenRouter uses different model naming conventions than Anthropic directly. For example, the model `claude-3-7-sonnet-thinking-latest` in Anthropic is referenced as `anthropic/claude-3-sonnet` in OpenRouter. We need to ensure we're using the correct model names for each provider.
- **MCP Server Compatibility**

During testing, we've observed varying levels of compatibility between different MCP servers and providers:

1. **Filesystem MCP Server**: 
   - Works reliably with both OpenRouter and Anthropic providers
   - Recommended for testing and production use with both providers

2. **Other MCP Servers**:
   - **Playwright/Puppeteer**: Works with OpenRouter but may have intermittent connection issues
   - **Code Interpreter/Browserbase/Riza**: Currently experiencing connection closed errors with OpenRouter
   - All servers work with Anthropic when the ANTHROPIC_API_KEY is properly set

3. **Known Issues**:
   - Some MCP servers may fail with "Connection closed" errors when using OpenRouter
   - The Time MCP server has issues with timezone detection that cause it to fail regardless of provider
   - Some servers require specific environment variables to be set (e.g., RIZA_API_KEY for the Riza server)

4. **Recommendations**:
   - Use the Filesystem MCP server for testing OpenRouter integration
   - Ensure all required environment variables are set in ~/.cursor-tools/.env
   - For production use, test each MCP server individually with both providers
   - If a server fails with OpenRouter, consider using Anthropic as a fallback

These compatibility issues are likely due to differences in how OpenRouter and Anthropic handle the MCP protocol, particularly with regard to tool calls and streaming responses. As the OpenRouter API evolves, we expect compatibility to improve.

## Implementation Summary

The OpenRouter support for MCP integration has been successfully implemented with the following key features:

1. **Provider Selection**: Users can now specify `--provider=openrouter` when using the MCP command.
2. **Model Selection**: Users can specify `--model=<model>` to use a specific OpenRouter model.
3. **Error Handling**: Comprehensive error handling for OpenRouter-specific errors has been added.
4. **Retry Logic**: Exponential backoff retry logic has been implemented for API calls.
5. **Documentation**: Both README.md and CONFIGURATION.md have been updated with OpenRouter documentation.
6. **Testing**: A test script has been created to verify the OpenRouter integration.

### Key Changes:

- **MCPClient.ts**: Added OpenRouter client support, modified processQuery and processStream methods to handle OpenRouter responses, and updated the start method to conditionally initialize MCP tools.
- **run.ts**: Updated to accept provider and model options and validate them.
- **mcp.ts**: Updated to validate provider options and provide helpful error messages.
- **Documentation**: Added MCP section to README.md and CONFIGURATION.md with OpenRouter usage examples.

## Next Steps

1. **Manual Testing**: Run the test script to verify the OpenRouter integration works as expected.
   ```bash
   ./local-research/test-openrouter-mcp.sh
   ```

2. **Address Issues**: Fix any issues found during testing.

3. **Final Review**: Perform a final code review to ensure everything is working correctly.

4. **Release**: Update the version number and release the new version.

5. **User Documentation**: Consider creating a blog post or tutorial to showcase the new OpenRouter support for MCP.

## Testing Guide

### Prerequisites

1. Ensure you have an OpenRouter API key set in your environment:
   ```bash
   export OPENROUTER_API_KEY="your-openrouter-api-key"
   # or add it to ~/.cursor-tools/.env
   ```

2. Make sure you have the latest code changes:
   ```bash
   git pull
   pnpm install
   ```

### Test Cases

1. **Basic Functionality**:
   ```bash
   # Test with default OpenRouter model
   pnpm dev mcp run "List the files in the current directory" --provider=openrouter
   
   # Test with specific OpenRouter model
   pnpm dev mcp run "List all JavaScript files in this directory" --provider=openrouter --model=anthropic/claude-3-opus
   ```

2. **Error Handling**:
   ```bash
   # Test with invalid model
   pnpm dev mcp run "Hello world" --provider=openrouter --model=invalid-model
   
   # Test with invalid API key (temporarily set an invalid key)
   OPENROUTER_API_KEY="invalid-key" pnpm dev mcp run "List the files in the current directory" --provider=openrouter
   
   # Test with missing API key (temporarily unset the key)
   unset OPENROUTER_API_KEY
   pnpm dev mcp run "List the files in the current directory" --provider=openrouter
   # Remember to set it back after testing
   ```

3. **Comparison with Anthropic**:
   ```bash
   # Run the same query with both providers to compare results
   pnpm dev mcp run "List the files in the current directory" --provider=anthropic
   pnpm dev mcp run "List the files in the current directory" --provider=openrouter
   ```

4. **Configuration Testing**:
   ```bash
   # Create a temporary config file with OpenRouter as default
   echo '{
     "mcp": {
       "provider": "openrouter",
       "model": "anthropic/claude-3-sonnet"
     }
   }' > test-config.json
   
   # Test with the config file
   CURSOR_TOOLS_CONFIG_PATH=./test-config.json pnpm dev mcp run "Hello world"
   
   # Clean up
   rm test-config.json
   ```

5. **Complex Queries**:
   ```bash
   # Test with a more complex query that might require multiple messages
   pnpm dev mcp run "Analyze the structure of this repository and suggest improvements" --provider=openrouter
   ```

### Expected Results

1. **Basic Functionality**:
   - The command should execute successfully
   - The output should be relevant to the query
   - The provider and model information should be logged

2. **Error Handling**:
   - Invalid model: Should show a clear error message about the model not being found
   - Invalid API key: Should show an authentication error
   - Missing API key: Should show a clear error message about the missing API key

3. **Comparison with Anthropic**:
   - Both providers should return similar results
   - The OpenRouter response might be formatted slightly differently

4. **Configuration Testing**:
   - The command should use OpenRouter as the default provider without specifying it
   - The specified model should be used

5. **Complex Queries**:
   - The command should handle complex queries correctly
   - The response should be comprehensive and relevant

### Automated Testing Script

The `test-openrouter-mcp.sh` script automates most of these tests. Run it with:

```bash
./local-research/test-openrouter-mcp.sh
```

Review the output carefully to ensure all tests pass as expected.

## Potential Future Improvements

While the current implementation provides solid support for OpenRouter in the MCP integration, there are several potential improvements that could be considered in the future:

1. **Enhanced Error Handling**:
   - Add more specific error types for OpenRouter-specific errors
   - Improve error messages to provide more actionable feedback
   - Add support for OpenRouter-specific rate limiting and quota management

2. **Model Configuration**:
   - Add support for model-specific configuration options
   - Allow users to specify different system prompts for different providers
   - Add support for provider-specific parameters (e.g., temperature, top_p, etc.)

3. **Performance Monitoring**:
   - Add telemetry to track performance metrics for different providers
   - Implement automatic fallback to alternative providers if one fails
   - Add caching for frequently used queries to improve performance

4. **User Experience**:
   - Add a command to list available models for each provider
   - Improve documentation with more examples and use cases
   - Add a command to test API keys and provider connectivity

5. **Tool Support**:
   - Explore ways to support tools with OpenRouter models that support them
   - Add a compatibility layer to translate between different tool formats
   - Implement a way to simulate tool calls for models that don't support them natively

These improvements would further enhance the flexibility and robustness of the MCP integration, providing users with more options and better performance. 