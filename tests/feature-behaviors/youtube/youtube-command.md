# Feature Behavior: YouTube Video Analysis Capability

## Description
vibe-tools should enable users to analyze YouTube videos using Gemini's video understanding capabilities. The youtube command should support various analysis types like summary, transcript, plan generation, and custom queries. It should handle different output formats and provide helpful error messages for various error scenarios.

## Test Scenarios

### Scenario 1: Basic Video Summary (Happy Path)
**Task Description:**
Use vibe-tools to generate a summary of the YouTube video https://youtu.be/eh89VE3Mk5g?si=omgHsY9F-j0cMJdt.

**Expected Behavior:**
- The AI agent should determine the appropriate command to use
- The response should include a concise summary of the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with appropriate parameters
- AI agent does not use the browser command
- Response contains a relevant summary of the video. This MUST include how to publish an npm package
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Generate Implementation Plan from Video (Happy Path)
**Task Description:**
Use vibe-tools to generate an implementation plan for publishing a npm package from the YouTube video https://youtu.be/eh89VE3Mk5g?si=omgHsY9F-j0cMJdt.

**Expected Behavior:**
- The AI agent should use the youtube command with type=plan option
- The response should include a step-by-step implementation plan based on the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with type=plan parameter
- AI agent does not use the browser command
- Response MUST include mention of tsup, changesets and github actions
- Plan includes multiple actionable steps
- Command completes successfully without errors

### Scenario 3: Request Video Transcript (Happy Path)
**Task Description:**
Use vibe-tools to generate a transcript of a YouTube video https://www.youtube.com/watch?v=43c-Sm5GMbc

**Expected Behavior:**
- The AI agent should use the youtube command with type=transcript option
- The response should include a transcript of the video's audio content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with type=transcript parameter
- Response contains a transcript of the video content
- Transcript must include details of how to handle character movement, animations, tilemap setup, physics collisions, and smooth camera for sidescrolling pixel art games in Godot 4
- Command completes successfully without errors

### Scenario 4: Custom Analysis Query (Happy Path)
**Task Description:**
Use vibe-tools to ask a how Chris recommends to configure camera settings to reduce camera jitter when when moving your character small distances in his video https://www.youtube.com/watch?v=43c-Sm5GMbc

**Expected Behavior:**
- The AI agent should use the youtube command with a custom query
- The response should address the custom query based on the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with a custom query
- Response directly addresses the custom query
- Response does not include content from the video that is not relevant to getting a smooth camera movement
- Command completes successfully without errors

### Scenario 5: Different Output Formats (Happy Path)
**Task Description:**
Use vibe-tools to analyze a YouTube video with different output formats (markdown, json, text).

**Expected Behavior:**
- The AI agent should use the youtube command with different format options
- The response should be formatted according to the requested format
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with format parameter
- Response is correctly formatted in the requested format
- Command completes successfully without errors

### Scenario 6: Error Handling - Invalid YouTube URL (Error Handling)
**Task Description:**
Attempt to use vibe-tools to analyze an invalid YouTube URL.

**Expected Behavior:**
- The command should fail with a clear error message
- Error message should indicate that the provided URL is not a valid YouTube URL
- The error should be handled gracefully without crashing
- Troubleshooting suggestions should be provided

**Success Criteria:**
- AI agent recognizes the invalid URL error
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated
- Troubleshooting suggestions are provided

### Scenario 7: Error Handling - Missing Gemini API Key (Error Handling)
**Task Description:**
Attempt to use vibe-tools with the youtube command to generate a transcript of https://www.youtube.com/watch?v=43c-Sm5GMbc without setting the GEMINI_API_KEY environment variable.

**Expected Behavior:**
- The command should fail with a clear error message
- Error message should indicate that the GEMINI_API_KEY is missing
- Error message should provide guidance on how to set up the API key

**Success Criteria:**
- AI agent recognizes the missing API key issue
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated

### Scenario 8: Error Handling - Video Too Long (Error Handling)
**Task Description:**
Attempt to use vibe-tools to analyze a very long YouTube video (1+ hour).

**Expected Behavior:**
- The command should fail with a clear error message about video length limitations
- Error message should suggest using a shorter video
- Troubleshooting suggestions should be provided

**Success Criteria:**
- AI agent recognizes the video length error
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated
- Troubleshooting suggestions are provided

### Scenario 9: Error Handling - Private or Age-Restricted Video (Error Handling)
**Task Description:**
Attempt to use vibe-tools to analyze this YouTube video: https://youtu.be/v_Kntns6Znc?si=JgyumCMp0KCdkBqa which is age restricted.

**Expected Behavior:**
- The command should fail with a clear error message about access restrictions
- Error message should indicate the video might be private or age-restricted
- Troubleshooting suggestions should be provided

**Success Criteria:**
- AI agent recognizes the access restriction error
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated
- Troubleshooting suggestions are provided

### Scenario 10: Configuration - Using Config Options (Configuration)
**Task Description:**
Verify that vibe-tools respects the model and max token configuration options in vibe-tools.config.json for the YouTube command. Try calling it with different combinations of model and max tokens. Note: Valid model options for youtube are gemini-2.0-flash and gemini-2.5-pro-exp-03-25. gemini 2.5 has a max token limit of 60000 tokens, gemini 2.0 flash has a max token limit of 8000 tokens.

**Expected Behavior:**
- The command should use the model defined in the configuration if no command line --model param is set
- If custom values are provided via command line, they should override the defaults

**Success Criteria:**
- The YouTube command correctly uses the configured default model, max tokens, default type, and default format
- Command line parameters override configuration settings
