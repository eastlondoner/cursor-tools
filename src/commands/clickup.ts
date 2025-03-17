import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../types';
import { TaskCommand } from './clickup/task';

export class ClickUpCommand implements Command {
  private subcommands: CommandMap = {
    task: new TaskCommand(),
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    if (!subcommand) {
      yield 'Please specify a subcommand: task';
      return;
    }

    if (this.subcommands[subcommand]) {
      yield* this.subcommands[subcommand].execute(subQuery, options);
    } else {
      yield `Unknown subcommand: ${subcommand}. Available subcommands: task`;
    }
  }
}
