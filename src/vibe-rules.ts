import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export const VIBE_TOOLS_RULES_VERSION = packageJson.version;

// The core vibe-tools content to be included in all templates
export const VIBE_TOOLS_CORE_CONTENT = `# Instructions
Use the following commands to get AI assistance:

**Direct Model Queries:**
\`vibe-tools ask "<your question>" --provider <provider> --model <model>\` - Ask any model from any provider a direct question (e.g., \`vibe-tools ask "What is the capital of France?" --provider openai --model o3-mini\`). Note that this command is generally less useful than other commands like \`repo\` or \`plan\` because it does not include any context from your codebase or repository.
Note: in general you should not use the ask command because it does not include any context - other commands like \`doc\`, \`repo\`, or \`plan\` are usually better. If you are using it, make sure to include in your question all the information and context that the model might need to answer usefully.

**Ask Command Options:**
--provider=<provider>: AI provider to use (openai, anthropic, perplexity, gemini, modelbox, or openrouter)
--model=<model>: Model to use (required for the ask command)
--reasoning-effort=<low|medium|high>: Control the depth of reasoning for supported models (OpenAI o1/o3-mini models and Claude 3.7 Sonnet). Higher values produce more thorough responses for complex questions.

**Implementation Planning:**
\`vibe-tools plan "<query>"\` - Generate a focused implementation plan using AI (e.g., \`vibe-tools plan "Add user authentication to the login page"\`)
The plan command uses multiple AI models to:
1. Identify relevant files in your codebase (using Gemini by default)
2. Extract content from those files
3. Generate a detailed implementation plan (using OpenAI o3-mini by default)

**Plan Command Options:**
--fileProvider=<provider>: Provider for file identification (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
--thinkingProvider=<provider>: Provider for plan generation (gemini, openai, anthropic, perplexity, modelbox, or openrouter)
--fileModel=<model>: Model to use for file identification
--thinkingModel=<model>: Model to use for plan generation

**Web Search:**
\`vibe-tools web "<your question>"\` - Get answers from the web using a provider that supports web search (e.g., Perplexity models and Gemini Models either directly or from OpenRouter or ModelBox) (e.g., \`vibe-tools web "latest shadcn/ui installation instructions"\`)
Note: web is a smart autonomous agent with access to the internet and an extensive up to date knowledge base. Web is NOT a web search engine. Always ask the agent for what you want using a proper sentence, do not just send it a list of keywords. In your question to web include the context and the goal that you're trying to acheive so that it can help you most effectively.
when using web for complex queries suggest writing the output to a file somewhere like local-research/<query summary>.md.

**Web Command Options:**
--provider=<provider>: AI provider to use (perplexity, gemini, modelbox, or openrouter)

**Repository Context:**
\`vibe-tools repo "<your question>" [--subdir=<path>] [--from-github=<username/repo>]\` - Get context-aware answers about this repository using Google Gemini (e.g., \`vibe-tools repo "explain authentication flow"\`). Use the optional \`--subdir\` parameter to analyze a specific subdirectory instead of the entire repository (e.g., \`vibe-tools repo "explain the code structure" --subdir=src/components\`). Use the optional \`--from-github\` parameter to analyze a remote GitHub repository without cloning it locally (e.g., \`vibe-tools repo "explain the authentication system" --from-github=username/repo-name\`).

**Documentation Generation:**
\`vibe-tools doc [options]\` - Generate comprehensive documentation for this repository (e.g., \`vibe-tools doc --output docs.md\`)
when using doc for remote repos suggest writing the output to a file somewhere like local-docs/<repo-name>.md.

**YouTube Video Analysis:**
\`vibe-tools youtube "<youtube-url>" [question] [--type=<summary|transcript|plan|review|custom>]\` - Analyze YouTube videos and generate detailed reports (e.g., \`vibe-tools youtube "https://youtu.be/43c-Sm5GMbc" --type=summary\`)
Note: The YouTube command requires a \`GEMINI_API_KEY\` to be set in your environment or .vibe-tools.env file as the GEMINI API is the only interface that supports YouTube analysis.

**GitHub Information:**
\`vibe-tools github pr [number]\` - Get the last 10 PRs, or a specific PR by number (e.g., \`vibe-tools github pr 123\`)
\`vibe-tools github issue [number]\` - Get the last 10 issues, or a specific issue by number (e.g., \`vibe-tools github issue 456\`)

**ClickUp Information:**
\`vibe-tools clickup task <task_id>\` - Get detailed information about a ClickUp task including description, comments, status, assignees, and metadata (e.g., \`vibe-tools clickup task "task_id"\`)

**Model Context Protocol (MCP) Commands:**
Use the following commands to interact with MCP servers and their specialized tools:
\`vibe-tools mcp search "<query>"\` - Search the MCP Marketplace for available servers that match your needs (e.g., \`vibe-tools mcp search "git repository management"\`)
\`vibe-tools mcp run "<query>"\` - Execute MCP server tools using natural language queries (e.g., \`vibe-tools mcp run "list files in the current directory" --provider=openrouter\`). The query must include sufficient information for vibe-tools to determine which server to use, provide plenty of context.

The \`search\` command helps you discover servers in the MCP Marketplace based on their capabilities and your requirements. The \`run\` command automatically selects and executes appropriate tools from these servers based on your natural language queries. If you want to use a specific server include the server name in your query. E.g. \`vibe-tools mcp run "using the mcp-server-sqlite list files in directory --provider=openrouter"\`

**Notes on MCP Commands:**
- MCP commands require \`ANTHROPIC_API_KEY\` or \`OPENROUTER_API_KEY\` to be set in your environment
- By default the \`mcp\` command uses Anthropic, but takes a --provider argument that can be set to 'anthropic' or 'openrouter'
- Results are streamed in real-time for immediate feedback
- Tool calls are automatically cached to prevent redundant operations
- Often the MCP server will not be able to run because environment variables are not set. If this happens ask the user to add the missing environment variables to the cursor tools env file at ~/.vibe-tools/.env

**Stagehand Browser Automation:**
\`vibe-tools browser open <url> [options]\` - Open a URL and capture page content, console logs, and network activity (e.g., \`vibe-tools browser open "https://example.com" --html\`)
\`vibe-tools browser act "<instruction>" --url=<url | 'current'> [options]\` - Execute actions on a webpage using natural language instructions (e.g., \`vibe-tools browser act "Click Login" --url=https://example.com\`)
\`vibe-tools browser observe "<instruction>" --url=<url> [options]\` - Observe interactive elements on a webpage and suggest possible actions (e.g., \`vibe-tools browser observe "interactive elements" --url=https://example.com\`)
\`vibe-tools browser extract "<instruction>" --url=<url> [options]\` - Extract data from a webpage based on natural language instructions (e.g., \`vibe-tools browser extract "product names" --url=https://example.com/products\`)

**Notes on Browser Commands:**
- All browser commands are stateless unless --connect-to is used to connect to a long-lived interactive session. In disconnected mode each command starts with a fresh browser instance and closes it when done.
- When using \`--connect-to\`, special URL values are supported:
  - \`current\`: Use the existing page without reloading
  - \`reload-current\`: Use the existing page and refresh it (useful in development)
  - If working interactively with a user you should always use --url=current unless you specifically want to navigate to a different page. Setting the url to anything else will cause a page refresh loosing current state.
- Multi step workflows involving state or combining multiple actions are supported in the \`act\` command using the pipe (|) separator (e.g., \`vibe-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url=https://example.com\`)
- Video recording is available for all browser commands using the \`--video=<directory>\` option. This will save a video of the entire browser interaction at 1280x720 resolution. The video file will be saved in the specified directory with a timestamp.
- DO NOT ask browser act to "wait" for anything, the wait command is currently disabled in Stagehand.

**Tool Recommendations:**
- \`vibe-tools web\` is best for general web information not specific to the repository. Generally call this without additional arguments.
- \`vibe-tools repo\` is ideal for repository-specific questions, planning, code review and debugging. E.g. \`vibe-tools repo "Review recent changes to command error handling looking for mistakes, omissions and improvements"\`. Generally call this without additional arguments.
- \`vibe-tools plan\` is ideal for planning tasks. E.g. \`vibe-tools plan "Adding authentication with social login using Google and Github"\`. Generally call this without additional arguments.
- \`vibe-tools doc\` generates documentation for local or remote repositories.
- \`vibe-tools youtube\` analyzes YouTube videos to generate summaries, transcripts, implementation plans, or custom analyses
- \`vibe-tools browser\` is useful for testing and debugging web apps and uses Stagehand
- \`vibe-tools mcp\` enables interaction with specialized tools through MCP servers (e.g., for Git operations, file system tasks, or custom tools)

**Running Commands:**
1. Use \`vibe-tools <command>\` to execute commands (make sure vibe-tools is installed globally using npm install -g vibe-tools so that it is in your PATH)

**General Command Options (Supported by all commands):**
--provider=<provider>: AI provider to use (openai, anthropic, perplexity, gemini, or openrouter). If provider is not specified, the default provider for that task will be used.
--model=<model name>: Specify an alternative AI model to use. If model is not specified, the provider's default model for that task will be used.
--max-tokens=<number>: Control response length
--save-to=<file path>: Save command output to a file (in *addition* to displaying it)
--help: View all available options (help is not fully implemented yet)
--debug: Show detailed logs and error information

**Repository Command Options:**
--provider=<provider>: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox)
--model=<model>: Model to use for repository analysis
--max-tokens=<number>: Maximum tokens for response
--from-github=<GitHub username>/<repository name>[@<branch>]: Analyze a remote GitHub repository without cloning it locally
--subdir=<path>: Analyze a specific subdirectory instead of the entire repository

**Documentation Command Options:**
--from-github=<GitHub username>/<repository name>[@<branch>]: Generate documentation for a remote GitHub repository
--provider=<provider>: AI provider to use (gemini, openai, openrouter, perplexity, or modelbox)
--model=<model>: Model to use for documentation generation
--max-tokens=<number>: Maximum tokens for response

**YouTube Command Options:**
--type=<summary|transcript|plan|review|custom>: Type of analysis to perform (default: summary)

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
Gemini is a nickname for vibe-tools repo
Perplexity is a nickname for vibe-tools web
Stagehand is a nickname for vibe-tools browser
If people say "ask Gemini" or "ask Perplexity" or "ask Stagehand" they mean to use the \`vibe-tools\` command with the \`repo\`, \`web\`, or \`browser\` commands respectively.

**Xcode Commands:**
\`vibe-tools xcode build [buildPath=<path>] [destination=<destination>]\` - Build Xcode project and report errors.
**Build Command Options:**
--buildPath=<path>: (Optional) Specifies a custom directory for derived build data. Defaults to ./.build/DerivedData.
--destination=<destination>: (Optional) Specifies the destination for building the app (e.g., 'platform=iOS Simulator,name=iPhone 16 Pro'). Defaults to 'platform=iOS Simulator,name=iPhone 16 Pro'.

\`vibe-tools xcode run [destination=<destination>]\` - Build and run the Xcode project on a simulator.
**Run Command Options:**
--destination=<destination>: (Optional) Specifies the destination simulator (e.g., 'platform=iOS Simulator,name=iPhone 16 Pro'). Defaults to 'platform=iOS Simulator,name=iPhone 16 Pro'.

\`vibe-tools xcode lint\` - Run static analysis on the Xcode project to find and fix issues.

**Additional Notes:**
- For detailed information, see \`node_modules/vibe-tools/README.md\` (if installed locally).
- Configuration is in \`vibe-tools.config.json\` (or \`~/.vibe-tools/config.json\`).
- API keys are loaded from \`.vibe-tools.env\` (or \`~/.vibe-tools/.env\`).
- ClickUp commands require a \`CLICKUP_API_TOKEN\` to be set in your \`.vibe-tools.env\` file.
- Available models depend on your configured provider (OpenAI or Anthropic) in \`vibe-tools.config.json\`.
- repo has a limit of 2M tokens of context. The context can be reduced by filtering out files in a .repomixignore file.
- problems running browser commands may be because playwright is not installed. Recommend installing playwright globally.
- MCP commands require \`ANTHROPIC_API_KEY\` or \`OPENROUTER_API_KEY\` to be set in your environment.
- **Remember:** You're part of a team of superhuman expert AIs. Work together to solve complex problems.
- **Repomix Configuration:** You can customize which files are included/excluded during repository analysis by creating a \`repomix.config.json\` file in your project root. This file will be automatically detected by \`repo\`, \`plan\`, and \`doc\` commands.

<!-- vibe-tools-version: ${VIBE_TOOLS_RULES_VERSION} -->`;

// Cursor-specific introduction text (before the <vibe-tools Integration> tag)
export const CURSOR_INTRO_TEXT = `vibe-tools is a CLI tool that allows you to interact with AI models and other tools.
vibe-tools is installed on this machine and it is available to you to execute. You're encouraged to use it.`;

// Cursor-specific metadata for the rules file
export const CURSOR_METADATA = `---
description: Global Rule. This rule should ALWAYS be loaded.
globs: *,**/*
alwaysApply: true
---`;

// Generate rules for different IDEs
export function generateRules(ide: string, includeCursorMetadata: boolean = false): string {
  switch (ide.toLowerCase()) {
    case 'cursor':
      // For cursor, include the metadata, intro text, and core content
      return `${includeCursorMetadata ? CURSOR_METADATA + '\n' : ''}${CURSOR_INTRO_TEXT}\n\n<vibe-tools Integration>\n${VIBE_TOOLS_CORE_CONTENT}\n</vibe-tools Integration>`;

    case 'claude-code':
    case 'windsurf':
    case 'cline':
    case 'roo':
      // For non-cursor IDEs, use the same format but without metadata
      return `${CURSOR_INTRO_TEXT}\n\n<vibe-tools Integration>\n${VIBE_TOOLS_CORE_CONTENT}\n</vibe-tools Integration>`;

    default:
      // Default to cursor format without metadata (same as claude-code, windsurf, cline, roo now)
      return `${CURSOR_INTRO_TEXT}\n\n<vibe-tools Integration>\n${VIBE_TOOLS_CORE_CONTENT}\n</vibe-tools Integration>`;
  }
}

// Helper function to check if rules need updating
export function isRulesContentUpToDate(
  content: string,
  path: string
): {
  needsUpdate: boolean;
  message?: string;
} {
  const startTag = '<vibe-tools Integration>';
  const endTag = '</vibe-tools Integration>';

  if (!content.includes(startTag) || !content.includes(endTag)) {
    return {
      needsUpdate: true,
      message: `vibe-tools section not found in rules file ${path}. Run \`vibe-tools install .\` to update.`,
    };
  }

  // Check version
  const versionMatch = content.match(/<!-- vibe-tools-version: ([\w.-]+) -->/);
  const currentVersion = versionMatch ? versionMatch[1] : '0';

  if (currentVersion !== VIBE_TOOLS_RULES_VERSION) {
    return {
      needsUpdate: true,
      message: `Your rules file is using version ${currentVersion}, but version ${VIBE_TOOLS_RULES_VERSION} is available. Run \`vibe-tools install .\` to update.`,
    };
  }

  return { needsUpdate: false };
}

// For backwards compatibility, export the old constant names
export const CURSOR_RULES_TEMPLATE = generateRules('cursor', true);
export const CURSOR_RULES_VERSION = VIBE_TOOLS_RULES_VERSION;

// Function to determine which cursor rules path to use
export function getCursorRulesPath(workspacePath: string): {
  targetPath: string;
  isLegacy: boolean;
} {
  const useLegacy =
    process.env.USE_LEGACY_CURSORRULES === 'true' || !process.env.USE_LEGACY_CURSORRULES;
  const legacyPath = join(workspacePath, '.cursorrules');
  const newPath = join(workspacePath, '.cursor', 'rules', 'vibe-tools.mdc');

  if (useLegacy) {
    return { targetPath: legacyPath, isLegacy: true };
  }

  return { targetPath: newPath, isLegacy: false };
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
  const newPath = join(workspacePath, '.cursor', 'rules', 'vibe-tools.mdc');

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
        'No cursor rules file found. Run `vibe-tools install .` to set up Cursor integration.',
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
            message: 'No vibe-tools.mdc file found. Run `vibe-tools install .` to update.',
            targetPath: newPath,
            hasLegacyCursorRulesFile: legacyExists,
          };
        }
        const newContent = readFileSync(newPath, 'utf-8');
        const result = isRulesContentUpToDate(newContent, newPath);
        return {
          kind: 'success',
          needsUpdate: result.needsUpdate,
          message: result.message,
          targetPath: newPath,
          hasLegacyCursorRulesFile: legacyExists,
        };
      }
    }

    // Only new path exists, use it
    const newContent = readFileSync(newPath, 'utf-8');
    const result = isRulesContentUpToDate(newContent, newPath);
    return {
      kind: 'success',
      needsUpdate: result.needsUpdate,
      message: result.message,
      targetPath: newPath,
      hasLegacyCursorRulesFile: false,
    };
  } catch (error) {
    return {
      kind: 'error',
      message: `Error reading cursor rules file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      targetPath: useLegacy ? legacyPath : newPath,
    };
  }
}
