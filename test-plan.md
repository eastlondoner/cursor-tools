# Cursor-Tools Test Plan

## Purpose

This test plan aims to verify the functionality of cursor-tools commands, with particular focus on:

1. Features documented in the README
2. Recently changed functionality (from CHANGELOG)
3. Different models and providers across commands

## Recent Changes to Test

From the CHANGELOG, key areas to test include:

- MCP server overrides in the marketplace (both hardcoded and user-configured)
- Updated references to Claude 3.7 Sonnet models (from Claude 3.5)
- Updated @browserbasehq/stagehand dependency (1.13.0 to 1.13.1)
- Browser command state management with `--connect-to` and `reload-current`
- Default console and network options for browser commands
- New cursor rules directory structure (`.cursor/rules/cursor-tools.mdc`)
- Dual-provider architecture for `plan` command
- `--quiet` flag for suppressing stdout while saving to file

## Test Environment Setup

1. Required API keys:

   - Set up `.cursor-tools.env` with:
     - `PERPLEXITY_API_KEY`
     - `GEMINI_API_KEY`
     - `OPENAI_API_KEY` (for browser commands)
     - `ANTHROPIC_API_KEY` (for MCP commands and browser commands)
     - `GITHUB_TOKEN` (optional, for GitHub commands)

2. For browser command testing:
   - Install Playwright: `npm install --global playwright`
   - Start test server: `bun serve-test` (runs on http://localhost:3000)
   - Test files located in `tests/commands/browser/`

## Test Approach

For each command, we will:

1. Test basic functionality (positive tests)
2. Test error handling (negative tests)
3. Test with different providers where applicable
4. Test with different models where applicable
5. Verify output quality and correctness
6. Test recent changes and edge cases

## Commands to Test

### 1. Direct Model Queries (`ask`)

- Test with different providers (OpenAI, Anthropic, Perplexity, Gemini, ModelBox, OpenRouter)
- Verify Claude 3.7 Sonnet model works correctly (previously 3.5)
- Compare output quality across models
- Test error handling

#### Test Cases:

- Basic query: `cursor-tools ask "What is cursor-tools?" --provider openai --model o3-mini`
- Complex query: `cursor-tools ask "Explain the differences between REST and GraphQL" --provider anthropic --model claude-3-7-sonnet`
- Technical query: `cursor-tools ask "How does JavaScript event loop work?" --provider perplexity --model perplexity-online-latest`
- ModelBox query: `cursor-tools ask "What are the benefits of TypeScript?" --provider modelbox --model claude-3-7-sonnet`
- OpenRouter query: `cursor-tools ask "Explain the SOLID principles" --provider openrouter --model anthropic/claude-3-7-sonnet`

#### Error Handling Tests:

- Missing model: `cursor-tools ask "Test question" --provider openai` (should throw ModelNotFoundError)
- Missing provider: `cursor-tools ask "Test question" --model o3-mini` (should throw ProviderError)
- Invalid provider: `cursor-tools ask "Test question" --provider invalid-provider --model o3-mini` (should throw ProviderError)
- Invalid model: `cursor-tools ask "Test question" --provider openai --model invalid-model` (should throw ModelNotFoundError)

### 2. Web Search (`web`)

- Test with different providers (Perplexity, Gemini, ModelBox, OpenRouter)
- Test saving output to file
- Test with debug flag
- Test quiet flag

#### Test Cases:

- Current technology: `cursor-tools web "Latest TypeScript features" --provider perplexity`
- Technical documentation: `cursor-tools web "Next.js app router documentation" --provider gemini`
- Saving output: `cursor-tools web "cursor-tools installation guide" --save-to web-results.md`
- ModelBox provider: `cursor-tools web "React 19 new features" --provider modelbox --model claude-3-7-sonnet`
- OpenRouter provider: `cursor-tools web "Node.js best practices 2024" --provider openrouter`
- Debug flag: `cursor-tools web "TypeScript 5.7 features" --debug`
- Quiet flag with save: `cursor-tools web "Angular vs React in 2024" --save-to web-compare.md --quiet`

### 3. Repository Context (`repo`)

- Test with different providers and models
- Test on this repository
- Test with token limit considerations
- Test default Claude 3.7 model (previously 3.5)

#### Test Cases:

- Code explanation: `cursor-tools repo "Explain the MCP server override implementation"`
- Architecture question: `cursor-tools repo "How are providers implemented in the codebase?"`
- Different models: `cursor-tools repo "What's the structure of browser commands?" --provider openai --model o3-mini`
- ModelBox provider: `cursor-tools repo "Explain the dual-provider architecture for plan command" --provider modelbox`
- OpenRouter provider: `cursor-tools repo "How is cursor rule integration implemented?" --provider openrouter`
- Debug flag: `cursor-tools repo "Analyze error handling in the codebase" --debug`
- Quiet flag: `cursor-tools repo "Summarize recent changes" --save-to repo-changes.md --quiet`

### 4. Implementation Planning (`plan`)

- Test with different file and thinking providers
- Test with various combinations of models
- Test default thinking provider (OpenAI with o3-mini model)
- Test small and larger planning tasks

#### Test Cases:

- Basic plan: `cursor-tools plan "How to add a new command to cursor-tools?"`
- Default providers (verify o3-mini is used): `cursor-tools plan "Add a health check endpoint" --debug`
- Split providers: `cursor-tools plan "Implement a health check endpoint" --fileProvider gemini --thinkingProvider openai --thinkingModel o3-mini`
- Complex task: `cursor-tools plan "Implement TypeScript strict mode across the codebase" --fileProvider gemini --thinkingProvider anthropic --thinkingModel claude-3-7-sonnet`
- ModelBox provider: `cursor-tools plan "Add support for a new AI provider" --fileProvider modelbox --thinkingProvider modelbox`
- OpenRouter provider: `cursor-tools plan "Implement a new browser command feature" --fileProvider openrouter --thinkingProvider openrouter`
- Quiet flag: `cursor-tools plan "Refactor error handling" --save-to plan-errors.md --quiet`

### 5. Documentation Generation (`doc`)

- Test local repository documentation
- Test remote GitHub repository documentation
- Test with different hints for focused documentation
- Test with different models including Claude 3.7 Sonnet

#### Test Cases:

- Local repo: `cursor-tools doc --save-to repo-docs.md`
- Remote repo: `cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to cursor-tools-docs.md`
- Focused docs: `cursor-tools doc --hint="Focus on browser commands" --save-to browser-docs.md`
- With Anthropic provider: `cursor-tools doc --provider anthropic --model claude-3-7-sonnet --save-to anthropic-docs.md`
- With specific branch: `cursor-tools doc --from-github=eastlondoner/cursor-tools@main --save-to main-docs.md`
- Quiet flag: `cursor-tools doc --from-github=eastlondoner/cursor-tools --save-to docs.md --quiet`

### 6. GitHub Integration

- Test PR listing
- Test issue listing
- Test specific PR and issue viewing
- Test remote repository specification

#### Test Cases:

- List PRs: `cursor-tools github pr`
- List issues: `cursor-tools github issue`
- View specific PR: `cursor-tools github pr 1` (if available)
- View specific issue: `cursor-tools github issue 1` (if available)
- From remote repo: `cursor-tools github pr --from-github=eastlondoner/cursor-tools`
- Quiet flag: `cursor-tools github pr --save-to prs.md --quiet`

### 7. Browser Automation

- Test each browser subcommand (open, act, observe, extract)
- Test with updated Stagehand dependency
- Test with different models including Claude 3.7 Sonnet
- Test default console and network options
- Test state persistence with `--connect-to` and `reload-current`

#### Test Cases:

- Open webpage: `cursor-tools browser open "https://example.com" --html`
- Default console/network: `cursor-tools browser open "http://localhost:3000/test-logging.html"` (verify console/network logs are captured)
- Disable console/network: `cursor-tools browser open "http://localhost:3000/test-logging.html" --no-console --no-network` (verify logs are not captured)
- Perform action: `cursor-tools browser act "Click on the first link" --url "https://example.com" --model claude-3-7-sonnet-latest`
- Default model: `cursor-tools browser act "Click the submit button" --url "http://localhost:3000/test-form.html" --provider anthropic` (verify claude-3-7-sonnet is used)
- Observe page: `cursor-tools browser observe "What interactive elements are visible?" --url "https://example.com"`
- Extract data: `cursor-tools browser extract "Get all heading text" --url "https://example.com"`

#### State Persistence Test Sequence:

1. `cursor-tools browser open "http://localhost:3000/test-state.html" --connect-to=9222`
2. `cursor-tools browser act "Click the 'Counter' button" --url=current --connect-to=9222` (verify state is maintained)
3. `cursor-tools browser act "Check the counter value" --url=current --connect-to=9222` (verify state persisted from previous action)
4. `cursor-tools browser act "Click the 'Counter' button" --url=reload-current --connect-to=9222` (verify reload works while maintaining connection)
5. `cursor-tools browser act "Check the counter value" --url=current --connect-to=9222` (verify counter was reset after reload)

### 8. MCP Commands

- Test MCP search functionality
- Test MCP run with overrides (recent feature)
- Test different MCP servers
- Test both hardcoded and user-configured overrides

#### Test Cases:

- Search: `cursor-tools mcp search "git operations"`
- Run command: `cursor-tools mcp run "list files in the current directory"`
- Hardcoded override: `cursor-tools mcp run "using google-calendar-mcp list upcoming events"` (testing the eastlondoner fork override)

#### User-Configured Override Test:

1. Temporarily modify `cursor-tools.config.json` to add user override:
   ```json
   {
     "mcp": {
       "overrides": {
         "test-mcp-server": {
           "githubUrl": "https://github.com/example/test-mcp-server",
           "command": "custom-command",
           "args": []
         }
       }
     }
   }
   ```
2. Run: `cursor-tools mcp run "using test-mcp-server perform test action"`
3. Verify that the user-configured override is applied (check logs)
4. Restore original `cursor-tools.config.json`

### 9. Installation and Cursor Rules

- Test cursor rules installation with different environment settings
- Test new `.cursor/rules/cursor-tools.mdc` file creation
- Test legacy `.cursorrules` file creation

#### Test Cases:

- New cursor rules format: `USE_LEGACY_CURSORRULES=false cursor-tools install .` (verify `.cursor/rules/cursor-tools.mdc` is created/updated)
- Legacy cursor rules format: `USE_LEGACY_CURSORRULES=true cursor-tools install .` (verify `.cursorrules` is created/updated)
- Default behavior: `cursor-tools install .` (verify correct file is updated based on default behavior)

## Test Execution Plan

1. Set up environment with all required API keys
2. Start test server for browser testing: `bun serve-test`
3. Execute tests for each command category
4. For each test:
   - Document command executed
   - Record output
   - Verify debug output when `--debug` flag is used
   - Verify no stdout output when `--quiet` flag is used
   - Confirm file output when `--save-to` is used
   - Note any errors or unexpected behavior
   - Assess response quality and correctness
5. Test environment cleanup

## Success Criteria

### General Criteria

- All commands execute without unexpected errors
- Output quality meets expectations
- Different providers and models can be successfully used
- Debug output is informative when `--debug` flag is used
- No stdout output occurs when `--quiet` flag is used with `--save-to`
- File output is correct when `--save-to` is used

### Recent Changes Validation

- Claude 3.7 Sonnet model works correctly in all commands (replacing Claude 3.5)
- MCP server overrides (both hardcoded and user-configured) function correctly
- Browser commands with Stagehand 1.13.1 function correctly
- Console and network logs are captured by default in browser commands
- Browser state is maintained correctly when using `--connect-to=current`
- Browser state is reset correctly when using `--connect-to=reload-current`
- Default thinking provider for plan command is OpenAI with o3-mini model
- Cursor rules are installed to the correct location based on `USE_LEGACY_CURSORRULES`
- Error messages are user-friendly and informative across all commands
