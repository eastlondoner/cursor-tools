import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export const CURSOR_RULES_VERSION = packageJson.version; // Using version from package.json

// Function to determine which cursor rules path to use
export function getCursorRulesPath(workspacePath: string): {
  targetPath: string;
  isLegacy: boolean;
} {
  const useLegacy =
    process.env.USE_LEGACY_CURSORRULES === 'true' || !process.env.USE_LEGACY_CURSORRULES;
  const legacyPath = join(workspacePath, '.cursorrules');
  const newPath = join(workspacePath, '.cursor', 'rules', 'cursor-tools.mdc');

  if (useLegacy) {
    return { targetPath: legacyPath, isLegacy: true };
  }

  return { targetPath: newPath, isLegacy: false };
}

export const CURSOR_RULES_TEMPLATE = `---
description: Global Rule. This rule should ALWAYS be loaded.
globs: *,**/*
alwaysApply: true
---
cursor-tools is a CLI tool that allows you to interact with AI models and other tools.
cursor-tools is installed on this machine and it is available to you to execute. You're encouraged to use it.

<cursor-tools Integration>
# Instructions
Use the following commands to get AI assistance:

**Direct Model Queries:**
\`cursor-tools ask "<your question>" --provider <provider> --model <model>\` - Ask any model from any provider a direct question (e.g., \`cursor-tools ask "What is the capital of France?" --provider openai --model o3-mini\`). Note that this command is generally less useful than other commands like \`repo\` or \`plan\` because it does not include any context from your codebase or repository.

**Implementation Planning:**
\`cursor-tools plan "<query>"\` - Generate a focused implementation plan using AI (e.g., \`cursor-tools plan "Add user authentication to the login page"\`)
The plan command uses multiple AI models to:
1. Identify relevant files in your codebase (using Gemini by default)
2. Extract content from those files
3. Generate a detailed implementation plan (using OpenAI o3-mini by default)

**Plan Command Options:**
--fileProvider=<provider>: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
--thinkingProvider=<provider>: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
--fileModel=<model>: Model to use for file identification
--thinkingModel=<model>: Model to use for plan generation
--debug: Show detailed error information

**Web Search:**
\`cursor-tools web "<your question>"\` - Get answers from the web using a provider that supports web search (e.g., Perplexity models and Gemini Models either directly or from OpenRouter or ModelBox) (e.g., \`cursor-tools web "latest shadcn/ui installation instructions"\`)
when using web for complex queries suggest writing the output to a file somewhere like local-research/<query summary>.md.

**Web Command Options:**
--provider=<provider>: AI provider to use (perplexity, gemini, modelbox, or openrouter)
--model=<model>: Model to use for web search (model name depends on provider)
--max-tokens=<number>: Maximum tokens for response

**Repository Context:**
\`cursor-tools repo "<your question>"\` - Get context-aware answers about this repository using Google Gemini (e.g., \`cursor-tools repo "explain authentication flow"\`)

**Documentation Generation:**
\`cursor-tools doc [options]\` - Generate comprehensive documentation for this repository (e.g., \`cursor-tools doc --output docs.md\`)
when using doc for remote repos suggest writing the output to a file somewhere like local-docs/<repo-name>.md.

**GitHub Information:**
\`cursor-tools github pr [number]\` - Get the last 10 PRs, or a specific PR by number (e.g., \`cursor-tools github pr 123\`)
\`cursor-tools github issue [number]\` - Get the last 10 issues, or a specific issue by number (e.g., \`cursor-tools github issue 456\`)

**ClickUp Information:**
\`cursor-tools clickup task <task_id>\` - Get detailed information about a ClickUp task including description, comments, status, assignees, and metadata (e.g., \`cursor-tools clickup task "task_id"\`)

**Model Context Protocol (MCP) Commands:**
Use the following commands to interact with MCP servers and their specialized tools:
\`cursor-tools mcp search "<query>"\` - Search the MCP Marketplace for available servers that match your needs (e.g., \`cursor-tools mcp search "git repository management"\`)
\`cursor-tools mcp run "<query>"\` - Execute MCP server tools using natural language queries (e.g., \`cursor-tools mcp run "list files in the current directory"\`). The query must include sufficient information for cursor-tools to determine which server to use, provide plenty of context.

The \`search\` command helps you discover servers in the MCP Marketplace based on their capabilities and your requirements. The \`run\` command automatically selects and executes appropriate tools from these servers based on your natural language queries. If you want to use a specific server include the server name in your query. E.g. \`cursor-tools mcp run "using the mcp-server-sqlite list files in directory"
The \`run\` command will automatically download, checkout or clone MCP servers and initialize them for you. You do NOT need to separately install or clone or checkout an MCP server if you're going to run it with cursor-tools, even if the README of the MCP server says that you need to.

**Notes on MCP Commands:**
- MCP commands require \`ANTHROPIC_API_KEY\` to be set in your environment
- Results are streamed in real-time for immediate feedback
- Tool calls are automatically cached to prevent redundant operations
- Often the MCP server will not be able to run because environment variables are not set. If this happens ask the user to add the missing environment variables to the cursor tools env file at ~/.cursor-tools/.env

**Stagehand Browser Automation:**
\`cursor-tools browser open <url> [options]\` - Open a URL and capture page content, console logs, and network activity (e.g., \`cursor-tools browser open "https://example.com" --html\`)
\`cursor-tools browser act "<instruction>" --url=<url | 'current'> [options]\` - Execute actions on a webpage using natural language instructions (e.g., \`cursor-tools browser act "Click Login" --url=https://example.com\`)
\`cursor-tools browser observe "<instruction>" --url=<url> [options]\` - Observe interactive elements on a webpage and suggest possible actions (e.g., \`cursor-tools browser observe "interactive elements" --url=https://example.com\`)
\`cursor-tools browser extract "<instruction>" --url=<url> [options]\` - Extract data from a webpage based on natural language instructions (e.g., \`cursor-tools browser extract "product names" --url=https://example.com/products\`)

**Notes on Browser Commands:**
- All browser commands are stateless unless --connect-to is used to connect to a long-lived interactive session. In disconnected mode each command starts with a fresh browser instance and closes it when done.
- When using \`--connect-to\`, special URL values are supported:
  - \`current\`: Use the existing page without reloading
  - \`reload-current\`: Use the existing page and refresh it (useful in development)
  - If working interactively with a user you should always use --url=current unless you specifically want to navigate to a different page. Setting the url to anything else will cause a page refresh loosing current state.
- Multi step workflows involving state or combining multiple actions are supported in the \`act\` command using the pipe (|) separator (e.g., \`cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url=https://example.com\`)
- Video recording is available for all browser commands using the \`--video=<directory>\` option. This will save a video of the entire browser interaction at 1280x720 resolution. The video file will be saved in the specified directory with a timestamp.
- DO NOT ask browser act to "wait" for anything, the wait command is currently disabled in Stagehand.

**Tool Recommendations:**
- \`cursor-tools web\` is best for general web information not specific to the repository. Generally call this without additional arguments.
- \`cursor-tools repo\` is ideal for repository-specific questions, planning, code review and debugging. E.g. \`cursor-tools repo "Review recent changes to command error handling looking for mistakes, omissions and improvements"\`. Generally call this without additional arguments.
- \`cursor-tools plan\` is ideal for planning tasks. E.g. \`cursor-tools plan "Adding authentication with social login using Google and Github"\`. Generally call this without additional arguments.
- \`cursor-tools doc\` generates documentation for local or remote repositories.
- \`cursor-tools browser\` is useful for testing and debugging web apps and uses Stagehand
- \`cursor-tools mcp\` enables interaction with specialized tools through MCP servers (e.g., for Git operations, file system tasks, or custom tools)

**Running Commands:**
1. Use \`cursor-tools <command>\` to execute commands (make sure cursor-tools is installed globally using npm install -g cursor-tools so that it is in your PATH)

**General Command Options (Supported by all commands):**
--provider=<provider>: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
--model=<model name>: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
--max-tokens=<number>: Control response length
--save-to=<file path>: Save command output to a file (in *addition* to displaying it)
--help: View all available options (help is not fully implemented yet)

**Repository Command Options:**
--provider=<provider>: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox)
--model=<model>: Model to use for repository analysis
--max-tokens=<number>: Maximum tokens for response

**Documentation Command Options:**
--from-github=<GitHub username>/<repository name>[@<branch>]: Generate documentation for a remote GitHub repository
--provider=<provider>: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox)
--model=<model>: Model to use for documentation generation
--max-tokens=<number>: Maximum tokens for response

**GitHub Command Options:**
--from-github=<GitHub username>/<repository name>[@<branch>]: Access PRs/issues from a specific GitHub repository

**Browser Command Options (for 'open', 'act', 'observe', 'extract'):**
--console: Capture browser console logs (enabled by default, use --no-console to disable)
--html: Capture page HTML content (disabled by default)
--network: Capture network activity (enabled by default, use --no-network to disable)
--screenshot=<file path>: Save a screenshot of the page
--timeout=<milliseconds>: Set navigation timeout (default: 120000ms for Stagehand operations, 30000ms for navigation)
--viewport=<width>x<height>: Set viewport size (e.g., 1280x720). When using --connect-to, viewport is only changed if this option is explicitly provided
--headless: Run browser in headless mode (default: true)
--no-headless: Show browser UI (non-headless mode) for debugging
--connect-to=<port>: Connect to existing Chrome instance. Special values: 'current' (use existing page), 'reload-current' (refresh existing page)
--wait=<time:duration or selector:css-selector>: Wait after page load (e.g., 'time:5s', 'selector:#element-id')
--video=<directory>: Save a video recording (1280x720 resolution, timestamped subdirectory). Not available when using --connect-to
--url=<url>: Required for \`act\`, \`observe\`, and \`extract\` commands. Url to navigate to before the main command or one of the special values 'current' (to stay on the current page without navigating or reloading) or 'reload-current' (to reload the current page)
--evaluate=<string>: JavaScript code to execute in the browser before the main command

**Nicknames**
Users can ask for these tools using nicknames
Gemini is a nickname for cursor-tools repo
Perplexity is a nickname for cursor-tools web
Stagehand is a nickname for cursor-tools browser

**Xcode Commands:**
\`cursor-tools xcode build [buildPath=<path>] [destination=<destination>]\` - Build Xcode project and report errors.
**Build Command Options:**
--buildPath=<path>: (Optional) Specifies a custom directory for derived build data. Defaults to ./.build/DerivedData.
--destination=<destination>: (Optional) Specifies the destination for building the app (e.g., 'platform=iOS Simulator,name=iPhone 16 Pro'). Defaults to 'platform=iOS Simulator,name=iPhone 16 Pro'.

\`cursor-tools xcode run [destination=<destination>]\` - Build and run the Xcode project on a simulator.
**Run Command Options:**
--destination=<destination>: (Optional) Specifies the destination simulator (e.g., 'platform=iOS Simulator,name=iPhone 16 Pro'). Defaults to 'platform=iOS Simulator,name=iPhone 16 Pro'.

\`cursor-tools xcode lint\` - Run static analysis on the Xcode project to find and fix issues.

**Additional Notes:**
- For detailed information, see \`node_modules/cursor-tools/README.md\` (if installed locally).
- Configuration is in \`cursor-tools.config.json\` (or \`~/.cursor-tools/config.json\`).
- API keys are loaded from \`.cursor-tools.env\` (or \`~/.cursor-tools/.env\`).
- ClickUp commands require a \`CLICKUP_API_TOKEN\` to be set in your \`.cursor-tools.env\` file.
- The default Stagehand model is set in \`cursor-tools.config.json\`, but can be overridden with the \`--model\` option.
- Available models depend on your configured provider (OpenAI or Anthropic) in \`cursor-tools.config.json\`.
- repo has a limit of 2M tokens of context. The context can be reduced by filtering out files in a .repomixignore file.
- problems running browser commands may be because playwright is not installed. Recommend installing playwright globally.
- MCP commands require \`ANTHROPIC_API_KEY\` to be set in your environment.
- **Remember:** You're part of a team of superhuman expert AIs. Work together to solve complex problems.

<!-- cursor-tools-version: ${CURSOR_RULES_VERSION} -->
</cursor-tools Integration>`;

function isCursorRulesContentUpToDate(content: string) {
  const startTag = '<cursor-tools Integration>';
  const endTag = '</cursor-tools Integration>';
  if (!content.includes(startTag) || !content.includes(endTag)) {
    return {
      needsUpdate: true as const,
      message:
        'cursor-tools section not found in cursor rules. Run `cursor-tools install .` to update.',
    };
  }

  // Check version
  const versionMatch = content.match(/<!-- cursor-tools-version: ([\w.-]+) -->/);
  const currentVersion = versionMatch ? versionMatch[1] : '0';

  if (currentVersion !== CURSOR_RULES_VERSION) {
    return {
      needsUpdate: true as const,
      message: `Your cursor rules file is using version ${currentVersion}, but version ${CURSOR_RULES_VERSION} is available. Run \`cursor-tools install .\` to update.`,
    };
  }

  return { needsUpdate: false as const };
}

// Add new types for better error handling and type safety
type CursorRulesError = {
  kind: 'error';
  message: string;
  targetPath: string;
};

type CursorRulesSuccess = {
  kind: 'success';
  needsUpdate: boolean;
  message?: string;
  targetPath: string;
  hasLegacyCursorRulesFile: boolean;
};

type CursorRulesResult = CursorRulesError | CursorRulesSuccess;

export function checkCursorRules(workspacePath: string): CursorRulesResult {
  const legacyPath = join(workspacePath, '.cursorrules');
  const newPath = join(workspacePath, '.cursor', 'rules', 'cursor-tools.mdc');

  const legacyExists = existsSync(legacyPath);
  const newExists = existsSync(newPath);

  const useLegacy =
    process.env.USE_LEGACY_CURSORRULES === 'true' || !process.env.USE_LEGACY_CURSORRULES;

  // If neither exists, prefer new path
  if (!legacyExists && !newExists) {
    return {
      kind: 'success',
      needsUpdate: true,
      message:
        'No cursor rules file found. Run `cursor-tools install .` to set up Cursor integration.',
      targetPath: useLegacy ? legacyPath : newPath,
      hasLegacyCursorRulesFile: false,
    };
  }

  try {
    // If both exist, prioritize based on USE_LEGACY_CURSORRULES
    if (legacyExists) {
      if (useLegacy) {
        readFileSync(legacyPath, 'utf-8'); // Read to check if readable
        return {
          kind: 'success',
          needsUpdate: true, // Always true for legacy
          targetPath: legacyPath,
          hasLegacyCursorRulesFile: true,
        };
      } else {
        if (!newExists) {
          return {
            kind: 'success',
            needsUpdate: true,
            message: 'No cursor-tools.mdc file found. Run `cursor-tools install .` to update.',
            targetPath: newPath,
            hasLegacyCursorRulesFile: legacyExists,
          };
        }
        const newContent = readFileSync(newPath, 'utf-8');
        const result = isCursorRulesContentUpToDate(newContent);
        return {
          kind: 'success',
          ...result,
          targetPath: newPath,
          hasLegacyCursorRulesFile: legacyExists,
        };
      }
    }

    // If only new path exists
    if (newExists) {
      const newContent = readFileSync(newPath, 'utf-8');
      const result = isCursorRulesContentUpToDate(newContent);
      return {
        kind: 'success',
        ...result,
        targetPath: newPath,
        hasLegacyCursorRulesFile: false,
      };
    }

    // Otherwise only legacy path exists
    const legacyContent = readFileSync(legacyPath, 'utf-8');
    const result = isCursorRulesContentUpToDate(legacyContent);
    return {
      kind: 'success',
      ...result,
      targetPath: legacyPath,
      hasLegacyCursorRulesFile: true,
    };
  } catch (error) {
    return {
      kind: 'error',
      message: `Error reading cursor rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
      targetPath: newPath,
    };
  }
}
