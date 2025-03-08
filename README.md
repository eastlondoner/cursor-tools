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
- [What is cursor-tools](#what-is-cursor-tools)
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
- [Skills](#skills)
  - [GitHub Integration](#github-integration)
  - [Xcode Tools](#xcode-tools)
  - [Documentation Generation](#documentation-generation-uses-gemini-20)
- [Configuration](#configuration)
  - [cursor-tools.config.json](#cursor-toolsconfigjson)
  - [GitHub Authentication](#github-authentication)
  - [Repomix Configuration](#repomix-configuration)
  - [Model Selection](#model-selection)
  - [Cursor Configuration](#cursor-configuration)
    - [Cursor Agent Configuration](#cursor-agent-configuration)
- [cursor-tools cli](#cursor-tools-cli)
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
- [Node Package Manager](#node-package-manager-npm)
- [Contributing](#contributing)
- [Sponsors](#sponsors)
- [License](#license)

### The AI Team
- Perplexity to search the web and perform deep research
- Gemini 2.0 for huge whole-codebase context window, search grounding and reasoning
- Stagehand for browser operation to test and debug web apps (uses Anthropic or OpenAI models)


### New Skills for your existing Agent
- Work with GitHub Issues and Pull Requests
- Generate local agent-accessible documentation for external dependencies 

`cursor-tools` is optimized for Cursor Composer Agent but it can be used by any coding agent that can execute commands

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

## What is cursor-tools

`cursor-tools` provides a CLI that your **AI agent can use** to expand its capabilities. `cursor-tools` is designed to be installed globally, providing system-wide access to its powerful features. When you run `cursor-tools install` we automatically add a prompt section to your Cursor project rules. During installation, you can choose between:
- The new `.cursor/rules/cursor-tools.mdc` file (recommended)
- The legacy `.cursorrules` file (for backward compatibility)

You can also control this using the `USE_LEGACY_CURSORRULES` environment variable:
- `USE_LEGACY_CURSORRULES=true` - Use legacy `.cursorrules` file
- `USE_LEGACY_CURSORRULES=false` - Use new `.cursor/rules/cursor-tools.mdc` file
- If not set, defaults to legacy mode for backward compatibility

`cursor-tools` requires a Perplexity API key and a Google AI API key.

`cursor-tools` is a node package that should be installed globally.

## Installation

Install cursor-tools globally:
```bash
npm install -g cursor-tools
```

Then run the interactive setup:
```bash
cursor-tools install .
```

This command will:
1. Guide you through API key configuration
2. Update your Cursor project rules for Cursor integration (using `.cursor/rules/cursor-tools.mdc` or existing `.cursorrules`)

## Requirements

- Node.js 18 or later
- Perplexity API key
- Google Gemini API key
- For browser commands:
  - Playwright (`npm install --global playwright`)
  - OpenAI API key or Anthropic API key (for `act`, `extract`, and `observe` commands)

`cursor-tools` uses Gemini-2.0 because it is the only good LLM with a context window that goes up to 2 million tokens - enough to handle and entire codebase in one shot. Gemini 2.0 experimental models that we use by default are currently free to use on Google and you need a Google Cloud project to create an API key.

`cursor-tools` uses Perplexity because Perplexity has the best web search api and indexes and it does not hallucinate. Perplexity Pro users can get an API key with their pro account and recieve $5/month of free credits (at time of writing). Support for Google search grounding is coming soon but so far testing has shown it still frequently hallucinates things like APIs and libraries that don't exist.

## Tips:

- Ask Cursor Agent to have Gemini review its work
- Ask Cursor Agent to generate documentation for external dependencies and write it to a local-docs/ folder

If you do something cool with `cursor-tools` please let me know on twitter or make a PR to add to this section!

## Additional Examples

### GitHub Skills
To see cursor-tools GitHub and Perplexity skills: Check out [this example issue that was solved using Cursor agent and cursor-tools](https://github.com/eastlondoner/cursor-tools/issues/1)

### Gemini code review
See cursor get approximately 5x more work done per-prompt with Gemini code review:
<img width="1701" alt="long view export" src="https://github.com/user-attachments/assets/a8a63f4a-1818-4e84-bb1f-0f60d82c1c42" />

## Detailed Cursor Usage

Use Cursor Composer in agent mode with command execution (not sure what this means, see section below on Cursor Agent configuration). If you have installed the cursor-tools prompt to your .cursorrules (or equivalent) just ask your AI coding agent/assistant to use "cursor-tools" to do things.


### Tool Recommendations
- `cursor-tools ask` allows direct querying of any model from any provider. It's best for simple questions where you want to use a specific model or compare responses from different models.
- `cursor-tools web` uses an AI teammate with web search capability to answer questions. `web` is best for finding up-to-date information from the web that is not specific to the repository such as how to use a library to search for known issues and error messages or to get suggestions on how to do something. Web is a teammate who knows tons of stuff and is always up to date.
- `cursor-tools repo` uses an AI teammate with large context window capability to answer questions. `repo` sends the entire repo as context so it is ideal for questions about how things work or where to find something, it is also great for code review, debugging and planning.  is a teammate who knows the entire codebase inside out and understands how everything works together.
- `cursor-tools plan` uses an AI teammate with reasoning capability to plan complex tasks. Plan uses a two step process. First it does a whole repo search with a large context window model to find relevant files. Then it sends only those files as context to a thinking model to generate a plan it is great for planning complex tasks and for debugging and refactoring. Plan is a teammate who is really smart on a well defined problem, although doesn't consider the bigger picture.
- `cursor-tools doc` uses an AI teammate with large context window capability to generate documentation for local or github hosted repositories by sending the entire repo as context. `doc` can be given precise documentation tasks or can be asked to generate complete docs from scratch it is great for generating docs updates or for generating local documentation for a libary or API that you use! Doc is a teammate who is great at summarising and explaining code, in this repo or in any other repo!
- `cursor-tools browser` uses an AI teammate with browser control (aka operator) capability to operate web browsers. `browser` can operate in a hidden (headless) mode to invisibly test and debug web apps or it can be used to connect to an existing browser session to interactively share your browser with Cursor agent it is great for testing and debugging web apps and for carrying out any task that can be done in a browser such as reading information from a bug ticket or even filling out a form. Browser is a teammate who can help you test and debug web apps, and can share control of your browser to perform small browser-based tasks.

Note: For repo, doc and plan commands the repository content that is sent as context can be reduced by filtering out files in a .repomixignore file.

### Command Nicknames
When using cursor-tools with Cursor Composer, you can use these nicknames:
- "Gemini" is a nickname for `cursor-tools repo`
- "Perplexity" is a nickname for `cursor-tools web`
- "Stagehand" is a nickname for `cursor-tools browser`


### Use web search
"Please implement country specific stripe payment pages for the USA, UK, France and Germany. Use cursor-tools web to check the available stripe payment methods in each country."

Note: in most cases you can say "ask Perplexity" instead of "use cursor-tools web" and it will work the same.

### Use repo search
"Let's refactor our User class to allow multiple email aliases per user. Use cursor-tools repo to ask for a plan including a list of all files that need to be changed."

Note: in most cases you can say "ask Gemini" instead of "use cursor-tools repo" and it will work the same.

### Use doc generation
"Use cursor-tools to generate documentation for the Github repo https://github.com/kait-http/kaito" and write it to docs/kaito.md"

Note: in most cases you can say "generate documentation" instead of "use cursor-tools doc" and it will work the same.

### Use github integration
"Use cursor-tools github to fetch issue 123 and suggest a solution to the user's problem"

"Use cursor-tools github to fetch PR 321 and see if you can fix Andy's latest comment"

Note: in most cases you can say "fetch issue 123" or "fetch PR 321" instead of "use cursor-tools github" and it will work the same.

### Use browser automation
"Use cursor-tools to open the users page and check the error in the console logs, fix it"

"Use cursor-tools to test the form field validation logic. Take screenshots of each state"

"Use cursor-tools to open https://example.com/foo the and check the error in the network logs, what could be causing it?"

Note: in most cases you can say "Use Stagehand" instead of "use cursor-tools" and it will work the same.

### Use direct model queries
"Use cursor-tools ask to compare how different models answer this question: 'What are the key differences between REST and GraphQL?'"

"Ask OpenAI's o3-mini model to explain the concept of dependency injection."

Note: The ask command requires both --provider and --model parameters to be specified. This command is generally less useful than other commands like `repo` or `plan` because it does not include any context from your codebase or repository.


## Authentication and API Keys
`cursor-tools` requires API keys for both Perplexity AI and Google Gemini. These can be configured in two ways:

1. **Interactive Setup**: Run `cursor-tools install` and follow the prompts
2. **Manual Setup**: Create `~/.cursor-tools/.env` in your home directory or `.cursor-tools.env` in your project root:
   ```env
   PERPLEXITY_API_KEY="your-perplexity-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

### Google Gemini API Authentication

`cursor-tools` supports multiple authentication methods for accessing the Google Gemini API, providing flexibility for different environments and security requirements. You can choose from the following methods:

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
   - ADC is ideal when running `cursor-tools` within Google Cloud environments (e.g., Compute Engine, Kubernetes Engine) or for local development using `gcloud`.
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
cursor-tools web "What's new in TypeScript 5.7?"
```

### Gemini 2.0: Repository Context & Planning
Leverage Google Gemini 2.0 models with 1M+ token context windows for codebase-aware assistance and implementation planning:

```bash
# Get context-aware assistance
cursor-tools repo "Explain the authentication flow in this project, which files are involved?"

# Generate implementation plans
cursor-tools plan "Add user authentication to the login page"
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

Repository context is created using Repomix. See repomix configuration section below for details on how to change repomix behaviour.

Above 1M tokens cursor-tools will always send requests to Gemini 2.0 Pro as it is the only model that supports 1M+ tokens.

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
cursor-tools browser open "https://example.com" --html

# Take a screenshot
cursor-tools browser open "https://example.com" --screenshot=page.png

# Debug in an interactive browser session
cursor-tools browser open "https://example.com" --connect-to=9222
```

2. `act` - Execute actions using natural language - Agent tells the browser-use agent what to do:
```bash
# Single action
cursor-tools browser act "Login as 'user@example.com'" --url "https://example.com/login"

# Multi-step workflow using pipe separator
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "https://example.com"

# Record interaction video
cursor-tools browser act "Fill out registration form" --url "https://example.com/signup" --video="./recordings"
```

3. `observe` - Analyze interactive elements:
```bash
# Get overview of interactive elements
cursor-tools browser observe "What can I interact with?" --url "https://example.com"

# Find specific elements
cursor-tools browser observe "Find the login form" --url "https://example.com"
```

4. `extract` - Extract data using natural language:
```bash
# Extract specific content
cursor-tools browser extract "Get all product prices" --url "https://example.com/products"

# Save extracted content
cursor-tools browser extract "Get article text" --url "https://example.com/blog" --html > article.html

# Extract with network monitoring
cursor-tools browser extract "Get API responses" --url "https://example.com/api-test" --network
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
cursor-tools browser act "Fill out registration form with name John Doe" --url "http://localhost:3000/signup" --video="./recordings"
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
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "http://localhost:3000/login"

# Form filling with multiple fields
cursor-tools browser act "Select 'Mr' from title | Type 'John' into first name | Type 'Doe' into last name | Click Next" --url "http://localhost:3000/register"

# Record complex interaction
cursor-tools browser act "Fill form | Submit | Verify success" --url "http://localhost:3000/signup" --video="./recordings"
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


## Skills

### GitHub Integration
Access GitHub issues and pull requests directly from the command line with rich formatting and full context:

```bash
# List recent PRs or issues
cursor-tools github pr
cursor-tools github issue

# View specific PR or issue with full discussion
cursor-tools github pr 123
cursor-tools github issue 456
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
cursor-tools xcode build  # Build Xcode project and report errors
cursor-tools xcode run    # Build and run app in simulator
cursor-tools xcode lint   # Analyze code and offer to fix warnings
```

**Build Command Options:**
```bash
# Specify custom build path (derived data)
cursor-tools xcode build buildPath=/custom/build/path

# Specify target device
cursor-tools xcode build destination="platform=iOS Simulator,name=iPhone 15"
```

**Run Command Options:**
```bash
# Run on iPhone simulator (default)
cursor-tools xcode run iphone

# Run on iPad simulator
cursor-tools xcode run ipad

# Run on specific device with custom build path
cursor-tools xcode run device="iPhone 16 Pro" buildPath=/custom/build/path
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
cursor-tools doc --save-to=docs.md

# Document remote GitHub repository (both formats supported)
cursor-tools doc --from-github=username/repo-name@branch
cursor-tools doc --from-github=https://github.com/username/repo-name@branch

# Save documentation to file (with and without a hint)
# This is really useful to generate local documentation for libraries and dependencies
cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/CURSOR-TOOLS.md
cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/CURSOR-TOOLS.md --hint="only information about the doc command"
```


## Configuration

### cursor-tools.config.json
Customize `cursor-tools` behavior by creating a `cursor-tools.config.json` file. This file can be created either globally in `~/.cursor-tools/cursor-tools.config.json` or locally in your project root.

The cursor-tools.config file configures the local default behaviour for each command and provider.

Here is an example of a typical cursor-tools.config.json file, showing some of the most common configuration options:
```json
{
  // Commands
  "repo": {
    "provider": "openrouter",
    "model": "google/gemini-2.0-pro-exp-02-05:free",
  },
  "doc": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.7-sonnet",
    "maxTokens": 4096
  },
  "web": {
    "provider": "gemini",
    "model": "gemini-2.0-pro-exp",
  },
  "plan": {
    "fileProvider": "gemini",
    "thinkingProvider": "perplexity",
    "thinkingModel": "r1-1776"
  },
  "browser": {
    "headless": false,
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
  },
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

2. **GitHub CLI**: If you have the GitHub CLI (`gh`) installed and are logged in, cursor-tools will automatically use it to generate tokens with the necessary scopes.

3. **Git Credentials**: If you have authenticated git with GitHub (via HTTPS), cursor-tools will automatically:
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

cursor-tools will automatically try these authentication methods in order:
1. `GITHUB_TOKEN` environment variable
2. GitHub CLI token (if `gh` is installed and logged in)
3. Git credentials (stored token or Basic Auth)

If no authentication is available, it will fall back to unauthenticated access with rate limits.


### Repomix Configuration

When generating documentation, cursor-tools uses Repomix to analyze your repository. By default, it excludes certain files and directories that are typically not relevant for documentation:
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

#### Model Selection

The `browser` commands support different AI models for processing. You can select the model using the `--model` option:

```bash
# Use gpt-4o
cursor-tools browser act "Click Login" --url "https://example.com" --model=gpt-4o

# Use Claude 3.7 Sonnet
cursor-tools browser act "Click Login" --url "https://example.com" --model=claude-3-7-sonnet-latest
```

You can set a default provider in your `cursor-tools.config.json` file under the `stagehand` section:

```json
{
  "stagehand": {
    "model": "claude-3-7-sonnet-latest", // For Anthropic provider
    "provider": "anthropic", // or "openai"
    "timeout": 90000
  }
}
```

You can also set a default model in your `cursor-tools.config.json` file under the `stagehand` section:

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

Available models depend on your configured provider (OpenAI or Anthropic) in `cursor-tools.config.json` and your API key.

### Cursor Configuration
`cursor-tools` automatically configures Cursor by updating your project rules during installation. This provides:
- Command suggestions
- Usage examples
- Context-aware assistance

For new installations, we use the recommended `.cursor/rules/cursor-tools.mdc` path. For existing installations, we maintain compatibility with the legacy `.cursorrules` file. If both files exist, we prefer the new path and show a warning.

#### Cursor Agent Configuration:

To get the benefits of cursor-tools you should use Cursor agent in "yolo mode". Ideal settings:

![image](https://github.com/user-attachments/assets/783e26cf-c339-4cae-9629-857da0359cef)


## cursor-tools cli

In general you do not need to use the cli directly, your AI coding agent will call the CLI but it is useful to know it exists and this is how it works.

### Command Options
All commands support these general options:
- `--model`: Specify an alternative model
- `--max-tokens`: Control response length
- `--save-to`: Save command output to a file (in addition to displaying it, like tee)
- `--quiet`: Suppress stdout output (only useful with --save-to)
- `--debug`: Show detailed error information
- `--help`: View all available options
- `--provider`: AI provider to use. Valid values: openai, anthropic, perplexity, gemini, openrouter

Documentation command specific options:
- `--from-github`: Generate documentation for a remote GitHub repository (supports @branch syntax)
- `--hint`: Provide additional context or focus for documentation generation

Plan command specific options:
- `--fileProvider`: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--thinkingProvider`: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
- `--fileModel`: Model to use for file identification
- `--thinkingModel`: Model to use for plan generation
- `--fileMaxTokens`: Maximum tokens for file identification
- `--thinkingMaxTokens`: Maximum tokens for plan generation

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
cursor-tools <command> [options]
```

For example:
```bash
cursor-tools web "What's new in TypeScript 5.7?"
```

## Troubleshooting

1. **Command Not Found**
    - Ensure `cursor-tools` is installed globally using `npm install -g cursor-tools`
    - Check your system's PATH environment variable to ensure it includes npm's global bin directory
    - On Unix-like systems, the global bin directory is typically `/usr/local/bin` or `~/.npm-global/bin`
    - On Windows, it's typically `%AppData%\npm`

2. **API Key Errors**
    - Verify `.cursor-tools.env` exists and contains valid API keys
    - Run `cursor-tools install` to reconfigure API keys
    - Check that your API keys have the necessary permissions
    - For GitHub operations, ensure your token has the required scopes (repo, read:user)
    - For Google Vertex AI authentication:
      - If using a JSON key file, verify the file path is correct and the file is readable
      - If using ADC, ensure you've run `gcloud auth application-default login` and the account has appropriate permissions
      - Verify your service account has the necessary roles in Google Cloud Console (typically "Vertex AI User")
      - For troubleshooting ADC: Run `gcloud auth application-default print-access-token` to check if ADC is working

3. **Model Errors**
    - Check your internet connection
    - Verify API key permissions
    - Ensure the specified model is available for your API tier

4. **GitHub API Rate Limits**
    - GitHub API has rate limits for unauthenticated requests. For higher limits you must be authenticated.
    - If you have the gh cli installed and logged in cursor-tools will use that to obtain a short lived auth token. Otherwise you can add a GitHub token to your environment:
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
    - If .cursorrules is outdated, run `cursor-tools install .` to update
    - Ensure Cursor is configured to allow command execution
    - Check that your Cursor version supports AI commands

### Examples

#### Web Search Examples
```bash
# Get information about new technologies
cursor-tools web "What are the key features of Bun.js?"

# Check API documentation
cursor-tools web "How to implement OAuth2 in Express.js?"

# Compare technologies
cursor-tools web "Compare Vite vs Webpack for modern web development"
```

#### Repository Context Examples
```bash
# Architecture understanding
cursor-tools repo "Explain the overall architecture of this project"

# Find usage examples
cursor-tools repo "Show me examples of error handling in this codebase"

# Debugging help
cursor-tools repo "Why might the authentication be failing in the login flow?"
```

#### Documentation Examples
```bash
# Document specific aspects and save to file without stdout output
cursor-tools doc --save-to=docs/api.md --quiet --hint="Focus on the API endpoints and their usage"

# Document with hint to customize the docs output
cursor-tools doc --save-to=docs/architecture.md --quiet --hint="Focus on system architecture"

# Document dependencies
cursor-tools doc --from-github=expressjs/express --save-to=docs/EXPRESS.md --quiet
```

#### GitHub Integration Examples
```bash
# List PRs with specific labels
cursor-tools github pr --from-github facebook/react

# Check recent issues in a specific repository
cursor-tools github issue --from-github vercel/next.js

# View PR with code review comments
cursor-tools github pr 123 --from-github microsoft/typescript

# Track issue discussions
cursor-tools github issue 456 --from-github golang/go
```

#### Xcode Command Examples
```bash
# Build an iOS app with default settings
cursor-tools xcode build

# Build with custom derived data path
cursor-tools xcode build buildPath=~/custom/derived/data

# Run in iPhone simulator
cursor-tools xcode run iphone

# Run on specific iPad model
cursor-tools xcode run device="iPad Pro (12.9-inch) (6th generation)"

# Analyze code quality 
cursor-tools xcode lint
```

#### Browser Command Examples

##### `open` subcommand examples:
```bash
# Open a URL and get HTML
cursor-tools browser open "https://example.com" --html

# Open and capture console logs and network activity
cursor-tools browser open "https://example.com" --console --network

# Take a screenshot
cursor-tools browser open "https://example.com" --screenshot=page.png

# Run in non-headless mode for debugging
cursor-tools browser open "https://example.com" --no-headless
```

##### `act`, `extract`, `observe` subcommands examples:
```bash
# AI-powered action
cursor-tools browser act "Click on 'Sign Up'" --url "https://example.com"

# AI-powered extraction
cursor-tools browser extract "Get the main content" --url "https://example.com/blog"

# AI-powered observation
cursor-tools browser observe "What can I do on this page?" --url "https://example.com"
```

## Node Package Manager (npm)

cursor-tools is available on npm [here](https://www.npmjs.com/package/cursor-tools)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. If you used cursor-tools to make your contribution please include screenshots or videos of cursor-tools in action.


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
