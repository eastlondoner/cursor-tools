# Feature Behavior Testing with AI Agents

## Overview

This document outlines our approach to regression testing for vibe-tools using AI agents. We'll create feature behavior files that describe desired behaviors, and AI agents will determine how to test these behaviors using vibe-tools. The agents will generate detailed reports and simple PASS/FAIL results for automated validation.

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

## Feature Behavior Files

Feature behavior files will be Markdown files describing:
1. The feature/capability being tested
2. Expected behavior
3. Test scenarios with natural language descriptions
4. Success criteria

Each file will follow this enhanced structure:

```markdown
# Feature Behavior: [Feature Name]

## Description
Brief description of the feature and its functionality.

## Test Scenarios

### Scenario 1: [Brief Scenario Description] (Happy Path)
**Task Description:**
Describe the task the AI agent should accomplish using vibe-tools, without specifying the exact command.
For example: "Search the web for information about TypeScript using vibe-tools."

**Expected Behavior:**
- The AI agent should determine the appropriate command(s) to use
- Response should include relevant information about the requested topic
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly identifies and uses the appropriate vibe-tools command(s)
- Response contains relevant information about the requested topic
- No unexpected error messages are displayed
- Command completes within a reasonable time

### Scenario 2: [Brief Scenario Description] (Error Handling)
...

### Scenario 3: [Brief Scenario Description] (Edge Case)
...

### Scenario 4: [Brief Scenario Description] (Performance)
...
```

## Test Assets Management

The testing framework supports referencing external assets for test scenarios that require specific inputs, such as long queries, sample files, or structured data. This enables consistent testing with predefined inputs.

### 1. Asset Storage Structure

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

This structure keeps related files together, making asset discovery and maintenance simpler when working with tests.

### 2. Asset Reference Types

The framework supports two types of asset references in test scenario descriptions:

#### Inline Content Loading: `[[asset:name]]`

Use double square brackets with the `asset:` prefix to indicate that the asset content should be automatically loaded and made available to the test. This is useful for smaller assets that will be directly embedded in prompts.

Example:
```markdown
**Task Description:**
Use vibe-tools to ask a question about capitals.

The agent should use this query: [[asset:simple-query]]
```

#### Path Reference Only: `{{path:name}}`

Use double curly braces with the `path:` prefix to indicate that only the absolute path to the asset should be provided. This is useful for larger assets where the test command itself should handle the file reading.

Example:
```markdown
**Task Description:**
Use vibe-tools to ask a very long question.

The agent should use the query stored in this file: {{path:scenario9-long-query.txt}}
```

### 3. Asset Loading Implementation

The test runner handles these references as follows:

1. For `[[asset:name]]` references:
   - Load the content from the asset file
   - Make it available to the AI agent as a string
   - Replace references in the scenario with the actual content

2. For `{{path:name}}` references:
   - Resolve the relative path to an absolute path
   - Make the absolute path available to the AI agent
   - Replace references in the scenario with the absolute path

### 4. Example Implementation

For the "Extremely Long Query" scenario in the ask-command tests:

1. Create the file: `tests/feature-behaviors/ask/ask-command/scenario9-long-query.txt` containing a well-crafted query of over 500 characters
2. Reference this asset in the scenario using path reference:
   ```markdown
   **Task Description:**
   Use vibe-tools to ask a very long question (over 500 characters).
   
   Use the query from this file: {{path:scenario9-long-query.txt}}
   ```

3. The test runner will resolve this to an absolute path
4. The AI agent can then use this path in its command, e.g.:
   ```bash
   vibe-tools ask --provider openai --model gpt-4 --file=/absolute/path/to/scenario9-long-query.txt
   ```

This approach ensures:
- Small assets can be loaded inline for convenience
- Large assets are referenced by path to maintain readability
- Absolute paths are provided to avoid relative path errors
- The test runner and AI agent have the flexibility to handle different types of assets appropriately

## Test Categories

Each feature behavior file should include scenarios from these categories:

1. **Positive Tests (Happy Path)**: Verify expected behavior under normal conditions
2. **Negative Tests (Error Handling)**: Verify correct error handling and informative error messages
3. **Boundary/Edge Cases**: Test limits, specific & unusual inputs, and edge conditions
4. **Instruction Understanding Tests**: Test whether AI agent can correctly interpret and use vibe-tools based on instructions

## Implementation: CLI-Based Testing Framework

This approach creates a dedicated testing command within vibe-tools that executes AI agent-based tests.

### Implementation Details:

1. **Test Runner Command**:
   ```
   vibe-tools test <feature-behavior-file.md> [options]
   ```

2. **Options**:
   - `--output=<directory>`: Directory to store test reports
   - `--parallel=<number>`: Number of parallel tests to run
   - `--branch=<branch-name>`: Branch name to include in report filenames
   - `--provider=<provider>`: AI provider to use (openai, anthropic)
   - `--model=<model>`: Model to use for testing
   - `--compare-with=<path-to-report>`: Compare with existing report
   - `--debug`: Enable debug mode for detailed logs
   - `--timeout=<seconds>`: Maximum test execution time
   - `--retries=<number>`: Number of retries for failed tests
   - `--tag=<tag1,tag2>`: Run only scenarios with specified tags
   - `--scenarios=<num1,num2>`: Run only scenarios with specified numbers (e.g., `--scenarios=1,3,5` will run only Scenario 1, Scenario 3, and Scenario 5). This is useful for debugging specific scenarios or running a subset of tests during development.

3. **Test Execution**:
   - Parse feature behavior file into structured test scenarios
   - Initialize AI agent with appropriate context and cursorrules
   - Instruct the AI agent to accomplish the described tasks using vibe-tools
   - Allow the AI agent to determine which commands to use based on the task description
   - Generate detailed report and PASS/FAIL result
   - Store reports in specified output directory with branch name in filename
   - Implement intelligent retry mechanism for flaky tests:
     - Retry only for specific, transient errors (network timeouts, API rate limits)
     - Use exponential backoff for retries
     - Define retry limits per step within a scenario for granular control
   - Implement timeout mechanism with per-scenario and step-level timeouts
   - Provide detailed error reporting including:
     - Full error messages and stack traces
     - Exit codes of failed commands
     - Specific step at which the error occurred
     - Last few lines of output before the error

4. **Test Environment Management**:
   - Explicitly manage environment variables required for tests
   - Use `.env.test` files to prevent interference between tests
   - Implement test server lifecycle management for browser command testing:
     - Start test server before scenarios needing it
     - Ensure server is reliably stopped after completion, even on failure
   - Include proper cleanup mechanisms for all resources

5. **Parallelization**:
   - Use dynamic test distribution with a queue system
   - Workers pick up the next available test from the queue
   - Implement resource management to prevent overloading system
   - Include clear logging and progress indicators for parallel runs
   - Default to (CPU cores - 1) for parallel tests, allow override

6. **Enhanced Reporting**:
   - Generate structured reports with consistent formatting using templates
   - Include execution time summary showing total time and time per scenario
   - Provide error summaries for quick identification of issues
   - Use distinct visual markers (✅, ❌) for PASS/FAIL status
   - Include the exact vibe-tools commands generated by the AI agent
   - Generate separate PASS/FAIL result files in a structured format (JSON)
   - Implement semantic comparison for AI-generated outputs:
     - Use Gemini for semantic understanding of outputs
     - Apply configurable similarity thresholds for comparison
     - Determine meaningful deviations vs. benign variations

7. **Report Structure**:
   - Test Scenario ID/Name
   - Task Description from Feature Behavior File
   - Approach Taken by AI Agent (which commands it chose)
   - Tool Call Log (detailed record of all tool executions with arguments, outputs, and errors)
   - Actual Output Received
   - Expected Behavior (Reference from the behavior file)
   - Success Criteria Checklist (with PASS/FAIL status for each criterion)
   - Overall Test Result (PASS/FAIL)
   - Error Messages or Debug Information (if any)
   - Execution Time
   - AI Provider and Model Used

8. **Advanced Features**:
   - **Scenario Parameterization**: Support data tables within feature files to parameterize scenarios
   - **Test Categorization**: Enhanced scenario types beyond basic categories
   - **Tagging System**: Allow adding tags to scenarios for more granular test selection and execution

### Advantages:
- Self-contained within vibe-tools codebase
- Direct access to vibe-tools functionality
- No external dependencies for test execution
- Easy integration with CI/CD pipelines
- Tests both vibe-tools functionality and AI agent understanding
- Faster implementation path for initial testing capabilities

## Implementation Plan

1. **Phase 1: Core Framework (Week 1-2)**
   - Create test runner command structure
   - Implement basic test execution flow
   - Develop feature behavior file parser
   - Implement initial report generation
   - Set up error handling and basic retry mechanism
   - Define report format and templates
   - **Milestone**: Basic test runner command working with simple reporting

2. **Phase 2: Core Feature Tests & Robustness (Week 3-4)**
   - Create feature behavior files for core capabilities:
     - Web search capability
     - Repository analysis capability
     - Documentation generation capability
     - Direct model query capability
     - Planning capability
   - Implement enhanced error handling with detailed reporting
   - Add intelligent retry with exponential backoff
   - Implement environment variable management
   - Generate initial baseline reports
   - **Milestone**: Feature behavior files for core capabilities created with robust execution

3. **Phase 3: Advanced Features & Reporting (Week 5-6)**
   - Add feature behavior files for advanced capabilities:
     - Browser automation capability
     - GitHub integration capability
   - Implement enhanced reporting with execution summaries
   - Implement semantic comparison using Gemini
   - Add parameterized test scenarios
   - Add tagging system for test scenarios
   - Implement parallel test execution
   - **Milestone**: Complete test suite with advanced reporting and execution features

4. **Phase 4: CI/CD Integration (Week 7-8)**
   - Set up GitHub Actions workflow
   - Implement automated baseline report generation
   - Create report comparison workflow
   - Add status badges and report publishing
   - Document test framework usage and feature behavior file creation
   - Create comprehensive testing guide
   - **Milestone**: Fully automated testing pipeline with documentation

5. **Phase 5: Refinement & Expansion (Week 9+)**
   - Gather feedback on test framework
   - Optimize performance and reliability
   - Expand test coverage for edge cases
   - Implement advanced semantic comparison features
   - Add cross-version comparison capabilities
   - **Milestone**: Refined and comprehensive testing system

## Current Progress

### Completed Items (Phase 1)
- ✅ **Test Runner Command Structure**: Implemented the `vibe-tools test` command with all specified options
- ✅ **Feature Behavior File Parser**: Created a robust parser that extracts scenarios, task descriptions, expected behaviors, and success criteria
- ✅ **Test Execution Flow**: Implemented the core logic for executing test scenarios using AI agents
- ✅ **Report Generation**: Created a detailed Markdown report structure with all the required information
- ✅ **Basic Retry Mechanism**: Implemented exponential backoff retry with intelligent handling of transient errors
- ✅ **Parallel Execution**: Implemented a queue-based parallel execution system with dynamic worker allocation
- ✅ **Error Handling**: Added comprehensive error handling with detailed error reporting
- ✅ **Enhanced Reporting**: Implemented structured report generation with success/failure markers and execution time tracking
- ✅ **Code Structure Refactoring**: Successfully moved the test command implementation to a proper directory structure under `src/commands/test/`

### Recently Completed Items (Phase 2)
- ✅ **Output Management**: Implemented scenario-specific output buffering for clean parallel execution logs
  - Added support for prefixing scenario outputs with scenario IDs
  - Created a buffering system that maintains output order
  - Integrated with ToolEnabledLLMClient for proper logging control
- ✅ **Parallel Execution Improvements**: Enhanced parallel test execution
  - Added progress tracking showing completed/running/pending scenarios
  - Implemented proper output sequencing for parallel scenarios
  - Added execution time statistics including time saved by parallelization
- ✅ **Directory Structure**: Established clear code organization:
  - Core test runner in `src/commands/test/command.ts`
  - Scenario execution in `src/commands/test/executor.ts`
  - Report generation in `src/commands/test/reporting.ts`
  - Type definitions in `src/commands/test/types.ts`

### In Progress (Phase 2)
- 🔄 **Feature Behavior Files**: Creating test scenarios for core vibe-tools commands
- 🔄 **Test Asset Management**: Implementing support for test assets and references
- 🔄 **Environment Management**: Working on test environment isolation

### Next Steps
1. Create feature behavior files for core capabilities:
   - Web search capability (tests/feature-behaviors/web/web-search-command.md)
   - Repository analysis capability (tests/feature-behaviors/repo/repo-command.md)
   - Documentation generation capability (tests/feature-behaviors/doc/doc-command.md)
   - Planning capability (tests/feature-behaviors/plan/plan-command.md)

2. Implement test asset management:
   - Add support for file-based test assets
   - Create asset reference system
   - Add validation for asset references

3. Enhance test reporting:
   - Add JSON output format
   - Implement report comparison
   - Add visual progress indicators

4. Begin Phase 3 work:
   - Add browser automation tests
   - Add GitHub integration tests
   - Implement parameterized test scenarios

## AI Agent Testing Guidelines

To ensure reliable and consistent test results, AI agents should follow these guidelines:

1. **Flexible Command Selection**:
   - Determine the appropriate vibe-tools commands based on task descriptions
   - Use the vibe-tools documentation to understand available commands and options
   - Select the most appropriate command(s) for the given task
   - Understand when to use command aliases or nicknames (e.g., "Perplexity" for web search)

2. **Structured Testing Process**:
   - Understand the feature behavior file completely before testing
   - Execute each scenario in sequence
   - Compare actual results against expected behavior
   - Evaluate each success criterion separately
   - Provide a clear PASS/FAIL result for each criterion and scenario

3. **Reproducible Testing**:
   - Document which commands were selected and why
   - Document any environment setup or prerequisites
   - Provide detailed steps taken during testing
   - Include all relevant outputs, logs, and screenshots

4. **Comprehensive Reporting**:
   - Create a detailed Markdown report for each feature behavior file
   - Include test environment details (OS, Node.js version, etc.)
   - Document the reasoning behind command selection
   - Document any variations or unexpected behavior
   - Provide suggestions for improvement or optimization
   - Generate a separate PASS/FAIL result file for automation

5. **Error Handling**:
   - Handle errors gracefully and document them
   - Distinguish between expected errors (part of the test) and unexpected errors
   - Include error stack traces and context when relevant
   - Suggest potential causes and solutions for unexpected errors

6. **Semantic Evaluation**:
   - Understand the intent behind each test scenario
   - Focus on meaningful output verification rather than exact matching
   - Consider the context and purpose of each task
   - Evaluate outputs based on their usefulness and correctness 