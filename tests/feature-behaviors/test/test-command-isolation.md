# Feature Behavior: Test isolation

## Description
This test verifies that tests are run in an isolated folder


### Scenario 1: Test commands run in an isolated folder
**Task Description:**
We're going to verify that cursor-tools test commands run in an isolated folder. You are inside a test so all you need to do is use ls to figure out if you're in a suitably isolated folder.

Test folders are creted new for each test and populated only with a symlink to the node_modules folder

**Expected Behavior:**
- The current directory should NOT contain source code
- The current directory should NOT be a git repository
- The current directory should have the expected folders that tests require

**Success Criteria:**
- The current directory contains a node_modules folder which is a symlink
- The current directory does not contain a .git folder
- The current directory does not contain a src folder
