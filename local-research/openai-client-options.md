Querying Perplexity AI using sonar-pro for: What are the ClientOptions for the OpenAI javascript sdk? Show me the typescript interface and explain each option.
The ClientOptions interface for the OpenAI JavaScript SDK includes the following properties:

```typescript
interface ClientOptions {
  apiKey?: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
  defaultQuery?: Record<string, string>;
  dangerouslyAllowBrowser?: boolean;
}
```

Explanation of each option:

- `apiKey`: Optional string for the OpenAI API key[1].
- `organization`: Optional string for the OpenAI organization ID[1].
- `baseURL`: Optional string to override the default API base URL[1].
- `timeout`: Optional number to set the request timeout in milliseconds[1].
- `maxRetries`: Optional number to set the maximum number of retries for failed requests[1].
- `defaultHeaders`: Optional object to set default headers for all requests[1].
- `defaultQuery`: Optional object to set default query parameters for all requests[1].
- `dangerouslyAllowBrowser`: Optional boolean to allow usage in browser environments (not recommended for security reasons)[1].

These options allow for customization of the OpenAI client behavior, including authentication, request settings, and environment-specific configurations[1].