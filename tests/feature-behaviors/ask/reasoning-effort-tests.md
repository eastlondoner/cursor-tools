# Feature Behavior: Reasoning Effort Parameter

## Description

vibe-tools should support the reasoning effort parameter for OpenAI models and extended thinking for Anthropic models. This feature allows users to adjust the level of reasoning depth that models apply when answering questions, which can significantly improve the quality of responses for complex questions.

## Test Scenarios

### Scenario 1: OpenRouter with OpenAI Model and High Reasoning

**Tags:** openrouter, extended-reasoning
**Task Description:**
Use vibe-tools to ask a complex logical reasoning question using OpenRouter with an OpenAI model and high reasoning effort.

Use this exact query: "Explain how merge sort works, its time complexity, and provide a step-by-step walkthrough of how it would sort the array [38, 27, 43, 3, 9, 82, 10]. Analyze why it's more efficient than bubble sort for large datasets."

**Expected Behavior:**

- The AI agent should use the ask command with OpenRouter provider, "openai/o3-mini" model, and high reasoning effort
- The response should include a detailed explanation of merge sort with time complexity analysis
- The command should complete successfully without errors
- The response should show evidence of deep reasoning (comprehensive explanation, step-by-step walkthrough, clear comparisons)

**Success Criteria:**

- AI agent correctly uses ask command with OpenRouter provider and "openai/o3-mini" model
- AI agent correctly sets the reasoning effort parameter to high
- Response contains a detailed explanation of merge sort
- Response includes step-by-step walkthrough of sorting the specific array
- Response contains time complexity analysis and comparison with bubble sort
- Response shows evidence of more thorough reasoning compared to default settings
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Incompatible Model with Reasoning Effort (Warning Message)

**Tags:** extended-reasoning, error-handling, anthropic
**Task Description:**
Use vibe-tools to ask a question using a model that does not support reasoning effort, such as Anthropic with claude-3-5-haiku-latest model, and attempt to use reasoning effort parameter.

Use this exact query: "A cryptographic hash function takes an input and returns a fixed-size string of bytes. Explain what properties make a good cryptographic hash function, and analyze how SHA-256 achieves these properties. Discuss at least three real-world applications where SHA-256 is commonly used."

**Expected Behavior:**

- The AI agent should use the ask command with Anthropic provider, claude-3-5-haiku-latest model, and high reasoning effort
- The command should execute but log a warning that the model does not support reasoning effort
- The response should still provide an answer to the question
- The command should complete successfully despite the incompatible parameter

**Success Criteria:**

- AI agent correctly uses ask command with Anthropic provider and claude-3-5-haiku-latest model
- AI agent correctly sets the reasoning effort parameter to high
- Command outputs a warning message indicating the model does not support reasoning effort
- Response still explains properties of cryptographic hash functions
- Response successfully completes despite the incompatible parameter
- Console output includes a message about ignoring the reasoning effort parameter
- No errors that prevent command execution are displayed

### Scenario 3: Anthropic Model with Extended Thinking

**Tags:** extended-reasoning, anthropic
**Task Description:**
Use vibe-tools to ask a complex critical analysis question using Anthropic provider with claude-3.7-sonnet model and high reasoning effort.

Use this exact query: "Compare and contrast three major frameworks for ethical AI development: utilitarian, deontological, and virtue ethics approaches. Analyze how each framework would address issues of privacy, bias, and automation of decision-making. Then, propose a hybrid framework that combines strengths from each approach while addressing their limitations."

**Expected Behavior:**

- The AI agent should use the ask command with Anthropic provider, claude-3-7-sonnet-latest model, and high reasoning effort
- The response should include a comprehensive comparison of ethical frameworks with detailed analysis
- The command should complete successfully without errors
- The response should show evidence of extended thinking (thorough comparison, nuanced analysis, thoughtful hybrid proposal)

**Success Criteria:**

- AI agent correctly uses ask command with Anthropic provider and claude-3-7-sonnet-latest model
- AI agent correctly sets the reasoning effort parameter to high (maps to extended thinking)
- Response includes comparison of three ethical frameworks
- Response analyzes how each framework addresses specific ethical issues
- Response proposes a hybrid framework with strengths from each approach
- Response shows evidence of deeper analysis with extended thinking enabled
- Console output includes a message about using extended thinking with appropriate token budget
- No error messages are displayed
- Command completes within a reasonable time
