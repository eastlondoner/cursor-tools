# Feature Behavior: Test Asset Handling

## Description
This test verifies that assets are correctly copied and path references are properly replaced with absolute paths.

### Scenario 1: Path Reference Asset Handling
**Task Description:**
We're going to verify that path references in test scenarios are correctly processed. The test should copy the referenced asset to the temporary directory and replace the reference with the absolute path.

Follow these steps to verify the asset handling:

1. First, print the current working directory using `pwd` to see where we are.
2. Use the `cat` command to display the content of the file referenced by {{path:sample-asset.txt}}.
3. Use the `ls -la assets` command to verify the file exists in the assets directory within the temporary directory.
4. Use the `find . -name "*.txt"` command to find all text files in the current directory structure.

**Expected Behavior:**
- The asset file should be copied to the temporary directory's assets folder
- The path reference should be replaced with the absolute path to the file in the temporary directory
- The cat command should display the content of the file
- The ls and find commands should confirm the file exists

**Success Criteria:**
- The cat command successfully displays the content of the file
- The ls and find commands confirm the file exists in the temporary directory structure
- The test environment is properly isolated
