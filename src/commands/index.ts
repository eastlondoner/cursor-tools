import { Command } from '../types.ts';
import { AskCommand } from './ask.ts';
import { BrowserCommand } from './browser/browserCommand.ts';
import { DocCommand } from './doc.ts';
import { GithubCommand } from './github.ts';
import { HelpCommand } from './help.ts';
import { InstallCommand } from './install.ts';
import { MCPCommand } from './mcp/mcp.ts';
import { PlanCommand } from './plan.ts';
import { RepoCommand } from './repo.ts';
import { WebCommand } from './web.ts';
import { XcodeCommand } from './xcode/xcode.ts';
import { InstructionsCommand } from './instructions.ts';

export const commands: Record<string, Command> = {
  ask: new AskCommand(),
  browser: new BrowserCommand(),
  doc: new DocCommand(),
  github: new GithubCommand(),
  help: new HelpCommand(),
  install: new InstallCommand(),
  mcp: new MCPCommand(),
  plan: new PlanCommand(),
  repo: new RepoCommand(),
  web: new WebCommand(),
  xcode: new XcodeCommand(),
  instructions: new InstructionsCommand(),
};
