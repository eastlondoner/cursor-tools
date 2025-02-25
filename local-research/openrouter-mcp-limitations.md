# OpenRouter MCP Limitations: Technical Explanation

## Summary

OpenRouter **CANNOT** work with most MCP servers, particularly complex ones like Code Interpreter, due to fundamental differences in how it handles tool calls compared to Anthropic's native implementation. This document explains the technical reasons for these limitations.

## Technical Explanation

### 1. Different Tool Call Handling Mechanisms

- **Anthropic's API**: Has native, built-in support for tool use with a specific format for tool calls in the message structure. Claude models are specifically trained to use tools and understand the tool call protocol.

- **OpenRouter's API**: Acts as an aggregator/proxy that standardizes APIs across different providers. It uses an OpenAI-compatible format that doesn't fully preserve Anthropic's tool call mechanism.

- **Impact**: When an MCP server like Code Interpreter attempts to use tool calls with OpenRouter, the connection is closed unexpectedly because OpenRouter doesn't properly handle these tool calls.

### 2. Stream Processing Differences

- **Anthropic**: Returns streaming tool calls with specific event types like `tool_use`, `content_block_delta`, and `message_delta` that the MCP client is designed to parse.

- **OpenRouter**: Uses a simplified streaming format that doesn't include these specialized event types, causing the MCP client to miss tool call events.

- **Impact**: The MCP client cannot properly process tool calls when using OpenRouter, leading to connection closed errors or incomplete functionality.

### 3. Implementation in cursor-tools

Our codebase explicitly disables tool call continuation for OpenRouter with this line in `MCPClient.ts`:

```typescript
continueConversation = provider === 'anthropic' ? Boolean(stopReason?.startsWith('tool_use')) : false;
```

The comment states: "OpenRouter doesn't support tool calls in the same way, so we always set to false for OpenRouter."

### 4. MCP Server Complexity Levels

Different MCP servers have different levels of tool call complexity:

- **Filesystem MCP Server**: Uses simple tool calls that OpenRouter can handle, as they're more straightforward and don't require complex back-and-forth interactions.

- **Code Interpreter MCP Server**: Uses more complex tool calls that require the full Anthropic tool call protocol, including multiple rounds of tool use and result processing.

## Why This Cannot Be Fixed Easily

1. **Fundamental API Differences**: The issue is not a simple bug but a fundamental difference in how OpenRouter and Anthropic handle tool calls.

2. **OpenRouter's Design**: OpenRouter is designed to provide a standardized API across different providers, which inherently limits its ability to support provider-specific features like Anthropic's tool calls.

3. **MCP Protocol Requirements**: The MCP protocol was designed with Anthropic's tool call mechanism in mind and expects specific behavior that OpenRouter cannot provide.

## Recommendations

1. **Use Anthropic Provider for Complex MCP Servers**:
   ```bash
   cursor-tools mcp run "Your code interpreter query" --provider=anthropic
   ```

2. **Only Use OpenRouter with the Filesystem MCP Server**:
   ```bash
   cursor-tools mcp run "List files in the current directory" --provider=openrouter
   ```

3. **Do Not Attempt to Use Code Interpreter with OpenRouter**:
   This will consistently fail and is not a supported configuration.

## Conclusion

The limitations of OpenRouter with MCP servers are inherent to its design and cannot be resolved without significant changes to either OpenRouter or the MCP protocol itself. Users should be clearly advised of these limitations and directed to use Anthropic for complex MCP servers. 