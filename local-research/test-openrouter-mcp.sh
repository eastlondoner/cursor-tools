#!/bin/bash

# Test script for MCP integration with OpenRouter provider
# Tests various MCP servers with OpenRouter

# Check for required environment variables
check_env_vars() {
  if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️ Error: OPENROUTER_API_KEY environment variable is not set"
    echo "Please set the required environment variable in ~/.cursor-tools/.env"
    echo "Example:"
    echo "OPENROUTER_API_KEY=your_openrouter_api_key"
    return 1
  fi
  
  return 0
}

# Run a test with the specified MCP server and query
run_test() {
  local test_name=$1
  local query=$2
  local model=$3
  local model_arg=""

  echo ""
  echo "Test: $test_name"
  
  if [ ! -z "$model" ]; then
    model_arg="--model=$model"
    echo "Running: pnpm dev mcp run \"$query\" --provider=openrouter $model_arg"
  else
    echo "Running: pnpm dev mcp run \"$query\" --provider=openrouter"
  fi
  
  if [ ! -z "$model" ]; then
    pnpm dev mcp run "$query" --provider=openrouter --model=$model
  else
    pnpm dev mcp run "$query" --provider=openrouter
  fi
  
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "❌ Test failed with exit code $exit_code"
  else
    echo "✅ Test completed successfully"
  fi
  echo "------------------------"
}

# Main test execution
echo "Starting MCP integration tests with OpenRouter provider..."

# Check environment variables
check_env_vars
env_check=$?

if [ $env_check -ne 0 ]; then
  echo "Exiting due to missing environment variables"
  exit 1
fi

echo "All required environment variables are set"
echo "------------------------"

# Test with default model
run_test "Filesystem MCP Server - List files" "List the files in the current directory" ""

# Test with specific model
run_test "Filesystem MCP Server - List JavaScript files" "List all JavaScript files in this directory" "anthropic/claude-3-opus"

# Test with Time MCP server (this previously failed)
run_test "Time MCP Server - Current date and time" "What is the current date and time?" ""

# Test with Git MCP server
run_test "Git MCP Server - Repository status" "Show the git status of this repository" ""

# Test with invalid model
run_test "Error handling - Invalid model" "Hello world" "invalid-model"

# Test with complex query
run_test "Complex query - Repository analysis" "Analyze the structure of this repository and suggest improvements" ""

echo "------------------------"
echo "All OpenRouter tests completed." 