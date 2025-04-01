# Feature Behavior: Web Search Capability

## Description
vibe-tools should enable users to search the web for information using AI models that support web search capabilities. The web command should work with various supported providers (Perplexity, Gemini, etc.), handle different output formats, and provide appropriate error messages when necessary.

## Test Scenarios

### Scenario 1: Basic Web Search (Happy Path)
**Task Description:**
Use vibe-tools to search the web for information about a recent technology topic. Do not specify the current date.

**Expected Behavior:**
- The AI agent should determine the appropriate command to use with a supported provider
- The response should include relevant and up-to-date information about the topic
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses web command with appropriate provider parameter
- Response contains relevant information that answers the query
- Response includes information that would require web access (not just general knowledge)
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Web Search with Different Providers (Happy Path)
**Task Description:**
Use vibe-tools to search the web for the same information using each supported provider that has web search capabilities:
- Perplexity (primary web search provider)
- Gemini (supports web search)
- ModelBox (supports web search via Gemini models)

**Note:** Not all providers support web search. Anthropic, OpenAI do not currently support web search capabilities and will return an error message if used with the web command.

**Expected Behavior:**
- The AI agent should run the web command with different supported providers
- Each command should return relevant information
- The responses may differ in content and style based on the provider

**Success Criteria:**
- AI agent correctly specifies different providers in separate commands
- Each command completes successfully
- Responses contain relevant information about the topic
- Differences in provider responses are noted and compared

### Scenario 3: Web Search with Save-to Option (Happy Path)
**Tags:** file-io, parameters
**Task Description:**
Use vibe-tools to search the web for information and save the results to a file.

**Expected Behavior:**
- The AI agent should include the save-to parameter in the command
- The response should be saved to the specified file
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly includes the save-to parameter in the command
- Response is saved to the specified file
- File contains the same content as displayed in the console
- Command completes successfully

### Scenario 4: Web Search with Max-Tokens Parameter (Happy Path)
**Tags:** tokens, parameters
**Task Description:**
Use vibe-tools to search the web for information that might require a lengthy response, but limit the response using the max-tokens parameter.

**Note:** Try different token limits (e.g., 100, 200, 500) to demonstrate how the response length varies. The default is 8000 tokens if not specified.

**Expected Behavior:**
- The AI agent should include the max-tokens parameter in the command (e.g., `--max-tokens=200`)
- The response should adhere to the specified token limit
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly includes the max-tokens parameter in the command
- Response respects the token limit specified
- Response still contains useful information despite the token limit
- No error messages are displayed

### Scenario 5: Web Search with Invalid Provider (Error Handling)
**Task Description:**
Attempt to use vibe-tools to search the web using a provider that doesn't support web search or doesn't exist:

- Anthropic (a valid provider that doesn't support web search)
- ImaginaryProvider (a non-existent provider)

**Expected Behavior:**
- The command should fail with a clear error message
- For Anthropic, the error message should indicate that Anthropic does not support web search capabilities
- For a non-existent provider, the error message should indicate that there is no such provider

**Success Criteria:**
- AI agent recognizes the invalid provider error
- Command fails gracefully with informative error message
- Error messages are correctly reported and interpreted
- No partial or corrupted output is generated

### Scenario 6: Web Search with Missing API Key (Error Handling)
**Task Description:**
Attempt to use vibe-tools to search the web using a provider for which no API key is configured. To do this you will have to explicitly set one of
- GEMINI_API_KEY=""
- PERPLEXITY_API_KEY=""
- MODELBOX_API_KEY=""

and explicitly set the corresponding provider.

**Expected Behavior:**
- When the API key is not available, the command should fail with a clear error message
- Error message should mention the missing API key
- Error message should provide guidance on how to configure the API key

**Success Criteria:**
- AI agent recognizes the missing API key issue
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated



### Scenario 7: Web Search for Complex Query (Happy Path)
**Tags:** advanced
**Task Description:**
Use vibe-tools to search the web for information about a complex topic that requires synthesizing information from multiple sources.

**Expected Behavior:**
- The AI agent should construct a command with the complex query
- The response should include comprehensive information from multiple sources
- The command should complete successfully without errors

**Success Criteria:**
- AI agent successfully passes the complex query to the web command
- Response includes information synthesized from multiple sources
- Response provides a comprehensive answer to the complex query
- Command completes successfully

### Scenario 8: Web Search for Time-Sensitive Information (Happy Path)
**Tags:** time-sensitive
**Task Description:**
Use vibe-tools to search the web for recent news or time-sensitive information.

**Expected Behavior:**
- The AI agent should construct a command to search for recent information
- The response should include up-to-date information
- The command should complete successfully without errors

**Success Criteria:**
- AI agent successfully constructs a command for searching recent information
- Response includes recent information that would require web access
- Response mentions the recency of the information
- Command completes successfully

### Scenario 9: Web Search with Specific Domain Focus (Advanced Usage)
**Tags:** advanced, parameters
**Task Description:**
Use vibe-tools to search the web for information with a focus on a specific domain or website.

**Expected Behavior:**
- The AI agent should include domain-specific parameters in the search query
- The response should focus on information from the specified domain
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly includes domain-specific parameters in the search query
- Response focuses on information from the specified domain
- Response provides relevant information related to the query
- Command completes successfully

### Scenario 10: Fallback with Invalid API Key (Fallback)
**Task Description:**
Attempt to use vibe-tools to search the web without setting a provider when the PERPLEXITY_API_KEY is invalid. To do this you will have to explicitly set PERPLEXITY_API_KEY="invalid" when running vibe-tools.

**Expected Behavior:**
- When the API key is invalid, the command should log a clear error message
- Error message should mention the invalid API key
- The command should fall back to using an alternate provider
- The command should succeed when using the alternate provider

**Success Criteria:**
- The logs indicate the invalid key issue
- Command succeeds using alternate provider and returns a valid response
