# vibe-tools Configuration Guide

This document provides detailed configuration information for vibe-tools.

## Configuration Overview

vibe-tools can be configured through two main mechanisms:

1. Environment variables (API keys and core settings)
2. JSON configuration file (provider settings, model preferences, and command options)

## Environment Variables

Create `.vibe-tools.env` in your project root or `~/.vibe-tools/.env` in your home directory:

```env
# Required API Keys
PERPLEXITY_API_KEY="your-perplexity-api-key"    # Required for web search
GEMINI_API_KEY="your-gemini-api-key"            # Required for repository analysis

# Optional API Keys
OPENAI_API_KEY="your-openai-api-key"            # For browser commands with OpenAI
ANTHROPIC_API_KEY="your-anthropic-api-key"      # For browser commands with Anthropic, and MCP commands
OPENROUTER_API_KEY="your-openrouter-api-key"    # For MCP commands with OpenRouter and web search
GITHUB_TOKEN="your-github-token"                # For enhanced GitHub access
NOTION_ACCESS_KEY="your-notion-api-key"         # For Notion integration

# Configuration Options
USE_LEGACY_CURSORRULES="true"                   # Use legacy .cursorrules file (default: false)
```

## Configuration File (vibe-tools.config.json)

Create this file in your project root to customize behavior. Here's a comprehensive example with all available options:

```json
{
  "perplexity": {
    "model": "sonar-pro", // Default model for web search
    "maxTokens": 8000 // Maximum tokens for responses
  },
  "gemini": {
    "model": "gemini-2.5-pro-exp", // Default model for repository analysis
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "plan": {
    "fileProvider": "gemini", // Provider for file identification
    "thinkingProvider": "openai", // Provider for plan generation
    "fileMaxTokens": 8192, // Tokens for file identification
    "thinkingMaxTokens": 8192 // Tokens for plan generation
  },
  "repo": {
    "provider": "gemini", // Default provider for repo command
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "doc": {
    "maxRepoSizeMB": 100, // Maximum repository size for remote docs
    "provider": "gemini", // Default provider for doc generation
    "maxTokens": 10000 // Maximum tokens for responses
  },
  "browser": {
    "defaultViewport": "1280x720", // Default browser window size
    "timeout": 30000, // Default timeout in milliseconds
    "stagehand": {
      "env": "LOCAL", // Stagehand environment
      "headless": true, // Run browser in headless mode
      "verbose": 1, // Logging verbosity (0-2)
      "debugDom": false, // Enable DOM debugging
      "enableCaching": false, // Enable response caching
      "model": "claude-3-7-sonnet-latest", // Default Stagehand model
      "provider": "anthropic", // AI provider (anthropic or openai)
      "timeout": 30000 // Operation timeout
    }
  },
  "tokenCount": {
    "encoding": "o200k_base" // Token counting method
  },
  "openai": {
    "maxTokens": 8000 // Will be used when provider is "openai"
  },
  "anthropic": {
    "maxTokens": 8000 // Will be used when provider is "anthropic"
  }
}
```

## Configuration Sections

### Perplexity Settings

- `model`: The AI model to use for web searches
- `maxTokens`: Maximum tokens in responses

### Gemini Settings

- `model`: The AI model for repository analysis
- `maxTokens`: Maximum tokens in responses
- Note: For repositories >800K tokens, automatically switches to gemini-1.5-pro

### Plan Command Settings

- `fileProvider`: AI provider for identifying relevant files
- `thinkingProvider`: AI provider for generating implementation plans
- `fileMaxTokens`: Token limit for file identification
- `thinkingMaxTokens`: Token limit for plan generation

### Repository Command Settings

- `provider`: Default AI provider for repository analysis
- `maxTokens`: Maximum tokens in responses

### Documentation Settings

- `maxRepoSizeMB`: Size limit for remote repositories
- `provider`: Default AI provider for documentation
- `maxTokens`: Maximum tokens in responses

### Browser Automation Settings

- `defaultViewport`: Browser window size
- `timeout`: Navigation timeout
- `stagehand`: Stagehand-specific settings including:
  - `env`: Environment configuration
  - `headless`: Browser visibility
  - `verbose`: Logging detail level
  - `debugDom`: DOM debugging
  - `enableCaching`: Response caching
  - `model`: Default AI model
  - `provider`: AI provider selection
  - `timeout`: Operation timeout

### Token Counting Settings

- `encoding`: Method used for counting tokens
  - `o200k_base`: Optimized for Gemini (default)
  - `gpt2`: Traditional GPT-2 encoding

## GitHub Authentication

The GitHub commands support several authentication methods:

1. **Environment Variable**: Set `GITHUB_TOKEN` in your environment:

   ```env
   GITHUB_TOKEN=your_token_here
   ```
