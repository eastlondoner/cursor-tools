# Plan: Adding Groq Model Support to Browser Commands

## Overview

This plan outlines how to add support for Groq models in browser commands, particularly focusing on integration with Stagehand. The key requirements are:

1. Allow any Groq model name (since they change frequently)
2. Integrate with existing config system
3. Work with Stagehand by setting `llmClient: <GroqClient instance>` without setting `modelName` in Stagehand constructor

## Implementation Steps

### 1. Configuration Updates

#### Update Config Types (`src/config.ts`)
```typescript
export interface Config {
  // ... existing config ...
  stagehand?: {
    provider: 'anthropic' | 'openai' | 'groq';
    model?: string; // Allow any string for Groq models
    verbose?: boolean;
    debugDom?: boolean;
    enableCaching?: boolean;
  };
}
```

#### Update Default Config
```typescript
export const defaultConfig: Config = {
  // ... existing defaults ...
  stagehand: {
    provider: 'openai', // Keep OpenAI as default
    verbose: false,
    debugDom: false,
    enableCaching: true,
  },
};
```

### 2. Stagehand Configuration (`src/commands/browser/stagehand/config.ts`)

1. Update model type to allow any string:
```typescript
// Remove specific model enum
// export const availableModels = z.enum(['claude-3-5-sonnet-latest', 'o3-mini', 'gpt-4o']);

// Replace with union that allows any string for Groq
const anthropicModels = z.enum(['claude-3-5-sonnet-latest']);
const openaiModels = z.enum(['o3-mini', 'gpt-4o']);
export const availableModels = z.union([anthropicModels, openaiModels, z.string()]);
export type AvailableModel = z.infer<typeof availableModels>;
```

2. Update `loadStagehandConfig` to handle Groq:
```typescript
export function loadStagehandConfig(config: Config): StagehandConfig {
  const stagehandConfig = config.stagehand || {};
  
  switch (stagehandConfig.provider) {
    case 'groq':
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY environment variable is required when using Groq provider');
      }
      return {
        provider: 'groq',
        headless: stagehandConfig.headless ?? true,
        verbose: stagehandConfig.verbose ?? false,
        debugDom: stagehandConfig.debugDom ?? false,
        enableCaching: stagehandConfig.enableCaching ?? true,
        model: stagehandConfig.model, // Don't set a default model for Groq
      };
    // ... existing cases ...
  }
}
```

3. Update helper functions:
```typescript
export function getStagehandApiKey(config: StagehandConfig): string {
  switch (config.provider) {
    case 'groq':
      return process.env.GROQ_API_KEY!;
    // ... existing cases ...
  }
}

export function getStagehandModel(
  config: StagehandConfig,
  options: { model?: string }
): string | undefined {
  // For Groq, just return the model name without validation
  if (config.provider === 'groq') {
    return options.model || config.model;
  }
  // ... existing model handling ...
}
```

### 3. Stagehand Creation (`src/commands/browser/stagehand/createStagehand.ts`)

Update `createStagehand` to properly initialize GroqClient:

```typescript
export async function createStagehand(options: SharedBrowserCommandOptions): Promise<StagehandInstance> {
  const config = loadConfig();
  const stagehandConfig = loadStagehandConfig(config);

  const stagehandOptions: ConstructorParams = {
    env: 'LOCAL',
    headless: options?.headless ?? stagehandConfig.headless,
    verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
    debugDom: options?.debug ?? stagehandConfig.debugDom,
    enableCaching: stagehandConfig.enableCaching,
    logger: stagehandLogger(options?.debug ?? stagehandConfig.verbose),
  };

  // Only set modelName for non-Groq providers
  if (stagehandConfig.provider !== 'groq') {
    stagehandOptions.modelName = getStagehandModel(stagehandConfig, { model: options?.model });
  }

  // Set up Groq client if using Groq provider
  if (stagehandConfig.provider === 'groq') {
    const modelName = getStagehandModel(stagehandConfig, { model: options?.model });
    if (!modelName) {
      throw new Error('A model name must be specified when using Groq provider');
    }

    stagehandOptions.llmClient = new GroqClient({
      logger: stagehandOptions.logger,
      enableCaching: stagehandConfig.enableCaching,
      modelName: modelName as AvailableModel, // Safe cast since we allow any string
      clientOptions: {
        apiKey: getStagehandApiKey(stagehandConfig),
      },
    });
  }

  // ... rest of createStagehand implementation ...
}
```

### 4. Documentation Updates

1. Update README.md to document Groq support:
   - How to set GROQ_API_KEY
   - How to specify Groq models in config or via --model flag
   - List of recommended/tested Groq models (qwen-2.5, deepseek-r1-distill-llama-70b, etc.)

2. Update cursor-tools.config.json example to show Groq configuration:
```json
{
  "stagehand": {
    "provider": "groq",
    "model": "qwen-2.5",
    "verbose": false,
    "debugDom": false,
    "enableCaching": true
  }
}
```

### 5. Testing Plan

1. Basic Functionality:
   - Test with different Groq models via config and --model flag
   - Verify model selection in logs
   - Test without model specified (should error)
   - Test without GROQ_API_KEY (should error)

2. Browser Commands:
   - Test `act`, `observe`, and `extract` with Groq models
   - Use test server (`pnpm serve-test`) for consistent testing
   - Test with complex multi-step actions
   - Test with various viewport sizes and timeouts

3. Error Handling:
   - Invalid API key
   - Invalid model names
   - Network errors
   - Rate limits

## Notes

1. The implementation allows any string as a model name, providing flexibility as Groq adds new models.
2. We're properly separating the model handling between Stagehand and GroqClient.
3. The configuration system maintains backward compatibility while adding Groq support.
4. Error messages are clear and helpful for debugging configuration issues.
5. The implementation follows the existing patterns in the codebase.

## Future Considerations

1. Add caching support for GroqClient (currently set to undefined)
2. Add support for user-provided instructions in GroqClient
3. Consider adding model validation against a known list while still allowing any string
4. Add automated tests if we decide to add testing infrastructure in the future 