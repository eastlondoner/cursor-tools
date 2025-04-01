# Feature Behavior: Test isolation

## Description
This test verifies that tests are run in an isolated folder


### Scenario 1: Test commands run in an isolated folder
**Task Description:**
We're going to verify that vibe-tools test commands run in an isolated folder. You are inside a test so all you need to do is use ls to figure out if you're in a suitably isolated folder.

Test folders are creted new for each test and populated only with a symlink to the node_modules folder

**Expected Behavior:**
- The current directory should NOT contain source code
- The current directory should NOT be a git repository
- The current directory should have the expected folders that tests require

**Success Criteria:**
- The current directory contains a node_modules folder which is a symlink
- The current directory does not contain a .git folder
- The current directory does not contain a src folder

### Scenario 2: Test filesystem MCP works in an isolated folder
**Task Description:**
We're going to verify that the filesystem tool works only in the current working directory. You are inside a test. use the filesystem tool to check the permitted directories, it should be obviously a temporary directory. Use the filesystem tool to list the directory and compare it with executing ls. The two should match. In some systems the prefixes might vary slightly but the current folder names should match.
Create a new file with the filesystem tool and today's date. Execute cat on the created file to confirm that it was created in the cwd correctly

**Expected Behavior:**
- Filesystem tool should work in the current directory, which is a temporary test directory
- The Filesystem tool and command executor should work together
- The Filesystem tool should only have access to the temorary test directory 

**Success Criteria:**
- The current directory is a temp directory
- There are at most 2 allowed directories in the filesystem tool and both match the temporary test directory
- The results of filesystem tool list and ls should match
- The file created with the filesystem tool should be readable with cat
