# Feature Behavior: Test Command Output

## Description
This test verifies the output behaviour of the test command for different parameters.

## Test Scenarios

### Scenario 1: Quietest output
**Task Description:**
Use cursor-tools to execute the test tests/feature-behaviors/test/test-command-parallel-example.md. Save the output to a file in the current directory and set the quiet flag when running cursor-tools.

**Expected Behavior:**
- The AI agent should determine the appropriate command to use with the correct flags
- The save-to file should be created and poplated with the details of the test run
- Output logged to the console should be minimal

**Success Criteria:**
- AI agent correctly uses the test command with --save-to and --quiet flags set
- Tests should pass
- The output that's logged to the console should be minimal, less than 20 lines.
- Output file is created and contains the detailed test output
- Command completes within a reasonable time (less than 1 min)

### Scenario 2: Save-to output
**Task Description:**
Use cursor-tools to execute the test tests/feature-behaviors/test/test-command-parallel-example.md. Save the output to a file in the current directory.

**Expected Behavior:**
- The AI agent should determine the appropriate command to use with the correct flags
- The save-to file should be created and poplated with the details of the test run
- Full outputs should be logged to the console AND written to the specified output file

**Success Criteria:**
- AI agent correctly uses the test command with --save-to flag set
- Tests should pass
- Console logs contain detailed test output
- Output file is created and contains the detailed test output
- Command completes within a reasonable time (less than 1 min)


### Scenario 3: Debug output
**Task Description:**
First use cursor-tools to execute the test in tests/feature-behaviors/test/test-command-parallel-example.md. Then run the same test with the debug flag set.

**Expected Behavior:**
- The AI agent should determine the appropriate commands to use with the correct flags
- The save-to file should be created and poplated with the details of the test run
- Full outputs should be logged to the console AND written to the specified output file

**Success Criteria:**
- AI agent correctly uses the test command with --debug flag set on the second execution
- Tests should pass
- The second run should contain detailed debug logs of the commands being executed by the LLM
- Command completes within a reasonable time (less than 2 min)
