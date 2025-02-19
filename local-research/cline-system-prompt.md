Querying Perplexity AI using sonar-pro for: How to configure Cline system prompt via a file similar to .cursorrules? What would be the format and location of such a file?
Cline supports configuring its system prompt via a .clinerules file placed in the root directory of a project[1][8]. The .clinerules file contains custom instructions that are automatically appended to Cline's system prompt, influencing all interactions within that project context[1].

The format of the .clinerules file is plain text[8]. The contents are simply appended to the bottom of Cline's system prompt[8].

Example .clinerules file structure:

```
your-project/
├── .clinerules
├── src/
├── docs/
└── ...
```

The .clinerules file allows you to define project-specific behaviors, conventions, and guidelines for Cline[8]. This can include coding style rules, error handling preferences, or important project context[1].