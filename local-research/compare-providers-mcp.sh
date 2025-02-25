#!/bin/bash

# Script to directly compare Anthropic and OpenRouter with the same MCP servers
# This will help determine if issues are specific to OpenRouter or more general

# Load environment variables from .env file
ENV_FILE="$HOME/.cursor-tools/.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "Warning: $ENV_FILE not found"
fi

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$OPENROUTER_API_KEY" ]; then
  echo "⚠️ Error: Both ANTHROPIC_API_KEY and OPENROUTER_API_KEY must be set"
  echo "Please set both environment variables in ~/.cursor-tools/.env"
  exit 1
fi

# Create a results directory
RESULTS_DIR="local-research/test-results"
mkdir -p "$RESULTS_DIR"

# Function to run a test with both providers
compare_test() {
  local test_name=$1
  local query=$2
  local anthropic_model=$3
  local openrouter_model=$4
  
  echo ""
  echo "=== Test: $test_name ==="
  echo ""
  
  # Run with Anthropic
  echo "Running with Anthropic provider..."
  if [ ! -z "$anthropic_model" ]; then
    echo "Command: pnpm dev mcp run \"$query\" --provider=anthropic --model=$anthropic_model"
    pnpm dev mcp run "$query" --provider=anthropic --model=$anthropic_model > "$RESULTS_DIR/${test_name}-anthropic.txt" 2>&1
  else
    echo "Command: pnpm dev mcp run \"$query\" --provider=anthropic"
    pnpm dev mcp run "$query" --provider=anthropic > "$RESULTS_DIR/${test_name}-anthropic.txt" 2>&1
  fi
  
  anthropic_exit=$?
  if [ $anthropic_exit -eq 0 ]; then
    echo "✅ Anthropic test completed successfully"
  else
    echo "❌ Anthropic test failed with exit code $anthropic_exit"
  fi
  
  # Run with OpenRouter
  echo ""
  echo "Running with OpenRouter provider..."
  if [ ! -z "$openrouter_model" ]; then
    echo "Command: pnpm dev mcp run \"$query\" --provider=openrouter --model=$openrouter_model"
    pnpm dev mcp run "$query" --provider=openrouter --model=$openrouter_model > "$RESULTS_DIR/${test_name}-openrouter.txt" 2>&1
  else
    echo "Command: pnpm dev mcp run \"$query\" --provider=openrouter"
    pnpm dev mcp run "$query" --provider=openrouter > "$RESULTS_DIR/${test_name}-openrouter.txt" 2>&1
  fi
  
  openrouter_exit=$?
  if [ $openrouter_exit -eq 0 ]; then
    echo "✅ OpenRouter test completed successfully"
  else
    echo "❌ OpenRouter test failed with exit code $openrouter_exit"
  fi
  
  # Compare results
  echo ""
  echo "Comparing results..."
  if [ $anthropic_exit -eq $openrouter_exit ]; then
    if [ $anthropic_exit -eq 0 ]; then
      echo "✅ Both providers succeeded"
    else
      echo "❌ Both providers failed"
    fi
  else
    if [ $anthropic_exit -eq 0 ]; then
      echo "⚠️ Anthropic succeeded but OpenRouter failed"
    else
      echo "⚠️ OpenRouter succeeded but Anthropic failed"
    fi
  fi
  
  echo ""
  echo "Results saved to:"
  echo "- $RESULTS_DIR/${test_name}-anthropic.txt"
  echo "- $RESULTS_DIR/${test_name}-openrouter.txt"
  echo ""
  echo "You can compare the results with:"
  echo "diff $RESULTS_DIR/${test_name}-anthropic.txt $RESULTS_DIR/${test_name}-openrouter.txt"
  echo "------------------------"
}

echo "Starting direct comparison of Anthropic and OpenRouter with MCP servers..."

# Test 1: Filesystem MCP Server - List files
compare_test "filesystem-list" "List the files in the current directory" "" ""

# Test 2: Time MCP Server - Current date and time
compare_test "time-current" "What is the current date and time?" "" ""

# Test 3: Git MCP Server - Repository status
compare_test "git-status" "Show the git status of this repository" "" ""

# Test 4: Invalid model test
compare_test "invalid-model" "Hello world" "invalid-model-anthropic" "invalid-model-openrouter"

echo "All comparison tests completed. Results saved to $RESULTS_DIR/" 