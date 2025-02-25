import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../../types';
import { OpenCommand } from './open.ts';
import { ElementCommand } from './element.ts';
import { ActCommand } from './stagehand/act.ts';
import { ExtractCommand } from './stagehand/extract.ts';
import { ObserveCommand } from './stagehand/observe.ts';

export class BrowserCommand implements Command {
  private subcommands: CommandMap = {
    open: new OpenCommand(),
    element: new ElementCommand(),
    act: new ActCommand(),
    extract: new ExtractCommand(),
    observe: new ObserveCommand(),
    help: {
      execute: async function* (this: BrowserCommand, _: string, options: CommandOptions) {
        yield this.getHelp();
      }.bind(this),
    },
  };

  getDescription(): string {
    return 'Automate browser actions and extract web content';
  }

  getHelp(): string {
    return `Browser Command - Automate browser actions and extract web content

Usage: cursor-tools browser <subcommand> [args] [options]

Subcommands:
  open <url>                Open URL and capture page content
  act "<instruction>"       Execute actions on a webpage
  observe "<instruction>"   Observe interactive elements
  extract "<instruction>"   Extract data from a webpage
  help                      Show this help message

Common Options:
  --url=<url>              URL to navigate to (required for act/observe/extract)
  --console                Capture browser console logs (default: true)
  --html                   Capture page HTML content
  --network               Capture network activity (default: true)
  --screenshot=<path>      Save a screenshot of the page
  --timeout=<ms>          Set navigation timeout (default: 30000ms)
  --viewport=<WxH>        Set viewport size (e.g., 1280x720)
  --headless              Run browser in headless mode (default: true)
  --no-headless          Show browser UI for debugging
  --connect-to=<port>     Connect to existing Chrome instance
  --video=<directory>     Save a video recording (1280x720)

Examples:
  cursor-tools browser open "https://example.com" --html
  cursor-tools browser act "Click Login" --url=https://example.com
  cursor-tools browser act "Click Login | Type 'user@example.com' into email | Click Submit" --url=https://example.com
  cursor-tools browser observe "interactive elements" --url=https://example.com
  cursor-tools browser extract "product names" --url=https://example.com/products
  cursor-tools browser help                 # Show this help message

Notes:
- All commands are stateless unless using --connect-to
- Special URL values with --connect-to:
  - 'current': Use existing page without reload
  - 'reload-current': Use existing page and refresh
- Multi-step actions supported with pipe (|) separator
- Video recording available for all commands
- DO NOT use "wait" in act instructions

Dependencies:
- Requires Playwright: npm install -g playwright
- Uses Stagehand for browser automation`;
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    // If no subcommand provided or help requested, show help
    if (!subcommand || subcommand === 'help' || options.help) {
      yield* this.subcommands.help.execute('', options);
      return;
    }

    const subCommandHandler = this.subcommands[subcommand];
    try {
      if (subCommandHandler) {
        yield* subCommandHandler.execute(subQuery, options);
      } else {
        yield `Unknown browser subcommand: ${subcommand}. Available subcommands: open, element, act, extract, observe, help`;
      }
    } catch (error) {
      console.error('Error executing browser command', error);
      throw error;
    }
  }
}
