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
  };

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand, ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    if (!subcommand) {
      yield 'Please specify a browser subcommand: open, element, act, extract, observe';
      return;
    }

    const subCommandHandler = this.subcommands[subcommand];
    try {
      if (subCommandHandler) {
        yield* subCommandHandler.execute(subQuery, options);
      } else {
        yield `Unknown browser subcommand: ${subcommand}. Available subcommands: open, element, act, extract, observe`;
      }
    } catch (error) {
      console.error('Error executing browser command', error);
      throw error;
    }
  }
}
