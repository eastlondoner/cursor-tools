Querying Perplexity AI using sonar-pro for: What is OpenRouter, how do you use it, and what Google Gemini models does it support? Include API usage examples and pricing information.
OpenRouter is a unified API that provides access to multiple large language models (LLMs) from different providers through a single interface[1][5]. It supports models from OpenAI, Anthropic, Google, and others[3].

To use OpenRouter:
1. Create an account at openrouter.ai
2. Generate an API key
3. Make API calls using the OpenRouter endpoint and your API key[6]

API usage example:

```python
import requests

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {
    "model": "google/gemini-pro",
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

Google Gemini models supported by OpenRouter:
- Gemini Pro 1.5
- Gemini Flash 8B Experimental[4]

Pricing (as of November 2024):
- Gemini Pro 1.5: $0.0025 per 1k input tokens, $0.0075 per 1k output tokens
- Some models like Google Gemma 2 9B and Gemini Flash 8B Experimental are free[4]

OpenRouter uses a pay-as-you-go model with no subscription fees[9].