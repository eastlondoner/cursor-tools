<div align="center">
  <img height="72" src="https://github.com/user-attachments/assets/45eff178-242f-4d84-863e-247b080cc6f5" />
</div>

<div align=center><h1>Give Cursor Agent an AI team and advanced skills</h1></div>

## Table of Contents

- [The AI Team](#the-ai-team)
- [New Skills](#new-skills-for-your-existing-agent)
- [How to Use](#how-do-i-use-it)
  - [Example: Using Perplexity](#asking-perplexity-to-carry-out-web-research)
  - [Example: Using Gemini](#asking-gemini-for-a-plan)
- [What is vibe-tools](#what-is-vibe-tools)
- [Installation](#installation)
- [Requirements](#requirements)
- [Tips](#tips)
- [Additional Examples](#additional-examples)
  - [GitHub Skills](#github-skills)
  - [Gemini Code Review](#gemini-code-review)
- [Detailed Cursor Usage](#detailed-cursor-usage)
  - [Tool Recommendations](#tool-recommendations)
  - [Command Nicknames](#command-nicknames)
  - [Web Search](#use-web-search)
  - [Repository Search](#use-repo-search)
  - [Documentation Generation](#use-doc-generation)
  - [GitHub Integration](#use-github-integration)
  - [Browser Automation](#use-browser-automation)
  - [Direct Model Queries](#use-direct-model-queries)
- [Authentication and API Keys](#authentication-and-api-keys)
- [AI Team Features](#ai-team-features)
  - [Perplexity: Web Search & Research](#perplexity-web-search--research)
  - [Gemini 2.0: Repository Context & Planning](#gemini-20-repository-context--planning)
  - [Stagehand: Browser Automation](#stagehand-browser-automation)
    - [Browser Command Options](#browser-command-options)
    - [Video Recording](#video-recording)
    - [Console and Network Logging](#console-and-network-logging)
    - [Complex Actions](#complex-actions)
    - [Troubleshooting Browser Commands](#troubleshooting-browser-commands)
  - [YouTube Video Analysis](#youtube-video-analysis)
- [Skills](#skills)
  - [GitHub Integration](#github-integration)
  - [Xcode Tools](#xcode-tools)
  - [Documentation Generation](#documentation-generation-uses-gemini-20)
- [Configuration](#configuration)
  - [vibe-tools.config.json](#vibe-toolsconfigjson)
  - [GitHub Authentication](#github-authentication)
  - [Repomix Configuration](#repomix-configuration)
  - [Model Selection](#model-selection)
  - [Cursor Configuration](#cursor-configuration)
    - [Cursor Agent Configuration](#cursor-agent-configuration)
- [vibe-tools cli](#vibe-tools-cli)
  - [Command Options](#command-options)
  - [Execution Methods](#execution-methods)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)
  - [Web Search Examples](#web-search-examples)
  - [Repository Context Examples](#repository-context-examples)
  - [Documentation Examples](#documentation-examples)
  - [GitHub Integration Examples](#github-integration-examples)
  - [Xcode Command Examples](#xcode-command-examples)
  - [Browser Command Examples](#browser-command-examples)
    - [open subcommand examples](#open-subcommand-examples)
    - [act, extract, observe subcommands examples](#act-extract-observe-subcommands-examples)
  - [YouTube Command Examples](#youtube-command-examples)
- [Node Package Manager](#node-package-manager-npm)
- [Contributing](#contributing)
- [Sponsors](#sponsors)
- [License](#license)

### The AI Team

- Perplexity to search the web and perform deep research
- Gemini 2.0 for huge whole-codebase context window, search grounding and reasoning
- Stagehand for browser operation to test and debug web apps (uses Anthropic or OpenAI models)
- OpenRouter for access to a variety of models through a unified API (for MCP commands)

### New Skills for your existing Agent

- Work with GitHub Issues and Pull Requests
- Generate local agent-accessible documentation for external dependencies
- Analyze YouTube videos to extract insights, summaries, and implementation plans

`vibe-tools` is optimized for Cursor Composer Agent but it can be used by any coding agent that can execute commands

### How do I use it?

After installation, to see AI teamwork in action just ask Cursor Composer to use Perplexity or Gemini.
Here are two examples:

<div align="center">
  <div>
    <h3>Asking Perplexity to carry out web research</h3>
  </div>
  <div style="display: flex;">
    <img width="350" alt="image" src="https://github.com/user-attachments/assets/d136c007-387b-449c-9737-553b34e71bbd" />
  </div>
  <details>
    <summary>see what happens next...</summary>
    <img width="350" alt="image" src="https://github.com/user-attachments/assets/06566162-fbaa-492a-8ce8-1a51e0713ee8" />
    <details>
      <summary>see what happens next...</summary>
      <img width="350" alt="image" src="https://github.com/user-attachments/assets/fbca8d46-0e0e-4752-922e-62cceec6c12b" />
      <details>
        <summary>see what happens next...</summary>
        <img width="1172" alt="image" src="https://github.com/user-attachments/assets/4bdae605-6f6c-43c3-b10c-c0263060033c" />
      </details>
    </details>
  </details>
    see the spec composer and perplexity produced together:
    <a href="https://github.com/eastlondoner/pac-man/blob/main/specs/pac-man-spec.md">pac-man-spec.md</a> (link out to the example repo)
  <br/>
  <br/>
  </div>
</div>

<div align="center">
  <div>
    <h3>Asking Gemini for a plan</h3>
  </div>
  <div style="display: flex;">
    <img width="350" src="https://github.com/user-attachments/assets/816daee4-0a31-4a6b-8aac-39796cb03b51" />
  </div>
  <details>
    <summary>see what happens next...</summary>
    <img width="350" alt="image" src="https://github.com/user-attachments/assets/b44c4cc2-6498-42e8-bda6-227fbfed0a7c" />
    <details>
      <summary>see what happens next...</summary>
      <img width="350" alt="image" src="https://github.com/user-attachments/assets/dcfcac67-ce79-4cd1-a66e-697c654ee986" />
      <details>
        <summary>see what happens next...</summary>
        <img width="350" alt="image" src="https://github.com/user-attachments/assets/8df7d591-f48b-463d-8d9b-f7e9c1c9c95b" />
      </details>
    </details>
  </details>
    see the spec composer and perplexity produced together:
    <a href="https://github.com/eastlondoner/pac-man/blob/main/specs/pac-man-plan.md">pac-man-plan.md</a> (link out to the example repo)
  <br/>
  <br/>
  </div>
</div>

## What is vibe-tools

`vibe-tools` provides a CLI that your **AI agent can use** to expand its capabilities. `vibe-tools` is designed to be installed globally, providing system-wide access to its powerful features. When you run `vibe-tools install`, it configures instruction files tailored to your chosen development environment:

- **Supported IDEs/Environments**: Cursor, Claude Code, Codex, Windsurf, Cline, Roo.
- **Instruction File Setup**: The installer automatically creates or updates relevant configuration files:
  - For **Cursor**: `.cursorrules` or `.cursor/rules/vibe-tools.mdc`.
  - For **Claude Code**: `CLAUDE.md` (local or global `~/.claude/CLAUDE.md`).
  - For **Codex**: `codex.md` (local or global `~/.codex/instructions.md`).
  - For **Windsurf**: `.windsurfrules`.
  - For **Cline/Roo**: `.clinerules` directory (with `vibe-tools.md`) or legacy file.

`vibe-tools` supports multiple AI instruction sources including Claude code, Codex, and IDE-specific rules, ensuring compatibility across various AI-powered development setups.

`vibe-tools` integrates with multiple AI providers including OpenAI, Anthropic, Gemini, Perplexity, OpenRouter, ModelBox, and xAI (Grok).

`vibe-tools` requires a Perplexity API key and a Google AI API key.

`vibe-tools` is a node package that should be installed globally.

## Installation

Install vibe-tools globally:

```bash
npm install -g vibe-tools
```

Then run the interactive setup:

```bash
vibe-tools install .
```

This command will:

1.  Guide you through API key configuration for the AI providers you choose.
2.  Create or update AI instruction files based on your selected IDE (e.g., setting up `.cursorrules` for Cursor, `CLAUDE.md` for Claude Code, `.windsurfrules` for Windsurf, etc.).

## Requirements

- Node.js 18 or later
- Perplexity API key
- Google Gemini API key
- For browser commands:
  - Playwright (`npm install --global playwright`)
  - OpenAI API key or Anthropic API key (for `act`, `extract`, and `observe` commands)

`vibe-tools` uses Gemini-2.0 because it is the only good LLM with a context window that goes up to 2 million tokens - enough to handle and entire codebase in one shot. Gemini 2.0 experimental models that we use by default are currently free to use on Google and you need a Google Cloud project to create an API key.

`vibe-tools` uses Perplexity because Perplexity has the best web search api and indexes and it does not hallucinate. Perplexity Pro users can get an API key with their pro account and recieve $5/month of free credits (at time of writing). Support for Google search grounding is coming soon but so far testing has shown it still frequently hallucinates things like APIs and libraries that don't exist.

## Tips:

- Ask Cursor Agent to have Gemini review its work
- Ask Cursor Agent to generate documentation for external dependencies and write it to a local-docs/ folder

If you do something cool with `vibe-tools` please let me know on twitter or make a PR to add to this section!

## Additional Examples

### GitHub Skills

To see vibe-tools GitHub and Perplexity skills: Check out [this example issue that was solved using Cursor agent and vibe-tools](https://github.com/eastlondoner/cursor-tools/issues/1)

### Gemini code review

See cursor get approximately 5x more work done per-prompt with Gemini code review:
<img width="1701" alt="long view export" src="https://github.com/user-attachments/assets/a8a63f4a-1818-4e84-bb1f-0f60d82c1c42" />

## Detailed Cursor Usage

Use Cursor Composer in agent mode with command execution (not sure what this means, see section below on Cursor Agent configuration). If you have installed the vibe-tools prompt to your .cursorrules (or equivalent) just ask your AI coding agent/assistant to use "vibe-tools" to do things.

### Tool Recommendations

- `vibe-tools ask` allows direct querying of any model from any provider. It's best for simple questions where you want to use a specific model or compare responses from different models.
- `vibe-tools web` uses an AI teammate with web search capability to answer questions. `web` is best for finding up-to-date information from the web that is not specific to the repository such as how to use a library to search for known issues and error messages or to get suggestions on how to do something. Web is a teammate who knows tons of stuff and is always up to date.
- `vibe-tools repo` uses an AI teammate with large context window capability to answer questions. `repo` sends the entire repo as context so it is ideal for questions about how things work or where to find something, it is also great for code review, debugging and planning. is a teammate who knows the entire codebase inside out and understands how everything works together.
- `vibe-tools plan` uses an AI teammate with reasoning capability to plan complex tasks. Plan uses a two step process. First it does a whole repo search with a large context window model to find relevant files. Then it sends only those files as context to a thinking model to generate a plan it is great for planning complex tasks and for debugging and refactoring. Plan is a teammate who is really smart on a well defined problem, although doesn't consider the bigger picture.
- `vibe-tools doc` uses an AI teammate with large context window capability to generate documentation for local or github hosted repositories by sending the entire repo as context. `doc` can be given precise documentation tasks or can be asked to generate complete docs from scratch it is great for generating docs updates or for generating local documentation for a libary or API that you use! Doc is a teammate who is great at summarising and explaining code, in this repo or in any other repo!
- `vibe-tools browser` uses an AI teammate with browser control (aka operator) capability to operate web browsers. `browser` can operate in a hidden (headless) mode to invisibly test and debug web apps or it can be used to connect to an existing browser session to interactively share your browser with Cursor agent it is great for testing and debugging web apps and for carrying out any task that can be done in a browser such as reading information from a bug ticket or even filling out a form. Browser is a teammate who can help you test and debug web apps, and can share control of your browser to perform small browser-based tasks.
- `vibe-tools youtube` uses an AI teammate with video analysis capability to understand YouTube content. `youtube` can generate summaries, extract transcripts, create implementation plans from tutorials, and answer specific questions about video content. It's great for extracting value from technical talks, tutorials, and presentations without spending time watching the entire video. YouTube is a teammate who can watch and analyze videos for you, distilling the key information.

Note: For repo, doc and plan commands the repository content that is sent as context can be reduced by filtering out files in a .repomixignore file.

### Command Nicknames

When using vibe-tools with Cursor Composer, you can use these nicknames:

- "Gemini" is a nickname for `vibe-tools repo`
- "Perplexity" is a nickname for `vibe-tools web`
- "Stagehand" is a nickname for `vibe-tools browser`

### Use web search

"Please implement country specific stripe payment pages for the USA, UK, France and Germany. Use vibe-tools web to check the available stripe payment methods in each country."

Note: in most cases you can say "ask Perplexity" instead of "use vibe-tools web" and it will work the same.

### Use repo search

"Let's refactor our User class to allow multiple email aliases per user. Use vibe-tools repo to ask for a plan including a list of all files that need to be changed."

"Use vibe-tools repo to analyze how authentication is implemented in the Next.js repository. Use --from-github=vercel/next.js."

"Use vibe-tools repo to explain this React component with documentation from the official React docs. Use --with-doc=https://react.dev/reference/react/useState"

Note: in most cases you can say "ask Gemini" instead of "use vibe-tools repo" and it will work the same.

### Use doc generation

"Use vibe-tools to generate documentation for the Github repo https://github.com/kait-http/kaito" and write it to docs/kaito.md"

Note: in most cases you can say "generate documentation" instead of "use vibe-tools doc" and it will work the same.

### Use github integration

"Use vibe-tools github to fetch issue 123 and suggest a solution to the user's problem"

"Use vibe-tools github to fetch PR 321 and see if you can fix Andy's latest comment"

Note: in most cases you can say "fetch issue 123" or "fetch PR 321" instead of "use vibe-tools github" and it will work the same.

### Use browser automation

"Use vibe-tools to open the users page and check the error in the console logs, fix it"

"Use vibe-tools to test the form field validation logic. Take screenshots of each state"

"Use vibe-tools to open https://example.com/foo the and check the error in the network logs, what could be causing it?"

Note: in most cases you can say "Use Stagehand" instead of "use vibe-tools" and it will work the same.

### Use direct model queries

"Use vibe-tools ask to compare how different models answer this question: 'What are the key differences between REST and GraphQL?'"

"Ask OpenAI's o3-mini model to explain the concept of dependency injection."

"Use vibe-tools ask to analyze this complex algorithm with high reasoning effort: 'Explain the time and space complexity of the Boyer-Moore string search algorithm' --provider openai --model o3-mini --reasoning-effort high"

Note: The ask command requires both --provider and --model parameters to be specified. This command is generally less useful than other commands like `repo` or `plan` because it does not include any context from your codebase or repository.

**Ask Command Options:**

- `--provider=<provider>`: AI provider to use (required)
- `--model=<model>`: Model to use (required)
- `--max-tokens=<number>`: Maximum tokens for response
- `--reasoning-effort=<low|medium|high>`: Control the depth of reasoning for supported models (OpenAI o1/o3-mini models and Claude 3.7 Sonnet). Higher values produce more thorough responses for complex questions.
- `--with-doc=<doc_url>`: Fetch content from a document URL and include it as context for the question

## Authentication and API Keys

`vibe-tools` requires API keys for Perplexity AI, Google Gemini, and optionally for OpenAI, Anthropic, OpenRouter, and xAI. These can be configured in two ways:

1. **Interactive Setup**: Run `vibe-tools install` and follow the prompts
2. **Manual Setup**: Create `~/.vibe-tools/.env` in your home directory or `.vibe-tools.env` in your project root:
   ```env
   PERPLEXITY_API_KEY="your-perplexity-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   OPENAI_API_KEY="your-openai-api-key"  # Optional, for Stagehand
   ANTHROPIC_API_KEY="your-anthropic-api-key" # Optional, for Stagehand and MCP
   OPENROUTER_API_KEY="your-openrouter-api-key" # Optional, for MCP
   XAI_API_KEY="your-xai-api-key" # Optional, for xAI Grok models
   GITHUB_TOKEN="your-github-token"  # Optional, for enhanced GitHub access
   ```
   - At least one of `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` must be provided to use the `mcp` commands.

### Google Gemini API Authentication

`vibe-tools` supports multiple authentication methods for accessing the Google Gemini API, providing flexibility for different environments and security requirements. You can choose from the following methods:

1. **API Key (Default)**

   - This is the simplest method and continues to be supported for backward compatibility.
   - Set the `GEMINI_API_KEY` environment variable to your API key string obtained from Google AI Studio.
   - **Example:**
     ```env
     GEMINI_API_KEY="your-api-key-here"
     ```

2. **Service Account JSON Key File**

   - For enhanced security, especially in production environments, use a service account JSON key file.
   - Set the `GEMINI_API_KEY` environment variable to the **path** of your downloaded service account JSON key file.
   - **Example:**
     ```env
     GEMINI_API_KEY="./path/to/service-account.json"
     ```
   - This method enables access to the latest Gemini models available through Vertex AI, such as `gemini-2.0-flash`.

3. **Application Default Credentials (ADC) (Recommended for Google Cloud Environments)**
   - ADC is ideal when running `vibe-tools` within Google Cloud environments (e.g., Compute Engine, Kubernetes Engine) or for local development using `gcloud`.
   - Set the `GEMINI_API_KEY` environment variable to `adc`.
   - **Example:**
     ```env
     GEMINI_API_KEY="adc"
     ```
   - **Setup Instructions:** First, authenticate locally using gcloud:
     ```bash
     gcloud auth application-default login
     ```

## AI Team Features

### Perplexity: Web Search & Research

Use Perplexity AI to get up-to-date information directly within Cursor:

```bash
vibe-tools web "What's new in TypeScript 5.7?"
```

### Gemini 2.0: Repository Context & Planning

Leverage Google Gemini 2.0 models with 1M+ token context windows for codebase-aware assistance and implementation planning:

```bash
# Get context-aware assistance
vibe-tools repo "Explain the authentication flow in this project, which files are involved?"

# Generate implementation plans
vibe-tools plan "Add user authentication to the login page"
```

The plan command uses multiple AI models to:

1. Identify relevant files in your codebase (using Gemini by default)
2. Extract content from those files
3. Generate a detailed implementation plan (using o3-mini by default)

**Plan Command Options:**

- `--fileProvider=<provider>`: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--thinkingProvider=<provider>`: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--fileModel=<model>`: Model to use for file identification
- `--thinkingModel=<model>`: Model to use for plan generation
- `--fileMaxTokens=<number>`: Maximum tokens for file identification
- `--thinkingMaxTokens=<number>`: Maximum tokens for plan generation
- `--debug`: Show detailed error information
- `--with-doc=<doc_url>`: Fetch content from a web URL and include it as context during plan generation

Repository context is created using Repomix. See repomix configuration section below for details on how to change repomix behaviour.

Above 1M tokens vibe-tools will always send requests to Gemini 2.0 Pro as it is the only model that supports 1M+ tokens.

The Gemini 2.0 Pro context limit is 2M tokens, you can add filters to .repomixignore if your repomix context is above this limit.

### Stagehand: Browser Automation

Automate browser interactions for web scraping, testing, and debugging:

**Important:** The `browser` command requires the Playwright package to be installed separately in your project:

```bash
npm install playwright
# or
yarn add playwright
# or
pnpm add playwright
```

1. `open` - Open a URL and capture page content:

```bash
# Open and capture HTML content, console logs and network activity (enabled by default)
vibe-tools browser open "https://example.com" --html

# Take a screenshot
vibe-tools browser open "https://example.com" --screenshot=page.png

# Debug in an interactive browser session
vibe-tools browser open "https://example.com" --connect-to=9222
```

2. `act` - Execute actions using natural language - Agent tells the browser-use agent what to do:

```bash
# Single action
vibe-tools browser act "Login as 'user@example.com'" --url "https://example.com/login"

# Multi-step workflow using pipe separator
vibe-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "https://example.com"

# Record interaction video
vibe-tools browser act "Fill out registration form" --url "https://example.com/signup" --video="./recordings"
```

3. `observe` - Analyze interactive elements:

```bash
# Get overview of interactive elements
vibe-tools browser observe "What can I interact with?" --url "https://example.com"

# Find specific elements
vibe-tools browser observe "Find the login form" --url "https://example.com"
```

4. `extract` - Extract data using natural language:

```bash
# Extract specific content
vibe-tools browser extract "Get all product prices" --url "https://example.com/products"

# Save extracted content
vibe-tools browser extract "Get article text" --url "https://example.com/blog" --html > article.html

# Extract with network monitoring
vibe-tools browser extract "Get API responses" --url "https://example.com/api-test" --network
```

#### Browser Command Options

All browser commands (`open`, `act`, `observe`, `extract`) support these options:

- `--console`: Capture browser console logs (enabled by default, use `--no-console` to disable)
- `--html`: Capture page HTML content (disabled by default)
- `--network`: Capture network activity (enabled by default, use `--no-network` to disable)
- `--screenshot=<file path>`: Save a screenshot of the page
- `--timeout=<milliseconds>`: Set navigation timeout (default: 120000ms for Stagehand operations, 30000ms for navigation)
- `--viewport=<width>x<height>`: Set viewport size (e.g., 1280x720)
- `--headless`: Run browser in headless mode (default: true)
- `--no-headless`: Show browser UI (non-headless mode) for debugging
- `--connect-to=<port>`: Connect to existing Chrome instance. Special values: 'current' (use existing page), 'reload-current' (refresh existing page)
- `--wait=<time:duration or selector:css-selector>`: Wait after page load (e.g., 'time:5s', 'selector:#element-id')
- `--video=<directory>`: Save a video recording (1280x720 resolution, timestamped subdirectory). Not available when using --connect-to
- `--url=<url>`: Required for `act`, `observe`, and `extract` commands
- `--evaluate=<string>`: JavaScript code to execute in the browser before the main command

**Notes on Connecting to an existing browser session with --connect-to**

- DO NOT ask browser act to "wait" for anything, the wait command is currently disabled in Stagehand.
- When using `--connect-to`, viewport is only changed if `--viewport` is explicitly provided
- Video recording is not available when using `--connect-to`
- Special `--connect-to` values:
  - `current`: Use the existing page without reloading
  - `reload-current`: Use the existing page and refresh it (useful in development)

#### Video Recording

All browser commands support video recording of the browser interaction in headless mode (not supported with --connect-to):

- Use `--video=<directory>` to enable recording
- Videos are saved at 1280x720 resolution in timestamped subdirectories
- Recording starts when the browser opens and ends when it closes
- Videos are saved as .webm files

Example:

```bash
# Record a video of filling out a form
vibe-tools browser act "Fill out registration form with name John Doe" --url "http://localhost:3000/signup" --video="./recordings"
```

#### Console and Network Logging

Console logs and network activity are captured by default:

- Use `--no-console` to disable console logging
- Use `--no-network` to disable network logging
- Logs are displayed in the command output

#### Complex Actions

The `act` command supports chaining multiple actions using the pipe (|) separator:

```bash
# Login sequence with console/network logging (enabled by default)
vibe-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "http://localhost:3000/login"

# Form filling with multiple fields
vibe-tools browser act "Select 'Mr' from title | Type 'John' into first name | Type 'Doe' into last name | Click Next" --url "http://localhost:3000/register"

# Record complex interaction
vibe-tools browser act "Fill form | Submit | Verify success" --url "http://localhost:3000/signup" --video="./recordings"
```

#### Troubleshooting Browser Commands

Common issues and solutions:

1. **Element Not Found Errors**

   - Use `--no-headless` to visually debug the page
   - Use `browser observe` to see what elements Stagehand can identify
   - Check if the element is in an iframe or shadow DOM
   - Ensure the page has fully loaded (try increasing `--timeout`)

2. **Stagehand API Errors**

   - Verify your OpenAI or Anthropic API key is set correctly
   - Check if you have sufficient API credits
   - Try switching models using `--model`

3. **Network Errors**

   - Check your internet connection
   - Verify the target website is accessible
   - Try increasing the timeout with `--timeout`
   - Check if the site blocks automated access

4. **Video Recording Issues**

   - Ensure the target directory exists and is writable
   - Check disk space
   - Video recording is not available with `--connect-to`

5. **Performance Issues**
   - Use `--headless` mode for better performance (default)
   - Reduce the viewport size with `--viewport`
   - Consider using `--connect-to` for development

### YouTube Video Analysis

Use Gemini-powered YouTube video analysis to extract insights, summaries, and implementation plans:

```bash
# Generate a video summary
vibe-tools youtube "https://www.youtube.com/watch?v=VIDEO_ID" --type=summary

# Get a detailed transcript
vibe-tools youtube "https://www.youtube.com/watch?v=VIDEO_ID" --type=transcript

# Create an implementation plan based on tutorial content
vibe-tools youtube "https://www.youtube.com/watch?v=VIDEO_ID" --type=plan

# Ask specific questions about the video
vibe-tools youtube "https://www.youtube.com/watch?v=VIDEO_ID" "How does the authentication flow work?"

# Save summary to a file
vibe-tools youtube "https://www.youtube.com/watch?v=VIDEO_ID" --type=summary --save-to=video-summary.md
```

The YouTube command leverages Gemini models' native ability to understand video content, enabling you to:

- Extract key insights and summaries from technical talks, tutorials, and presentations
- Generate complete transcripts of video content
- Create implementation plans based on tutorial videos
- Perform quality reviews of educational content
- Get answers to specific questions about the video content

**YouTube Command Options:**

- `--type=<summary|transcript|plan|custom>`: Type of analysis to perform (default: summary)

**Note:** The YouTube command requires a `GEMINI_API_KEY` to be set in your environment or .vibe-tools.env file as the Gemini API is currently the only interface that reliably supports YouTube video analysis.

## Skills

### GitHub Integration

Access GitHub issues and pull requests directly from the command line with rich formatting and full context:

```bash
# List recent PRs or issues
vibe-tools github pr
vibe-tools github issue

# View specific PR or issue with full discussion
vibe-tools github pr 123
vibe-tools github issue 456
```

The GitHub commands provide:

- View of 10 most recent open PRs or issues when no number specified
- Detailed view of specific PR/issue including:
  - PR/Issue description and metadata
  - Code review comments grouped by file (PRs only)
  - Full discussion thread
  - Labels, assignees, milestones and reviewers
- Support for both local repositories and remote GitHub repositories
- Markdown-formatted output for readability

**Authentication Methods:**
The commands support multiple authentication methods:

1. GitHub token via environment variable: `GITHUB_TOKEN=your_token_here`
2. GitHub CLI integration (if `gh` is installed and logged in)
3. Git credentials (stored tokens or Basic Auth)

Without authentication:

- Public repositories: Limited to 60 requests per hour
- Private repositories: Not accessible

With authentication:

- Public repositories: 5,000 requests per hour
- Private repositories: Full access (with appropriate token scopes)

### Xcode Tools

Automate iOS app building, testing, and running in the simulator:

```bash
# Available subcommands
vibe-tools xcode build  # Build Xcode project and report errors
vibe-tools xcode run    # Build and run app in simulator
vibe-tools xcode lint   # Analyze code and offer to fix warnings
```

**Build Command Options:**

```bash
# Specify custom build path (derived data)
vibe-tools xcode build buildPath=/custom/build/path

# Specify target device
vibe-tools xcode build destination="platform=iOS Simulator,name=iPhone 15"
```

**Run Command Options:**

```bash
# Run on iPhone simulator (default)
vibe-tools xcode run iphone

# Run on iPad simulator
vibe-tools xcode run ipad

# Run on specific device with custom build path
vibe-tools xcode run device="iPhone 16 Pro" buildPath=/custom/build/path
```

The Xcode commands provide:

- Automatic project/workspace detection
- Dynamic app bundle identification
- Build output streaming with error parsing
- Simulator device management
- Support for both iPhone and iPad simulators
- Custom build path specification to control derived data location

### Documentation Generation (uses Gemini 2.0)

Generate comprehensive documentation for your repository or any GitHub repository:

```bash
# Document local repository and save to file
vibe-tools doc --save-to=docs.md

# Document remote GitHub repository (both formats supported)
vibe-tools doc --from-github=username/repo-name@branch
vibe-tools doc --from-github=https://github.com/username/repo-name@branch

# Save documentation to file (with and without a hint)
# This is really useful to generate local documentation for libraries and dependencies
vibe-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/MY_DOCS.md
vibe-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/MY_DOCS.md --hint="only information about the doc command"

# Document dependencies
vibe-tools doc --from-github=expressjs/express --save-to=docs/EXPRESS.md --quiet

# Document with additional web documentation as context
vibe-tools doc --from-github=reactjs/react-redux --with-doc=https://redux.js.org/tutorials/fundamentals/part-5-ui-and-react --save-to=docs/REACT_REDUX.md
```

## Configuration

### vibe-tools.config.json

Customize `vibe-tools` behavior by creating a `vibe-tools.config.json` file. This file can be created either globally in `~/.vibe-tools/vibe-tools.config.json` or locally in your project root.

The vibe-tools.config file configures the local default behaviour for each command and provider.

Here is an example of a typical vibe-tools.config.json file, showing some of the most common configuration options:

```json
{
  // Commands
  "repo": {
    "provider": "openrouter",
    "model": "google/gemini-2.5-pro-exp-03-25:free"
  },
  "doc": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.7-sonnet",
    "maxTokens": 4096
  },
  "web": {
    "provider": "gemini",
    "model": "gemini-2.5-pro-exp"
  },
  "plan": {
    "fileProvider": "gemini",
    "thinkingProvider": "perplexity",
    "thinkingModel": "r1-1776"
  },
  "browser": {
    "headless": false
  },
  //...

  // Providers
  "stagehand": {
    "model": "claude-3-7-sonnet-latest", // For Anthropic provider
    "provider": "anthropic", // or "openai"
    "timeout": 90000
  },
  "openai": {
    "model": "gpt-4o"
  }
  //...
}
```

For details of all configuration options, see [CONFIGURATION.md](CONFIGURATION.md). This includes details of all the configuration options and how to use them.

### GitHub Authentication

The GitHub commands support several authentication methods:

1. **Environment Variable**: Set `GITHUB_TOKEN` in your environment:

   ```env
   GITHUB_TOKEN=your_token_here
   ```

2. **GitHub CLI**: If you have the GitHub CLI (`gh`) installed and are logged in, vibe-tools will automatically use it to generate tokens with the necessary scopes.

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

### Repomix Configuration

When generating documentation, vibe-tools uses Repomix to analyze your repository. By default, it excludes certain files and directories that are typically not relevant for documentation:

- Node modules and package directories (`node_modules/`, `packages/`, etc.)
- Build output directories (`dist/`, `build/`, etc.)
- Version control directories (`.git/`)
- Test files and directories (`test/`, `tests/`, `__tests__/`, etc.)
- Configuration files (`.env`, `.config`, etc.)
- Log files and temporary files
- Binary files and media files

You can customize the files and folders to exclude using two methods, both can be combined together:

1. **Create a `.repomixignore` file** in your project root to specify files to exclude.

Example `.repomixignore` file for a Laravel project:

```
vendor/
public/
database/
storage/
.idea
.env
```

2. **Create a `repomix.config.json` file** in your project root for more advanced configuration options:

Example `repomix.config.json` to enable compression and specify what to include:

```json
{
  "include": ["src/**/*", "README.md", "package.json"],
  "output": {
    "compress": true
  }
}
```

This configuration will be detected and used automatically by the `repo`, `plan`, and `doc` commands, allowing for precise control over which files are included in the repository analysis.

If both a .repomixignore and an ignore section in `repomix.config.json` are present then the ignore patterns from both are combined.

#### Model Selection

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
    "model": "claude-3-7-sonnet-latest", // For Anthropic provider
    "provider": "anthropic", // or "openai"
    "timeout": 90000
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

### Cursor Configuration

`vibe-tools` automatically configures Cursor by updating your project rules during installation. This provides:

- Command suggestions
- Usage examples
- Context-aware assistance

For new installations, we use the recommended `.cursor/rules/vibe-tools.mdc` path. For existing installations, we maintain compatibility with the legacy `.cursorrules` file. If both files exist, we prefer the new path and show a warning.

#### Cursor Agent Configuration:

To get the benefits of vibe-tools you should use Cursor agent in "yolo mode". Ideal settings:

![image](https://github.com/user-attachments/assets/783e26cf-c339-4cae-9629-857da0359cef)

## vibe-tools cli

In general you do not need to use the cli directly, your AI coding agent will call the CLI but it is useful to know it exists and this is how it works.

### Command Options

All commands support these general options:

- `--model`: Specify an alternative model
- `--max-tokens`: Control response length
- `--reasoning-effort=<low|medium|high>`: Control the depth of reasoning for supported models (OpenAI o1/o3-mini and Claude 3.7 Sonnet). Higher values produce more thorough responses at the cost of increased token usage.
- `--save-to`: Save command output to a file (in addition to displaying it, like tee)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--provider`: AI provider to use. Valid values: openai, anthropic, perplexity, gemini, openrouter

Documentation command specific options:

- `--from-github`: Generate documentation for a remote GitHub repository (supports @branch syntax)
- `--hint`: Provide additional context or focus for documentation generation
- `--with-doc=<doc_url>`: Fetch content from a web URL and include it as additional context for documentation generation

Repository command specific options:

- `--from-github=<GitHub username>/<repository name>[@<branch>]`: Analyze a remote GitHub repository without cloning it locally
- `--subdir=<path>`: Analyze a specific subdirectory instead of the entire repository
- `--with-doc=<doc_url>`: Fetch content from a web URL and include it as context with your query

Plan command specific options:

- `--fileProvider`: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--thinkingProvider`: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--fileModel`: Model to use for file identification
- `--thinkingModel`: Model to use for plan generation
- `--fileMaxTokens`: Maximum tokens for file identification
- `--thinkingMaxTokens`: Maximum tokens for plan generation
- `--debug`: Show detailed error information
- `--with-doc=<doc_url>`: Fetch content from a web URL and include it as context during plan generation

GitHub command specific options:

- `--from-github=<GitHub username>/<repository name>[@<branch>]`: Access PRs/issues from a specific GitHub repository. `--repo` is an older, still supported synonym for this option.

Xcode command specific options:

- For the build subcommand:
  - `buildPath=<path>`: Set a custom derived data path
  - `destination=<destination string>`: Set a custom simulator destination
- For the run subcommand:
  - `iphone` or `ipad`: Select device type
  - `device=<device name>`: Specify a custom device
  - `buildPath=<path>`: Set a custom derived data path

Browser command specific options:

- `--console`: Capture browser console logs (enabled by default, use `--no-console` to disable)
- `--html`: Capture page HTML content (disabled by default)
- `--network`: Capture network activity (enabled by default, use `--no-network` to disable)
- `--screenshot`: Save a screenshot of the page
- `--timeout`: Set navigation timeout (default: 120000ms for Stagehand operations, 30000ms for navigation)
- `--viewport`: Set viewport size (e.g., 1280x720)
- `--headless`: Run browser in headless mode (default: true)
- `--no-headless`: Show browser UI (non-headless mode) for debugging
- `--connect-to`: Connect to existing Chrome instance
- `--wait`: Wait after page load (e.g., 'time:5s', 'selector:#element-id')
- `--video`: Save a video recording (1280x720 resolution, timestamped subdirectory)
- `--url`: Required for `act`, `observe`, and `extract` commands. Url to navigate to on connection or one of the special values: 'current' (use existing page), 'reload-current' (refresh existing page).
- `--evaluate`: JavaScript code to execute in the browser before the main command

### Execution Methods

Execute commands using:

```bash
vibe-tools <command> [options]
```

For example:

```bash
vibe-tools web "What's new in TypeScript 5.7?"
```

## Troubleshooting

1. **Command Not Found**

   - Ensure `vibe-tools` is installed globally using `npm install -g vibe-tools`
   - Check your system's PATH environment variable to ensure it includes npm's global bin directory
   - On Unix-like systems, the global bin directory is typically `/usr/local/bin` or `~/.npm-global/bin`
   - On Windows, it's typically `%AppData%\npm`

2. **API Key Errors**

   - Verify `.vibe-tools.env` exists and contains valid API keys
   - Run `vibe-tools install` to reconfigure API keys
   - Check that your API keys have the necessary permissions
   - For GitHub operations, ensure your token has the required scopes (repo, read:user)
   - For Google Vertex AI authentication:
     - If using a JSON key file, verify the file path is correct and the file is readable
     - If using ADC, ensure you've run `gcloud auth application-default login` and the account has appropriate permissions
     - Verify your service account has the necessary roles in Google Cloud Console (typically "Vertex AI User")
     - For troubleshooting ADC: Run `gcloud auth application-default print-access-token` to check if ADC is working
   - For MCP commands ensure that _either_ the `ANTHROPIC_API_KEY` _or_ the `OPENROUTER_API_KEY` are set.
   - If using OpenRouter for MCP, ensure `OPENROUTER_API_KEY` is set.
   - If a provider is not specified for an MCP command, Anthropic will be used by default.

3. **Model Errors**

   - Check your internet connection
   - Verify API key permissions
   - Ensure the specified model is available for your API tier

4. **GitHub API Rate Limits**

   - GitHub API has rate limits for unauthenticated requests. For higher limits you must be authenticated.
   - If you have the gh cli installed and logged in vibe-tools will use that to obtain a short lived auth token. Otherwise you can add a GitHub token to your environment:
     ```env
     GITHUB_TOKEN=your_token_here
     ```
   - Private repositories always require authentication

5. **Documentation Generation Issues**

   - Repository too large: Try using `--hint` to focus on specific parts
   - Token limit exceeded: The tool will automatically switch to a larger model
   - Network timeouts: The tool includes automatic retries
   - For very large repositories, consider documenting specific directories or files

6. **Cursor Integration**
   - If .cursorrules is outdated, run `vibe-tools install .` to update
   - Ensure Cursor is configured to allow command execution
   - Check that your Cursor version supports AI commands

### Examples

#### Web Search Examples

```bash
# Get information about new technologies
vibe-tools web "What are the key features of Bun.js?"

# Check API documentation
vibe-tools web "How to implement OAuth2 in Express.js?"

# Compare technologies
vibe-tools web "Compare Vite vs Webpack for modern web development"
```

#### Repository Context Examples

```bash
# Architecture understanding
vibe-tools repo "Explain the overall architecture of this project"

# Find usage examples
vibe-tools repo "Show me examples of error handling in this codebase"

# Debugging help
vibe-tools repo "Why might the authentication be failing in the login flow?"

# Analyze specific subdirectory
vibe-tools repo "Explain the code structure" --subdir=src/components

# Analyze remote GitHub repository
vibe-tools repo "Explain the architecture" --from-github=username/repo-name

# Deep analysis with enhanced reasoning
vibe-tools repo "Analyze the security implications of our authentication implementation" --reasoning-effort high

# Include web documentation as context
vibe-tools repo "Help me implement useState in my component" --with-doc=https://react.dev/reference/react/useState
```

#### Direct Model Query Examples

```bash
# Basic question
vibe-tools ask "What is the capital of France?" --provider openai --model o3-mini

# Complex algorithm explanation with high reasoning effort
vibe-tools ask "Explain the quicksort algorithm and analyze its time complexity in different scenarios" --provider openai --model o3-mini --reasoning-effort high

# Comparative analysis with Claude model and enhanced reasoning
vibe-tools ask "Compare and contrast microservices vs monolithic architecture" --provider anthropic --model claude-3-7-sonnet --reasoning-effort medium
```

#### Documentation Examples

```bash
# Document specific aspects and save to file without stdout output
vibe-tools doc --save-to=docs/api.md --quiet --hint="Focus on the API endpoints and their usage"

# Document with hint to customize the docs output
vibe-tools doc --save-to=docs/architecture.md --quiet --hint="Focus on system architecture"

# Document dependencies
vibe-tools doc --from-github=expressjs/express --save-to=docs/EXPRESS.md --quiet

# Document with additional web documentation as context
vibe-tools doc --from-github=reactjs/react-redux --with-doc=https://redux.js.org/tutorials/fundamentals/part-5-ui-and-react --save-to=docs/REACT_REDUX.md
```

#### GitHub Integration Examples

```bash
# List PRs with specific labels
vibe-tools github pr --from-github facebook/react

# Check recent issues in a specific repository
vibe-tools github issue --from-github vercel/next.js

# View PR with code review comments
vibe-tools github pr 123 --from-github microsoft/typescript

# Track issue discussions
vibe-tools github issue 456 --from-github golang/go
```

#### Xcode Command Examples

```bash
# Build an iOS app with default settings
vibe-tools xcode build

# Build with custom derived data path
vibe-tools xcode build buildPath=~/custom/derived/data

# Run in iPhone simulator
vibe-tools xcode run iphone

# Run on specific iPad model
vibe-tools xcode run device="iPad Pro (12.9-inch) (6th generation)"

# Analyze code quality
vibe-tools xcode lint
```

#### Browser Command Examples

##### `open` subcommand examples:

```bash
# Open a URL and get HTML
vibe-tools browser open "https://example.com" --html

# Open and capture console logs and network activity
vibe-tools browser open "https://example.com" --console --network

# Take a screenshot
vibe-tools browser open "https://example.com" --screenshot=page.png

# Run in non-headless mode for debugging
vibe-tools browser open "https://example.com" --no-headless
```

##### `act`, `extract`, `observe` subcommands examples:

```bash
# AI-powered action
vibe-tools browser act "Click on 'Sign Up'" --url "https://example.com"

# AI-powered extraction
vibe-tools browser extract "Get the main content" --url "https://example.com/blog"

# AI-powered observation
vibe-tools browser observe "What can I do on this page?" --url "https://example.com"
```

#### YouTube Command Examples

```bash
# Generate a comprehensive summary of a technical talk
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --type=summary

# Get a complete transcript with speaker annotations
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --type=transcript --save-to=transcript.md

# Create an implementation plan from a coding tutorial
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --type=plan

# Generate a critical review of a tutorial's accuracy and quality
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --type=review

# Ask specific questions about video content
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" "What libraries does the tutorial use for authentication?"

# Use a specific model for analysis
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --model=gemini-2.5-pro-exp

# Use custom analysis type for specialized insights
vibe-tools youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --type=custom "Extract all code examples and explain them in detail"
```

## Node Package Manager (npm)

vibe-tools is available on npm [here](https://www.npmjs.com/package/vibe-tools)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. If you used vibe-tools to make your contribution please include screenshots or videos of vibe-tools in action.

## Sponsors

### [Vinta.app](https://vinta.app)

**Optimise your Vinted accounting** with real-time analytics, inventory management, and tax compliance tools.

:link: [Start scaling your Vinted business today](https://vinta.app)

---

### [Resoled.it](https://resoled.it)

**Automate your Vinted reselling business** with advanced tools like autobuy, custom snipers, and one-click relisting.

:link: [Take Vinted reselling to the next level](https://resoled.it)

---

### [iterate.com](https://iterate.com)

**Build self-driving startups** with autonomous AI agents that run your company.

:link: [AI Engineer in London? Join the startup revolution](https://iterate.com)

## License

MIT License - see [LICENSE](LICENSE) for details.
