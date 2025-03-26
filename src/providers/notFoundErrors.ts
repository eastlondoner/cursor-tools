/**
 * Utility function to detect if an error is related to a model not being found
 * across different provider APIs.
 *
 * @param error - The error object from the API call
 * @returns boolean indicating if this is a model not found error
 */
export function isModelNotFoundError(error: unknown): boolean {
  // Check for error properties from structured errors
  if (error && typeof error === 'object') {
    // Check error codes (common in OpenAI, OpenRouter)
    if (
      'code' in error &&
      typeof error.code === 'string' &&
      ['model_not_found', 'invalid_model', 'model_not_available'].includes(error.code)
    ) {
      return true;
    }

    // Check error types (common in Anthropic)
    if (
      'type' in error &&
      typeof error.type === 'string' &&
      ['invalid_request_error', 'model_error'].includes(error.type)
    ) {
      // For these error types, we should check if the message relates to model not found
      if ('message' in error && typeof error.message === 'string') {
        return isModelNotFoundErrorMessage(error.message);
      }
    }

    // Check status code (common in Anthropic)
    if ('status' in error && error.status === 404) {
      return true;
    }
  }

  // Check error message patterns
  if (error instanceof Error) {
    return isModelNotFoundErrorMessage(error.message);
  }

  return false;
}

/**
 * Helper function to check if an error message indicates a model not found error
 *
 * @param message - The error message to check
 * @returns boolean indicating if this message suggests a model not found error
 */
function isModelNotFoundErrorMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Common error message patterns across providers
  const modelNotFoundPatterns = [
    'model not found',
    'no model',
    'invalid model',
    'does not exist',
    'unavailable model',
    'model is not supported',
    'model invalid',
    'model could not be found',
    'the model', // This is too general by itself, needs to be combined
  ];

  return (
    modelNotFoundPatterns.some((pattern) => lowerMessage.includes(pattern)) &&
    // If it includes "the model", ensure it's combined with another indicator
    (lowerMessage.includes('the model')
      ? lowerMessage.includes('does not exist') ||
        lowerMessage.includes('unavailable') ||
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('not found')
      : true)
  );
}
