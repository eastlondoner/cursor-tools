# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.60.8] - 2026-04-27

### Added
 - Fix for auto-update logic under different package managers

## [0.60.7] - 2025-04-26

### Added
 - **Auto-update**:
   - Automatically updates vibe-tools CLI to the latest version
   - Runs automatically on either of the commands
   - Automatically detects available IDEs and updates rules (if vibe-tools Integration detected)
   - For vibe-tools install it prompts user if they wanna continue with installation

### Improved

- **Doc & Browser Commands Provider Improvements**:
  - Doc and repo commands are now properly using their configured providers.

- **CTA improvement**:
  - Improved CTA for vibe-tools install to prompt user if they wanna continue with installationto do stuff. Removed misleading mention of --help flag.
  - Documented ask --with-doc command

## [0.60.6] - 2025-04-22

### Added

- **Document Web Url Integration**: Added `--with-doc <doc_url>` flag to `repo` and `doc` commands to fetch content from any web URL and include it as context.
  - Uses the internal browser open command with a wait time to capture rendered HTML.
  - Implements retry logic (3s, 5s, 10s waits) for fetching content to improve reliability.
  - For repo: Prepends fetched document content to the user query sent to the analysis model.
  - For doc: Includes fetched document content as additional context for documentation generation.

## [0.60.5] - 2025-04-18

### Added

- **Document Web Url Integration**: Added `--with-doc <doc_url>` flag to `repo` and `doc` commands to fetch content from any web URL and include it as context.
  - Uses the internal browser open command with a wait time to capture rendered HTML.
  - Implements retry logic (3s, 5s, 10s waits) for fetching content to improve reliability.
  - For repo: Prepends fetched document content to the user query sent to the analysis model.
  - For doc: Includes fetched document content as additional context for documentation generation.

## [0.60.4] - 2025-04-16

### Added

- **Codex Support**: Added support for OpenAI Codex instructions similar to Claude code instructions, providing a consistent experience across different AI models.
  - Support for both local `codex.md` at repository root and global `~/.codex/instructions.md`

### Improved

- **Installation Process**:
  - Added support for copying existing global config during installation
  - Fixed incorrect provider naming bug
  - Fixed Gemini 2.5 Pro correct naming
  - Added suggestion to delete old cursor-tools folder if it exists
  - Enhanced UX for Claude code and Codex instructions setup

## [0.60.3] - 2025-04-10

### Added

- **X.AI Provider Support**: Added support for the X.AI provider, enabling the use of Grok models (e.g., `grok-3-latest`, `grok-3-mini-latest`). Configure using the `XAI_API_KEY` environment variable.
- **Document Web Url Integration**: Added `--with-doc <doc_url>` flag to `repo` and `doc` commands to fetch content from any web URL and include it as context.

## [0.60.0] - 2025-04-09

### Changed

- Updated default Gemini Pro model from 2.0 to gemini-2.5-pro-exp for improved performance

### Added

- **Youtube command**: Added `youtube` command that can be used to analyze YouTube videos and generate detailed reports:

  - Support for multiple analysis types: summaries, transcripts, implementation plans, reviews, or custom analysis
  - Optional questions parameter for targeted insights about video content
  - Uses Gemini models which have native YouTube video understanding capabilities
  - Results can be saved to files for reference and sharing
  - Requires `GEMINI_API_KEY` to be set in your environment or .vibe-tools.env file

- **Support for Reasoning Effort Parameter**: Added `--reasoning-effort` parameter to enhance the quality of responses for complex queries:
  - Supports `low`, `medium`, and `high` values for controlling reasoning depth
  - Compatible with OpenAI o1 and o3-mini models directly
  - Translated to extended thinking with appropriate token budgets for Claude 3.7 Sonnet models
  - Works with OpenRouter provider using a compatible format
  - Can be overridden for custom models by setting the `OVERRIDE_SAFETY_CHECKS=true` environment variable

### Fixed

- **Test Reporting Displays Detailed Scenario Results**: Fixed an issue in `src/commands/test/command.ts` where test scenario details were not being correctly displayed in generated reports. The fix ensures that the promises returned by `queue.add()` are properly handled, allowing detailed scenario information to appear in test reports.

## [0.6.0-alpha.14]

### Added

- **GitHub Repository Analysis for Repo Command**: Added `--from-github` parameter to the repo command, enabling analysis of remote GitHub repositories without local cloning. This feature provides the same functionality previously available in the doc command, making it easier to get context-aware assistance for any public GitHub repository (e.g., `vibe-tools repo "explain the authentication flow" --from-github=username/repo-name`).

## [0.6.0-alpha.13]

### Added

- **Support for Custom Repomix Configuration**: Added support for `repomix.config.json` files to customize which files are included/excluded during repository analysis. This configuration file can be placed in the repository root and will be automatically detected by `repo`, `plan`, and `doc` commands, allowing for more precise control over repository content analysis.
- **Subdirectory Analysis for Repo Command**: Added `--subdir` parameter to the repo command, allowing users to analyze a specific subdirectory instead of the entire repository. This makes the repo command more efficient when working with large codebases by focusing only on relevant subdirectories (e.g., `vibe-tools repo "explain the code" --subdir=src/commands`).
- **Improved Model Name Resolution**: Enhanced model name handling across providers to better handle experimental and latest model versions:

  - Automatically resolves `-exp-*` suffixes to find stable model versions
  - Resolves `-latest` suffixes to the most recent compatible model
  - For ModelBox and OpenRouter: automatically finds models across providers without requiring provider prefixes (e.g. `gpt-4o` will find `openai/gpt-4o`)
  - Provides helpful suggestions when models aren't found, showing similar available models

- **Support for OpenRouter when using MCP**
- By default the `mcp` command uses Anthropic, but now takes a --provider argument that can be set to 'anthropic' or 'openrouter'
- MCP commands require `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` to be set in your environment
- The '--model' arg can also be used with the MCP command to set the OpenRouter model. It is ignored if the provider is Anthropic.

- **Google Vertex AI Authentication**: Added support for Google Vertex AI authentication using JSON key files or Application Default Credentials (ADC). This update maintains backward compatibility, continuing to support the direct API key string method, while adding additional authentication options. To use this feature, set the `GEMINI_API_KEY` environment variable to the path of your JSON key file or to `adc` to use Application Default Credentials. This enables access to gemini models such as `gemini-2.0-flash` via the Vertex AI. This feature introduces a new dependency: `google-auth-library`.

  - **Example: Using Service Account JSON Key**
    Set `GEMINI_API_KEY` to the path of your service account JSON key file:
    ```env
    GEMINI_API_KEY="./path/to/service-account.json"
    ```
  - **Example: Using Application Default Credentials (ADC)**
    First, authenticate locally using gcloud:
    ```bash
    gcloud auth application-default login
    ```
    Then set `GEMINI_API_KEY` to `adc` to use Application Default Credentials:
    ```env
    GEMINI_API_KEY="adc"
    ```

- **New Test Command**: Added comprehensive test command for automated feature behavior testing:
  - **Real Command Execution**: Tests now execute actual vibe-tools commands in a controlled environment, validating real-world behavior instead of simulated outputs.
  - Parallel test execution with dynamic worker allocation for faster test suite runtime.
  - Scenario-specific output buffering for clean parallel execution logs, ensuring readability even with concurrent tests.
  - Progress tracking showing completed/running/pending scenarios, providing real-time feedback during test runs.
  - Execution time statistics including total execution time and time saved by parallelization, offering insights into performance gains.
  - Detailed test reports with:
    - Test scenario details and results, including clear PASS/FAIL status with visual markers.
    - Tool execution logs: Detailed record of each tool execution during tests, including arguments, outputs (stdout/stderr), and any errors, providing in-depth insight into test execution flow.
    - Approach summaries using Gemini: After each test scenario, Gemini is used to summarize the AI agent's approach, providing a natural language overview of the steps and tools used to solve the test scenario.
  - Test coverage includes various categories of scenarios: Happy Path, Error Handling, Edge Cases, and Performance.
  - Support for test asset management and references: Introduced a robust system for managing test assets, allowing scenarios to reference external files or inline content, improving test data organization and reusability.
  - Intelligent retry mechanism with exponential backoff: Implemented a retry system that automatically handles transient errors with exponential backoff and jitter, improving test reliability and reducing false negatives.
  - Enhanced error handling and reporting: Improved error messages now include detailed information such as error types, stack traces, and context, making debugging test failures more efficient.

## [0.6.0-alpha.7] - 2025-03-05

### Added

- **Improved ModelBox Provider**: Enhanced the ModelBox provider with improved model name handling. If a requested model is not found, vibe-tools now provides helpful suggestions for similar models. Error messages have also been clarified to better guide users on the requirement for provider prefixes when specifying ModelBox models.

  - **Example: Improved Error Message**
    If you use an invalid model with ModelBox, you will now receive suggestions:

    ```text
    Error: Model 'invalid-model' not found in ModelBox.

    You requested: invalid-model
    Similar available models:
    - openai/gpt-4o
    - anthropic/claude-3-5-sonnet

    Use --model with one of the above models. Note: ModelBox requires provider prefixes (e.g., 'openai/gpt-4' instead of just 'gpt-4').
    ```

- Added support for MCP server overrides in the marketplace
  - Implemented hardcoded overrides in `MCP_OVERRIDES` map
  - Added override for google-calendar-mcp to use eastlondoner fork
  - Overrides can specify custom `githubUrl`, `command`, and `args`
  - Preserves environment variables when using overrides
  - Type-safe implementation ensures overrides match the MCPServer interface
  - Overrides take precedence over marketplace data and automatic GitHub repository checks
  - Logs when an override is applied using console.log for transparency
  - Added support for user-configurable overrides in `vibe-tools.config.json`
    - Users can define custom overrides in the `mcp.overrides` section
    - Config overrides take precedence over hardcoded overrides
    - Warns when a config override replaces a hardcoded override

### Changed

- Updated all references to Claude 3.5 Sonnet models to Claude 3.7 Sonnet models throughout the codebase
  - Updated model references in configuration files, documentation, and source code
  - Updated default model settings for Anthropic provider
  - Updated error messages and model suggestions
  - Used `claude-3-7-sonnet` for most use cases and `claude-3-7-sonnet-thinking` for MCP client
- Updated @browserbasehq/stagehand dependency from 1.13.0 to 1.13.1
- Updated @browserbasehq/stagehand dependency from 1.13.1 to 1.14.0
- Added new dependencies for test command:
  - Added `p-queue` for parallel execution management
  - Added `glob` and `@types/glob` for test file pattern matching
  - Added `playwright` and `playwright-core` with version pinning

## [0.6.0-alpha.5] - 2024-03-22

### Changed

- vibe-tools now only recommends global installation
- Updated install command to check for and warn about vibe-tools dependencies in package.json files
  - Checks both dependencies and devDependencies in package.json
  - Provides clear instructions for removing local installations using npm, pnpm, or yarn
  - This is in response to multiple issues caused by local installation and execution under different js runtimes

## [0.6.0-alpha.4] - 2024-03-22

### Changed

- Added validation to require --tag alpha or --tag latest when running release command

## [0.6.0-alpha.3] - 2024-03-22

### Added

- Added ModelBox provider for access to a wider range of models through an OpenAI-compatible API
- Added OpenRouter provider to enable access to models from various providers including Perplexity
- New ClickUp integration command for task management
  - Added ClickUp authentication flow with API token request during installation
  - Implemented ClickUp command with task management capabilities
  - Added ClickUp command instructions to template
- Added instructions for Chrome remote debugging setup in cursor rules

### Changed

- Improved browser command state management when using `--connect-to`:
  - Reuses existing browser tabs for subsequent commands in a session, preserving page state
  - Introduced `reload-current` as a special URL value to refresh the current page without losing the connected session
- Browser commands (`open`, `act`, `observe`, `extract`) now have `--console` and `--network` options enabled by default. Use `--no-console` and `--no-network` to disable them.
- Improved page reuse in browser commands when using `--connect-to`: now reuses existing tabs instead of creating new ones for better state preservation
- Improved error handling and type safety in cursor rules management
- Enhanced directory creation order in installation process
- Added user choice during installation for cursor rules location (legacy `.cursorrules` or new `.cursor/rules/vibe-tools.mdc`)
- Added `USE_LEGACY_CURSORRULES` environment variable to control cursor rules file location
- Improved output handling across all commands:
  - Centralized output handling in main CLI
  - Commands now yield output consistently
  - Better error handling for file writes
  - Added timeout protection for stdout writes
  - More reliable output flushing
- Improved security by not logging API keys in stagehand config

## [0.6.0-alpha.1] - 2024-03-22

### Fixed

- Fixed debug logging in all provider commands to properly pass through the debug flag
  - Fixed `ask` command to pass debug flag to provider
  - Fixed `web` command to properly handle debug flag
  - Fixed `doc` command to include debug flag in options
  - Fixed `plan` command to pass debug flag to both file and thinking providers
  - Standardized debug logging format across all providers
  - Debug logs now show full request and response details when enabled

### Changed

- Changed default thinking provider for plan command to OpenAI with o3-mini model for significantly faster plan generation, while maintaining plan quality

### Added

- New `ask` command for direct model queries
  - Requires both provider and model parameters
  - Allows querying any model from any provider directly
  - Simple and focused command for direct questions
- Support for new Cursor IDE project rules structure
  - New installations now use `.cursor/rules/vibe-tools.mdc` by default
  - Maintain compatibility with legacy `.cursorrules` file via `USE_LEGACY_CURSORRULES=true`
  - Interactive choice during installation
  - When both exist, use path based on `USE_LEGACY_CURSORRULES` environment variable
  - Updated documentation to reflect new path structure
- Added support for the `gpt-4o` model in browser commands (`act`, `extract`, `observe`)
  - The model can be selected using the `--model=gpt-4o` command-line option
  - The default model can be configured in `vibe-tools.config.json`
  - If no model is specified, a default model is used based on the configured provider (OpenAI or Anthropic)
- **Internal:** Bundled Stagehand script directly into the codebase to prevent dependency issues
- **Build:** Added stagehand script verification to the release process
- Enhanced `plan` command with dual-provider architecture:
  - Separate providers for file identification and plan generation
  - `fileProvider` handles repository file analysis
  - `thinkingProvider` generates implementation plans
  - New command options:
    - `--fileProvider`: Provider for file identification (gemini, openai, or openrouter)
    - `--thinkingProvider`: Provider for plan generation (gemini, openai, or openrouter)
    - `--fileModel`: Model to use for file identification
    - `--thinkingModel`: Model to use for plan generation
    - `--fileMaxTokens`: Maximum tokens for file identification
    - `--thinkingMaxTokens`: Maximum tokens for plan generation
- Brand new provider system with enhanced error handling and configuration:
  - New provider interfaces for specialized tasks
  - Shared implementations via provider mixins
  - Better error messages and debugging support
  - Configurable system prompts for different tasks
- Added `--quiet` flag to suppress stdout output while still saving to file with `--save-to`
  - Useful for scripting and automated documentation generation
  - All commands now support quiet mode
  - Error messages are still displayed even in quiet mode

## [0.4.3-alpha.23] - 2024-03-22

### Fixed

- Fixed browser commands to respect system color scheme when using `--connect-to` by not forcing a specific color scheme

## [0.4.3-alpha.22] - 2024-03-22

### Fixed

- Fixed browser commands to not set viewport size in Stagehand when using `--connect-to`

## [0.4.3-alpha.21] - 2024-03-22

### Fixed

- Fixed browser commands to not set viewport size when using `--connect-to` without an explicit `--viewport` option

## [0.4.3-alpha.20] - 2024-03-22

### Changed

- Browser commands (`open`, `act`, `observe`, `extract`) now have `--console` and `--network` options enabled by default. Use `--no-console` and `--no-network` to disable them.

## [0.4.3-alpha.19] - 2024-03-22

### Fixed

- Fixed browser commands to always reuse existing tabs when using `--connect-to` instead of creating new ones

## [0.4.3-alpha.18] - 2024-03-22

### Changed

- Browser commands now preserve viewport size when using `--connect-to` unless `--viewport` is explicitly provided
- Added validation to prevent using `--video` with `--connect-to` as video recording is not supported when connecting to existing Chrome instances

## [0.4.3-alpha.17] - 2024-03-22

### Added

- Added `reload-current` as a special URL value for browser commands when using `--connect-to`. This allows refreshing the current page while maintaining the connection, which is particularly useful in development workflows.

## [0.4.3-alpha.15] - 2024-03-21

### Fixed

- Fixed console logging in browser act command by correcting parameter order in outputMessages call

## [0.4.3-alpha.13] - 2024-03-21

### Added

- Browser commands now support `--url=current` to skip navigation and use the current page
- Browser commands now automatically skip navigation if already on the correct URL
- Improved page reuse when connecting to existing Chrome instance

## [0.4.3-alpha.12] - 2025-02-07

### Added

- New `browser` command for AI-powered web automation and debugging, leveraging Stagehand AI for natural language interaction
  - `act <instruction> --url <url> [options]`: Execute actions on a webpage using natural language instructions
    - `<instruction>`: Natural language instruction describing the action (e.g., "Click Login", "Type 'hello' in the search box")
    - `--url <url>`: Required URL to navigate to before performing actions
    - Additional options:
      - `--delay=<milliseconds>`: Delay between actions (default: 100)
      - `--retry=<number>`: Number of retries for failed actions (default: 3)
  - `extract <instruction> --url <url> [options]`: Extract data from webpages based on natural language instructions
    - `<instruction>`: Natural language instruction describing the data to extract (e.g., "product names", "article content")
    - `--url <url>`: Required URL to navigate to
    - Additional options:
      - `--format=<json|csv|text>`: Output format (default: json)
      - `--flatten`: Flatten nested objects in output
  - `observe <instruction> --url <url> [options]`: Observe interactive elements on a webpage and suggest possible actions
    - `<instruction>`: Natural language instruction describing what to observe (e.g., "interactive elements", "login form")
    - `--url <url>`: Required URL to navigate to
    - Additional options:
      - `--interval=<milliseconds>`: Check interval for observation (default: 1000)
      - `--duration=<duration>`: Total observation time (e.g., '30s', '5m')
      - `--changes-only`: Only report when changes are detected
  - `open <url> [options]`: Open and interact with web pages
    - Capture HTML content with `--html`
    - Monitor console logs with `--console`
    - Track network activity with `--network`
    - Take screenshots with `--screenshot=<file path>`
    - Configure viewport size with `--viewport=<width>x<height>`
    - Debug with visible browser using `--no-headless`
    - Connect to existing Chrome instances with `--connect-to=<port>`
  - Common options for all browser commands:
    - `--timeout=<milliseconds>`: Set navigation timeout (default: 30000)
    - `--viewport=<width>x<height>`: Set viewport size (e.g., 1280x720)
    - `--headless`: Run browser in headless mode (default: true)
    - `--no-headless`: Show browser UI for visual inspection and debugging
    - `--connect-to=<port>`: Connect to an existing Chrome instance
    - `--wait=<duration or selector>`: Wait after page load, supports:
      - Time duration: '5s', '1000ms', '2m' (seconds, milliseconds, minutes)
      - CSS selector: '#element-id', '.my-class'
      - Explicit format: 'time:5s', 'selector:#element-id', 'css:.my-class'
  - Made Playwright a peer dependency for lighter installation
  - Added browser configuration options in config file (headless mode, viewport, timeout)
  - Integrated Stagehand AI for browser automation
    - Support for OpenAI and Anthropic providers
    - Auto-selection of provider based on available API keys
    - Configurable timeout and debug options

### Changed

- Moved Playwright from direct dependency to peer dependency
  - Users need to install Playwright separately to use browser commands
  - Added clear installation instructions and error messages

## [0.4.3-alpha.10] - 2025-02-07

### Fixed

- Fixed punycode deprecation warning by properly redirecting both `punycode` and `node:punycode` imports to `punycode/`

## [0.4.3-alpha.9] - 2025-02-07

### Fixed

- Fixed dynamic require issues with Node.js built-in modules by using proper ESM imports
- Improved handling of Node.js built-in modules in build configuration

## [0.4.1] - 2025-02-06

### Changed

- Changed default tokenizer to `o200k_base` for better compatibility with Gemini models
- Added configurable tokenizer support through `tokenCount.encoding` in config file
- Updated documentation to reflect new tokenizer configuration options

## [0.4.0] - 2025-02-06

### Improvements

- Big improvements to robustness of command line arguments
- Introduces doc command to generate documentation for local or remote repositories
- Introduces github command to access PRs and issues from github
  - Support for listing recent PRs and issues
  - Detailed view of PR/issue discussions and code review comments
  - Multiple authentication methods:
    - GitHub token via environment variable
    - GitHub CLI integration for automatic token generation
    - Git credentials support (stored tokens or Basic Auth)
  - Support for both local and remote repositories
  - Markdown-formatted output for readability
- Use token count estimation to switch gemini models to pro if repository is large to fit any other model
- Updates GitHub model names to latest versions
- Updates Perplexity model names to latest versions
- Added version command to display the current version of vibe-tools

### Fixed

- Improved GitHub authentication error handling and rate limit messages
- Better detection of stored GitHub tokens in git credentials
- Fixed authentication status messages to accurately reflect available methods

## [0.3.4] - 2025-02-05

### Fixed

- Fixed ESM compatibility issues with Node.js built-in modules
- Removed bundling of Node.js built-ins for better ESM support
- Reduced bundle size by externalizing Node.js core modules

## [0.3.3] - 2025-02-05

### Fixed

- Fixed dynamic require issues with Node.js built-in modules
- Updated build configuration to properly handle Node.js built-ins in ESM context

## [0.3.2] - 2025-02-05

### Fixed

- Fixed dynamic require of url module in ESM context
- Updated import-meta-url.js to use proper ESM imports

## [0.3.1] - 2025-02-05

### Changed

- Improved release process with dedicated release script
- Fixed ESM compatibility issues with dependencies
- Added better error handling for git operations during release

## [0.3.0] - 2025-02-05

### Changed

- Updated build configuration to output ES Module format for better Node.js 20+ compatibility
- Changed output file from CommonJS (.cjs) to ES Module (.mjs)
- Fixed ESM compatibility issues with dependencies

## [0.2.0] - 2025-02-05

### Added

- Added branch support for GitHub repositories in `doc` command
  - Support for specifying branch using `@branch` syntax (e.g. `--fromGithub=username/repo@branch`)
  - Works with both HTTPS URLs and shorthand format
  - Properly integrates with repomix API using the `ref` parameter

## [0.1.0] - 2025-02-04

### Added

- New `doc` command to generate comprehensive repository documentation
  - Support for local repository documentation generation
  - Support for remote GitHub repository documentation via `--fromGithub` option
  - Option to save documentation to file with `--output`
- Development mode support via `pnpm dev` for running latest code without building

### Changed

- Updated `.cursorrules` to include documentation for the new `doc` command
- Improved command-line argument parsing for better option handling

## [0.0.14] - Previous Release

Initial release with basic functionality:

- Web search using Perplexity AI
- Repository context-aware answers using Google Gemini
- Installation and configuration utilities

### Added

- **Document Web Url Integration**: Added `--with-doc <doc_url>` flag to `repo` and `doc` commands to fetch content from any web URL and include it as context.
- **YouTube Video Analysis**: Added `youtube` command for analyzing YouTube videos (summaries, transcripts, etc.).
