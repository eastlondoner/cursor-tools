import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../types';
import { PrCommand } from './github/pr.ts';
import { IssueCommand } from './github/issue.ts';

export class GithubCommand implements Command {
  private subcommands: CommandMap = {
    pr: new PrCommand(),
    issue: new IssueCommand(),
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    if (!subcommand) {
      yield 'Please specify a subcommand: pr or issue';
      return;
    }

    if (this.subcommands[subcommand]) {
      yield* this.subcommands[subcommand].execute(subQuery, options);
    } else {
      yield `Unknown subcommand: ${subcommand}. Available subcommands: pr, issue`;
    }
  }
}
