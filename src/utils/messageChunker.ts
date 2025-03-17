/**
 * Finds the nearest valid split point before the target index.
 * Prioritizes sentence boundaries (period, exclamation, question mark + whitespace, or newline),
 * then falls back to secondary boundaries (comma, semicolon), and finally spaces.
 * If no valid split point is found, returns the target index itself.
 */
function findNearestSplitPoint(text: string, targetIndex: number): number {
  // Primary split points: sentence boundaries with one or more whitespace characters
  const sentenceSplitRegex = /[.!?]\s+|\n/g;
  let lastMatch = 0;
  let match;

  while ((match = sentenceSplitRegex.exec(text)) !== null) {
    if (match.index > targetIndex) {
      break;
    }
    lastMatch = match.index + match[0].length;
  }

  // If no sentence boundary found, try secondary split points (comma, semicolon) or spaces
  if (lastMatch <= 0) {
    const secondarySplitRegex = /[,;]\s+|\s/g;
    while ((match = secondarySplitRegex.exec(text)) !== null) {
      if (match.index > targetIndex) {
        break;
      }
      lastMatch = match.index + match[0].length;
    }
    // If still no split point found, force split at target index
    if (lastMatch <= 0) {
      return targetIndex;
    }
  }

  return lastMatch;
}

/**
 * Splits a message into chunks that are within the specified character limit.
 * Uses an iterative approach to find good split points at sentence boundaries,
 * falling back to secondary boundaries (comma, semicolon) and spaces if needed.
 * As a last resort, will force split at the character limit.
 */
export function chunkMessage(message: string, limit: number): string[] {
  if (message.length <= limit) {
    return [message];
  }

  const chunks: string[] = [];
  let remainingText = message;

  while (remainingText.length > 0) {
    if (remainingText.length <= limit) {
      chunks.push(remainingText);
      break;
    }

    // Find the best split point within the limit
    const splitIndex = findNearestSplitPoint(remainingText, limit);

    // If no good split point found, force split at the limit
    const actualSplitIndex = splitIndex > 0 ? splitIndex : limit;

    // Extract the chunk, trim whitespace, and add to chunks if non-empty
    const chunk = remainingText.slice(0, actualSplitIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Update remaining text for next iteration
    remainingText = remainingText.slice(actualSplitIndex).trim();
  }

  return chunks;
}
