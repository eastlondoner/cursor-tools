#!/bin/bash
# make bash play nicely
set -eo pipefail

# Function to run a command and capture its precise start/end times
run_and_time() {
    local command="$1"
    local start_file="$2"
    local end_file="$3"

    # Capture start time in seconds since epoch
    date +%s > "$start_file"

    # Execute the command and capture the exit code
    eval "$command"
    local exit_code=$?

    # Capture end time in seconds since epoch
    date +%s > "$end_file"

    # Return the original exit code
    return $exit_code
}

# Create temporary files for storing timestamps
anthropic_start_file=$(mktemp)
anthropic_end_file=$(mktemp)
groq_start_file=$(mktemp)
groq_end_file=$(mktemp)

# Run the commands in parallel, capturing their start/end times in separate files
run_and_time "pnpm dev browser act \"Click the start button and Type 'anthropic: claude-3-5-sonnet-latest' in the name field | Click on Button 1, Click on Button 2,  Click on Button 3 | Type 'DONE, stagehand will check if all steps completed then exit' in the Message input and Click on the Stop Button\" --url http://localhost:3000/test-browser-control --model claude-3-5-sonnet-latest --connect-to 9223" "$anthropic_start_file" "$anthropic_end_file" &
anthropic_pid=$!

run_and_time "pnpm dev browser act \"Click the start button and Type 'groq: qwen-2.5-32b' in the name field | Click on Button 1, Click on Button 2,  Click on Button 3 | Type 'DONE, stagehand will check if all steps completed then exit' in the Message input and Click on the Stop Button\" --url http://localhost:3000/test-browser-control --model qwen-2.5-32b --connect-to 9224" "$groq_start_file" "$groq_end_file" &
groq_pid=$!

# Wait for both processes to finish
wait "$groq_pid"
wait "$anthropic_pid"

# Read the start and end times from the files
anthropic_start=$(cat "$anthropic_start_file")
anthropic_end=$(cat "$anthropic_end_file")
groq_start=$(cat "$groq_start_file")
groq_end=$(cat "$groq_end_file")

# Clean up the temporary files
rm "$anthropic_start_file" "$anthropic_end_file" "$groq_start_file" "$groq_end_file"

# Calculate durations in seconds
anthropic_duration=$((anthropic_end - anthropic_start))
groq_duration=$((groq_end - groq_start))

# Print results
echo "Test execution times:"
echo "Anthropic (claude-3-5-sonnet-latest): $anthropic_duration seconds"
echo "Groq (qwen-2.5-32b): $groq_duration seconds"
echo "Difference: $((anthropic_duration - groq_duration)) seconds (positive means Groq is faster)"
