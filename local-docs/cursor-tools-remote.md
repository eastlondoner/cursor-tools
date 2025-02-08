
--- Repository Documentation ---

# Cursor Tools Documentation

## Repository Purpose and Summary

`cursor-tools` enhances AI-powered development agents and IDEs. It provides AI-powered web queries and codebase understanding. It integrates with Cursor and other agents using Perplexity AI for web searches and Google Gemini for repository-aware assistance. It's an npm package with a CLI to extend agent capabilities.

## Quick Start

1.  **Installation:**

    Run this interactive setup in your project's root directory:
    ```bash
    npx cursor-tools@latest install .
    ```
    This installs `cursor-tools`, configures API keys, and updates `.cursorrules`.

2.  **Basic Usage:**

    *   **Web Search (Perplexity AI):**

        ```bash
        cursor-tools web "Your question here"
        ```

    *   **Repository Context (Google Gemini):**

        ```bash
        cursor-tools repo "Your question about the codebase"
        ```
    If it is not globally installed you can use:

    ```bash
     npx -y cursor-tools@latest web "query"
    ```

## Configuration

### API Keys

`cursor-tools` needs API keys for Perplexity AI and Google Gemini. Set them up using:

1.  **Interactive Setup**: `cursor-tools install` guides you through the process.

2.  **Manual Setup**: Create `.cursor-tools.env` in your project root, or `~/.cursor-tools/.env` in home directory:

    ```
    PERPLEXITY_API_KEY="your-perplexity-api-key"
    GEMINI_API_KEY="your-gemini-api-key"
    ```

### Default Settings

Customize with `cursor-tools.config.json`:
```json
{
  "perplexity": {
    "model": "sonar-pro",
    "maxTokens": 8000
  },
  "gemini": {
    "model": "gemini-2.0-flash-thinking-exp-01-21",
    "maxTokens": 10000
  }
}
```

## Core Features

### Web Search

Get current web info:

```bash
cursor-tools web "What's new in TypeScript 5.7?"
```

### Repository Context

Get codebase-aware answers:

```bash
cursor-tools repo "Explain the authentication flow."
```

### Documentation Generation
Create docs for your repository or a GitHub repo:

```bash
# Local
cursor-tools doc "Generate documentation"

# Remote GitHub repo
cursor-tools doc "Generate documentation" --fromGithub=username/repo-name
cursor-tools doc "Generate documentation" --fromGithub=username/repo-name@branch # Specific branch

# Save to file
cursor-tools doc "Generate documentation" --output=docs/README.md
```

### Command Options
*   `--model`: Choose a different model.
*   `--maxTokens`: Set the maximum response length.
*   `--help`: All available options.
*   `--fromGithub`: Generate docs from a remote GitHub repository (For documentation).
*    `--output`: Save the documentation to a specified file (For documentation).

## Cursor Integration

`cursor-tools` sets up Cursor by updating your project rules during installation. For new installations, we use the recommended `.cursor/rules/cursor-tools.mdc` path. For existing installations, we maintain compatibility with the legacy `.cursorrules` file. If both files exist, we prefer the new path and show a warning.

The project rules provide command suggestions and context-aware help for the Cursor Composer.

Use Cursor agent in "yolo mode."

## Troubleshooting

### Common Issues

1.  **Command Not Found:**
    *   Install `cursor-tools` (globally or as dev dependency).
    *   Check your PATH if globally installed.

2.  **API Key Errors:**
    *   Make sure `.cursor-tools.env` file exists and has correct API keys.
    *   Run `cursor-tools install` again to set up the API keys.

3.  **Model Errors:**
    *   Check internet connection.
    *   Check API key permissions.
    *   Make sure the model is available for your API tier.


--- End of Documentation ---
