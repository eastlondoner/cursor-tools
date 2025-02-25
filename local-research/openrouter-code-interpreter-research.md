Querying perplexity using sonar-pro for: Why does the Code Interpreter MCP server fail with OpenRouter but work with Anthropic? Are there any known solutions or workarounds for using Code Interpreter MCP with OpenRouter? What are the technical differences in how OpenRouter and Anthropic handle tool calls? with maxTokens: 8000
The Code Interpreter MCP (Multi-modal Conversational Programming) server failing with OpenRouter but working with Anthropic is likely due to differences in how these services handle tool calls and streaming responses. Here's an analysis of the situation and potential solutions:

## Technical Differences

1. Tool Call Handling:
   - Anthropic models like Claude 3.5 Sonnet have built-in support for tool use, including a Code Interpreter tool[2]. This allows for seamless integration with the MCP server.
   - OpenRouter, being an API aggregator, may not fully support or properly translate tool calls for all the models it provides access to[1].

2. Streaming Responses:
   - Anthropic's API returns streaming tool calls all at once after a delay[5]. This behavior is likely expected and handled by the MCP server.
   - OpenRouter might not maintain this exact behavior when proxying requests to various models, potentially causing issues with the MCP server's expectations.

3. API Structure:
   - Anthropic's API integrates tools directly into the `user` and `assistant` message structure[2]. The MCP server is likely designed to work with this specific format.
   - OpenRouter's standardized API may not preserve this exact structure, leading to compatibility issues.

## Potential Solutions and Workarounds

1. Use Anthropic Directly:
   - The most straightforward solution is to use Anthropic's API directly for Code Interpreter functionality, bypassing OpenRouter[2].

2. OpenRouter Configuration:
   - Check if OpenRouter has any specific settings or endpoints for tool use. You may need to configure your requests differently when using OpenRouter[1].

3. Model Selection:
   - Ensure you're using a model through OpenRouter that supports tool calls. Not all models available via OpenRouter may have this capability[1].

4. Custom Middleware:
   - Implement a middleware layer that translates OpenRouter's responses into a format expected by the MCP server, mimicking Anthropic's API structure[5].

5. OpenRouter Support:
   - Contact OpenRouter support to inquire about their tool call support and any plans to improve compatibility with systems like the Code Interpreter MCP server[3].

6. MCP Server Modification:
   - If you have access to the MCP server code, consider modifying it to handle the differences in OpenRouter's API responses[4].

7. Alternative Tools:
   - Explore alternative code interpretation tools that may be more compatible with OpenRouter's API structure[6].

## Conclusion

The core issue likely stems from the differences in how Anthropic and OpenRouter handle tool calls and structure their API responses. Anthropic's native support for tools like Code Interpreter makes it more compatible with the MCP server out of the box. To use OpenRouter effectively, you may need to either adapt your integration approach or work with OpenRouter to ensure proper support for tool calls and streaming responses in a format compatible with your MCP server implementation.