Packing repository using repomix...
Querying Gemini AI using gemini-2.0-pro-exp-02-05...
# Integrating Vercel AI SDK with Stagehand for Browser Automation

This document details best practices for integrating the Vercel AI SDK with Stagehand for browser automation, focusing on async operations, streaming responses, state management, error handling, provider configuration, and performance.  It combines insights from multiple sources, including best practices for Playwright integration (since Stagehand builds upon Playwright).  TypeScript examples are provided throughout.

## Overview

The combination of Vercel AI SDK and Stagehand allows for powerful, AI-driven browser automation.  The Vercel AI SDK provides a streamlined interface for interacting with various Large Language Models (LLMs) through different providers (e.g., OpenAI, Anthropic). Stagehand, built on Playwright, enables browser automation controlled by natural language instructions. By connecting these two tools, we can build AI agents that can dynamically interact with web pages based on streamed instructions from an LLM.

## Best Practices

### 1. Async Operations and `async/await`

Since both Vercel AI SDK and Stagehand operations are asynchronous, use `async/await` for clean and manageable code.  This makes it easier to chain operations and handle results.

```typescript
import { chromium, Page, Browser } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function exampleAutomation(): Promise<void> {
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();

  try {
    await page.goto('https://example.com');
    const pageContent: string = await page.content();

    const response = await streamText({
      model: openai('gpt-4'),  // Or use another provider, like anthropic()
      messages: [{ role: 'user', content: `Analyze this HTML:\n\n${pageContent}` }],
    });

    for await (const chunk of response) {
      console.log(chunk); // Process and act on each streamed chunk
    }
  } finally {
    await browser.close(); // Ensure browser closure, even on errors
  }
}

exampleAutomation();
```

### 2. Streaming Responses

The Vercel AI SDK's `streamText` function is central to building responsive, interactive automation.  Process the stream chunk-by-chunk to react to AI instructions in real-time.

```typescript
import { chromium } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function streamingAutomation(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('https://example.com');

    const response = streamText({
      model: openai('gpt-4'),
      messages: [{ role: 'user', content: 'Give me step-by-step instructions to find the "Contact Us" button.' }],
    });

    for await (const chunk of response) {
      console.log(`AI Instruction: ${chunk}`);

      // Perform actions based on AI's instructions
      if (chunk.includes('Find a link labeled "Contact Us"')) {
        await page.click('a:has-text("Contact Us")'); // Example: Click a link
      } else if (chunk.includes('Look in the footer')) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight); // Scroll to bottom
        });
      }
      // Add more conditional actions based on expected responses
    }
  } finally {
    await browser.close();
  }
}

streamingAutomation();

```

**Key Considerations for Streaming:**

* **TypeScript Types:** The `streamText` function returns an `AsyncIterable<string>`.  Use this type for proper type checking.
* **Real-time Interaction:** Act on each streamed chunk as it arrives.  This allows for a dynamic interaction loop where the AI's output directly drives the browser actions.
* **Error Handling:** Wrap the stream iteration in a `try...catch` block to handle potential errors during streaming (see Error Handling section below).

### 3. State Management

When building complex workflows, maintain a state object to track the progress and context of the automation. This context can be shared between the AI model and the browser automation logic.

```typescript
import { chromium, Browser, Page } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface AutomationContext {
  browser: Browser;
  page: Page;
  aiState: {
    loginAttempted?: boolean;
    formFilled?: boolean;
    // ... other state variables
  };
}

async function statefulAutomation(): Promise<void> {
  const context: AutomationContext = {
    browser: await chromium.launch(),
    page: await (await chromium.launch()).newPage(),
    aiState: {},
  };

  try {
    await context.page.goto('https://example.com/login');

    const response = streamText({
      model: openai('gpt-4'),
      messages: [{ role: 'user', content: 'Log in to the website.  If you have already tried, tell me "Already tried."' }],
    });

    for await (const chunk of response) {
      await processInstruction(chunk, context);
    }
  } finally {
    await context.browser.close();
  }
}

async function processInstruction(instruction: string, context: AutomationContext): Promise<void> {
    if (instruction.includes("Already tried")) {
        //handle already tried
        console.log("Already tried logging in");
        return;
    }
  if (instruction.includes('Enter username')) {
    await context.page.fill('input[name="username"]', 'testuser');
    context.aiState.loginAttempted = true;
  } else if (instruction.includes('Enter password')) {
    await context.page.fill('input[name="password"]', 'testpassword');
  } else if (instruction.includes('Click submit')) {
    await context.page.click('button[type="submit"]');
    context.aiState.formFilled = true;
  }
  // ... other state updates
}

statefulAutomation();
```

### 4. Error Handling and Retries

Robust error handling is crucial for reliable automation.

*   **`try...catch` Blocks:** Wrap both the Vercel AI SDK calls and the Playwright/Stagehand actions in `try...catch` blocks.

*   **Streaming Errors:** Handle errors *within* the stream iteration.

*   **Retry Logic:** Implement custom retry logic with exponential backoff for transient errors.

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function generateTextWithRetry(prompt: string): Promise<string> {
  const maxRetries = 3;
  let retryDelay = 1000; // Initial delay in milliseconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
        const response = await streamText({
          model: openai('gpt-4'),
          messages: [{ role: 'user', content: prompt }],
        });
        let text = "";
        for await (const chunk of response) {
           text += chunk
        }
        return text;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw error; // Re-throw if max retries reached
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay *= 2; // Exponential backoff
    }
  }
  throw new Error("retry logic failed") //should never be hit
}


async function handleStreamWithRetry(prompt: string) {
    try {
        const { textStream } = await generateTextWithRetry(prompt);
        for await (const textPart of textStream) {
            process.stdout.write(textPart);
        }
    } catch (error) {
    console.error('Final error after retries:', error);
    }
}
```

### 5. Provider-Specific Configurations and Model Parameters

The Vercel AI SDK allows you to configure different AI providers (OpenAI, Anthropic, etc.) and pass provider-specific options.

*   **Provider Packages:** Use the provider-specific package (e.g., `@ai-sdk/openai`, `@ai-sdk/anthropic`) to create the model instance.

*   **Model Parameters:** Pass model-specific parameters (e.g., `temperature`, `max_tokens`) in the `streamText` options.

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

async function multiProviderExample(): Promise<void> {
  // OpenAI example
  const openaiResponse = await streamText({
    model: openai('gpt-4'), // Use the OpenAI provider
    messages: [{ role: 'user', content: 'Explain the concept of closures in JavaScript.' }],
    temperature: 0.7, // OpenAI-specific parameter
    max_tokens: 200,  // Common parameter
  });
  //process openai
  console.log("openai output:");
  for await (const chunk of openaiResponse) {
    console.log(chunk);
  }
  // Anthropic example
  const anthropicResponse = await streamText({
    model: anthropic('claude-3-opus-20240229'), // Use the Anthropic provider
    messages: [{ role: 'user', content: 'Write a short poem about the sea.' }],
    max_tokens: 150,
  });
  console.log("anthropic output:");
  for await (const chunk of anthropicResponse) {
    console.log(chunk);
  }
}

multiProviderExample();
```

### 6. Multiple Providers

You can configure multiple providers simultaneously using `customProvider`.  This allows you to switch between models easily.

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { customProvider, streamText } from 'ai';

const aiProvider = customProvider({
  languageModels: {
    'gpt-4': openai('gpt-4'),       // OpenAI's GPT-4
    'claude-3': anthropic('claude-3-opus-20240229'), // Anthropic's Claude 3 Opus
    // Add more models as needed
  },
});

async function multiProviderAutomation(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('https://news.ycombinator.com');

    // Use GPT-4 to analyze the page
    const gpt4Response = streamText({
      model: aiProvider('gpt-4'), // Select GPT-4
      messages: [{ role: 'user', content: 'Summarize the top 3 articles on this page.' }],
    });

    console.log("GPT-4 Summary:");
    for await (const chunk of gpt4Response) {
      console.log(chunk);
    }
    // Use Claude 3 for a different task
    const claude3Response = streamText({
        model: aiProvider('claude-3'), // Select Claude 3
        messages: [{ role: 'user', content: 'Describe the general sentiment of the discussions.' }],
      });
      console.log("Claude 3 Summary:");
      for await (const chunk of claude3Response) {
        console.log(chunk);
      }
  } finally {
    await browser.close();
  }
}

multiProviderAutomation();
```

### 7. Performance Considerations and Rate Limiting

*   **Vercel AI SDK's `streamText`:** This function is designed for efficient streaming and real-time updates, making it well-suited for interactive browser automation.
*   **Rate Limiting:** Be mindful of rate limits imposed by both the AI providers (OpenAI, Anthropic, etc.) and Vercel itself.
    *   **Provider Rate Limits:** Implement retry logic with exponential backoff to handle rate limiting from the AI provider.
    *   **Vercel Rate Limits:** Consult Vercel's documentation for platform-specific limits (e.g., deployment limits, function invocation limits).  Use the `@vercel/firewall` package for custom rate limiting if needed.

```typescript
// Example using @vercel/firewall
import { unstable_checkRateLimit as checkRateLimit } from '@vercel/firewall';

async function rateLimitedAction(request: Request): Promise<Response> {
  const { rateLimited } = await checkRateLimit('my-action', { request });
  if (rateLimited) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Continue with the action if not rate-limited
  // ...
  return new Response("ok")
}
```

## Complete Example

```typescript
import { chromium, Browser, Page } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface AutomationContext {
  browser: Browser;
  page: Page;
  aiState: {
    formFilled?: boolean;
    buttonClicked?: boolean;
    // Add more state variables as needed
  };
}

async function completeExample(): Promise<void> {
  const context: AutomationContext = {
    browser: await chromium.launch(),
    page: await (await chromium.launch()).newPage(),
    aiState: {},
  };

  try {
    await context.page.goto('https://example.com/form');

    const response = streamText({
      model: openai('gpt-4'), // Or any other supported model
      messages: [
        {
          role: 'user',
          content: 'Fill out the form on this page. Use the name "Test User" and email "test@example.com".',
        },
      ],
    });

    for await (const chunk of response) {
      console.log(`AI Instruction: ${chunk}`);
      await processInstruction(chunk, context);
    }

    // After processing instructions, check if the form was submitted
    if (context.aiState.formFilled && context.aiState.buttonClicked) {
      console.log('Form submitted successfully!');
    } else {
      console.warn('Form submission may not have completed.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await context.browser.close();
  }
}

async function processInstruction(instruction: string, context: AutomationContext): Promise<void> {
  if (instruction.includes('Fill name')) {
    await context.page.fill('input[name="name"]', 'Test User');
    context.aiState.formFilled = true; // Update state
  } else if (instruction.includes('Fill email')) {
    await context.page.fill('input[name="email"]', 'test@example.com');
    context.aiState.formFilled = true; // Update state
  } else if (instruction.includes('Click submit')) {
    await context.page.click('button[type="submit"]');
    context.aiState.buttonClicked = true; // Update state
  }
}

completeExample();

```

This complete example demonstrates a basic form-filling scenario, combining streaming responses, state management, and error handling.  It uses a shared `AutomationContext` to keep track of the browser instance, the page, and the AI's state.  The `processInstruction` function acts on the streamed instructions from the AI, updating the state accordingly. The `finally` block ensures the browser is always closed, even if errors occur.

This comprehensive guide provides a solid foundation for building sophisticated AI-powered browser automation using the Vercel AI SDK and Stagehand. Remember to consult the official documentation for both libraries for the most up-to-date information and advanced features.
