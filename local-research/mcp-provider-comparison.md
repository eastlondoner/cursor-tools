# MCP Provider Compatibility Comparison

This document summarizes the compatibility of different MCP servers with Anthropic and OpenRouter providers based on our testing.

## Testing Methodology

We conducted direct comparison tests between Anthropic and OpenRouter providers using the same MCP servers and queries. The tests were designed to determine if issues are specific to OpenRouter or if they're more general.

The following tests were performed:
1. Filesystem MCP Server - List files
2. Time MCP Server - Current date and time
3. Git MCP Server - Repository status
4. Invalid model test

## Summary of Findings

### Common Issues

1. **Time MCP Server**:
   - Both providers fail with the same error: `ZoneInfoNotFoundError: 'No time zone found with key CST'`
   - This is a server-side issue with the Time MCP server's timezone detection, not related to the provider

2. **Git MCP Server**:
   - Both providers require additional environment variables like `GITHUB_PERSONAL_ACCESS_TOKEN` and `GITLAB_PERSONAL_ACCESS_TOKEN`
   - Without these variables, both providers fail in the same way

### Provider-Specific Issues

1. **Anthropic**:
   - Model naming: Uses model names like `claude-3-7-sonnet-thinking-latest` and `claude-3-opus-20240229`
   - Default model issues: The default model `claude-3-7-sonnet-thinking-latest` sometimes returns a 404 error

2. **OpenRouter**:
   - Model naming: Uses model names like `anthropic/claude-3-sonnet` and `anthropic/claude-3-opus`
   - Connection closed errors: Some MCP servers fail with "Connection closed" errors specifically with OpenRouter

### Filesystem MCP Server Compatibility

The Filesystem MCP server works reliably with both providers, making it the best choice for testing and production use.

## Detailed Comparison

| MCP Server | Anthropic | OpenRouter | Notes |
|------------|-----------|------------|-------|
| Filesystem | ✅ Works  | ✅ Works   | Most reliable server for both providers |
| Time       | ❌ Fails  | ❌ Fails   | Timezone detection issues with both providers |
| Git        | ⚠️ Requires env vars | ⚠️ Requires env vars | Works with both providers when env vars are set |
| Playwright/Puppeteer | ✅ Works | ⚠️ Intermittent issues | May have connection closed errors with OpenRouter |
| Code Interpreter | ✅ Works | ❌ Fails | Connection closed errors with OpenRouter |
| Browserbase | ✅ Works | ❌ Fails | Connection closed errors with OpenRouter |
| Riza | ⚠️ Requires env vars | ❌ Fails | Requires RIZA_API_KEY; connection issues with OpenRouter |

## Recommendations

1. **For OpenRouter Integration**:
   - Use the Filesystem MCP server for reliable operation
   - Use the correct model naming convention: `anthropic/claude-3-sonnet` instead of `claude-3-7-sonnet-thinking-latest`
   - Be aware that some MCP servers may not work with OpenRouter due to connection issues

2. **For Anthropic Integration**:
   - Most MCP servers work well with Anthropic
   - Use the correct model naming convention: `claude-3-7-sonnet-thinking-latest` or `claude-3-opus-20240229`
   - Be aware of the default model issues and consider specifying a model explicitly

3. **For Both Providers**:
   - Set all required environment variables for the MCP servers you plan to use
   - Be aware of the Time MCP server timezone detection issues
   - Consider using Anthropic as a fallback when OpenRouter fails with a specific MCP server

## Conclusion

The issues with OpenRouter and MCP servers appear to be a combination of:

1. **Server-specific issues** that affect both providers (like the Time MCP server timezone detection)
2. **Provider-specific issues** with OpenRouter (connection closed errors with some servers)
3. **Configuration issues** (different model naming conventions, missing environment variables)

The Filesystem MCP server is the most reliable option for both providers, while other servers may require additional configuration or may not work with OpenRouter at all. 