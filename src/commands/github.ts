import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../types';
import { PrCommand } from './github/pr.ts';
import { IssueCommand } from './github/issue.ts';

export class GithubCommand implements Command {
  private subcommands: CommandMap = {
    pr: new PrCommand(),
    issue: new IssueCommand(),
    help: {
      execute: async function* (this: GithubCommand, _: string, options: CommandOptions) {
        yield this.getHelp();
      }.bind(this),
    },
  };

  getDescription(): string {
    return 'Get information about GitHub PRs and issues';
  }

  getHelp(): string {
    return `GitHub Command - Get information about GitHub PRs and issues

Usage: cursor-tools github <subcommand> [args] [options]

Subcommands:
  pr [number]     Get the last 10 PRs, or a specific PR by number
  issue [number]  Get the last 10 issues, or a specific issue by number
  help            Show this help message

Options:
  --from-github=<username>/<repository>[@<branch>]  Access PRs/issues from a specific GitHub repository

Examples:
  cursor-tools github pr                  # List last 10 PRs
  cursor-tools github pr 123              # Get details of PR #123
  cursor-tools github issue               # List last 10 issues
  cursor-tools github issue 456           # Get details of issue #456
  cursor-tools github help                # Show this help message

Notes:
- Defaults to the current repository if --from-github is not specified
- Requires appropriate GitHub access permissions
- Uses GitHub API rate limits`;
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    // If no subcommand provided or help requested, show help
    if (!subcommand || subcommand === 'help' || options.help) {
      yield* this.subcommands.help.execute('', options);
      return;
    }

    if (this.subcommands[subcommand]) {
      yield* this.subcommands[subcommand].execute(subQuery, options);
    } else {
      yield `Unknown subcommand: ${subcommand}. Available subcommands: pr, issue, help`;
    }
  }
}
