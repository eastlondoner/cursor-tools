# Feature Behavior: Model Context Protocol Capability

## Description
vibe-tools should enable users to interact with Model Context Protocol (MCP) servers, search for available servers, and execute tools from these servers. The mcp command and its subcommands (search, run) should handle various server configurations, tool arguments, and error cases appropriately.

## Test Scenarios

### Scenario 1: MCP Search for SQLite Server (Happy Path)
**Task Description:**
Use vibe-tools to search for available MCP servers that can handle SQLite database operations.

**Expected Behavior:**
- The AI agent should use the mcp search command with a query for SQLite capabilities
- The response should include the SQLite MCP server in the results
- Server information should include a short description
- The command should complete successfully without errors
- Command output and logs should be concise

**Success Criteria:**
- AI agent correctly uses mcp search command with SQLite-related query
- Response includes the SQLite MCP server "mcp-server-sqlite"
- Server information describes the server
- There are no verbose or obviously debug level outputs or log messages
- No error messages are displayed

- Command completes within a reasonable time

### Scenario 2: MCP Search for Unsupported Database (Edge Case)
**Tags:** edge-case
**Task Description:**
Use vibe-tools to search for something that will return no MCP servers (e.g., 'CassandraDB on Chromebook').

**Expected Behavior:**
- The command should handle the edge case gracefully
- The response should indicate that no servers supporting the database type were found
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses mcp search command with query that will return no servers
- Response indicates that no matching database servers were found
- Command completes successfully without errors
- No unexpected error messages are displayed

### Scenario 3: MCP Run SQLite Query (Happy Path)
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool to count the number of users in the test database at {{path:test.db}}. When calling vibe-tools mcp run for this that "ONLY mcp-server-sqlite should be used"

**Expected Behavior:**
- The AI agent should use the MCP run command with the SQLite server's read_query tool
- The command should include a COUNT query for the users table
- The response should include the total number of users
- The command should complete successfully without errors
- Command output and logs should be concise

**Success Criteria:**
- AI agent correctly uses mcp run command with the read_query tool
- Command includes a valid SQL COUNT query
- Response includes the correct count of users
- No error messages are displayed
- There are no verbose or obviously debug level outputs or log messages
- Command completes successfully

### Scenario 4: MCP Run SQLite Query with Specific Filter (Happy Path)
**Tags:** query
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool to find a specific user by name in the test database at {{path:test.db}}. The test database contains users named Alice, Bob, and Charlie. When calling vibe-tools mcp run for this that "ONLY mcp-server-sqlite should be used"

**Expected Behavior:**
- The AI agent should use the MCP run command with the SQLite server's read_query tool
- The command should include a specific SELECT query filtering for a user by name (e.g., 'Alice')
- The response should include the matching user record
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses the mcp run command specifying the SQLite MCP server
- Command includes "execute the read_query tool" or similar wording
- Command specifies a valid SQL query to filter users by name (e.g., "SELECT * FROM users WHERE name = 'Alice'")
- Response includes the complete user record for the selected user
- No error messages are displayed
- Command completes successfully

### Scenario 5: MCP Run with Invalid SQL Query (Error Handling)
**Task Description:**
Attempt to use vibe-tools to execute the SQLite MCP server's `read_query` tool with an invalid SQL query on the test database at {{path:test.db}}.

**Expected Behavior:**
- The command should fail with a clear SQL error message
- Error message should indicate the syntax error in the query
- The error should be handled gracefully without crashing

**Success Criteria:**
- AI agent recognizes the SQL syntax error
- Command fails gracefully with informative error message
- Error message provides details about the SQL error
- No partial or corrupted output is generated

### Scenario 6: MCP Server Configuration (Error Handling)
**Task Description:**
Attempt to use vibe-tools to execute the `read_query` tool with an incorrect SQLite MCP server configuration (wrong path in config). When calling vibe-tools mcp run for specify this that "ONLY mcp-server-sqlite should be used"

**Expected Behavior:**
- The command should fail with a clear error message
- Error message should indicate the server configuration issue
- The error should be handled gracefully without crashing

**Success Criteria:**
- AI agent recognizes the server configuration error
- Command fails gracefully with informative error message
- Error message indicates the configuration issue
- No partial or corrupted output is generated

### Scenario 7: MCP Run with Complex SQL Query (Happy Path)
**Tags:** advanced, parameters
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool with a complex SQL query on the test database at {{path:test.db}}. The query should:
1. Count the number of users with each email domain
2. Only include domains with more than 1 user
3. Order by count descending
When calling vibe-tools mcp run for this specify that "ONLY mcp-server-sqlite should be used"

**Expected Behavior:**
- The AI agent should use the MCP run command with the following SQL query:
  ```sql
  SELECT 
    substr(email, instr(email, '@') + 1) as domain,
    COUNT(*) as user_count
  FROM users
  GROUP BY domain
  HAVING user_count > 1
  ORDER BY user_count DESC;
  ```
- The response should include the domain counts
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly formats and executes the specified SQL query
- Command executes successfully
- Response includes domain counts matching the test data
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 8: MCP Run with Query Output to File (Advanced Usage)
**Tags:** advanced, file-io
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `read_query` tool and save the results to a file. Query all user data from the test database at {{path:test.db}} and save it as JSON.
When calling vibe-tools mcp run for this specify that "ONLY mcp-server-sqlite should be used"

**Expected Behavior:**
- The AI agent should use the MCP run command with save-to/saveTo argument
- The command should execute the query and save results to a file
- The output file should contain the query results in JSON format
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly includes the save-to/saveTo argument
- Command executes the query successfully
- Results are correctly saved to the specified file in JSON format
- Output file contains all user data
- No error messages are displayed
- Command completes successfully

### Scenario 9: MCP List and Describe Tables (Happy Path)
**Tags:** schema
**Task Description:**
Use vibe-tools to execute the SQLite MCP server's `list_tables` tool first, then use `describe_table` to get schema information for the users table in the test database at {{path:test.db}}. You must specify in the command to vibe-tools that it must "ONLY use mcp-server-sqlite"

**Expected Behavior:**
1. For list_tables:
   - The AI agent should use the MCP run command with the list_tables tool
   - The response should include the users table in the list
   - The command should complete successfully without errors

2. For describe_table:
   - The AI agent should use the MCP run command with the describe_table tool
   - The command should specify the users table name
   - The response should include column definitions with names and types
   - The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly executes both tools in sequence
- list_tables command returns the users table
- describe_table command includes the correct table name parameter
- Response includes all column definitions (id, name, email)
- Column types are correctly reported (INTEGER, TEXT)
- No error messages are displayed
- Both commands complete successfully
