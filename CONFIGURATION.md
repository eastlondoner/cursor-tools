# vibe-tools Configuration Guide

This document provides detailed configuration information for vibe-tools.

## Configuration Overview

vibe-tools can be configured through two main mechanisms:

1. Environment variables (API keys and core settings)
2. JSON configuration file (provider settings, model preferences, and command options)

## Environment Variables

Create `.vibe-tools.env` in your project root or `~/.vibe-tools/.env` in your home directory:

```env
# Required API Keys
PERPLEXITY_API_KEY="your-perplexity-api-key"    # Required for web search
GEMINI_API_KEY="your-gemini-api-key"            # Required for repository analysis

# Optional API Keys
OPENAI_API_KEY="your-openai-api-key"            # For browser commands with OpenAI
ANTHROPIC_API_KEY="your-anthropic-api-key"      # For browser commands with Anthropic, and MCP commands
OPENROUTER_API_KEY="your-openrouter-api-key"    # For MCP commands with OpenRouter and web search
GITHUB_TOKEN="your-github-token"                # For enhanced GitHub access

# Configuration Options
USE_LEGACY_CURSORRULES="true"                   # Use legacy .cursorrules file (default: false)
```

## Configuration File (vibe-tools.config.json)

Create this file in your project root to customize behavior. Here's a comprehensive example with all available options:

```json
{
  "perplexity": {
    "model": "sonar-pro", // Default model for web search
    "maxTokens": 8000 // Maximum tokens for responses
  },
  "gemini": {
    "model": "gemini-2.5-pro-exp", // Default model for repository analysis
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "plan": {
    "fileProvider": "gemini", // Provider for file identification
    "thinkingProvider": "openai", // Provider for plan generation
    "fileMaxTokens": 8192, // Tokens for file identification
    "thinkingMaxTokens": 8192 // Tokens for plan generation
  },
  "repo": {
    "provider": "gemini", // Default provider for repo command
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "doc": {
    "maxRepoSizeMB": 100, // Maximum repository size for remote docs
    "provider": "gemini", // Default provider for doc generation
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "browser": {
    "defaultViewport": "1280x720", // Default browser window size
    "timeout": 30000, // Default timeout in milliseconds
    "stagehand": {
      "env": "LOCAL", // Stagehand environment
      "headless": true, // Run browser in headless mode
      "verbose": 1, // Logging verbosity (0-2)
      "debugDom": false, // Enable DOM debugging
      "enableCaching": false, // Enable response caching
      "model": "claude-3-7-sonnet-latest", // Default Stagehand model
      "provider": "anthropic", // AI provider (anthropic or openai)
      "timeout": 30000 // Operation timeout
    }
  },
  "tokenCount": {
    "encoding": "o200k_base" // Token counting method
  },
  "openai": {
    "maxTokens": 8000 // Will be used when provider is "openai"
  },
  "anthropic": {
    "maxTokens": 8000 // Will be used when provider is "anthropic"
  }
}
```

## Configuration Sections

### Perplexity Settings

- `model`: The AI model to use for web searches
- `maxTokens`: Maximum tokens in responses

### Gemini Settings

- `model`: The AI model for repository analysis
- `maxTokens`: Maximum tokens in responses
- Note: For repositories >800K tokens, automatically switches to gemini-1.5-pro

### Plan Command Settings

- `fileProvider`: AI provider for identifying relevant files
- `thinkingProvider`: AI provider for generating implementation plans
- `fileMaxTokens`: Token limit for file identification
- `thinkingMaxTokens`: Token limit for plan generation

### Repository Command Settings

- `provider`: Default AI provider for repository analysis
- `maxTokens`: Maximum tokens in responses

### Documentation Settings

- `maxRepoSizeMB`: Size limit for remote repositories
- `provider`: Default AI provider for documentation
- `maxTokens`: Maximum tokens in responses

### Browser Automation Settings

- `defaultViewport`: Browser window size
- `timeout`: Navigation timeout
- `stagehand`: Stagehand-specific settings including:
  - `env`: Environment configuration
  - `headless`: Browser visibility
  - `verbose`: Logging detail level
  - `debugDom`: DOM debugging
  - `enableCaching`: Response caching
  - `model`: Default AI model
  - `provider`: AI provider selection
  - `timeout`: Operation timeout

### Token Counting Settings

- `encoding`: Method used for counting tokens
  - `o200k_base`: Optimized for Gemini (default)
  - `gpt2`: Traditional GPT-2 encoding

## GitHub Authentication

The GitHub commands support several authentication methods:

1. **Environment Variable**: Set `GITHUB_TOKEN` in your environment:

   ```env
   GITHUB_TOKEN=your_token_here
   ```

2. **GitHub CLI**: If you have the GitHub CLI (`gh`) installed and logged in, vibe-tools will automatically use it to generate tokens with the necessary scopes.

3. **Git Credentials**: If you have authenticated git with GitHub (via HTTPS), vibe-tools will automatically:
   - Use your stored GitHub token if available (credentials starting with `ghp_` or `gho_`)
   - Fall back to using Basic Auth with your git credentials

To set up git credentials:

1. Configure git to use HTTPS instead of SSH:
   ```bash
   git config --global url."https://github.com/".insteadOf git@github.com:
   ```
2. Store your credentials:
   ```bash
   git config --global credential.helper store  # Permanent storage
   # Or for macOS keychain:
   git config --global credential.helper osxkeychain
   ```
3. The next time you perform a git operation requiring authentication, your credentials will be stored

Authentication Status:

- Without authentication:

  - Public repositories: Limited to 60 requests per hour
  - Private repositories: Not accessible
  - Some features may be restricted

- With authentication (any method):
  - Public repositories: 5,000 requests per hour
  - Private repositories: Full access (if token has required scopes)

vibe-tools will automatically try these authentication methods in order:

1. `GITHUB_TOKEN` environment variable
2. GitHub CLI token (if `gh` is installed and logged in)
3. Git credentials (stored token or Basic Auth)

If no authentication is available, it will fall back to unauthenticated access with rate limits.

## Repomix Configuration

When generating documentation, vibe-tools uses Repomix to analyze your repository. By default, it excludes certain files and directories that are typically not relevant for documentation:

- Node modules and package directories (`node_modules/`, `packages/`, etc.)
- Build output directories (`dist/`, `build/`, etc.)
- Version control directories (`.git/`)
- Test files and directories (`test/`, `tests/`, `__tests__/`, etc.)
- Configuration files (`.env`, `.config`, etc.)
- Log files and temporary files
- Binary files and media files

You can customize the files and folders to exclude by adding a `.repomixignore` file to your project root.

Example `.repomixignore` file for a Laravel project:

```
vendor/
public/
database/
storage/
.idea
.env
```

This ensures that the documentation focuses on your actual source code and documentation files.
Support to customize the input files to include is coming soon - open an issue if you run into problems here.

## Model Selection

The `browser` commands support different AI models for processing. You can select the model using the `--model` option:

```bash
# Use gpt-4o
vibe-tools browser act "Click Login" --url "https://example.com" --model=gpt-4o

# Use Claude 3.7 Sonnet
vibe-tools browser act "Click Login" --url "https://example.com" --model=claude-3-7-sonnet-latest
```

You can set a default provider in your `vibe-tools.config.json` file under the `stagehand` section:

```json
{
  "stagehand": {
    "provider": "openai" // or "anthropic"
  }
}
```

You can also set a default model in your `vibe-tools.config.json` file under the `stagehand` section:

```json
{
  "stagehand": {
    "provider": "openai", // or "anthropic"
    "model": "gpt-4o"
  }
}
```

If no model is specified (either on the command line or in the config), a default model will be used based on your configured provider:

- **OpenAI:** `o3-mini`
- **Anthropic:** `claude-3-7-sonnet-latest`

Available models depend on your configured provider (OpenAI or Anthropic) in `vibe-tools.config.json` and your API key.

## Cursor Configuration

`vibe-tools` automatically configures Cursor by updating your project rules during installation. This provides:

- Command suggestions
- Usage examples
- Context-aware assistance

For new installations, we use the recommended `.cursor/rules/vibe-tools.mdc` path. For existing installations, we maintain compatibility with the legacy `.cursorrules` file. If both files exist, we prefer the new path and show a warning.

### Cursor Agent Configuration

To get the benefits of vibe-tools you should use Cursor agent in "yolo mode". Ideal settings:

![image](https://github.com/user-attachments/assets/783e26cf-c339-4cae-9629-857da0359cef)

## Command-Specific Configuration

### Ask Command

The `ask` command requires both a provider and a model to be specified. While these must be provided via command-line arguments, the maxTokens can be configured through the provider-specific settings:

```json
{
  "openai": {
    "maxTokens": 8000 // Will be used when provider is "openai"
  },
  "anthropic": {
    "maxTokens": 8000 // Will be used when provider is "anthropic"
  }
}
```

### Plan Command

The plan command uses two different models:

1. A file identification model (default: Gemini with gemini-2.5-pro-exp)
2. A thinking model for plan generation (default: OpenAI with o3-mini)

You can configure both models and their providers:

```json
{
  "plan": {
    "fileProvider": "gemini",
    "thinkingProvider": "openai",
    "fileModel": "gemini-2.5-pro-exp",
    "thinkingModel": "o3-mini",
    "fileMaxTokens": 8192,
    "thinkingMaxTokens": 8192
  }
}
```

The OpenAI o3-mini model is chosen as the default thinking provider for its speed and efficiency in generating implementation plans.

## MCP Configuration

The `vibe-tools mcp run` command supports using OpenRouter as a provider. You can configure this using the following:

- **`--provider` (Command-line option):** Specify the provider to use. Valid values are `anthropic` (default) and `openrouter`.
- **`--model` (Command-line option):** Specify the OpenRouter model to use (e.g., `openai/o3-mini`). This option is ignored if the provider is Anthropic.
- **Environment Variable:** You _must_ set either `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` in your environment.

**Default Behavior:**

- If `--provider` is not specified, `anthropic` is used by default.
- If `--model` is not specified and the provider is `openrouter` a provider default model is used.

**Example `vibe-tools.config.json`:**
The `vibe-tools.config.json` is not currently used to configure MCP.
