
--- Repository Documentation ---

```markdown
# 🤘 Stagehand Next.js Quickstart

This project is a Next.js starter kit built with [Stagehand](https://github.com/browserbase/stagehand), a SDK for automating browsers. It's built on top of [Playwright](https://playwright.dev/) and provides features for debugging and AI fail-safes.

## Quick Start

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    This command starts the Next.js development server with turbopack.

## What's Next?

### Add your API keys

This project defaults to using OpenAI.
You'll also want to set your Browserbase API key and project ID to run this project in the cloud.

```bash
cp .example.env .env # Add your API keys to .env
```

### Run on Browserbase

To run on Browserbase, add your API keys to `.env` and change `env: "LOCAL"` to `env: "BROWSERBASE"` in `stagehand.config.ts`.

## Project Structure
The project includes a server-side entry point (`app/api/stagehand/run.ts`) and the main Stagehand script (`app/api/stagehand/main.ts`). Configurations can be edited in `stagehand.config.ts`.

## Core Files
- `app/api/stagehand/main.ts`: This is where the automation logic resides.
- `app/api/stagehand/run.ts`: Server-side entry point for Stagehand.
- `stagehand.config.ts`: Configuration file for Stagehand.

## Package: `@browserbasehq/stagehand`
- **Summary:** A library for automating browser interactions using Playwright, enhanced with AI capabilities.
- **How to import:**
  ```typescript
    import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
  ```
### Public API:

-   **`Stagehand` Class:**
    -   **Constructor:** `new Stagehand(config: ConstructorParams)`
        -   `config`: Configuration object (see `stagehand.config.ts` for details).
    -   **`init()`:** Initializes the Stagehand instance.
        - Returns: `Promise<void>`
    -   **`close()`:** Closes the browser and cleans up resources.
        - Returns: `Promise<void>`
    -   **`page` property**:  Provides a Playwright `Page` object, extended with Stagehand's AI methods.
    - **`context` property**: Provides a Playwright `BrowserContext` object.
    - **`act(params: { action: string; }): Promise<any>`**: Let Stagehand AI take over and complete the action.
      - `action`: Description of the action.
      - Returns:  `Promise<any>` (Result of the AI action)
    -  **`extract`**:  Use AI to extract information from the web page, the return value will be parsed based on the Zod schema you provide.
    - **`observe`**: Observe elements in the current page, will return AI generated selectors based on the description you provide.
-   **`Page` (extended Playwright Page):**
    -   **`extract(params: { instruction: string; schema: z.ZodObject<any> }): Promise<z.infer<typeof params.schema>>`**:  Extracts information from the page based on a given instruction and validates it against a Zod schema.
        -   `instruction`: Natural language instruction for extraction.
        -   `schema`: Zod schema for the expected data structure.
    -   **`observe(params: { instruction: string }): Promise<{ description: string; selector: string }[]>`**:  Observes elements on the page based on the provided instruction, returning an array of descriptions and their corresponding CSS selectors.
        -   `instruction`: Natural language instruction for observation.

## Package: `@browserbasehq/sdk`
- **Summary**: Browserbase SDK for interacting with Browserbase see [Browserbase Sessions](https://docs.browserbase.com/docs/sessions)
-   **How to import:**
  ```typescript
  import Browserbase from "@browserbasehq/sdk";
  ```

### Public API:
- **`Browserbase` class:**
  - **Constructor** `new Browserbase(config: ConstructorParams)`
  - `config`: configuration object.
  - **`sessions` property:** Provides access to session management.
    - `create(params: {projectId: string}): Promise<Session>`
      - `projectId`: Browserbase project id.
      - Returns: `Promise<Session>` Created session
    - `debug(sessionId: string): Promise<{debuggerFullscreenUrl: string}>`
      - `sessionId`: The id of the session.
      - Returns: `Promise<{debuggerFullscreenUrl: string}>` Debug URL.

## Configuration (`stagehand.config.ts`)

This file exports a `StagehandConfig` object of type `ConstructorParams`. Key options include:

-   `env`: `"BROWSERBASE"` or `"LOCAL"`.  Determines where the script runs (cloud or locally).
-   `apiKey`:  Your Browserbase API key.
-   `projectId`: Your Browserbase project ID.
-   `debugDom`: Enables DOM debugging.
-   `headless`:  Whether to run the browser in headless mode.
-   `logger`:  Custom logging function.  The default logger is provided, and an example of a custom logger with more details is provided.
-   `domSettleTimeoutMs`: Timeout for the DOM to settle.
- `browserbaseSessionCreateParams`: Creation parameters for Browserbase sessions.
-   `enableCaching`: Enables or disables caching.
-   `browserbaseSessionID`:  Session ID for resuming a Browserbase session.
-   `modelName`:  The LLM model name (e.g., `"gpt-4o"`).
-   `modelClientOptions`: Configuration for the model client (e.g., API key).

## Dependencies and Requirements

-   **Node.js:** (v20 or later recommended)
-   **npm:** Node Package Manager
-   **Playwright:** Installed as part of `@browserbasehq/stagehand`.
-   **Zod:**  For schema validation.
- **Next.js**: Version 15.1.6
-   **React**: Version 19.0.0
-   **tailwindcss**: Version 3.4.1

-   **API Keys:**
    -   Browserbase API Key (for cloud execution).
    -   OpenAI API Key (default LLM).  Or Anthropic API key (if configured).

## Advanced Usage

### Custom Logging

The `logger` option in `stagehand.config.ts` allows you to define a custom logging function. The provided `logLineToString` function demonstrates how to format and filter log messages. You can customize this function to control log output.

### Switching to Anthropic Claude 3.5 Sonnet

1.  Add your Anthropic API key to `.env`.
2.  In `stagehand.config.ts`, change `modelName` to `"claude-3-5-sonnet-latest"`.
3.  Update `modelClientOptions` to use your Anthropic API key: `{ apiKey: process.env.ANTHROPIC_API_KEY }`.

### Example: Running a Stagehand Session

The `app/api/stagehand/run.ts` file provides server actions for starting and running Stagehand:

- **`runStagehand(sessionId?: string)`:** Runs the Stagehand automation script defined in `main.ts`. It initializes Stagehand, runs the `main` function, and closes the Stagehand instance.
  - `sessionId`: optional Browserbase session id
-   **`startBBSSession(): Promise<{ sessionId: string; debugUrl: string }>`:**  Starts a new Browserbase session and returns the session ID and debug URL.
- **`getConfig()`:** get current Stagehand configuration.
```typescript
// Example usage within app/page.tsx
import { runStagehand, startBBSSession, getConfig } from "@/app/api/stagehand/run";
// ... inside a component
  const startScript = useCallback(async () => {
    if (!config) return;
    setRunning(true);
    try {
      if (config.env === "BROWSERBASE") {
        const { sessionId, debugUrl } = await startBBSSession();
        setDebugUrl(debugUrl);
        setSessionId(sessionId);
        await runStagehand(sessionId);
      } else {
        await runStagehand();
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setRunning(false);
    }
  }, [config]);

```


--- End of Documentation ---
