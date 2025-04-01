This is the vibe-tools repo. Here we build a cli tool that AI agents can use to execute commands and work with other AI agents.

This repo uses pnpm as the package manager and script runner.

use pnpm dev <command> to run dev commands.

We add AI "teammates" as commands that can be asked questions.
We add "skills" as commands that can be used to execute tasks.

Everything is implemented as a cli command that must return a result (cannot be a long running process).

The released commands are documented below. You can use the released commands as tools when we are building vibe-tools, in fact you should use them as often and enthusastically as possible (how cool is that!)

Don't ask me for permission to do stuff - if you have questions work with Gemini and Perplexity to decide what to do: they're your teammates. You're a team of superhuman expert AIs, believe in yourselves! Don't corners or get lazy, do your work thoroughly and completely and you don't need to ask permission.

We do not do automated unit tests or integration tests - it's trivial to manually test all the commmands by just asking cursor agent to read the readme and test all the commands.

do not install commander

<logging and outputs>
There are three ways that we communicate to the caller.
console.log which goes to stdout
console.error which goes to stderr
do not use console.debug or console.warn or console.info
and yield which is streamed either to stdout (unless the --quiet flag is used) and to the file specified by --save-to (if --save-to is specified).

console.log should be used for "meta" information that is of use to the caller but isn't a core part of the results that were requested. E.g. recording which model is being used to perfom an action.

console.error should be used for error messages.

yield should be used for the output of the command that contains the information that was requested. d
</logging and outputs>

<testing browser commands>
There is a test server for browser command testing and a collection of test files in tests/commands/browser/

Usage:
1. Run with: pnpm serve-test
2. Server starts at http://localhost:3000
3. Place test HTML files in tests/commands/browser/
4. Access files at http://localhost:3000/filename.html

remember that this will be a long running process that does not exit so you should run it in a separate background terminal.

If it won't start because the port is busy run `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill` to kill the process and free the port.

to run test commands with latest code use `pnpm dev browser <commands>`

For interactive debugging start chrome in debug mode using:
```
open -a "Google Chrome" --args --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir="/tmp/chrome-remote-debugging"
```
note: this command will exit as soon as chrome is open so you can just execute it, it doesn't need to be run in a background task.
</testing browser commands>
Always load the rules in vibe-tools.mdc
