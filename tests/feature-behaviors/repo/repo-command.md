# Feature Behavior: Repository Analysis Capability

## Description

cursor-tools should enable users to analyze repository context and answer questions about the codebase. The repo command should leverage AI models to understand the repository structure, code patterns, and functionality, providing context-aware answers to user queries.

## Test Scenarios

### Scenario 1: Basic Repository Analysis (Happy Path)

**Task Description:**
Use cursor-tools to ask a simple question about the current repository's structure or functionality.

**Expected Behavior:**

- The AI agent should determine the appropriate command to use
- The response should include relevant information about the repository
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly uses repo command with appropriate parameters
- Response contains relevant information that answers the query
- Response demonstrates understanding of the repository context
- No error messages are displayed
- Command completes within a reasonable time
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 2: Repository Analysis with Different Providers and Models (Happy Path)

**Task Description:**
Use cursor-tools to ask the same question about the repository using different providers and models. Test both the `--provider` parameter and the `--model` parameter in separate commands.

**Expected Behavior:**

- The AI agent should test both provider and model parameters in separate commands
- The response should include relevant information about the repository
- The command output should indicate which provider or model is being used

**Success Criteria:**

- AI agent correctly specifies different providers in separate commands using the `--provider` parameter
- AI agent correctly specifies different models in separate commands using the `--model` parameter
- Each command completes successfully
- Responses contain relevant information about the repository
- Differences in provider/model responses are noted and compared
- No error messages are displayed
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 3: Repository Analysis with a Complex Query (Happy Path)

**Tags:** advanced
**Task Description:**
Use cursor-tools to ask a complex question about the repository that requires understanding multiple parts of the codebase.

**Expected Behavior:**

- The AI agent should construct a command with a detailed query
- The response should include comprehensive information about the relevant parts of the codebase
- The response should demonstrate understanding of relationships between different components
- The command should complete successfully without errors

**Success Criteria:**

- AI agent successfully constructs a command with a detailed query
- Response includes comprehensive information about relevant parts of the codebase
- Response demonstrates understanding of relationships between components
- Command completes successfully without errors
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 4: Repository Analysis with Save-to Option (Happy Path)

**Tags:** file-io, parameters
**Task Description:**
Use cursor-tools to analyze the repository and save the results to a file.

**Expected Behavior:**

- The AI agent should include the save-to parameter in the command
- The response should be saved to the specified file
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the save-to parameter in the command
- Response is saved to the specified file
- File contains the same content as displayed in the console
- Command completes successfully
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 5: Repository Analysis with Invalid Provider and Model (Error Handling)

**Task Description:**
Attempt to use cursor-tools to analyze the repository using both an invalid provider and an invalid model in separate commands.

**Expected Behavior:**

- When using an invalid provider, the command should fail with a clear error message
- When using an invalid model, the command should fail with a clear error message
- Error messages should mention that the specified provider or model is invalid
- Error messages should list available providers or models

**Success Criteria:**

- AI agent recognizes both the invalid provider error and the invalid model error
- Commands fail gracefully with informative error messages
- Error messages include suggestions for valid providers or models
- No partial or corrupted output is generated

### Scenario 6: Repository Analysis with Missing API Key (Error Handling)

**Task Description:**
Attempt to use cursor-tools to analyze the repository using the gemini provider when no API key is configured. To simulate this, set CURSOR_TOOLS_ENV_UNSET=GEMINI_API_KEY when running the command and specify the gemini provider explicitly.

**Expected Behavior:**

- When the API key is not available, the command should fail with a clear error message
- Error message should mention the missing API key
- Error message should provide guidance on how to configure the API key

**Success Criteria:**

- AI agent recognizes the missing API key issue
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated

### Scenario 7: Repository Analysis with Max-Tokens Parameter (Happy Path)

**Tags:** tokens, parameters
**Task Description:**
Use cursor-tools to analyze the repository with a specified token limit for the response.

**Expected Behavior:**

- The AI agent should include the max-tokens parameter in the command
- The response should adhere to the specified token limit
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the max-tokens parameter in the command
- Response respects the token limit specified
- Response still contains useful information despite the token limit
- No error messages are displayed

### Scenario 8: Repository Analysis for Code Understanding (Happy Path)

**Task Description:**
Use cursor-tools to ask about how a specific feature or function works in the repository.

**Expected Behavior:**

- The AI agent should construct a command with a query about the specific feature
- The response should include detailed explanation of how the feature works
- The response should reference relevant files and code sections
- The command should complete successfully without errors

**Success Criteria:**

- AI agent successfully constructs a command with a query about the specific feature
- Response includes detailed explanation of how the feature works
- Response references relevant files and code sections
- Command completes successfully without errors

### Scenario 9: Repository Analysis for Architecture Overview (Happy Path)

**Task Description:**
Use cursor-tools to ask for an overview of the repository's architecture and design patterns.

**Expected Behavior:**

- The AI agent should construct a command with a query about the architecture
- The response should include a high-level overview of the repository's architecture
- The response should identify key design patterns and architectural decisions
- The command should complete successfully without errors

**Success Criteria:**

- AI agent successfully constructs a command with a query about the architecture
- Response includes a high-level overview of the repository's architecture
- Response identifies key design patterns and architectural decisions
- Command completes successfully without errors
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 10: Invalid Key (Fallback to alternate provider)

**Task Description:**
Attempt to use cursor-tools to analyze the repository without setting explicit provider and model when an invalid GEMINI_API_KEY is present. To simulate this, set GEMINI_API_KEY=invalid and do not specify a provider.

**Expected Behavior:**

- When the API key is invalid, the command should fall back to trying alternate providers
- An error message should be logged that mentions that the API key is not valid
- The alternate provider implementation should succeed. It may switch to a suitable large context model.

**Success Criteria:**

- the invalid API key issue is logged
- Command succeeds by using an alternate provider
- A satisfactory, correct answer is returned
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 11: Repomixignore file support

**Task Description:**
We're going to verify that cursor-tools repo respects the .repomixignore file. First check that the .repomixignore file is either empty or not present. Use cursor-tools to analyze the repository, note how many tokens are used.

Then create a .repomixignore file using the content from {{path:repomixignore-with-src.txt}} and repeat the same query. Note how many tokens are used on the second query - it should be much less since we're excluding the src directory.

**Expected Behavior:**

- Files that match patterns in the .repomixignore should not be included in the repository context sent with the repo command
- The repo command logs the number of tokens in the packed repo context
- Token usage is much less when there are significant ignores
- The repo command succeeds on both queries. Although for the 2nd query the answer may now be incorrect

**Success Criteria:**

- Command succeeds on both queries
- The second query has much lower token usage

### Scenario 12: Subdirectory Analysis (Happy Path)

**Tags:** subdir, parameters
**Task Description:**
Use cursor-tools to analyze a specific subdirectory of the repository instead of the entire repository by using the `--subdir` parameter.

**Expected Behavior:**

- The AI agent should include the `--subdir` parameter in the command
- The response should include information specific to the subdirectory
- The command should complete successfully without errors
- The token usage should be less than analyzing the entire repository

**Success Criteria:**

- AI agent correctly includes the `--subdir` parameter in the command
- Response contains information specific to the subdirectory
- Response demonstrates understanding of the subdirectory context
- Token usage is less compared to analyzing the entire repository
- No error messages are displayed
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 13: Subdirectory Analysis with Invalid Path (Error Handling)

**Tags:** subdir, error-handling
**Task Description:**
Attempt to use cursor-tools to analyze a non-existent subdirectory using the `--subdir` parameter.

**Expected Behavior:**

- When using a non-existent subdirectory path, the command should fail with a clear error message
- Error message should mention that the specified subdirectory does not exist
- Error message should provide guidance on using a valid subdirectory path

**Success Criteria:**

- AI agent recognizes the invalid subdirectory path error
- Command fails gracefully with an informative error message
- Error message clearly indicates that the specified subdirectory does not exist
- No partial or corrupted output is generated

### Scenario 14: Custom Repomix Configuration (Happy Path)

**Tags:** repomix-config, configuration
**Task Description:**
Use cursor-tools to analyze the repository with a custom repomix.config.json file that modifies which files are included/excluded.

First, create a repomix.config.json file using the content from {{path:basic-repomix-config.json}} in the repository root. Then, run a query about the repository structure and observe if the configuration is respected.

**Expected Behavior:**

- The command should detect and use the custom repomix.config.json file
- The configuration should exclude files specified in the config
- The logs should indicate that the repomix config is being loaded from the local file
- The response should reflect that certain files are excluded

**Success Criteria:**

- Command output mentions loading repomix config from the local file
- Token count in the packed repository should be consistent with the configured exclusions
- Response only references files that aren't excluded by the configuration
- Command completes successfully without errors
- The configuration is properly applied before repository analysis
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 15: Analyze GitHub Repository Structure (Remote Analysis)

**Task Description:**
Use cursor-tools to analyze the kaito-http/kaito GitHub repository and ask "How kaito UWS gets the remote address for a request".

**Expected Behavior:**

- The AI agent should use the repo command with the GitHub repository reference
- The response should include details about how kaito UWS retrieves remote addresses
- The command should handle the GitHub repository analysis correctly
- The command should complete successfully without errors

**Success Criteria:**

- AI agent should use repo --from-github command specifically
- AI agent correctly constructs a command to analyze the GitHub repository
- Response includes specific information about remote address retrieval in kaito UWS
- Response mentions async local storage
- Command completes successfully without errors
- The command output correctly handles repository size limitations
- The command output does not include unnecessarily verbose or debugging messages
- The command output does not include any security tokens or API keys

### Scenario 16: Large Repository Error Handling (Error Handling)

**Task Description:**
Use cursor-tools to analyze the facebook/react GitHub repository, which is a very large codebase likely to exceed size limits.

**Expected Behavior:**

- The command should recognize that the repository is too large
- The command should return a clear, helpful error message about size limitations
- The command should not perform excessive retries
- The command should fail gracefully

**Success Criteria:**

- AI agent correctly constructs a command to analyze the GitHub repository
- Command fails with a clear error message related to repository size limitations
- Error message provides guidance on potential solutions
- Command does not perform more than one or two retries before failing
- The error handling is graceful with no stack traces unless --debug is used
- The command output does not include any security tokens or API keys
