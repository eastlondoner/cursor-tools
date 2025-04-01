# Feature Behavior: Model Context Protocol Edge Cases

## Description
Tests edge cases and error handling scenarios for vibe-tools MCP command interactions, focusing on server configuration, database access issues, and tool-specific edge cases.

## Test Scenarios

### Scenario 1: MCP Run with SQLite Server Override (Happy Path)
**Tags:** parameters
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool with a server override parameter to query the test database at {{path:test.db}}. Run a SELECT query to get all users from the users table.

**Expected Behavior:**
- The AI agent should include the server override parameter pointing to the SQLite MCP server
- The command should execute the `read_query` tool with the SELECT statement
- The response should include the list of users from the database
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly includes the server override parameter for the SQLite MCP server
- Command executes the `read_query` tool with a valid SQL SELECT statement
- Response includes all users from the test database
- No error messages are displayed
- Command completes successfully

### Scenario 2: MCP Run with Invalid Table Schema (Error Handling)
**Task Description:**
Attempt to use vibe-tools to execute the SQLite MCP server's `create_table` tool with an invalid table schema (missing required fields). When running this command include instructions not to retry the table creation if it fails.

**Expected Behavior:**
- The command should fail with a clear error message
- Error message should indicate the schema validation error
- The error should be handled gracefully without crashing

**Success Criteria:**
- AI agent recognizes the schema validation error
- Command fails gracefully with informative error message
- Error message indicates which schema fields are invalid/missing
- No partial or corrupted output is generated

### Scenario 3: MCP Run with Simple Pagination (Edge Case)
**Tags:** performance
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool to test basic pagination by:
1. Getting the total count of users
2. Retrieving the first page (LIMIT 2)
3. Retrieving the second page (LIMIT 2 OFFSET 2)

**Expected Behavior:**
- The command should handle basic pagination correctly
- Each page should return exactly 2 users
- The second page should start after the first page
- Each command should complete quickly

**Success Criteria:**
- AI agent correctly executes the count and paginated queries
- First page shows users 1-2
- Second page shows user 3
- Each query completes in under 5 seconds
- No error messages are displayed
