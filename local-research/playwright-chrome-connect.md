Querying Perplexity AI using sonar-pro for: How to connect Playwright to an existing Chrome instance? What are the requirements and steps?
To connect Playwright to an existing Chrome instance:

Requirements:
- An existing Chrome instance running with remote debugging enabled
- Playwright installed in your project

Steps:
1. Launch Chrome with remote debugging enabled:
```
chrome --remote-debugging-port=9222
```

2. Use the `connectOverCDP` method to connect Playwright:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = await browser.newPage();
  await page.goto('https://example.com');
  // Perform actions...
  await browser.close();
})();
```

Key points:
- Only works with Chromium-based browsers
- Requires Chrome to be launched with `--remote-debugging-port` flag
- Use `chromium.connectOverCDP()` instead of `chromium.launch()`
- The default browser context is accessible via `browser.contexts()`[1][5][9]

This method is useful for debugging, running tests in pre-configured environments, or when you need to connect to an already running Chrome instance[1][3].