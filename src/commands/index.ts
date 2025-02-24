import type { CommandMap } from '../types.ts';
import { WebCommand } from './web.ts';
import { InstallCommand } from './install.ts';
import { GithubCommand } from './github.ts';
import { BrowserCommand } from './browser/browserCommand.ts';
import { PlanCommand } from './plan.ts';
import { RepoCommand } from './repo.ts';
import { DocCommand } from './doc.ts';
import { AskCommand } from './ask.ts';
import { MCPCommand } from './mcp/mcp.ts';
import { XcodeCommand } from './xcode/xcode.ts';
import { HelpCommand } from './help.ts';

export const commands: CommandMap = {
  web: new WebCommand(),
  repo: new RepoCommand(),
  install: new InstallCommand(),
  doc: new DocCommand(),
  github: new GithubCommand(),
  browser: new BrowserCommand(),
  plan: new PlanCommand(),
  ask: new AskCommand(),
  mcp: new MCPCommand(),
  xcode: new XcodeCommand(),
  help: new HelpCommand(),
};
