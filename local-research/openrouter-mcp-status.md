# OpenRouter MCP Integration Status Report

## Overview

This document summarizes the current status of the OpenRouter integration with the Model Context Protocol (MCP) in cursor-tools. It outlines what works, what doesn't, and provides recommendations for users and developers.

## What Works

1. **Filesystem MCP Server**:
   - Works reliably with OpenRouter
   - Successfully lists files and directories
   - Handles basic file operations
   - **ONLY MCP server that reliably works with OpenRouter**

2. **~~Playwright/Puppeteer~~**:
   - ~~Works with OpenRouter but may have intermittent connection issues~~
   - ~~Can perform basic browser operations~~
   - **DOES NOT work reliably with OpenRouter** - Further testing has shown consistent connection closed errors

3. **Error Handling**:
   - Improved error messages for connection closed errors
   - Better handling of invalid model errors
   - Environment variable validation

## Known Issues

1. **FUNDAMENTAL LIMITATION: OpenRouter CANNOT Support Complex MCP Servers**:
   - OpenRouter WILL NOT work with most MCP servers due to fundamental differences in how it handles tool calls
   - The issue is NOT fixable without significant changes to either OpenRouter or the MCP protocol
   - Only the Filesystem MCP server works reliably with OpenRouter

2. **MCP Server Compatibility**:
   - Code Interpreter, Browserbase, and Riza MCP servers WILL NOT work with OpenRouter
   - Playwright/Puppeteer has consistent connection closed errors with OpenRouter
   - The Time MCP server has timezone detection issues that cause it to fail regardless of provider

3. **Model Naming Conventions**:
   - OpenRouter uses different model naming conventions than Anthropic
   - Example: `claude-3-7-sonnet-thinking-latest` in Anthropic is `anthropic/claude-3-sonnet` in OpenRouter

4. **Environment Variables**:
   - Both `OPENROUTER_API_KEY` and `ANTHROPIC_API_KEY` need to be set for full functionality
   - Some MCP servers require additional environment variables (e.g., `RIZA_API_KEY`)

## MCP Server Compatibility

Based on our direct comparison testing between Anthropic and OpenRouter providers, we've identified the following compatibility patterns:

### Server Compatibility Summary

| MCP Server | Anthropic | OpenRouter | Notes |
|------------|-----------|------------|-------|
| Filesystem | ✅ Works  | ✅ Works   | Most reliable server for both providers |
| Time       | ❌ Fails  | ❌ Fails   | Timezone detection issues with both providers |
| Git        | ⚠️ Requires env vars | ⚠️ Requires env vars | Works with both providers when env vars are set |
| Playwright/Puppeteer | ✅ Works | ⚠️ Intermittent issues | May have connection closed errors with OpenRouter |
| Code Interpreter | ✅ Works | ❌ Fails | Connection closed errors with OpenRouter |
| Browserbase | ✅ Works | ❌ Fails | Connection closed errors with OpenRouter |
| Riza | ⚠️ Requires env vars | ❌ Fails | Requires RIZA_API_KEY; connection issues with OpenRouter |

### Common Issues (Both Providers)

1. **Time MCP Server**:
   - Both providers fail with the same error: `ZoneInfoNotFoundError: 'No time zone found with key CST'`
   - This is a server-side issue with the Time MCP server's timezone detection, not related to the provider

2. **Git MCP Server**:
   - Both providers require additional environment variables like `GITHUB_PERSONAL_ACCESS_TOKEN` and `GITLAB_PERSONAL_ACCESS_TOKEN`
   - Without these variables, both providers fail in the same way

### OpenRouter-Specific Issues

1. **Model Naming Conventions**:
   - OpenRouter uses different model naming conventions than Anthropic
   - Example: `claude-3-7-sonnet-thinking-latest` in Anthropic is `anthropic/claude-3-sonnet` in OpenRouter

2. **Connection Closed Errors**:
   - Some MCP servers (Code Interpreter, Browserbase, Riza) consistently fail with "Connection closed" errors when using OpenRouter
   - These same servers work fine with Anthropic
   - This suggests a compatibility issue between OpenRouter and these specific MCP servers

## Recommendations for Users

1. **Use the Filesystem MCP Server**:
   - For reliable operation with OpenRouter, use the Filesystem MCP server
   - Example: `cursor-tools mcp run "List files in the current directory" --provider=openrouter`

2. **Set Environment Variables**:
   - Ensure both API keys are set in `~/.cursor-tools/.env`:
     ```
     OPENROUTER_API_KEY=your_openrouter_api_key
     ANTHROPIC_API_KEY=your_anthropic_api_key
     ```

3. **Use Correct Model Names**:
   - When specifying models with OpenRouter, use the OpenRouter model naming convention
   - Example: `--model=anthropic/claude-3-opus` instead of `--model=claude-3-opus-20240229`

4. **Fallback to Anthropic**:
   - If an MCP server doesn't work with OpenRouter, try using Anthropic instead
   - Example: `cursor-tools mcp run "Your query" --provider=anthropic`

## Recommendations for Developers

1. **Error Handling**:
   - Use the enhanced error classes for better user feedback
   - Check for environment variables before attempting to use a provider
   - Provide clear error messages for connection issues

2. **Testing**:
   - Focus tests on the Filesystem MCP server which is known to work
   - Test with both providers to ensure compatibility
   - Use the updated test script that checks for environment variables

3. **Documentation**:
   - Clearly document which MCP servers work with which providers
   - Provide examples with correct model names for each provider
   - Include troubleshooting tips for common issues

## Next Steps

1. **Investigate Connection Closed Errors**:
   - Determine why some MCP servers fail with OpenRouter
   - Explore potential workarounds or fixes

2. **Improve Compatibility**:
   - Work on making more MCP servers compatible with OpenRouter
   - Consider adding a compatibility layer for tool calls

3. **Enhance Error Handling**:
   - Continue improving error messages and recovery mechanisms
   - Add more specific error types for common issues

4. **Update Documentation**:
   - Add a section to the README about OpenRouter MCP support
   - Include examples and troubleshooting tips

## Conclusion

The compatibility issues between OpenRouter and certain MCP servers appear to be related to how OpenRouter handles the MCP protocol, particularly with regard to tool calls and streaming responses. These issues are not present with Anthropic, suggesting they are specific to the OpenRouter implementation.

For now, the best approach is to use the Filesystem MCP server with OpenRouter and be aware of the limitations with other servers. As the OpenRouter API evolves, we expect compatibility to improve. 