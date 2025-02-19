# Browser Act Speed Test Ideas

## Test Goals
- Compare the speed of different LLM models (OpenAI, Anthropic, Groq) in browser automation tasks
- Focus on straightforward but multi-step tasks that require some intelligence
- Use natural language instructions that are clear but not overly specific
- Test real-world scenarios that users might automate

## Test Scenarios

### 1. E-commerce Product Search and Details
A classic e-commerce flow that tests navigation, form filling, and verification:

1. Open the test page
2. Search for a specific product
3. Click on the product in search results
4. Verify product details on the next page

**Implementation:**
- Create `ecommerce-test.html` and `ecommerce-product-details.html` in tests/commands/browser/
- Test command example:
```bash
pnpm dev browser act "Type 'widget' into the search box | Click the search button | Click on 'Super Widget' | Verify that the page shows 'Super Widget'" --url http://localhost:3000/ecommerce-test.html
```

### 2. Multi-Page Form Navigation
A form split across multiple pages to test navigation and state management:

1. Start on page 1 with personal details
2. Fill out name and email
3. Click next to go to page 2
4. Fill out address details
5. Click next to go to page 3
6. Select preferences from dropdowns
7. Submit the form

**Implementation:**
- Create `form-page-1.html`, `form-page-2.html`, `form-page-3.html`
- Test command example:
```bash
pnpm dev browser act "Type 'John Doe' into the name field | Type 'john@example.com' into email | Click Next | Type '123 Main St' into address | Select 'CA' from state dropdown | Click Next | Select 'Option A' from preferences | Click Submit" --url http://localhost:3000/form-page-1.html
```

### 3. Interactive Elements Test
Using our existing `interactive-test.html` to test various input types:

1. Fill out a username
2. Fill out a password
3. Check the "Remember me" box
4. Select a role from dropdown
5. Click login

**Implementation:**
- Already exists in `tests/commands/browser/interactive-test.html`
- Test command example:
```bash
pnpm dev browser act "Type 'testuser' into username | Type 'password123' into password | Check the Remember me checkbox | Select Administrator from the role dropdown | Click the Login button" --url http://localhost:3000/interactive-test.html
```

## Test Methodology

### Setup
1. Start test server: `pnpm serve-test`
2. Ensure all test pages are in place
3. Configure models in `cursor-tools.config.json`

### Running Tests
For each scenario and model:
1. Run the test 3-5 times
2. Record wall-clock time using `time` command
3. Calculate average time
4. Note any failures or inconsistencies

### Models to Test
- OpenAI: gpt-4o, o3-mini
- Anthropic: claude-3-5-sonnet-latest
- Groq: deepseek-r1-distill-llama-70b, qwen-2.5

### Metrics to Collect
1. Total execution time
2. Success rate
3. Consistency of actions
4. Any error patterns

## Implementation Notes

### Test Pages
All test pages should:
- Have clear, semantic HTML
- Include proper labels and ARIA attributes
- Use consistent IDs and classes
- Be completely self-contained (no external dependencies)
- Load instantly (no artificial delays)

### Test Commands
- Use clear, natural language instructions
- Break complex actions into clear steps with the pipe operator
- Include verification steps
- Use `--debug` flag for detailed logging when needed

### Error Handling
- Pages should handle invalid input gracefully
- Include clear error messages in the UI
- Test both happy path and error scenarios

## Future Enhancements
1. Add more complex scenarios if initial tests are too easy
2. Add parallel test running capability
3. Add automated result collection and analysis
4. Add visual comparison of execution paths 