<div align="center">
  <img height="72" src="https://github.com/user-attachments/assets/45eff178-242f-4d84-863e-247b080cc6f5" />
</div>

<div align=center><h1>Give Cursor Agent an AI team and advanced skills</h1></div>

### The AI Team
- Perplexity to search the web and perform deep research
- Gemini 2.0 for huge whole-codebase context window, search grounding and reasoning
- (coming soon) o3 for browser operation to test and debug web apps

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

`cursor-tools` provides a CLI that your **AI agent can use** to expand its capabilities. `cursor-tools` works with with Cursor (and is compatible with other agents), When you run `cursor-tools install` we automatically add a prompt section to your `.cursorrules` file so that it works out of the box with Cursor, there's not need for additional prompts.

`cursor-tools` requires a Perplexity API key and a Google AI API key.

`cursor-tools` is an node package. You can install it globally, at a node project level or run without installation using `npx`.

## Installation

Run the interactive setup:
```bash
npx cursor-tools@latest install .
```

This command will:

1. Add `cursor-tools` as a dev dependency in your package.json
2. Guide you through API key configuration
3. Update your `.cursorrules` file for Cursor integration

## Requirements

- Node.js 18 or later
- Perplexity API key
- Google Gemini API key

`cursor-tools` uses Gemini-2.0 because it is the only good LLM with a context window that goes up to 2 million tokens - enough to handle and entire codebase in one shot. Gemini 2.0 experimental models that we use by default are currently free to use on Google and you need a Google Cloud project to create an API key.

`cursor-tools` uses Perplexity because Perplexity has the best web search api and indexes and it does not hallucinate. Perplexity Pro users can get an API key with their pro account and recieve $5/month of free credits (at time of writing). Support for Google search grounding is coming soon but so far testing has shown it still frequently hallucinates things like APIs and libraries that don't exist.


## Additional Examples

To see cursor-tools GitHub and Perplexity skills: Check out [this example issue that was solved using Cursor agent and cursor-tools](https://github.com/eastlondoner/cursor-tools/issues/1)

Tips:

- Ask Cursor Agent to have Gemini review its work
- Ask Cursor Agent to generate documentation for external dependencies and write it to a local-docs/ folder

If you do something cool with `cursor-tools` please let me know on twitter or make a PR to add to this section!

## Detailed Cursor Usage

Use Cursor Composer in agent mode with command execution (not sure what this means, see section below on Cursor Agent configuration). If you have installed the cursor-tools prompt to your .cursorrules (or equivalent) just ask your AI coding agent/assistant to use "cursor-tools" to do things.

Examples usages:

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

## Authentication and API Keys
`cursor-tools` requires API keys for both Perplexity AI and Google Gemini. These can be configured in two ways:

1. **Interactive Setup**: Run `cursor-tools install` and follow the prompts
2. **Manual Setup**: Create `~/.cursor-tools/.env` in your home directory or `.cursor-tools.env` in your project root:
   ```env
   PERPLEXITY_API_KEY="your-perplexity-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   ```


## Core Features

### Web Search
Use Perplexity AI to get up-to-date information directly within Cursor:
```bash
cursor-tools web "What's new in TypeScript 5.7?"
```

### Repository Context
Leverage Google Gemini for codebase-aware assistance:
```bash
cursor-tools repo "Explain the authentication flow in this project, which files are involved?"
```

### Browser Automation
Automate browser interactions for web scraping, testing, and debugging:

**Important:** The `browser` command requires the Playwright package to be installed separately in your project:
```bash
npm install playwright
# or
yarn add playwright
# or
pnpm add playwright
```

#### Video Recording
All browser commands support video recording of the browser interaction. This is useful for debugging and documentation:
- Use `--video=<directory>` to enable recording
- Videos are saved at 1280x720 resolution
- Each recording gets a unique timestamp
- Recording starts when the browser opens and ends when it closes
- Videos are saved as .webm files

Example:
```bash
# Record a video of filling out a form
cursor-tools browser act "Fill out registration form with name John Doe" --url "http://localhost:3000/signup" --video="./recordings"
```

#### Complex Actions
The `act` command supports chaining multiple actions using the pipe (|) separator. This allows you to perform complex sequences of actions in a single command:

```bash
# Login sequence
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Type 'password123' into password | Click Submit" --url "http://localhost:3000/signup"

# Form filling
cursor-tools browser act "Select 'Mr' from title | Type 'John' into first name | Type 'Doe' into last name | Click Next" --url "http://localhost:3000/register"
```

Each instruction is executed in sequence, and the command will fail if any step fails. You can combine this with video recording and console and network logging to debug complex interactions:

```bash
# Record a complex interaction
cursor-tools browser act "Click Login | Type credentials | Click Submit | Wait for dashboard" --url "https://example.com" --video="./debug-recordings" --console --network
```

Examples:
```bash
# Basic usage: Open a URL and capture its HTML content
cursor-tools browser open "http://localhost:3000" --html

# Add console logs and network monitoring
cursor-tools browser open "http://localhost:3000" --console --network

# Capture a screenshot of the entire page
cursor-tools browser open "http://localhost:3000" --screenshot="page.png"

# Debug with visible browser window (non-headless mode)
cursor-tools browser open "http://localhost:3000" --no-headless

# Advanced: Connect to an existing Chrome instance
cursor-tools browser open "http://localhost:3000" --connect-to=9222

# AI-powered action: Click on a button using natural language instruction
cursor-tools browser act "Click on 'Get Started' button" --url "http://localhost:3000"

# AI-powered action: Multiple sequential actions using pipe separator and console and network logging
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "http://localhost:3000/login" --console --network

# Record video of browser interaction
cursor-tools browser act "Fill out all fields on the registration form with dummy data" --url "http://localhost:3000/signup" --video="./recordings"

# AI-powered data extraction: Extract product names and prices
cursor-tools browser extract "Extract product names and prices" --url "http://localhost:3000/products"

# AI-powered observation: List interactive elements on a page
cursor-tools browser observe "List all interactive elements" --url "http://localhost:3000/signup"
```

**Browser Command Options (for 'open', 'act', 'observe', 'extract'):**
--console: Capture browser console logs (enabled by default, use --no-console to disable)
--html: Capture page HTML content
--network: Capture network activity (enabled by default, use --no-network to disable)
--screenshot=<file path>: Save a screenshot of the page
--timeout=<milliseconds>: Set navigation timeout (default: 30000ms)
--viewport=<width>x<height>: Set viewport size (e.g., 1280x720)
--headless: Run browser in headless mode (default: true)
--no-headless: Show browser UI (non-headless mode) for debugging
--connect-to=<port>: Connect to existing Chrome instance
--wait=<duration or selector>: Wait after page load (e.g., '5s', '#element-id', 'selector:.my-class')
--video=<directory>: Save a video recording of the browser interaction to the specified directory (1280x720 resolution)

**Notes on Browser Commands:**
- All browser commands are stateless: each command starts with a fresh browser instance and closes it when done.
- Multi step workflows involving state or combining multiple actions are supported in the `act` command using the pipe (|) separator (e.g., `cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url=https://example.com`)
- Video recording is available for all browser commands using the `--video=<directory>` option. This will save a video of the entire browser interaction at 1280x720 resolution. The video file will be saved in the specified directory with a timestamp.
- The `--console` and `--network` options are enabled by default. Use `--no-console` and `--no-network` to disable them.

**Examples:**

```bash
# Open a URL, capturing console logs and network activity (enabled by default)
cursor-tools browser open "http://localhost:3000"

# Disable console and network monitoring
cursor-tools browser open "http://localhost:3000" --no-console --no-network

# AI-powered action: Multiple sequential actions using pipe separator (console and network logging are enabled by default)
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "http://localhost:3000/login"

# AI-powered action: Multiple sequential actions with console and network logging explicitly disabled
cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url "http://localhost:3000/login" --no-console --no-network
```

### Documentation Generation
Generate comprehensive documentation for your repository or any GitHub repository:
```bash
# Document local repository
cursor-tools doc

# Document remote GitHub repository
cursor-tools doc --from-github=username/repo-name
cursor-tools doc --from-github=username/repo-name@branch  # Specify branch
cursor-tools doc --from-github=https://github.com/username/repo-name@branch  # HTTPS URL format

# Save documentation to file
# This is really useful to generate local documentation for libraries and dependencies
cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/CURSOR-TOOLS.md
cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to=docs/CURSOR-TOOLS.md --hint="only information about the doc command"
```


### GitHub Integration
Access GitHub issues and pull requests directly from the command line:
```bash
# List recent PRs
cursor-tools github pr

# View specific PR with full discussion and code review comments
cursor-tools github pr 123

# List recent issues
cursor-tools github issue

# View specific issue with full discussion thread
cursor-tools github issue 456

# Access other repositories using --from-github or --repo
cursor-tools github pr --from-github microsoft/vscode
cursor-tools github issue 789 --from-github microsoft/vscode
```

The GitHub commands provide:
- If no PR/Issue number is specified, view of 10 most recent open PRs or issues
- If a PR/Issue number is specified, detailed view of specific PR or issue including:
  - PR/Issue description and metadata
  - Code review comments grouped by file (PRs only)
  - Full Discussion thread
  - Labels, assignees, milestones and reviewers as appropriate
- Support for both local repositories and remote GitHub repositories
- Markdown-formatted output for readability


## Configuration

### Default Settings
Customize `cursor-tools` behavior by creating a `cursor-tools.config.json` file:
```json
{
  "perplexity": {
    "model": "sonar-pro",
    "maxTokens": 8000
  },
  "gemini": {
    "model": "gemini-2.0-flash-thinking-exp-01-21",
    "maxTokens": 10000
  },
  "tokenCount": {
    "encoding": "o200k_base"  // Tokenizer to use for token counting (options: o200k_base, cl100k_base, gpt2, r50k_base, p50k_base, p50k_edit)
  },
  "browser": {
    "defaultViewport": "1280x720",
    "timeout": 30000,
    "stagehand": {
      "env": "LOCAL",
      "headless": true,
      "verbose": 1,
      "debugDom": false,
      "enableCaching": false,
      "llmProvider": "openai", // or "anthropic" or "google"
      "timeout": 30000 // Optional, timeout for operations in milliseconds
    }
  }
}
```

The configuration supports:
- `perplexity.model`: Perplexity AI model to use
- `perplexity.maxTokens`: Maximum tokens for Perplexity responses
- `gemini.model`: Google Gemini model to use
- `gemini.maxTokens`: Maximum tokens for Gemini responses
- `tokenCount.encoding`: Tokenizer to use for counting tokens (defaults to `o200k_base` which is optimized for Gemini)
- `browser.defaultViewport`: Default viewport size for browser commands
- `browser.timeout`: Default timeout for browser commands
- `browser.stagehand.env`: Environment for browser commands
- `browser.stagehand.headless`: Whether to run browser in headless mode
- `browser.stagehand.verbose`: Verbosity level for browser commands
- `browser.stagehand.debugDom`: Whether to enable debug output for browser commands
- `browser.stagehand.enableCaching`: Whether to enable caching for browser commands
- `browser.stagehand.llmProvider`: Language model provider for browser commands
- `browser.stagehand.timeout`: Timeout for operations in milliseconds

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
  - Access to all features

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


### Cursor Configuration
`cursor-tools` automatically configures Cursor by updating your `.cursorrules` file during installation. This provides:
- Command suggestions
- Usage examples
- Context-aware assistance

#### Cursor Agent Configuration:

To get the benefits of cursor-tools you should use Cursor agent in "yolo mode". Ideal settings:

![image](https://github.com/user-attachments/assets/783e26cf-c339-4cae-9629-857da0359cef)


## cursor-tools cli

In general you do not need to use the cli directly, your AI coding agent will call the CLI but it is useful to know it exists and this is how it works.

### Command Options
All commands support these general options:
- `--model`: Specify an alternative model
- `--max-tokens`: Control response length
- `--save-to`: Save command output to a file (in *addition* to displaying it, like tee)
- `--help`: View all available options (help has not been implemented for all commands yet)

Documentation command specific options:
- `--from-github`: Generate documentation for a remote GitHub repository (supports @branch syntax)

GitHub command specific options:
- `--from-github`: Access PRs/issues from a specific GitHub repository (format: owner/repo)
- `--repo`: Alternative to --from-github, does the same thing (format: owner/repo)

### Execution Methods
Execute commands in several ways:
```bash
# Global installation
cursor-tools web "query"

# without global installation
npx -y cursor-tools@latest web "query"
```

## Troubleshooting

1. **Command Not Found**
    - Ensure `cursor-tools` is installed (globally or as a dev dependency)
    - Check your PATH if installed globally

2. **API Key Errors**
    - Verify `.cursor-tools.env` exists and contains valid API keys
    - Run `cursor-tools install` to reconfigure API keys
    - Check that your API keys have the necessary permissions
    - For GitHub operations, ensure your token has the required scopes (repo, read:user)

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
# Document specific aspects
cursor-tools doc --hint="Focus on the API endpoints and their usage"

# Document with custom output
cursor-tools doc --save-to=docs/architecture.md --hint="Focus on system architecture"

# Document dependencies
cursor-tools doc --from-github=expressjs/express --save-to=docs/EXPRESS.md
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


## License

MIT License - see [LICENSE](LICENSE) for details.
