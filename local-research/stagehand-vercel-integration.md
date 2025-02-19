Querying Perplexity AI using sonar-pro for: How does browserbase/stagehand-nextjs-quickstart integrate with Vercel AI SDK? Show the specific configuration and code examples.
The browserbase/stagehand-nextjs-quickstart project integrates with Vercel AI SDK by using BrowserBase to scrape and summarize web pages for chat responses[1]. Here are the key integration points:

1. Environment setup:
Create a `.env` file with the following variables[1]:
```
BROWSERBASE_API_KEY
BROWSERBASE_PROJECT_ID
ANTHROPIC_API_KEY
```

2. API endpoint:
The project sets up an API endpoint at `/api/chat` that can be called to generate responses[1].

3. Code example:
Here's a sample route handler using BrowserBase and Vercel AI SDK[6]:

```typescript
export async function GET(request: Request) {
  const userMessage = "What is the weather in San Francisco?";
  const info = await getPageInfo(userMessage);
  const response = await generateText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    messages: convertToCoreMessages([
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: `Info: ${info}\n\nQuestion: ${userMessage}` }
    ]),
  });
  return new Response(JSON.stringify({ content: response.text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

This code uses BrowserBase to fetch page info and Anthropic's Claude model via Vercel AI SDK to generate a response.