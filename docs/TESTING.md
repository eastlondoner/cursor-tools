# Testing in vibe-tools

This document describes the testing approach for vibe-tools and provides guidance on writing and running tests.

## Test Command

The `test` command in vibe-tools allows testing scenarios defined in feature behavior files. These tests can verify that vibe-tools commands work correctly and behave as expected.

### Running Tests

To run tests, use the following command:

```bash
pnpm dev test <feature-behavior-file> [options]
```

For example:

```bash
# Run a specific test file
pnpm dev test tests/feature-behaviors/web/web-command.md

# Run multiple test files using a glob pattern
pnpm dev test "tests/feature-behaviors/web/*.md"

# Run tests in parallel
pnpm dev test tests/feature-behaviors/test/test-command-parallel-example.md --parallel 4
```

### Test Command Options

- `--output`: Directory to store test reports (default: `tests/reports`)
- `--branch`: Branch name for report organization (default: current git branch)
- `--model`: LLM model to use for test execution (default: `claude-3-7-sonnet-latest`)
- `--timeout`: Maximum execution time in seconds for a test scenario (default: 300)
- `--retries`: Number of retries for failed test scenarios (default: 3)
- `--tag`: Filter scenarios by tags (comma-separated list)
- `--mcpServers`: MCP servers to include in the test environment (comma-separated list)
- `--parallel`: Number of scenarios to run in parallel (default: CPU count - 1)

## Feature Behavior Files

Feature behavior files define test scenarios for vibe-tools commands. These files are written in Markdown and follow a specific format.

### Example Feature Behavior File

```markdown
# Feature Behavior: Web Command

## Description
This test verifies that the web command can query online information correctly.

## Test Scenarios

### Scenario 1: Basic Web Query
**Task Description:**
Use vibe-tools to search for information about climate change.

**Expected Behavior:**
- The AI agent should use the web command
- Response should include information about climate change
- The command should complete successfully

**Success Criteria:**
- AI agent correctly uses the vibe-tools web command
- Response contains relevant information about climate change
- Command completes without errors
```

### Feature Behavior File Format

- **Feature Behavior**: The name of the feature being tested
- **Description**: A description of what the test verifies
- **Test Scenarios**: A list of test scenarios
  - **Scenario**: A specific test case
    - **Task Description**: What the AI agent should do
    - **Expected Behavior**: What should happen when the command is executed
    - **Success Criteria**: Specific criteria for success

## Isolated Test Environments

The test command creates isolated environments for each test scenario to ensure tests don't interfere with each other.

### Environment Isolation Approach

Each test scenario runs in its own temporary directory with the following setup:

1. A unique temporary directory is created for each scenario
2. A symlink to the main project's `node_modules` directory is created in the temp directory
3. The `package.json` file is copied to the temp directory
4. Any assets referenced in the test scenario are copied to the temp directory
5. Commands are executed using `pnpm --dir="<project-root>" exec vibe-tools`
6. The temporary directory is cleaned up after the test completes

This approach ensures that each test has access to the necessary dependencies without having to install them separately, while still providing isolation between tests.

### Asset References

Test scenarios can reference external files using special syntax:

- `[[asset:name]]`: Inline content reference - the content of the file is inserted into the task description
- `{{path:name}}`: Path reference - the path to the file is inserted into the task description

Assets are automatically copied to the temporary directory and references are updated accordingly.

### Command Execution

Commands are executed using a tool-enabled LLM client, which provides the AI agent with tools to execute vibe-tools commands. The client:

1. Receives a task description
2. Determines which vibe-tools command to use
3. Executes the command in the isolated environment
4. Reports the results

### Error Handling

The test environment includes robust error handling:

- Transient errors (like network issues) are automatically retried
- Command timeouts are handled gracefully
- Asset copying failures are reported but don't fail the test
- Cleanup failures are logged but don't affect test results

## Writing Effective Tests

To write effective tests:

1. **Be specific**: Clearly define what the test should verify
2. **Cover edge cases**: Test both common and uncommon scenarios
3. **Use appropriate assertions**: Define clear success criteria
4. **Provide context**: Include enough information for the AI agent to understand the task
5. **Keep tests independent**: Each test should be self-contained

## Debugging Tests

To debug a failing test:

1. Run the test with `--debug` flag to see detailed output
2. Check the test report for error messages
3. Look at the scenario logs to see what commands were executed
4. Run the command manually to verify it works as expected
5. Adjust the test scenario as needed

## Continuous Testing

The test command can be integrated into CI/CD pipelines to ensure vibe-tools commands work correctly as changes are made. For example:

```yaml
# GitHub Actions workflow
name: Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm dev test "tests/feature-behaviors/**/*.md" --parallel 4
```

## Best Practices

1. **Keep tests small and focused**: Each test should verify a specific behavior
2. **Use meaningful names**: Name tests so they describe what they're testing
3. **Use appropriate timeouts**: Some tests may take longer than others
4. **Clean up after tests**: Ensure tests don't leave artifacts behind
5. **Use parallelism wisely**: Running tests in parallel can speed up execution but may cause resource contention
6. **Use appropriate tags**: Tags can help organize and filter tests 