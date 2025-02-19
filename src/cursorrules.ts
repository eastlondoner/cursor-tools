import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export const CURSOR_RULES_VERSION = packageJson.version; // Using version from package.json

export const CURSOR_RULES_TEMPLATE = `---
description: Global Rule
globs: 
---

<cursor-tools Integration>
# Instructions
Use the following commands to get AI assistance:

**Web Search:**
\`cursor-tools web "<your question>"\` - Get answers from the web using Perplexity AI (e.g., \`cursor-tools web "latest weather in London"\`)
when using web for complex queries suggest writing the output to a file somewhere like local-research/<query summary>.md.

**Repository Context:**
\`cursor-tools repo "<your question>"\` - Get context-aware answers about this repository using Google Gemini (e.g., \`cursor-tools repo "explain authentication flow"\`)

**Documentation Generation:**
\`cursor-tools doc [options]\` - Generate comprehensive documentation for this repository (e.g., \`cursor-tools doc --output docs.md\`)
when using doc for remote repos suggest writing the output to a file somewhere like local-docs/<repo-name>.md.

**GitHub Information:**
\`cursor-tools github pr [number]\` - Get the last 10 PRs, or a specific PR by number (e.g., \`cursor-tools github pr 123\`)
\`cursor-tools github issue [number]\` - Get the last 10 issues, or a specific issue by number (e.g., \`cursor-tools github issue 456\`)

**Browser Automation (Stateless):**
\`cursor-tools browser open <url> [options]\` - Open a URL and capture page content, console logs, and network activity (e.g., \`cursor-tools browser open "https://example.com" --html\`)
\`cursor-tools browser act "<instruction>" --url=<url> [options]\` - Execute actions on a webpage using natural language instructions (e.g., \`cursor-tools browser act "Click Login" --url=https://example.com\`)
\`cursor-tools browser observe "<instruction>" --url=<url> [options]\` - Observe interactive elements on a webpage and suggest possible actions (e.g., \`cursor-tools browser observe "interactive elements" --url=https://example.com\`)
\`cursor-tools browser extract "<instruction>" --url=<url> [options]\` - Extract data from a webpage based on natural language instructions (e.g., \`cursor-tools browser extract "product names" --url=https://example.com/products\`)
\`cursor-tools browser vision <image_path> [options]\` - Analyze a screenshot for visual issues and UI/UX problems (e.g., \`cursor-tools browser vision screenshot.png --context=page.html\`)

**Notes on Browser Commands:**
- All browser commands are stateless unless --connect-to is used to connect to a long-lived interactive session. In disconnected mode each command starts with a fresh browser instance and closes it when done.
- When using \`--connect-to\`, special URL values are supported:
  - \`current\`: Use the existing page without reloading
  - \`reload-current\`: Use the existing page and refresh it (useful in development)
- Multi step workflows involving state or combining multiple actions are supported in the \`act\` command using the pipe (|) separator (e.g., \`cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url=https://example.com\`)
- Video recording is available for all browser commands using the \`--video=<directory>\` option. This will save a video of the entire browser interaction at 1280x720 resolution. The video file will be saved in the specified directory with a timestamp.
- DO NOT ask browser act to "wait" for anything, the wait command is currently disabled in Stagehand.

**Vision Command Options:**
--prompt="<custom prompt>": Provide a custom analysis prompt (default focuses on UI/UX issues)
--context=<file path>: Include HTML, CSS, or JS files for context (e.g., \`--context=page.html\` or \`--context=html:page.html,css:styles.css\`)
--save-to=<file path>: Save analysis output to a file
--debug: Enable debug output for troubleshooting
--model=<model name>: Use a specific Gemini model (default: gemini-pro-vision)

**Tool Recommendations:**
- \`cursor-tools web\` is best for general web information not specific to the repository.
- \`cursor-tools repo\` is ideal for repository-specific questions, planning, code review and debugging.
- \`cursor-tools doc\` generates documentation for local or remote repositories.
- \`cursor-tools browser\` is useful for testing and debugging web apps.
- \`cursor-tools browser vision\` is perfect for UI/UX reviews and visual QA, especially with HTML context.

**Running Commands:**
1. **Installed version:** Use \`cursor-tools <command>\` (if in PATH) or \`npm exec cursor-tools "<command>"\`, \`yarn cursor-tools "<command>"\`, \`pnpm cursor-tools "<command>"\`.
2. **Without installation:** Use \`npx -y cursor-tools@latest "<command>"\` or \`bunx -y cursor-tools@latest "<command>"\`.

**General Command Options (Supported by all commands):**
--model=<model name>: Specify an alternative AI model to use.
--max-tokens=<number>: Control response length
--save-to=<file path>: Save command output to a file (in *addition* to displaying it)
--help: View all available options (help is not fully implemented yet)

**Documentation Command Options:**
--from-github=<GitHub username>/<repository name>[@<branch>]: Generate documentation for a remote GitHub repository

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

**Nicknames**
Users can ask for these tools using nicknames
Gemini is a nickname for cursor-tools repo
Perplexity is a nickname for cursor-tools web
Stagehand is a nickname for cursor-tools browser

**Additional Notes:**
- For detailed information, see \`node_modules/cursor-tools/README.md\` (if installed locally).
- Configuration is in \`cursor-tools.config.json\` (or \`~/.cursor-tools/config.json\`).
- API keys are loaded from \`.cursor-tools.env\` (or \`~/.cursor-tools/.env\`).
- Browser commands require separate installation of Playwright: \`npm install --save-dev playwright\` or \`npm install -g playwright\`.
- The default Stagehand model is set in \`cursor-tools.config.json\`, but can be overridden with the \`--model\` option.
- Available models depend on your configured provider (OpenAI or Anthropic) in \`cursor-tools.config.json\`.
- repo has a limit of 2M tokens of context. The context can be reduced by filtering out files in a .repomixignore file.
- problems running browser commands may be because playwright is not installed. Recommend installing playwright globally.
- Vision command requires a GEMINI_API_KEY in your .cursor-tools.env file.
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

  // Check if either file exists
  const legacyExists = existsSync(legacyPath);
  const newExists = existsSync(newPath);

  // If neither exists, prefer new path
  if (!legacyExists && !newExists) {
    return {
      kind: 'success',
      needsUpdate: true,
      message:
        'No cursor rules file found. Run `cursor-tools install .` to set up Cursor integration.',
      targetPath: newPath,
      hasLegacyCursorRulesFile: false,
    };
  }

  try {
    // If both exist, check new path first
    if (newExists && legacyExists) {
      const newContent = readFileSync(newPath, 'utf-8');
      const result = isCursorRulesContentUpToDate(newContent);
      return {
        kind: 'success',
        ...result,
        targetPath: newPath,
        hasLegacyCursorRulesFile: true,
      };
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
