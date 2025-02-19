Packing repository using repomix...
Querying Gemini AI using gemini-2.0-pro-exp-02-05...
The `stagehand-nextjs-quickstart` project integrates with the Vercel AI SDK primarily through Browserbase, which is used to scrape and summarize web pages for chat responses. This integration is facilitated by the `@browserbasehq/stagehand` and `@browserbasehq/sdk` packages.

**Key Integration Points:**

1.  **Environment Setup:** The project requires setting environment variables for `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and the API key for the chosen LLM provider (e.g., `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`). These are typically stored in a `.env` file.

2.  **API Endpoint:** An API endpoint (e.g., `/api/chat`) is set up to handle requests and generate responses using the Vercel AI SDK and Browserbase.

3.  **Stagehand Configuration (`stagehand.config.ts`):**
    *   `env`: This setting determines whether the script runs locally (`"LOCAL"`) or on Browserbase (`"BROWSERBASE"`).
    *   `browserbase`: This section contains `apiKey` and `projectId` for Browserbase authentication.
    *   `aiModel`:  This section configures the AI model and provider.  It includes `provider` (e.g., "openai", "anthropic"), `model` (e.g., "gpt-4", "claude-3-5-sonnet-latest"), and `apiKey`. The Vercel AI SDK provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`) are used to create the model instances.
    *   `vercelAI`:  (Based on research document inference) This section controls Vercel AI SDK settings. Though not shown in a full, explicit example, it logically would include options like `enabled: true` and perhaps `sdkVersion: 'latest'`.

4.  **Code Example (Route Handler):** The `app/api/stagehand/run.ts` file in the quickstart provides server actions for running Stagehand. The critical function is `runStagehand`, which initializes Stagehand, runs the automation logic (defined in `app/api/stagehand/main.ts`), and handles closing the Stagehand instance. A `startBBSSession` function is also present to create a new Browserbase session and get a debug URL.

    A simplified example using Browserbase and the Vercel AI SDK might look like this (combining information from multiple search result documents):

    ```typescript
    // app/api/stagehand/run.ts
    import { streamText } from 'ai';
    import { openai } from '@ai-sdk/openai'; // Or anthropic, etc.
    import { Stagehand } from "@browserbasehq/stagehand";
    import { loadConfig } from "@/app/api/stagehand/config"; // Assuming config loading

    export async function runStagehand(sessionId?: string) {
        const config = loadConfig(); // Loads from stagehand.config.ts
        const stagehand = new Stagehand({
            env: config.env, // "BROWSERBASE" or "LOCAL"
            apiKey: config.apiKey,
            projectId: config.projectId,
            modelName: config.aiModel.model,
            modelClientOptions: { apiKey: config.aiModel.apiKey }, // Pass provider API key
            headless: config.headless,
            logger: config.logger, // optional custom logger
            // ... other config options
        });

        try{
            await stagehand.init();
            await main(stagehand); // Where the core automation logic lives
        } finally {
            await stagehand.close();
        }
    }

    //app/api/stagehand/main.ts
    import {Page, BrowserContext} from "@browserbasehq/stagehand";
    import { streamText } from 'ai';
    import { openai } from '@ai-sdk/openai';

    export default async function main(stagehand: { page: Page; context: BrowserContext }) {
        await stagehand.page.goto('https://www.example.com');
        const pageContent = await stagehand.page.content();

          const response = streamText({
              model: openai('gpt-4'),  // Or use another provider, like anthropic()
              messages: [{ role: 'user', content: `Analyze this HTML:\n\n${pageContent}` }],
          });
          let responseText = "";
          for await (const chunk of response) {
              responseText += chunk;
          }
        console.log("AI Output:", responseText);

        // ... Stagehand actions based on AI response ...
    }


    ```

5. **Model Selection:** The quickstart uses the `modelName` and `modelClientOptions` properties within `stagehand.config.ts` to specify which LLM to use and how to authenticate with it.  This allows for switching between providers (like OpenAI and Anthropic) and models (like `gpt-4o` or `claude-3-5-sonnet-latest`).

In essence, the Vercel AI SDK provides the connection to the LLM, while Stagehand (building on Playwright) provides the browser automation.  Browserbase acts as the infrastructure connecting them, allowing the AI's responses to directly control browser actions, creating a powerful AI-driven web automation system. The quickstart project provides the structure and necessary configuration to tie these components together within a Next.js application.
