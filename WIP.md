# Feature Behavior Testing Plan for vibe-tools

This document outlines our approach to regression testing for vibe-tools using AI agents. We create feature behavior files that describe desired behaviors, and AI agents determine how to test these behaviors using vibe-tools. The agents generate detailed reports and simple PASS/FAIL results for automated validation.

## Goals

1. **Comprehensive Feature Testing**: Test all major features and commands of vibe-tools in an automated fashion
2. **Regression Detection**: Quickly identify when changes break existing functionality
3. **Parallel Execution**: Run tests concurrently to reduce overall testing time
4. **Documentation**: Generate detailed reports explaining test outcomes and behavior
5. **Human-Readable Reports**: Ensure test results are easy to understand and analyze
6. **Automation-Friendly**: Enable CI/CD integration with simple PASS/FAIL outputs
7. **Maintainability**: Make it easy to add new tests and update existing ones
8. **Cross-Version Testing**: Compare behavior across different versions/branches
9. **AI Agent Flexibility**: Test whether AI agents can correctly interpret and use vibe-tools based on natural language descriptions

## Test Assets Management

The testing framework supports referencing external assets for test scenarios that require specific inputs, such as long queries, sample files, or structured data. This enables consistent testing with predefined inputs.

### Asset Storage Structure

Assets are stored in directories adjacent to their corresponding test files, using the same name as the test file (minus extension):

```
tests/feature-behaviors/
    ask/
        ask-command.md              # Test file
        ask-command/                # Assets directory for this test
            scenario9-long-query.txt
    browser/
        browser-open-command.md     # Test file
        browser-open-command/       # Assets directory for this test
            test-form.html
```

## Current Test Coverage

Currently, the repository has the following feature behavior tests:
- `ask/ask-command.md`: Tests for direct model queries
- `browser/browser-command.md`: Tests for browser automation capabilities
- `doc/doc-command.md`: Tests for documentation generation
- `example/test.md`: A sample test file
- `github/github-command.md`: Tests for GitHub integration
- `mcp/mcp-command.md` and `mcp-command-edge-cases.md`: Tests for Model Context Protocol interactions
- `plan/plan-command.md`: Tests for implementation planning
- `repo/repo-command.md`: Tests for repository context analysis
- `test/test-command-parallel-example.md`: An example for parallel testing
- `test/test-command-outputs.md`: Tests for command output handling
- `web/web-command.md`: Tests for web search functionality

## Enhancement Plan for Existing Tests

### 1. Cross-Command Consistency
- **Consistent Error Reporting**: Ensure error reporting is consistent across all commands
- **Consistent Option Handling**: Verify that common options like `--debug`, `--save-to`, and `--quiet` behave consistently

### 2. `browser/browser-command.md`
- **Browser Connect-to Edge Cases**: Add robust test cases for Chrome instance connection scenarios
- **Browser Viewport Handling**: Test viewport configurations more explicitly

### 3. `mcp/mcp-command.md` and `mcp-command-edge-cases.md`
- **Refactor Tests**: Break down large edge cases file into more focused test files
- **Error Handling**: Add specific tests for:
  - MCP Server Connection Errors
  - MCP Tool Not Found Errors
  - MCP Tool Argument Validation Errors

## Planned New Test Files

The following test files are planned for implementation:

### 1. `test/test-command-outputs.md`

**Description**: Tests for the test command itself, focusing on output handling and different output modes.

**Key Scenarios**:
- **Test Command with Quiet Output**: Test running tests with the `--quiet` flag
- **Test Command with Save-to Output**: Test saving output to a file
- **Test Command with Debug Output**: Test debug logging
- **Test Command Output Combination**: Test combining output flags

### 2. `plan/plan-command.md`

**Description**: Tests for the `plan` command, focusing on generating implementation plans based on user queries and repository context.

**Key Scenarios**:
- **Basic Plan Generation (Happy Path)**: Test a simple plan generation request.
- **Plan Generation with Specific Providers (Happy Path)**: Test plan generation using different combinations of `fileProvider` and `thinkingProvider`.
- **Plan Generation for a Complex Task (Happy Path)**: Test plan generation for a more complex, multi-step task.
- **Plan Generation with Debug Option (Happy Path)**: Test plan generation with debug output enabled.
- **Plan Generation Error Handling (Error Handling)**: Test error handling when invalid providers or models are specified.

### 3. `repo/repo-command.md`

**Description**: Tests for the `repo` command, focusing on its ability to analyze repository context and answer questions about the codebase.

**Key Scenarios**:
- **Basic Repo Analysis (Happy Path)**: Test a simple repository analysis query.
- **Repo Analysis with Different Providers (Happy Path)**: Test repo analysis using different providers.
- **Repo Analysis with a Complex Query (Happy Path)**: Test repo analysis with a more complex query requiring understanding of multiple parts of the codebase.
- **Repo Analysis with Save-to Option (Happy Path)**: Test saving repo analysis results to a file.
- **Repo Analysis Error Handling (Error Handling)**: Test error handling when invalid parameters are provided.

### 4. `doc/doc-command.md`

**Description**: Tests for the `doc` command, focusing on generating documentation for repositories.

**Key Scenarios**:
- **Basic Documentation Generation (Happy Path)**: Test generating documentation for the current repository.
- **Documentation Generation with Output File (Happy Path)**: Test generating documentation and saving it to a specified output file.
- **Documentation Generation for Remote Repository (Happy Path)**: Test generating documentation for a remote GitHub repository.
- **Documentation Generation with Hint (Happy Path)**: Test generating documentation with a hint to focus on specific parts of the repository.
- **Documentation Generation Error Handling (Error Handling)**: Test error handling when invalid parameters are provided.

### 5. `github/github-command.md`

**Description**: Tests for the `github` command and its subcommands (`pr`, `issue`), focusing on GitHub integration.

**Key Scenarios**:
- **GitHub PR List (Happy Path)**: Test retrieving a list of recent pull requests.
- **GitHub PR Details (Happy Path)**: Test retrieving details for a specific pull request.
- **GitHub Issue List (Happy Path)**: Test retrieving a list of recent issues.
- **GitHub Issue Details (Happy Path)**: Test retrieving details for a specific issue.
- **GitHub Authentication Method Verification (Happy Path)**: Test each authentication method (env var, GitHub CLI, git credentials) to ensure they work correctly.
- **GitHub Rate Limit Handling (Error Handling)**: Test error handling when GitHub API rate limits are exceeded.
- **GitHub Authentication Error (Error Handling)**: Test error handling when GitHub authentication fails.
- **GitHub Private Repository Access (Edge Case)**: Test accessing a private repository (requires test credentials).

### 6. `clickup/clickup-command.md`

**Description**: Tests for the `clickup` command, focusing on ClickUp integration for task management.

**Key Scenarios**:
- **ClickUp Task Details (Happy Path)**: Test retrieving details for a specific ClickUp task.
- **ClickUp Task with Comments (Happy Path)**: Test retrieving a ClickUp task with comments.
- **ClickUp Task with Attachments (Happy Path)**: Test retrieving a ClickUp task with attachments.
- **ClickUp Authentication Error (Error Handling)**: Test error handling when ClickUp authentication fails.
- **ClickUp Invalid Task ID (Error Handling)**: Test error handling when an invalid task ID is provided.

### 7. `xcode/xcode-command.md`

**Description**: Tests for the `xcode` command and its subcommands (`build`, `run`, `lint`), focusing on Xcode integration for iOS/macOS development.

**Key Scenarios**:
- **Xcode Build Command (Happy Path)**: Test the `xcode build` subcommand to build an Xcode project.
- **Xcode Run Command (Happy Path)**: Test the `xcode run` subcommand to build and run an Xcode project.
- **Xcode Run with Device Specification (Happy Path)**: Test the `xcode run` command with different device types (iPhone, iPad, specific device names).
- **Xcode Lint Command (Happy Path)**: Test the `xcode lint` subcommand to analyze code and report warnings.
- **Xcode Lint Output Verification (Happy Path)**: Test the output format and content of the linting report.
- **Xcode Build Error Types (Error Handling)**: Test different types of build failures (compile errors, linking errors, code signing issues) to ensure proper error reporting.
- **Xcode Build Error Handling (Error Handling)**: Test error handling when the build command fails.
- **Xcode Missing Project (Error Handling)**: Test error handling when the specified Xcode project is not found.

### 8. `mcp/mcp-command.md`

**Description**: Tests for the `mcp` command and its subcommands (`search`, `run`), focusing on Model Context Protocol server interactions.

**Key Scenarios**:
- **MCP Search Command (Happy Path)**: Test the `mcp search` subcommand to search for available MCP servers.
- **MCP Search with No Results (Edge Case)**: Test the `mcp search` command with a query that returns no results.
- **MCP Run Command (Happy Path)**: Test the `mcp run` subcommand to execute a tool from an MCP server.
- **MCP Run with Tool Arguments (Happy Path)**: Test passing different types of arguments (strings, numbers, booleans, objects) to MCP tools.
- **MCP Run with Server Override (Happy Path)**: Test the `mcp run` subcommand with a server override.
- **MCP Run with Tool Execution Errors (Error Handling)**: Test error handling when MCP tool execution fails (tool not found, invalid arguments, server errors).
- **MCP Server Not Found (Error Handling)**: Test error handling when no suitable MCP server is found.
- **MCP API Key Missing (Error Handling)**: Test error handling when the required Anthropic API key is not configured.

### 9. `install/install-command.md`

**Description**: Tests for the `install` command, focusing on its ability to set up vibe-tools in a workspace.

**Key Scenarios**:
- **Basic Installation (Happy Path)**: Test the basic installation process in a clean workspace.
- **Installation with Legacy Mode (Happy Path)**: Test installation with legacy mode enabled (using `.cursorrules`).
- **Installation with New Mode (Happy Path)**: Test installation with new mode enabled (using `.cursor/rules/vibe-tools.mdc`).
- **Upgrade Scenario (Happy Path)**: Test upgrading an existing installation to a newer version.
- **Error Handling for File System Permissions (Error Handling)**: Test error handling when file system permissions prevent installation.

## Implementation Strategy

1. **Prioritization**: Implement tests for the most frequently used commands first (web, repo, plan, doc).
2. **Test Assets**: Create necessary test assets (sample files, mock data) for each test scenario.
3. **Test Tagging**: Implement a comprehensive tagging system for tests (e.g., `@api-key-required`, `@slow`, `@network-dependent`, `@browser-ui`) to enable flexible test execution.
4. **Environment Variable Isolation**: Ensure tests are isolated and environment variables from one test scenario don't affect others.
5. **Test Execution Time Metrics**: Add metrics to track execution time per scenario and overall test suite execution time.
6. **CI Integration**: Ensure all tests can be run in CI/CD pipelines.
7. **Documentation**: Update TESTING.md with information about the new tests.

## Next Steps

1. Create directory structure for each new test file
2. Implement the test files in order of priority
3. Create necessary test assets and test data generation utilities
4. Run tests to verify functionality
5. Update documentation with information about the new tests and how to run them
