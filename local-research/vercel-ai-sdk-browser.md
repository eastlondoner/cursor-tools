Querying Perplexity AI using sonar-pro for: What are the best practices for integrating Vercel AI SDK with browser automation tools like Playwright? Focus on handling async operations, streaming responses during browser actions, and managing state. Include TypeScript examples.
To integrate Vercel AI SDK with browser automation tools like Playwright, consider the following best practices:

1. Handle async operations using async/await:

```typescript
import { chromium } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function automateWithAI() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://example.com');

  const content = await page.content();

  const response = await streamText({
    model: openai('gpt-4'),
    messages: [{ role: 'user', content: `Analyze this HTML: ${content}` }],
  });

  for await (const chunk of response) {
    console.log(chunk);
  }

  await browser.close();
}

automateWithAI();
```

2. Stream responses during browser actions:

```typescript
import { chromium } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function streamDuringAutomation() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const response = streamText({
    model: openai('gpt-4'),
    messages: [{ role: 'user', content: 'Provide step-by-step instructions for a web search' }],
  });

  for await (const chunk of response) {
    console.log(chunk);
    // Perform browser actions based on AI instructions
    if (chunk.includes('Enter search query')) {
      await page.fill('input[name="q"]', 'Playwright automation');
    } else if (chunk.includes('Click search button')) {
      await page.click('input[type="submit"]');
    }
  }

  await browser.close();
}

streamDuringAutomation();
```

3. Manage state using a shared context:

```typescript
import { chromium, Browser, Page } from 'playwright';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface AutomationContext {
  browser: Browser;
  page: Page;
  aiState: Record<string, any>;
}

async function managedAutomation() {
  const context: AutomationContext = {
    browser: await chromium.launch(),
    page: await (await chromium.launch()).newPage(),
    aiState: {},
  };

  try {
    await context.page.goto('https://example.com');

    const response = streamText({
      model: openai('gpt-4'),
      messages: [{ role: 'user', content: 'Analyze the page and suggest actions' }],
    });

    for await (const chunk of response) {
      console.log(chunk);
      await processAIInstruction(chunk, context);
    }
  } finally {
    await context.browser.close();
  }
}

async function processAIInstruction(instruction: string, context: AutomationContext) {
  if (instruction.includes('Click button')) {
    await context.page.click('button');
    context.aiState.buttonClicked = true;
  } else if (instruction.includes('Fill form')) {
    await context.page.fill('input[name="username"]', 'testuser');
    context.aiState.formFilled = true;
  }
}

managedAutomation();
```

These examples demonstrate integrating Vercel AI SDK with Playwright, handling async operations, streaming responses during browser actions, and managing state in TypeScript[1][3][4][7][10].