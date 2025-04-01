# Implementation Plan: Adding Filesystem MCP Server to Test Executor

## Overview

This plan outlines the steps to add the filesystem MCP server to `src/commands/test/executor-new.ts` as a tool available to tests. The filesystem MCP will be configured with `@modelcontextprotocol/server-filesystem` and will only have access to the temporary test directory. We'll also update the prompt to inform the test executor about these limitations.

## Implementation Steps

### 1. Configure the Filesystem MCP Server

We need to set up the filesystem MCP server with the following configuration:

```json
"filesystem": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/path/to/temporary/test/directory"
  ]
}
```

Where `/path/to/temporary/test/directory` will be the temporary directory created for each test scenario.

This should be passed in to the UnifiedLLMClient constructor so that it has access to the tool

### 2. Update the System Prompt

Update the system prompt to inform the test executor about the filesystem MCP tool and its limitations. The prompt should clearly explain:

1. That the filesystem MCP tool is available for file operations
2. The exact capabilities of the tool (read, write, list, etc.)
3. That it can ONLY access files within the temporary test directory
4. Examples of how to use the tool for common operations

```typescript
const systemPrompt = `You are a testing agent for vibe-tools commands. Your task is to execute the test scenario provided using the tools available to determine if vibe-tools is working correctly and report the results.

<filesystem_mcp_tool>
A filesystem MCP tool (filesystem_mcp) is available for file operations. This tool is configured via '@modelcontextprotocol/server-filesystem' and can ONLY access the temporary test directory (${tempDir}).

The filesystem_mcp tool supports the following operations:
- read: Read the contents of a file
- write: Write content to a file
- list: List files in a directory
- exists: Check if a file or directory exists
- mkdir: Create a directory

Examples:
- To read a file: filesystem_mcp({ operation: 'read', path: 'example.txt' })
- To write to a file: filesystem_mcp({ operation: 'write', path: 'example.txt', content: 'Hello world' })
- To list files: filesystem_mcp({ operation: 'list', path: '.' })

IMPORTANT: Do NOT attempt to use this tool to access files outside the temporary test directory (${tempDir}).
</filesystem_mcp_tool>

${CURSOR_RULES_TEMPLATE}

Execute the test scenario provided and report the results. If you run into problems executing the scenario, make 3 attempts to execute the scenario. If you still run into problems after 3 attempts, report the results as FAIL.

<hints>
The available command line tools are vibe-tools, ${tools.map((t) => t.name).join(', ')}. Other command line tools are not permitted.
Reply with your workings and your findings. Only use tools to perform the test; do not use tools to communicate your results.
</hints>

Update me on what you are doing as you execute the test scenario. Once you determine that it's passed or failed, report the results in the following format:
${jsonResponseInstructions}
`;
```
