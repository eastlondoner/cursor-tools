
--- Repository Documentation ---

```markdown
## Cursor-Tools Repository Documentation

### 1. Repository Purpose and "What is it" Summary

**Repository Purpose:**

This repository contains `cursor-tools`, a command-line interface (CLI) tool designed to enhance AI agents, particularly Cursor Composer, with advanced skills and teamwork capabilities. It enables AI agents to:

- **Perform web searches and research** using Perplexity AI.
- **Gain repository context and planning** using Google Gemini models.
- **Automate browser interactions** for web application testing and debugging using Stagehand.
- **Interact with GitHub** for issue and pull request management.

`cursor-tools` aims to provide AI agents with a suite of tools to solve complex problems collaboratively, acting as a team of expert AI assistants.

**What is cursor-tools?**

`cursor-tools` is a CLI tool that empowers AI coding agents with new skills by integrating various AI models and specialized tools. It acts as a bridge between natural language instructions and powerful AI capabilities, allowing AI agents to:

- **Answer complex queries** about codebases, leveraging large context window models.
- **Plan and execute implementation tasks** with step-by-step guidance.
- **Generate documentation** for code repositories.
- **Interact with web applications** for testing and automation.
- **Access and manage GitHub information**.

`cursor-tools` is designed to be installed globally and configured to work seamlessly with Cursor and other AI agents capable of executing command-line tools.

### 2. Quick Start: Installation and Basic Usage

**Installation:**

To install `cursor-tools` globally using npm, run:

```bash
npm install -g cursor-tools
```

After installation, run the setup command to configure API keys and integrate with Cursor:

```bash
cursor-tools install .
```

This interactive command will guide you through:
- Setting up API keys for Perplexity and Gemini.
- Configuring Cursor project rules to enable `cursor-tools` integration.

**Basic Usage:**

Once installed, you can use `cursor-tools` commands directly from your terminal or through an AI agent like Cursor Composer. Here are a few basic examples:

**Web Search using Perplexity:**
```bash
cursor-tools web "What are the latest features in React 19?"
```

**Repository Context Query using Gemini:**
```bash
cursor-tools repo "Explain the project architecture."
```

**Implementation Planning using Gemini and OpenAI:**
```bash
cursor-tools plan "Implement user authentication with social logins."
```

**Documentation Generation for a local repository:**
```bash
cursor-tools doc --save-to=docs.md
```

**GitHub Issue Information:**
```bash
cursor-tools github issue 123
```

**Browser Automation (opening a webpage):**
```bash
cursor-tools browser open "https://example.com" --html
```

For more detailed usage instructions and advanced features, refer to the subsequent sections of this documentation.

### 3. Configuration Options

`cursor-tools` can be configured through a combination of environment variables and a JSON configuration file.

**Environment Variables:**

API keys and core settings are managed through environment variables. Create a `.cursor-tools.env` file in your project root or `~/.cursor-tools/.env` in your home directory to set these variables.

Example `.cursor-tools.env`:
```env
PERPLEXITY_API_KEY="your_perplexity_api_key"
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
ANTHROPIC_API_KEY="your_anthropic_api_key"
GITHUB_TOKEN="your_github_token"
```

**Configuration File (cursor-tools.config.json):**

Provider settings, model preferences, and command options are configured in `cursor-tools.config.json`. This file can be placed in your project root or `~/.cursor-tools/config.json` in your home directory.

Example `cursor-tools.config.json`:
```json
{
  "perplexity": {
    "model": "sonar-pro",
    "maxTokens": 8000
  },
  "gemini": {
    "model": "gemini-2.0-pro-exp",
    "maxTokens": 10000
  },
  "plan": {
    "fileProvider": "gemini",
    "thinkingProvider": "openai",
    "fileMaxTokens": 8192,
    "thinkingMaxTokens": 8192
  },
  "repo": {
    "provider": "gemini",
    "maxTokens": 10000
  },
  "doc": {
    "maxRepoSizeMB": 100,
    "provider": "gemini",
    "maxTokens": 10000
  },
  "browser": {
    "defaultViewport": "1280x720",
    "timeout": 120000,
    "stagehand": {
      "provider": "openai",
      "verbose": true,
      "debugDom": false,
      "enableCaching": true
    }
  },
  "tokenCount": {
    "encoding": "o200k_base"
  }
}
```

Refer to `CONFIGURATION.md` for a detailed breakdown of all available configuration options and sections.

### 4. Public Packages Documentation

This repository provides a single public package, `cursor-tools`, which encompasses all the functionalities described below.

### 5. Package Summary & How to Install / Import

**Package Summary:**

The `cursor-tools` package provides a command-line interface to access various AI-powered tools, including web search, repository analysis, documentation generation, GitHub integration, and browser automation. It is designed to be used by AI agents to enhance their capabilities in software development and information retrieval tasks.

**Installation:**

To install the `cursor-tools` package globally using npm:

```bash
npm install -g cursor-tools
```

**Importing (for programmatic use - not typically used directly by AI agents but useful for developers extending the tool):**

While `cursor-tools` is primarily used as a CLI, developers can import and extend its functionalities if needed. To import modules from `cursor-tools` in a Node.js environment:

```typescript
import { commands } from 'cursor-tools/dist/index.mjs';
// or specific commands
import { WebCommand } from 'cursor-tools/dist/index.mjs';
```

**Note:**  `cursor-tools` is primarily designed to be executed from the command line. Direct programmatic import and usage of internal modules are for advanced use cases and may require understanding of the internal architecture.

### 6. Detailed Documentation of Public Features / API / Interface

`cursor-tools` provides the following top-level commands, each with subcommands and options:

#### 6.1. `ask` Command

**Summary:**
The `ask` command allows for direct querying of various AI models from different providers. It is designed for simple, direct questions where specific model selection is desired without repository context.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools ask "<your question>" --provider <provider> --model <model> [options]
```

**Parameters:**
- `<your question>`: The question to ask the AI model (string).
- `--provider <provider>`:  Specifies the AI provider to use. Required. Available providers: `openai`, `anthropic`, `perplexity`, `gemini`, `openrouter`, `modelbox`.
- `--model <model>`: Specifies the AI model to use from the selected provider. Required. Model names depend on the provider.
- `[options]`: Optional parameters to modify command behavior (see General Command Options).

**General Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools ask "What is the capital of Spain?" --provider openai --model o3-mini
cursor-tools ask "Explain the concept of blockchain technology." --provider gemini --model gemini-2.0-pro-exp
```

#### 6.2. `web` Command

**Summary:**
The `web` command leverages AI models with web search capabilities to answer user queries using up-to-date information from the internet. It is ideal for general knowledge questions and research tasks that are not specific to a codebase.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools web "<your question>" [options]
```

**Parameters:**
- `<your question>`: The question or search query (string).
- `[options]`: Optional parameters to modify command behavior (see Web Command Options and General Command Options).

**Web Command Options:**
- `--provider=<provider>`: AI provider to use (perplexity, gemini, modelbox, or openrouter). Defaults to `perplexity`.
- `--model=<model>`: Model to use for web search. Model name depends on the provider. If not specified, the default model for the provider will be used.
- `--max-tokens=<number>`: Maximum tokens for response

**General Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools web "What is the current weather in London?"
cursor-tools web "Find the latest research on climate change." --provider gemini --model gemini-2.0-pro-exp
cursor-tools web "latest javascript framework trends" --save-to web-search-results.md
```

#### 6.3. `repo` Command

**Summary:**
The `repo` command provides context-aware answers about a software repository using Google Gemini models with large context windows. It sends the entire repository content as context to the AI, making it suitable for codebase analysis, code review, and understanding project architecture.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools repo "<your question>" [options]
```

**Parameters:**
- `<your question>`: The question about the repository (string).
- `[options]`: Optional parameters to modify command behavior (see Repository Command Options and General Command Options).

**Repository Command Options:**
- `--provider=<provider>`: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox). Defaults to `gemini`.
- `--model=<model>`: Model to use for repository analysis. If not specified, the default model for the provider will be used.
- `--max-tokens=<number>`: Maximum tokens for response

**General Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools repo "Explain the authentication flow in this repository."
cursor-tools repo "Review recent changes to the error handling logic for potential improvements." --save-to code-review.md
cursor-tools repo "List all files related to user management." --provider openai --model o3-mini
```

#### 6.4. `plan` Command

**Summary:**
The `plan` command generates detailed implementation plans for software development tasks using a dual-provider architecture. It first identifies relevant files in the codebase using one model and then generates a step-by-step plan using another model.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools plan "<query>" [options]
```

**Parameters:**
- `<query>`: The description of the implementation task (string).
- `[options]`: Optional parameters to modify command behavior (see Plan Command Options and General Command Options).

**Plan Command Options:**
- `--fileProvider=<provider>`: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter). Defaults to `gemini`.
- `--thinkingProvider=<provider>`: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter). Defaults to `openai`.
- `--fileModel=<model>`: Model to use for file identification. If not specified, the default model for the provider will be used.
- `--thinkingModel=<model>`: Model to use for plan generation. If not specified, the default model for the provider will be used.
- `--fileMaxTokens=<number>`: Maximum tokens for file identification
- `--thinkingMaxTokens=<number>`: Maximum tokens for plan generation

**General Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools plan "Add user authentication to the login page."
cursor-tools plan "Refactor the payment service to use asynchronous processing." --thinkingProvider anthropic --thinkingModel claude-3-7-sonnet
cursor-tools plan "Implement real-time chat functionality." --save-to plan-chat.md
```

#### 6.5. `doc` Command

**Summary:**
The `doc` command generates comprehensive documentation for a local repository or a remote GitHub repository. It leverages large context window models to understand the codebase and produce well-structured documentation.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools doc [options]
```

**Documentation Command Options:**
- `--from-github=<GitHub username>/<repository name>[@<branch>]`: Generate documentation for a remote GitHub repository. Supports specifying a branch using `@<branch>` syntax.
- `--provider=<provider>`: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox). Defaults to `gemini`.
- `--model=<model>`: Model to use for documentation generation. If not specified, the default model for the provider will be used.
- `--max-tokens=<number>`: Maximum tokens for response
- `--hint=<string>`: Provide additional context or focus for documentation generation

**General Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools doc --save-to=repository-documentation.md
cursor-tools doc --from-github=username/repo-name --save-to=remote-repo-docs.md
cursor-tools doc --from-github=username/repo-name@develop --save-to=remote-repo-docs-develop.md
cursor-tools doc --hint="Focus on API endpoints and data models." --save-to api-docs.md
```

#### 6.6. `github` Command

**Summary:**
The `github` command provides access to GitHub information, specifically issues and pull requests, directly from the command line. It allows listing recent items and viewing detailed information for specific PRs or issues.

**Installation:**
Part of the global `cursor-tools` installation.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools github <subcommand> [options]
```

**Subcommands:**
- `pr [number]`: Get the last 10 PRs or a specific PR by number.
- `issue [number]`: Get the last 10 issues or a specific issue by number.

**GitHub Command Options:**
- `--from-github=<GitHub username>/<repository name>[@<branch>]`: Access PRs/issues from a specific GitHub repository. Synonym: `--repo`.

**General Command Options:**
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**
```bash
cursor-tools github pr
cursor-tools github issue
cursor-tools github pr 123
cursor-tools github issue 456
cursor-tools github pr --from-github=facebook/react
cursor-tools github issue 789 --from-github=vuejs/vue
```

#### 6.7. `browser` Command

**Summary:**
The `browser` command suite provides browser automation capabilities for web application testing, debugging, and interaction. It utilizes Stagehand AI for natural language instructions and supports various browser operations.

**Installation:**
Part of the global `cursor-tools` installation. Requires separate Playwright installation: `npm install -g playwright`.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools browser <subcommand> [options]
```

**Subcommands:**
- `open <url> [options]`: Opens a URL in a browser instance and captures page content, console logs, and network activity.
- `act "<instruction>" --url=<url | 'current'> [options]`: Executes actions on a webpage based on natural language instructions.
- `observe "<instruction>" --url=<url> [options]`: Observes interactive elements on a webpage and suggests possible actions.
- `extract "<instruction>" --url=<url> [options]`: Extracts data from a webpage based on natural language instructions.

**Browser Command Options (for 'open', 'act', 'observe', 'extract'):**
- `--console`: Capture browser console logs (enabled by default, use `--no-console` to disable)
- `--html`: Capture page HTML content (disabled by default)
- `--network`: Capture network activity (enabled by default, use `--no-network` to disable)
- `--screenshot=<file path>`: Save a screenshot of the page
- `--timeout=<milliseconds>`: Set navigation timeout (default: 120000ms for Stagehand operations, 30000ms for navigation)
- `--viewport=<width>x<height>`: Set viewport size (e.g., 1280x720). When using --connect-to, viewport is only changed if this option is explicitly provided
- `--headless`: Run browser in headless mode (default: true)
- `--no-headless`: Show browser UI (non-headless mode) for debugging
- `--connect-to=<port>`: Connect to existing Chrome instance. Special values: 'current' (use existing page), 'reload-current' (refresh existing page)
- `--wait=<time:duration or selector:css-selector>`: Wait after page load (e.g., 'time:5s', 'selector:#element-id')
- `--video=<directory>`: Save a video recording (1280x720 resolution, timestamped subdirectory). Not available when using --connect-to
- `--url=<url>`: Required for `act`, `observe`, and `extract` commands. Url to navigate to before the main command or one of the special values 'current' (to stay on the current page without navigating or reloading) or 'reload-current' (to reload the current page)
- `--evaluate=<string>`: JavaScript code to execute in the browser before the main command
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**

**Open Command:**
```bash
cursor-tools browser open "https://example.com" --html
cursor-tools browser open "https://example.com" --screenshot=homepage.png
cursor-tools browser open "https://example.com" --no-headless
```

**Act Command:**
```bash
cursor-tools browser act "Click 'Login'" --url="https://example.com/login"
cursor-tools browser act "Fill out the form and submit" --url="https://example.com/signup" --video="./recordings"
cursor-tools browser act "Click Menu | Click About Us" --url="https://example.com"
cursor-tools browser act "Type 'query' into search box" --url="https://example.com" --evaluate="document.querySelector('input[type=search]').focus()"
```

**Observe Command:**
```bash
cursor-tools browser observe "What interactive elements are on the page?" --url="https://example.com"
cursor-tools browser observe "Find login button and form" --url="https://example.com/login"
```

**Extract Command:**
```bash
cursor-tools browser extract "Get product names and prices" --url="https://example.com/products"
cursor-tools browser extract "Extract all article titles from the blog" --url="https://example.com/blog" --save-to products.json
```

#### 6.8. `mcp` Command

**Summary:**
The `mcp` command family allows interaction with Model Context Protocol (MCP) servers, enabling access to specialized tools and functionalities provided by these servers.

**Installation:**
Part of the global `cursor-tools` installation. Requires `ANTHROPIC_API_KEY` environment variable to be set.

**Import:**
Not intended for direct programmatic import.

**API/Interface:**

```bash
cursor-tools mcp <subcommand> [options]
```

**Subcommands:**
- `search "<query>"`: Searches the MCP Marketplace for available servers matching the query.
- `run "<query>"`: Executes tools from MCP servers based on natural language queries.

**MCP Command Options:**
- `--provider=<provider>`: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
- `--model=<model name>`: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
- `--max-tokens=<number>`: Control response length
- `--save-to=<file path>`: Save command output to a file (in *addition* to displaying it)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options (help is not fully implemented yet)

**Example Usage:**

**Search Command:**
```bash
cursor-tools mcp search "git repository management"
cursor-tools mcp search "database query tools"
```

**Run Command:**
```bash
cursor-tools mcp run "list files in the current directory"
cursor-tools mcp run "using the mcp-server-sqlite list tables in database mydatabase.db"
cursor-tools mcp run "using the git-server create a new branch called feature-x"
```

### 7. Dependencies and Requirements

- **Node.js:** Version 18 or later is required.
- **npm:** Node Package Manager (typically bundled with Node.js).
- **API Keys:**
    - Perplexity API key (for web search)
    - Google Gemini API key (for repository analysis and documentation)
    - OpenAI API key or Anthropic API key (for browser commands)
    - GitHub Token (optional, for GitHub commands)
    - Anthropic API key (for MCP commands)
- **Playwright:** For browser automation commands (`browser` command family), Playwright must be installed separately: `npm install -g playwright`.

### 8. Advanced Usage Examples

**Generating Documentation for a Remote Repository with a Specific Branch:**

```bash
cursor-tools doc --from-github=facebook/react@main --save-to react-docs.md
```

**Planning a Complex Feature with Specific Providers:**

```bash
cursor-tools plan "Implement a new payment gateway integration" --fileProvider gemini --thinkingProvider anthropic --thinkingModel claude-3-7-sonnet --save-to payment-plan.md
```

**Automating a Multi-Step Browser Workflow with Video Recording:**

```bash
cursor-tools browser act "Go to website | Login | Navigate to settings | Change profile picture | Save changes" --url="https://example.com" --video="./automation-videos" --no-headless
```

**Using Nicknames for Commands:**

```bash
Gemini "Explain the project's data models."
Perplexity "What are the latest AI trends in 2024?"
Stagehand act "Click 'Accept Cookies' if visible" --url="https://example.com"
```

**Combining Commands for Complex Tasks:**

```bash
# Generate documentation for a remote repository and then ask Gemini to summarize it
cursor-tools doc --from-github=vuejs/vue --save-to vue-docs.md && cursor-tools repo "Summarize the vuejs documentation in vue-docs.md"
```
```

--- End of Documentation ---
