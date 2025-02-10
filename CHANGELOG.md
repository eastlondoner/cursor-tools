# Changelog

All notable changes to this project will be documented in this file.


## [Unreleased]

### Changed

- Browser commands (`open`, `act`, `observe`, `extract`) now have `--console` and `--network` options enabled by default. Use `--no-console` and `--no-network` to disable them. 
- Improved page reuse in browser commands when using `--connect-to`: now reuses existing tabs instead of creating new ones for better state preservation
- Improved error handling and type safety in cursor rules management
- Enhanced directory creation order in installation process

### Added
- Support for new Cursor IDE project rules structure
  - New installations now use `.cursor/rules/cursor-tools.mdc`
  - Maintain compatibility with legacy `.cursorrules` file
  - When both exist, prefer new path and show warning
  - Updated documentation to reflect new path structure
- Added support for the `gpt-4o` model in browser commands (`act`, `extract`, `observe`)
  - The model can be selected using the `--model=gpt-4o` command-line option
  - The default model can be configured in `cursor-tools.config.json`
  - If no model is specified, a default model is used based on the configured provider (OpenAI or Anthropic)
- **Internal:** Bundled Stagehand script directly into the codebase to prevent dependency issues
- **Build:** Added stagehand script verification to the release process

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
- Added version command to display the current version of cursor-tools

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