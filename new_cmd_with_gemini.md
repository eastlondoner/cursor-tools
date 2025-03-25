# Implementing a New Command with Gemini YouTube Video Analysis

## Overview

This document provides a detailed guide on implementing a new command for cursor-tools that leverages Gemini's ability to analyze YouTube videos. Gemini 2.0 Flash now supports YouTube video analysis, allowing you to create powerful AI-driven commands that can extract information, generate summaries, or create detailed reports from video content.

## Command Structure in cursor-tools

Commands in cursor-tools follow a consistent architecture:

1. **Command Interface**: All commands implement the `Command` interface from `src/types.ts`, which requires an `execute` method that returns a `CommandGenerator` (an AsyncGenerator that yields strings).

2. **Command Classes**: Each command is implemented as a class in the `src/commands/` directory or in subdirectories for related commands.

3. **Command Registration**: All commands are registered in the `commands` map in `src/commands/index.ts`.

4. **Command Execution**: The main CLI application in `src/index.ts` dispatches command execution to the appropriate command handler.

## Current Gemini Implementation

Gemini is implemented in cursor-tools through two provider classes:

1. **GoogleVertexAIProvider**: Used when `GEMINI_API_KEY` points to a service account JSON file or 'adc' (Application Default Credentials).

2. **GoogleGenerativeLanguageProvider**: Used for API key-based authentication.

These providers are created by the `createProvider` function in `src/providers/base.ts` based on the provider name and available credentials.

## Extending Gemini for YouTube Analysis

To implement a YouTube analysis command, we need to extend the existing Gemini implementation to handle video content. The current implementation only supports text inputs, but Gemini 2.0 Flash now supports analyzing YouTube videos via the `fileData` object in the API request.

### Step 1: Update the Gemini Provider

First, we need to extend the GoogleGenerativeLanguageProvider to support sending YouTube video URLs as part of the request:

```typescript
// In src/providers/base.ts

interface VideoAnalysisOptions extends ModelOptions {
  videoUrl: string;
}

// Add this method to GoogleGenerativeLanguageProvider class
async executeVideoPrompt(
  prompt: string,
  options: VideoAnalysisOptions
): Promise<string> {
  const model = await this.getModel(options);
  const maxTokens = options.maxTokens;
  const systemPrompt = this.getSystemPrompt(options);
  const videoUrl = options.videoUrl;
  
  if (!videoUrl) {
    throw new Error('Video URL is required for video analysis');
  }
  
  const startTime = Date.now();
  
  this.logRequestStart(options, model, maxTokens, systemPrompt);
  
  return retryWithBackoff(
    async () => {
      try {
        const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  fileData: {
                    fileUri: videoUrl,
                    mimeType: 'video/*'
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: { 
            maxOutputTokens: maxTokens,
            temperature: 1,
            topK: 40,
            topP: 0.95,
            responseMimeType: 'text/plain'
          },
          ...(systemPrompt
            ? {
                systemInstruction: {
                  role: 'user',
                  parts: [{ text: systemPrompt }]
                }
              }
            : {})
        };
        
        this.debugLog(options, 'Request body:', this.truncateForLogging(requestBody));
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const endTime = Date.now();
        this.debugLog(options, `API call completed in ${endTime - startTime}ms`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new NetworkError(`Google Generative Language API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        this.debugLog(options, 'Response:', this.truncateForLogging(data));
        
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return content;
      } catch (error) {
        if (error instanceof NetworkError) {
          throw error;
        }
        
        throw new NetworkError(
          'Failed to execute video prompt with Google Generative Language API',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },
    5, // maxRetries
    1000, // initialDelay
    options?.timeout || TEN_MINUTES
  );
}
```

### Step 2: Create a New YouTube Command

Next, create a new command class to handle YouTube video analysis:

```typescript
// src/commands/youtube.ts

import type { Command, CommandGenerator, CommandOptions } from '../types';
import { loadConfig, loadEnv } from '../config';
import type { Config } from '../types';
import { ApiKeyMissingError, ProviderError } from '../errors';
import { createProvider } from '../providers/base';

interface YouTubeCommandOptions extends CommandOptions {
  type?: 'summary' | 'transcript' | 'plan' | 'review' | 'custom';
  duration?: 'short' | 'medium' | 'full';
}

export class YouTubeCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: YouTubeCommandOptions): CommandGenerator {
    try {
      // Extract YouTube URL from query
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i;
      const urlMatch = query.match(urlRegex);
      
      if (!urlMatch) {
        yield 'Please provide a valid YouTube URL.';
        return;
      }
      
      const youtubeUrl = urlMatch[0];
      const remainingQuery = query.replace(youtubeUrl, '').trim();
      
      // Make sure we have a GEMINI_API_KEY
      if (!process.env.GEMINI_API_KEY) {
        throw new ApiKeyMissingError('Gemini');
      }
      
      // Create Gemini provider
      const provider = createProvider('gemini');
      
      // Get model, default to gemini-2.0-flash which supports video
      const model = options?.model || this.config.youtube?.model || 'gemini-2.0-flash';
      
      // Get max tokens, default to 8192 for detailed responses
      const maxTokens = options?.maxTokens || this.config.youtube?.maxTokens || 8192;
      
      yield `Analyzing YouTube video: ${youtubeUrl}\n`;
      
      // Convert the Gemini provider to GoogleGenerativeLanguageProvider to access video methods
      // Note: This requires adding the executeVideoPrompt method to the GoogleGenerativeLanguageProvider class
      const geminiProvider = provider as any;
      if (!geminiProvider.executeVideoPrompt) {
        throw new Error('The selected provider does not support video analysis');
      }
      
      // Determine the type of analysis based on options
      const analysisType = options?.type || 'summary';
      
      // Create system prompt based on analysis type
      let systemPrompt = 'You are a specialist generating detailed reports based on youtube videos.';
      let userPrompt = remainingQuery || 'Provide a comprehensive summary of this video.';
      
      switch (analysisType) {
        case 'summary':
          userPrompt = remainingQuery || 'Provide a comprehensive summary of this video.';
          break;
        case 'transcript':
          userPrompt = remainingQuery || 'Generate a detailed transcript of this video.';
          break;
        case 'plan':
          userPrompt = remainingQuery || 'Watch this video and generate a detailed plan on how to implement something similar.';
          break;
        case 'review':
          userPrompt = remainingQuery || 'Provide a critical review and analysis of this video.';
          break;
        case 'custom':
          // Use the user's query as is
          userPrompt = remainingQuery || 'Analyze this video and provide your insights.';
          break;
      }
      
      yield `Using analysis type: ${analysisType}\n`;
      yield `Processing with model: ${model}\n`;
      
      const response = await geminiProvider.executeVideoPrompt(userPrompt, {
        videoUrl: youtubeUrl,
        model,
        maxTokens,
        systemPrompt,
        debug: options?.debug
      });
      
      yield response;
    } catch (error) {
      if (error instanceof ProviderError || error instanceof ApiKeyMissingError) {
        yield error.formatUserMessage(options?.debug);
      } else if (error instanceof Error) {
        yield `Error: ${error.message}\n`;
      } else {
        yield 'An unknown error occurred\n';
      }
    }
  }
}
```

### Step 3: Register the New Command

Add the command to the `commands` map in `src/commands/index.ts`:

```typescript
import { YouTubeCommand } from './youtube';

export const commands: CommandMap = {
  // Existing commands...
  youtube: new YouTubeCommand(),
};
```

### Step 4: Update Interface Definitions

Update the type definitions to support video analysis:

```typescript
// In src/types.ts

// Add to existing Provider type definition
export type Provider = 'gemini' | 'openai' | 'openrouter' | 'perplexity' | 'modelbox' | 'anthropic';

// Add to existing BaseModelProvider interface
export interface BaseModelProvider {
  executePrompt(prompt: string, options?: ModelOptions): Promise<string>;
  supportsWebSearch(
    modelName: string
  ): Promise<{ supported: boolean; model?: string; error?: string }>;
  // Add this optional method
  executeVideoPrompt?(prompt: string, options: VideoAnalysisOptions): Promise<string>;
}

// Add new interface
export interface VideoAnalysisOptions extends ModelOptions {
  videoUrl: string;
}
```

## Implementation Details

### API Analysis

The following CURL example demonstrates how Gemini processes YouTube videos:

```bash
API_KEY="YOUR_API_KEY"

curl \
  -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY} \
  -H 'Content-Type: application/json' \
  -d @<(echo '{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "fileData": {
            "fileUri": "https://youtu.be/43c-Sm5GMbc",
            "mimeType": "video/*"
          }
        },
        {
          "text": "Watch this video and generate a detailed plan on how to implement something similar"
        }
      ]
    },
    {
      "role": "model",
      "parts": [
        {
          "text": "Here is a plan on how to set up a character with tile maps in Godot engine 4.0.1 based on the presented video.\n\n..."
        }
      ]
    },
    {
      "role": "user",
      "parts": [
        {
          "text": "INSERT_INPUT_HERE"
        }
      ]
    }
  ],
  "systemInstruction": {
    "role": "user",
    "parts": [
      {
        "text": "You are a specialist generating detailed reports based on youtube videos."
      }
    ]
  },
  "generationConfig": {
    "temperature": 1,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 8192,
    "responseMimeType": "text/plain"
  }
}')
```

Key components:
1. The API endpoint is `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
2. The model used is `gemini-2.0-flash` which supports video analysis
3. The video URL is passed in the `fileData.fileUri` field
4. A system instruction defines the AI's role
5. Generation config specifies parameters like temperature and token limit

### Important Considerations

1. **Model Support**: Only `gemini-2.0-flash` (and potentially newer versions) supports YouTube video analysis. Always check for the latest model capabilities.

2. **API Key**: You need a valid Gemini API key with appropriate permissions for video analysis.

3. **Error Handling**: Video analysis may fail for various reasons:
   - Video too long
   - Video unavailable or restricted
   - Network issues
   - API limitations

4. **Performance**: Video analysis is computationally intensive and may take longer than text processing.

5. **URL Format**: Make sure to validate YouTube URLs. The regex pattern `(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)` can help extract valid YouTube URLs.

6. **Privacy & Terms of Service**: Ensure your application complies with YouTube's terms of service and privacy policies when analyzing videos.

## Command Usage Examples

After implementation, users can use the new command in various ways:

```bash
# Basic video summary
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc"

# Generate implementation plan
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --type=plan

# Custom analysis
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" What techniques are used for character animation?

# Specify model and tokens
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --model=gemini-2.0-flash --max-tokens=4096

# Save the output to a file
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --save-to=video-analysis.md
```

## Documentation Update

Don't forget to update the CLI documentation in `.cursor/rules/cursor-tools.mdc` to include your new command:

```markdown
**YouTube Video Analysis:**
`cursor-tools youtube "<youtube-url>" [question] [options]` - Analyze YouTube videos and generate detailed reports (e.g., `cursor-tools youtube "https://youtu.be/43c-Sm5GMbc" --type=summary`)

**YouTube Command Options:**
--type=<summary|transcript|plan|review|custom>: Type of analysis to perform (default: summary)
--provider=<provider>: AI provider to use (only Gemini is supported)
--model=<model>: Model to use for video analysis (default: gemini-2.0-flash)
--max-tokens=<number>: Maximum tokens for response (default: 8192)
--save-to=<file path>: Save command output to a file
```

## Testing

To test your implementation:

1. Ensure you have a valid Gemini API key set in your environment
2. Create a test file that runs your command with various YouTube URLs
3. Verify that the command can handle different types of videos and user queries
4. Test error cases like invalid URLs or unavailable videos

## Conclusion

By implementing a YouTube analysis command, you're extending cursor-tools with powerful video understanding capabilities. This allows developers to quickly extract information, generate summaries, or create implementation plans from video content, saving time and enhancing productivity.

Remember that video analysis is an advanced feature that requires proper error handling and user guidance. Make sure to provide clear documentation and helpful error messages for the best user experience. 

# Current Progress

The YouTube video analysis command has been successfully implemented in cursor-tools. This command leverages Gemini's powerful capability to analyze and understand YouTube video content, providing various analysis types such as summaries, transcripts, implementation plans, reviews, and custom analyses.

## Implementation Details

### 1. Extended Type Definitions
- Added `VideoAnalysisOptions` interface in `src/types.ts` extending `ModelOptions` with:
  - `videoUrl`: Required for specifying the YouTube URL
  - `temperature`, `topK`, `topP`: Optional generation parameters for customizing model output
- Extended `BaseModelProvider` interface with optional `executeVideoPrompt` method
- Updated the `Config` interface to include YouTube configuration options:
  ```typescript
  youtube?: {
    provider?: Provider;
    model?: string;
    maxTokens?: number;
    defaultType?: 'summary' | 'transcript' | 'plan' | 'review' | 'custom';
    defaultFormat?: 'markdown' | 'json' | 'text';
    maxRetries?: number;
    retryDelay?: number;
  };
  ```

### 2. Provider Implementation
- Added `executeVideoPrompt` method to `GoogleGenerativeLanguageProvider` in `src/providers/base.ts`
- Implemented detailed error handling for specific error codes (400, 403, 404, 429, 500)
- Added smart retry logic that only retries on server errors (5xx) and rate limits (429)
- Added support for customizable generation parameters (temperature, topK, topP)

### 3. Command Implementation
- Created a dedicated folder structure: `src/commands/youtube/`
- Implemented `YouTubeCommand` class in `src/commands/youtube/youtube.ts`
- Added URL validation and reformatting to ensure proper YouTube URL format
- Implemented support for different analysis types with tailored system prompts:
  - `summary`: For comprehensive video summaries
  - `transcript`: For verbatim transcripts with speaker attribution
  - `plan`: For implementation plans from tutorial videos
  - `review`: For critical analysis and reviews
  - `custom`: For user-specific queries about videos
- Added output format options: markdown, JSON, and plain text
- Implemented detailed error handling with user-friendly error messages
- Added progressive status updates during processing
- Included troubleshooting suggestions for common errors

### 4. Command Registration and Export
- Created an index.ts file in `src/commands/youtube/` to export the command
- Registered the command in `src/commands/index.ts`

### 5. Documentation Updates
- Updated `.cursor/rules/cursor-tools.mdc` to include:
  - Command syntax and description
  - Available options with descriptions
  - Note about required GEMINI_API_KEY
  - Troubleshooting suggestions
  - Added the YouTube command to Tool Recommendations

### 6. Testing
- Created comprehensive test scenarios in `tests/feature-behaviors/youtube/youtube-command.md`
- Test coverage includes:
  - Happy path scenarios for different analysis types
  - Testing different output formats
  - Error handling for invalid URLs, missing API keys
  - Error handling for videos that are too long, private, or age-restricted
  - Configuration testing
  - Performance testing with longer videos

## Features

The implemented YouTube command provides:

1. **Multiple Analysis Types**: Summary, transcript, plan, review, and custom queries
2. **Flexible Output Formats**: Markdown, JSON, and plain text 
3. **Robust Error Handling**: User-friendly error messages with troubleshooting tips
4. **Configurable Options**: Via command line or config file
5. **Progressive Feedback**: Status updates throughout processing

## Usage Examples

```bash
# Basic video summary
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc"

# Generate transcript
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --type=transcript

# Create implementation plan with JSON output
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --type=plan --format=json

# Custom analysis question
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" "What techniques are used for character animation?"

# Save the output to a file
cursor-tools youtube "https://www.youtube.com/watch?v=43c-Sm5GMbc" --save-to=video-analysis.md
```

The implementation is complete and ready for use, providing a powerful extension to cursor-tools that enables AI-driven video analysis capabilities.