Querying Perplexity AI using sonar-pro for: For integrating Vercel AI SDK with browser automation: 1) What are the best practices for error handling and retries? 2) How do you handle provider-specific configurations and model parameters? 3) What's the recommended way to handle streaming responses with TypeScript types? 4) Are there any performance considerations or rate limiting features? Include code examples.
1) Error handling and retries best practices for Vercel AI SDK:

- Use try/catch blocks for regular errors[7]:

```typescript
try {
  const { text } = await generateText({
    model: yourModel,
    prompt: 'Write a recipe.',
  });
} catch (error) {
  // handle error
}
```

- For streaming errors, use try/catch around the stream iteration[7]:

```typescript
try {
  const { textStream } = streamText({
    model: yourModel,
    prompt: 'Write a recipe.',
  });
  for await (const textPart of textStream) {
    process.stdout.write(textPart);
  }
} catch (error) {
  // handle error
}
```

- Implement custom retry logic using exponential backoff.

2) Handling provider-specific configurations:

- Use the provider-specific package (e.g. @ai-sdk/openai) to configure the model[3]:

```typescript
import { openai } from '@ai-sdk/openai';

const response = await streamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Say this is a test.' }],
});
```

- Pass additional parameters in the options object:

```typescript
const response = await streamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Say this is a test.' }],
  temperature: 0.7,
  max_tokens: 100
});
```

3) Handling streaming responses with TypeScript:

- Use the streamText function and type the response[3]:

```typescript
import { streamText } from 'ai';

const response = await streamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Say this is a test.' }],
});

return response.toTextStreamResponse({
  headers: {
    'Content-Type': 'text/event-stream',
  },
});
```

4) Performance considerations and rate limiting:

- Use the @vercel/firewall package for custom rate limiting[9]:

```typescript
import { unstable_checkRateLimit as checkRateLimit } from '@vercel/firewall';

export async function POST(request: Request) {
  const { rateLimited } = await checkRateLimit('update-object', { request });
  if (rateLimited) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // Continue with request handling
}
```

- Be aware of Vercel's platform rate limits, e.g. 100 deployments per day for Hobby plans[4].