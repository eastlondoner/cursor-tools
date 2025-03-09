# Git Worktree Guide

Git worktrees solve the common problem of needing to switch between multiple branches frequently to work on multiple features simultaneously or to switch tasks quickly without staging your work in progress. Imagine you're deep into developing a new feature, and suddenly a critical bug needs immediate attention on a different branch. Without worktrees, you'd have to stash or commit your unfinished changes, switch branches, fix the bug, switch back, and then unstash/revert. This context switching is time-consuming and error-prone.

## What is a Worktree?

A worktree is a working directory with a .git folder (repository) that allows you to have multiple branches of a single Git repository checked out *simultaneously* to different subfolders. Think of worktrees like having multiple desktops for your computer, each focused on a different task, but all accessing the same files. Each worktree has its own directory, but they all share the same `.git` repository data (history, objects, etc.).

This allows you to:
- Work on multiple features simultaneously
- Handle urgent hotfixes while keeping your current work intact
- Review and test code from different branches without disrupting your work
- Experiment with different approaches in parallel

## Common Commands

### Creating a Worktree
```bash
# Create a new worktree for an existing branch
git worktree add <path-to-new-worktree> <existing-branch-name>

# Example:
cd /path/to/your/repo
git worktree add feature-x develop  # Creates a worktree at feature-x based on the 'develop' branch

# Create a new worktree with a new branch (this creates the branch too)
git worktree add -b <new-branch-name> <path-to-new-worktree> [<start-point>]

# Example:
git worktree add -b my-new-feature my-feature-worktree  # Creates a new branch 'my-new-feature' and a worktree at my-feature-worktree

# You can optionally specify a start-point (like a branch or commit hash)
git worktree add -b hotfix-login hotfix origin/main
```

### Managing Worktrees
```bash
# List all worktrees
git worktree list

# Example Output:
# /path/to/main/repo        0a1b2c3 [main]
# /path/to/feature-x        4d5e6f7 [feature-x]
# /path/to/hotfix          8g9h0i1 [bug-fix]

# Remove a worktree (this only removes the worktree directory, not the branch)
git worktree remove <path-to-worktree>

# Example:
git worktree remove feature-x

# Force removal if there are uncommitted changes
git worktree remove -f feature-x

# Move a worktree to a new location
git worktree move <path-to-worktree> <new-path-to-worktree>

# Example:
git worktree move feature-x feature-x-part-2

# Clean up stale worktree entries
git worktree prune

# This removes entries from the worktree list that point to directories that no longer exist
```

## Best Practices

0. Do not work in the worktree root directory. In the worktree root directory just checkout this `worktree` branch that only contains a README.

1. Use the branch name as the directory name. Use meaningful branch names.
   - Good: `feature-login`
   - Avoid: `temp1`

2. Clean up worktrees when you're done with them
   - Always use `git worktree remove` instead of manually deleting directories
   - This ensures proper cleanup of Git's internal worktree metadata

## Common Issues and Solutions

1. **Submodule Limitations**
   - Submodules require separate initialization in *each* worktree after creation
   - Run `git submodule update --init` in each new worktree that uses submodules

2. **Remote Branch Issues**
   - Bare repositories don't automatically fetch all remote branches
   - Add this to your Git config to fix fetch issues:
     ```
     [remote "origin"]
     fetch = +refs/heads/*:refs/remotes/origin/*
     ```

3. **Disk Space**
   - Each worktree creates a new working directory with its own copy of all files
   - The Git history is shared, so the `.git` directory is not duplicated

4. **Detached HEAD State**
   - Creating a worktree from a specific commit (instead of a branch) results in a detached HEAD
   - Always create worktrees from branches, or create a new branch with `-b` flag

5. **.git Location**
   - Main worktree: Has a regular `.git` directory
   - Linked worktrees: Have a `.git` file pointing to `.git/worktrees/<worktree-name>` in the main repository

## Example Workflow

1. **You're starting working on a feature in a feature branch+directory:**
   ```bash
   cd /path/to/your/repo
   git worktree add feature-new-ui feature-new-ui
   cd feature-new-ui
   # ... make some changes ...
   ```

2. **An urgent bug needs fixing:**
   ```bash
   # Create a worktree for the hotfix, based on the 'main' branch
   cd /path/to/your/repo
   git worktree add hotfix-login-bug origin/main
   cd hotfix-login-bug

   # Create a branch for the fix (best practice)
   git checkout -b hotfix-login-bug

   # ... fix the bug ...
   git add .
   git commit -m "Fix: Login issue causing 500 error"

   # Push the fix to the remote repository
   git push -u origin hotfix-login-bug

   # Create a pull request for the fix
   gh pr create --base main --head hotfix-login-bug --title "Fix: Login issue causing 500 error" --body "This PR fixes the login issue causing a 500 error."
   ```

3. **Return to your feature work:**
   ```bash
   cd /path/to/your/repo
   cd feature-new-ui
   # Continue working on your feature...
   ```

4. **Clean up the hotfix worktree:**
   ```bash
   git worktree remove hotfix-login-bug
   ```

## Further Reading

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Pro Git Book - Git Tools - Worktree](https://git-scm.com/book/en/v2/Git-Tools-Worktree)
