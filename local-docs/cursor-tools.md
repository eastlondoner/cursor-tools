
--- Repository Documentation ---

# cursor-tools

## What is it?

`cursor-tools` is an npm package that extends the capabilities of AI-powered development environments (like Cursor) by providing a command-line interface (CLI) for web queries, repository analysis, documentation generation, and GitHub integration. It leverages Perplexity AI for web searches and Google Gemini for in-depth, context-aware code understanding.

## Quick Start

### Requirements

-   Node.js 18 or later
-   Perplexity API key
-   Google Gemini API key

### Installation

1.  **Install:**
    Run the interactive setup within your project directory:

    ```bash
    npx cursor-tools@latest install .
    ```

    This will:

    -   Add `cursor-tools` as a dev dependency to your `package.json`.
    -   Guide you through setting up API keys (or you can set them manually).
    -   Update your `.cursorrules` file for integration with Cursor.

2.  **API Keys:**
    The install command should prompt to enter your API Keys, but, if this does not happen, you can enter them manually. `cursor-tools` requires API keys for both Perplexity AI and Google Gemini. Create a `.cursor-tools.env` file in your project root (or `~/.cursor-tools/.env` in your home directory) with the following content:

    ```
    PERPLEXITY_API_KEY="your-perplexity-api-key"
    GEMINI_API_KEY="your-gemini-api-key"
    ```
    Replace the placeholders with your actual API keys.

### Basic Usage

Once installed, your AI coding assistant (e.g., within Cursor) can utilize `cursor-tools` commands. Below is a simplified summary, and later sections of this document provide more detail.

1.  **Web Search (Perplexity AI):**
    ```bash
    cursor-tools web "your question"
    ```

2.  **Repository Context (Google Gemini):**
    ```bash
    cursor-tools repo "your question about the codebase"
    ```

3. **Documentation Generation:**
    ```bash
    cursor-tools doc  # Documents the current local repository
    cursor-tools doc --from-github username/repo # Documents a remote Github repository
    cursor-tools doc --output filepath # Save to file
    ```
4. **GitHub Integration:**
   ```bash
   cursor-tools github pr [number] # List or view PRs.
   cursor-tools github issue [number] #List or view Issues.
   ```

## Configuration

You can customize `cursor-tools` by creating a `cursor-tools.config.json` file in your project root (or `~/.cursor-tools/config.json` in your home directory):

```json
{
  "perplexity": {
    "model": "sonar-pro",
    "maxTokens": 4000
  },
  "gemini": {
    "model": "gemini-2.0-flash-thinking-exp-01-21",
    "maxTokens": 10000
  },
  "doc": {
      "maxRepoSizeMB": 100
  }
}
```

-   **`perplexity`:**
    -   `model`:  The Perplexity AI model to use (default: `"sonar-pro"`).
    -   `maxTokens`: The maximum number of tokens in the Perplexity AI response (default: `4000`).
-   **`gemini`:**
    -   `model`: The Google Gemini model to use (default: `"gemini-2.0-flash-thinking-exp-01-21"`).  `cursor-tools` will automatically switch to `"gemini-2.0-pro-exp-02-05"` if the repository token count exceeds 800,000.
    -   `maxTokens`: The maximum number of tokens in the Gemini response (default: `10000`).
-   **`doc`**:
    -   `maxRepoSizeMB`: Maximum repository size in MB for *remote* processing, used with `cursor-tools doc --from-github`.  Default is 100MB.  Larger repos should be cloned and documented locally.

## Public Features / API / Interfaces

`cursor-tools` provides the following commands, which are designed to be used primarily by an AI agent, but can also be used directly from the command line.

### 1. `web` Command

Performs web searches using Perplexity AI.

**Interface:**

```typescript
interface Command {
  execute(query: string, options?: CommandOptions): CommandGenerator;
}

type CommandGenerator = AsyncGenerator<string, void, unknown>;

interface CommandOptions {
  model?: string;        // Perplexity model name.
  maxTokens?: number;    // Maximum tokens in response.
  saveTo?: string;       // Path to save the output, in *addition* to printing to stdout.
  hint?: string;         // Additional context/hint for the AI.
}
```

**Usage:**

```bash
cursor-tools web "What is the latest version of React?"  # Basic search
cursor-tools web --model sonar-pro "Explain quantum computing" # Specify model.
cursor-tools web "How do I use fetch in JavaScript?" --max-tokens 500 --save-to output.txt # Limit tokens and save.
```

**Dependencies:**

-   Perplexity API key (set as `PERPLEXITY_API_KEY` environment variable).
-   `eventsource-client` npm package for streaming responses.

### 2. `repo` Command

Provides context-aware answers about the current repository using Google Gemini.

**Interface:**  (Uses the same `Command`, `CommandGenerator`, and `CommandOptions` interfaces as `web`.)

```typescript
interface CommandOptions {
  model?: string;        // Gemini model name.
  maxTokens?: number;    // Maximum tokens in response.
  saveTo?: string;       // Path to save the output, in *addition* to printing to stdout.
  hint?: string;        // Additional context/hint for the AI.
}
```

**Usage:**

```bash
cursor-tools repo "Explain the purpose of the src/config.ts file"
cursor-tools repo "How does authentication work in this project?" --model gemini-pro
cursor-tools repo "List all public functions in src/commands/index.ts" --save-to functions.txt
```

**Dependencies:**

-   Google Gemini API key (set as `GEMINI_API_KEY` environment variable).
-   `repomix` npm package to pack the repository context.

### 3. `doc` Command

Generates documentation for a repository.

**Interface:** (Uses the same `Command` and `CommandGenerator` interfaces as `web`).

```typescript
interface DocCommandOptions extends CommandOptions {
  output?: string;      // Optional output file path.  If omitted, prints to stdout.
  fromGithub?: string;  // GitHub URL or 'username/reponame[@branch]'
}
```

**Usage:**

```bash
cursor-tools doc  # Documents the local repository, output to stdout.
cursor-tools doc --output docs.md # Documents local repo, saves to docs.md
cursor-tools doc --from-github eastlondoner/cursor-tools # Documents a remote GitHub repo.
cursor-tools doc --from-github eastlondoner/cursor-tools@main --output cursor-tools-docs.md # Specify branch and output file.
cursor-tools doc --hint "Focus on the public API" --output api-docs.md
```

**Dependencies:**

-   Google Gemini API key (set as `GEMINI_API_KEY` environment variable).
-   `repomix` npm package for local repository packing.  For remote repositories, the Repomix API (`api.repomix.com`) is used.
-   `node:fs` for file operations.

### 4. `github` Command
Accesses information from GitHub, including pull requests and issues.
**Interface:**
```typescript
interface GithubOptions extends CommandOptions {
  repo?: string;
  fromGithub?: string;
}
```

**Subcommands:**
  - `pr`: Accesses pull request information.
    **Usage**:
    ```bash
    cursor-tools github pr # Lists recent PRs.
    cursor-tools github pr 123 # Shows details for PR #123.
    cursor-tools github pr --from-github owner/repo # Lists PRs from a remote repository.
    cursor-tools github pr 123 --from-github owner/repo # Shows details of remote PR #123.
    ```
  - `issue`: Accesses issue information.
     **Usage**:
    ```bash
    cursor-tools github issue # Lists recent issues.
    cursor-tools github issue 456 # Shows details for Issue #456.
    cursor-tools github issue --from-github owner/repo # Lists issues from remote repository.
    cursor-tools github issue 456 --from-github owner/repo # Shows details of remote issue #456.
    ```
**Dependencies:**

-   GitHub authentication (see below).

### 5. `install` command
Installs `cursor-tools` into a repository.
**Interface:**
```typescript
interface InstallOptions extends CommandOptions {
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}
```
**Usage:**

```bash
npx cursor-tools@latest install . # Install in the current directory.
```
**Dependencies:**
   -   `node:fs` for file operations.
   -   `node:path` for path manipulation.
   -   `node:os` for accessing the user's home directory.

## GitHub Authentication

The `github` command supports multiple authentication methods, tried in this order:

1.  **`GITHUB_TOKEN` environment variable:**  Set this to a personal access token with `repo` and `read:user` scopes.
2.  **GitHub CLI (`gh`):** If installed and logged in, `cursor-tools` will use it to generate temporary tokens.
3.  **Git Credentials:** If you've authenticated with GitHub via HTTPS, `cursor-tools` will try to use those credentials.  It looks for tokens starting with `ghp_` or `gho_`, or uses Basic Auth if those aren't found.

If no authentication is available, the command will use unauthenticated access, which has significantly lower rate limits.

## Advanced Usage Examples

- **Combining commands:**  An AI agent could use `cursor-tools web` to research a topic, then use `cursor-tools repo` to apply that knowledge to the current codebase.

- **Iterative refinement:** An AI agent could use multiple `cursor-tools repo` calls with different `hint` values to progressively refine its understanding of a complex code section.

- **Automated documentation updates:**  A script could use `cursor-tools doc --output` to automatically regenerate documentation whenever the codebase changes.

- **GitHub Workflow Integration**: You could set up a GitHub Action that runs `cursor-tools doc --from-github` on a schedule or on pushes to the `main` branch, automatically updating your project's documentation.

## Dependencies

-   **`dotenv`:** Loads environment variables from `.env` files.
-   **`eventsource-client`:**  Used by the `web` command to handle streaming responses from Perplexity AI.
-   **`repomix`:** Used by the `repo` and `doc` commands to pack the repository context.
-   Node.js built-in modules: `fs`, `path`, `os`, `child_process`, `url`.

## Cursor Integration

`cursor-tools` sets up Cursor by updating your project rules during installation. For new installations, we use the recommended `.cursor/rules/cursor-tools.mdc` path. For existing installations, we maintain compatibility with the legacy `.cursorrules` file. If both files exist, we prefer the new path and show a warning.

The project rules provide:
- A list of available `cursor-tools` commands
- Explanations of when to use each command
- Instructions on how to run the commands (both installed and in development)
- Notes about configuration and API keys
- A version number (`cursor-tools-version`) to track updates. The `checkCursorRules` function in `src/cursorrules.ts` checks this version and warns the user if an update is needed.

--- End of Documentation ---
