# vibe-tools Documentation Command Issues and Next Steps

## Current Issues

Based on the test report (`tests/reports/feature/openrouter-mcp/doc-command_report_2025-03-12T16-57-15-257Z.md`), the following issues were identified with the `doc` command:

### 1. Empty Repository Handling (Scenario 7)
- The command fails when run on empty or nearly empty repositories
- No specific logic exists to detect and handle this edge case gracefully
- Users receive technical errors rather than helpful messages

### 2. Format Parameter Support (Scenario 8)
- The command does not properly support the `--format` parameter
- No validation or clear documentation for supported formats

### 3. Large Repository Performance (Scenario 9)
- Performance issues when processing large repositories
- Potential timeout or memory problems without proper handling
- No progress indicators or partial results for large repos

### 4. Multiple Parameters Support (Scenario 10)
- Issues when combining multiple command parameters
- Possible parameter conflicts or unexpected behavior
- Lack of validation for parameter combinations

## Next Steps

### 1. Enhance Empty Repository Handling
- Add detection for empty or nearly empty repositories
- Provide meaningful documentation even for minimal codebases
- Return helpful messages instead of errors
- Example: "Repository contains minimal code. Basic structure documentation generated."

### 2. Implement Format Parameter Support
- Add support for different output formats (markdown, JSON, HTML)
- Validate format parameter values
- Document supported formats in help text

### 3. Optimize Large Repository Performance
- Implement chunking for large repositories
- Add progress indicators for long-running operations
- Provide partial results if complete processing fails
- Consider adding a `--max-size` parameter to limit processing

### 4. Improve Multiple Parameters Support
- Add validation for parameter combinations
- Document expected behavior for parameter interactions
- Handle potential conflicts gracefully

### 5. General Improvements
- Add comprehensive error handling throughout the command
- Improve retry logic with better user feedback
- Enhance documentation of command options
- Add unit tests for edge cases

## Implementation Priority

1. Empty Repository Handling - High Priority (Common edge case)
2. Format Parameter Support - Medium Priority
3. Multiple Parameters Support - Medium Priority
4. Large Repository Performance - Low Priority (Requires more extensive changes)

## Testing Strategy

After implementing fixes:

1. Run the test scenarios again using:
   ```
   pnpm dev test tests/feature-behaviors/doc/doc-command.md
   ```

2. Add additional test cases for edge conditions

3. Manually verify fixes with real-world repositories of varying sizes and complexities