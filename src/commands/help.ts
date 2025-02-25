import { Command, CommandOptions, CommandGenerator } from '../types.ts';
import { commands } from './index.ts';

export class HelpCommand implements Command {
  getDescription(): string {
    return 'Show help information for commands';
  }

  getHelp(): string {
    return `Help Command - Show help information for commands

Usage: cursor-tools help [command]

Arguments:
  command   Optional command name to get detailed help for

Examples:
  cursor-tools help              # Show general help
  cursor-tools help xcode        # Show help for xcode command
  cursor-tools help browser      # Show help for browser command
  cursor-tools help repo         # Show help for repo command

Available Commands:
${this.getCommandList()}

For detailed help on a specific command, run:
  cursor-tools help <command>
  cursor-tools instructions     Get complete documentation and examples

Notes:
- Use --help flag with any command for quick help
- Each command may have its own specific options
- See command-specific help for detailed usage
- Visit GitHub repository for full documentation`;
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    // If a specific command is provided, show help for that command
    if (query) {
      const command = commands[query];
      if (!command) {
        yield `Unknown command: ${query}\n`;
        yield `Available commands: ${Object.keys(commands).join(', ')}\n`;
        return;
      }
      
      // Get help text from the command if it has a getHelp method
      if ('getHelp' in command && typeof command.getHelp === 'function') {
        yield command.getHelp();
        return;
      }
      
      // Fallback to basic help text
      yield `Help for command: ${query}\n`;
      yield `No detailed help available for this command.\n`;
      return;
    }

    // Show general help text
    yield this.getGeneralHelp();
  }

  private getGeneralHelp(): string {
    return `cursor-tools - AI-powered CLI tool for development tasks

Quick Start:
  cursor-tools instructions     Get complete instructions and command reference
  cursor-tools help <command>   Get detailed help for a specific command

Usage: cursor-tools [options] <command> [args]

Global Options:
  --model=<model>           Specify an alternative AI model to use
  --max-tokens=<number>     Control response length
  --save-to=<file path>    Save command output to a file
  --from-github=<url>      Access GitHub repository content
  --output=<filepath>      Specify output file path
  --hint=<hint>            Provide additional context
  --help                   Show this help message

Available Commands:
${this.getCommandList()}

For detailed help on a specific command, run:
  cursor-tools help <command>

Examples:
  cursor-tools web "latest weather in London"
  cursor-tools repo "explain authentication flow"
  cursor-tools doc --output docs.md
  cursor-tools browser open "https://example.com" --html

For more information, visit: https://github.com/eastlondoner/cursor-tools
`;
  }

  private getCommandList(): string {
    return Object.entries(commands)
      .map(([name, command]) => {
        const description = 'getDescription' in command && typeof command.getDescription === 'function'
          ? command.getDescription()
          : 'No description available';
        return `  ${name.padEnd(15)} ${description}`;
      })
      .join('\n');
  }
} 