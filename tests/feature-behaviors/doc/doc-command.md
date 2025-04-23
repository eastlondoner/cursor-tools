# Feature Behavior: Documentation Generation Capability

## Description

vibe-tools should enable users to generate comprehensive documentation for repositories. The doc command should analyze the repository structure, code patterns, and functionality to create detailed documentation that can be saved to a file or displayed in the console.

## Test Scenarios

### Scenario 1: Basic Documentation Generation (Happy Path)

**Task Description:**
Use vibe-tools to generate documentation for the current repository.

**Expected Behavior:**

- The AI agent should determine the appropriate command to use
- The response should include comprehensive documentation about the repository
- The documentation should cover the repository structure, key components, and functionality
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly uses doc command with appropriate parameters
- Response contains comprehensive documentation about the repository
- Documentation covers repository structure, key components, and functionality
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Documentation Generation with Output File (Happy Path)

**Tags:** file-io, parameters
**Task Description:**
Use vibe-tools to generate documentation for the current repository and save it to a specified output file.

**Expected Behavior:**

- The AI agent should include the output parameter in the command
- The documentation should be saved to the specified file
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the output parameter in the command
- Documentation is saved to the specified file
- File contains comprehensive documentation about the repository
- Command completes successfully

### Scenario 3: Documentation Generation for Remote Repository (Happy Path)

**Tags:** advanced
**Task Description:**
Use vibe-tools to generate documentation for a remote GitHub repository.

**Expected Behavior:**

- The AI agent should include the repository URL in the command
- The response should include comprehensive documentation about the remote repository
- The documentation should cover the repository structure, key components, and functionality
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the repository URL in the command
- Response contains comprehensive documentation about the remote repository
- Documentation covers repository structure, key components, and functionality
- Command completes successfully without errors

### Scenario 4: Documentation Generation with Hint (Happy Path)

**Tags:** parameters
**Task Description:**
Use vibe-tools to generate documentation with a hint to focus on specific parts of the repository.

**Expected Behavior:**

- The AI agent should include the hint parameter in the command
- The documentation should focus on the specified parts of the repository
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the hint parameter in the command
- Documentation focuses on the specified parts of the repository
- Documentation provides detailed information about the specified focus areas
- Command completes successfully

### Scenario 5: Documentation Generation with Invalid Repository URL (Error Handling)

**Task Description:**
Attempt to use vibe-tools to generate documentation for a repository with an invalid URL.

**Expected Behavior:**

- The command should fail with a clear error message
- Error message should mention that the specified repository URL is invalid
- Error message should provide guidance on how to specify a valid repository URL

**Success Criteria:**

- AI agent recognizes the invalid repository URL error
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated

### Scenario 6: Documentation Generation with Missing API Key (Error Handling)

**Task Description:**
Attempt to use vibe-tools to generate documentation when required API keys are missing.
To simulate missing API keys, set CURSOR_TOOLS_ENV_UNSET=GEMINI_API_KEY when running the command and specify the gemini provider explicitly.

**Expected Behavior:**

- When the API key is not available, the command should fail with a clear error message
- Error message should mention the missing API key
- Error message should provide guidance on how to configure the API key

**Success Criteria:**

- AI agent recognizes the missing API key issue
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated

### Scenario 7: Documentation Generation for Empty Repository (Edge Case)

**Tags:** edge-case
**Task Description:**
Use vibe-tools to generate documentation for an empty or nearly empty repository.

**Expected Behavior:**

- The command should handle the edge case gracefully
- The response should acknowledge the lack of content to document
- The documentation should still provide basic information about the repository

**Success Criteria:**

- AI agent successfully runs the doc command
- Response acknowledges the lack of content to document
- Documentation provides basic information about the repository
- Command completes successfully without errors

### Scenario 8: Documentation Generation with Format Parameter (Happy Path)

**Tags:** parameters
**Task Description:**
Use vibe-tools to generate documentation with a specified output format.

**Expected Behavior:**

- The AI agent should include the format parameter in the command
- The documentation should be generated in the specified format
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the format parameter in the command
- Documentation is generated in the specified format
- Documentation content is properly formatted according to the specified format
- Command completes successfully

### Scenario 9: Documentation Generation for Large Repository (Performance)

**Tags:** performance
**Task Description:**
Use vibe-tools to generate documentation for a large repository with many files and directories.

**Expected Behavior:**

- The command should handle the large repository without crashing
- The response should include comprehensive documentation
- The command might take longer but should eventually complete

**Success Criteria:**

- AI agent successfully runs the doc command on the large repository
- Command handles the large repository without crashing
- Documentation includes comprehensive information despite the repository size
- Command eventually completes successfully

### Scenario 10: Documentation Generation with Multiple Parameters (Advanced Usage)

**Tags:** advanced, parameters
**Task Description:**
Use vibe-tools to generate documentation with multiple parameters (output file, format, hint, etc.).

**Expected Behavior:**

- The AI agent should include multiple parameters in the command
- The documentation should be generated according to all specified parameters
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes multiple parameters in the command
- Documentation is generated according to all specified parameters
- Documentation content and format match the specified parameters
- Command completes successfully

### Scenario 11: Documentation Generation with Custom Repomix Configuration (Happy Path)

**Tags:** repomix-config, configuration
**Task Description:**
Use vibe-tools to generate documentation with a custom repomix.config.json file that modifies which files are included/excluded in the documentation.

First, create a repomix.config.json file using the content from {{path:doc-repomix-config.json}} in the repository root. Then, generate documentation and verify that the configuration is respected.

**Expected Behavior:**

- The command should detect and use the custom repomix.config.json file
- The configuration should exclude files specified in the config from the documentation
- The logs should indicate that the repomix config is being loaded from the local file
- The documentation content should reflect that certain files are excluded

**Success Criteria:**

- Command output mentions loading repomix config from the local file
- Token count in the packed repository should be consistent with the configured exclusions
- Documentation only covers files that aren't excluded by the configuration
- Command completes successfully without errors
- The configuration is properly applied during repository packing
- The documentation content only references files that are included by the configuration
- The documentation structure reflects the include/exclude patterns in the configuration

### Scenario 12: Documentation Generation Enhanced with Document Context

**Tags:** context-augmentation
**Task Description:**
Generate documentation for the current repository using `vibe-tools doc`, but enhance it with context from the document at `https://www.notion.so/1d0939cee1fa8058b002ef08412bc907?pvs=4`. Use a hint like "Document the repository, explaining how the document fetching utility (`src/utils/fetch-doc.ts`) relates to the RAG concepts described in the provided document."

**Expected Behavior:**

- The AI agent should use `doc --with-doc` with the correct URL and the specified hint.
- The command should fetch document content and analyze the repository.
- The generated documentation should cover the repository structure _and_ explicitly incorporate information from the document, specifically linking the `fetch-doc.ts` utility to the RAG concepts.
- The command should complete without errors.

**Success Criteria:**

- AI agent correctly identifies and uses `vibe-tools doc --with-doc "https://www.notion.so/1d0939cee1fa8058b002ef08412bc907?pvs=4" --hint "Document the repository, explaining how the document fetching utility (src/utils/fetch-doc.ts) relates to the RAG concepts described in the provided document."` (or similar).
- Document content is fetched successfully (indicated by logs).
- Generated documentation covers repository structure.
- Documentation explicitly references and integrates RAG concepts from the document, linking them to `src/utils/fetch-doc.ts`.
- No unexpected error messages are displayed.
- Command completes within a reasonable time.

### Scenario 13: Documentation Generation with a Configured Provider 1) (Happy Path)

**Tags:** vibe-tools-config, configuration
**Task Description:**
Attempt to use vibe-tools to generate documentation using a configured provder.

First, create a vibe-tools.config.json file using the content from {{path:doc-vibe-tools.config1.json}} in the repository root. Then, generate documentation. Verify that the first instance of "Trying provider: (provider)" in the command output references the configured provider. The test passes ONLY if the very FIRST instance of "Trying provider:" contains the configured provider, if it does not then you should report the test as failing EVEN IF subsequent occurences of "Trying provider:" contain the configured provider.

**Expected Behavior:**
- The command should detect and use the custom vibe-tools.config.json file
- The command should try to use the configured provider in the first attempt at creating the documentation

**Success Criteria:**
- The first instance of "Trying provider: (provider)" in the command output shows the name of the configured provider.

### Scenario 14: Documentation Generation with a Configured Provider 2) (Happy Path)

**Tags:** vibe-tools-config, configuration
**Task Description:**
Attempt to use vibe-tools to generate documentation using a configured provder.

First, create a vibe-tools.config.json file using the content from {{path:doc-vibe-tools.config2.json}} in the repository root. Then, generate documentation. Verify that the first instance of "Trying provider: (provider)" in the command output references the configured provider. The test passes ONLY if the very FIRST instance of "Trying provider:" contains the configured provider, if it does not then you should report the test as failing EVEN IF subsequent occurences of "Trying provider:" contain the configured provider.

**Expected Behavior:**
- The command should detect and use the custom vibe-tools.config.json file
- The command should try to use the configured provider in the first attempt at creating the documentation

**Success Criteria:**
- The first instance of "Trying provider: (provider)" in the command output shows the name of the configured provider.
