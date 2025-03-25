# Feature Behavior: YouTube Video Analysis Capability

## Description
cursor-tools should enable users to analyze YouTube videos using Gemini's video understanding capabilities. The youtube command should support various analysis types like summary, transcript, plan generation, and custom queries. It should handle different output formats and provide helpful error messages for various error scenarios.

## Test Scenarios

### Scenario 1: Basic Video Summary (Happy Path)
**Task Description:**
Use cursor-tools to generate a summary of a YouTube video about a technical topic.

**Expected Behavior:**
- The AI agent should determine the appropriate command to use
- The response should include a concise summary of the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with appropriate parameters
- Response contains a relevant summary of the video
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Generate Implementation Plan from Video (Happy Path)
**Task Description:**
Use cursor-tools to generate an implementation plan from a YouTube video that provides a tutorial or guide.

**Expected Behavior:**
- The AI agent should use the youtube command with type=plan option
- The response should include a step-by-step implementation plan based on the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with type=plan parameter
- Response contains a detailed implementation plan based on the video
- Plan includes actionable steps and relevant details from the video
- Command completes successfully without errors

### Scenario 3: Request Video Transcript (Happy Path)
**Task Description:**
Use cursor-tools to generate a transcript of a YouTube video.

**Expected Behavior:**
- The AI agent should use the youtube command with type=transcript option
- The response should include a transcript of the video's audio content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with type=transcript parameter
- Response contains a transcript of the video content
- Transcript is reasonably accurate and readable
- Command completes successfully without errors

### Scenario 4: Custom Analysis Query (Happy Path)
**Task Description:**
Use cursor-tools to ask a custom question about a YouTube video, requiring deeper analysis beyond a simple summary.

**Expected Behavior:**
- The AI agent should use the youtube command with a custom query
- The response should address the custom query based on the video content
- The command should complete successfully without errors

**Success Criteria:**
- AI agent correctly uses youtube command with a custom query
- Response directly addresses the custom query
- Response demonstrates understanding of the video content beyond a basic summary
- Command completes successfully without errors

### Scenario 5: Different Output Formats (Happy Path)
**Task Description:**
Use cursor-tools to analyze a YouTube video with different output formats (markdown, json, text).

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
Attempt to use cursor-tools to analyze an invalid YouTube URL.

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
Attempt to use cursor-tools youtube command without setting the GEMINI_API_KEY environment variable.

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
Attempt to use cursor-tools to analyze a very long YouTube video (1+ hour).

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
Attempt to use cursor-tools to analyze a private or age-restricted YouTube video.

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
Verify that cursor-tools respects configuration options in cursor-tools.config.json for the YouTube command.

**Expected Behavior:**
- The command should use the default values defined in the configuration
- If custom values are provided via command line, they should override the defaults

**Success Criteria:**
- The YouTube command correctly uses the configured default model, max tokens, default type, and default format
- Command line parameters override configuration settings
- The behavior is consistent with other cursor-tools commands

### Scenario 11: Performance - Long Videos (Performance)
**Task Description:**
Test the performance and handling of longer videos (5-10 minutes) to evaluate the quality of summaries and transcripts.

**Expected Behavior:**
- For videos within length limitations, the command should complete successfully
- The quality of the summary or transcript should be reasonable even for longer videos
- The command should provide status updates during processing

**Success Criteria:**
- Command completes successfully for videos within length limitations
- Output quality remains consistent even for longer videos
- Status updates are provided during processing 