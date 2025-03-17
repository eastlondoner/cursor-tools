/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
            dp[i - 1][j - 1] // substitution
          );
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculate string similarity score between 0 and 1
 * 1 means strings are identical, 0 means completely different
 */
export function stringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Find similar models from a list of available models
 * Returns top 5 most similar models
 */
export function getSimilarModels(model: string, availableModels: Set<string>): string[] {
  const modelParts = model.split('/', 2);
  const provider = modelParts.length > 1 ? modelParts[0] : null;
  const modelName = modelParts.length > 1 ? modelParts[1] : model;

  // Find models from the same provider if provider is provided
  const similarModels = Array.from(availableModels).filter((m) => {
    if (provider) {
      const [mProvider] = m.split('/');
      return mProvider === provider;
    }
    return true;
  });

  // Sort by similarity to the requested model name
  return similarModels
    .sort((a, b) => {
      const [, aName] = provider ? a.split('/') : [null, a];
      const [, bName] = provider ? b.split('/') : [null, b];
      const aSimilarity = stringSimilarity(modelName, aName);
      const bSimilarity = stringSimilarity(modelName, bName);
      return bSimilarity - aSimilarity;
    })
    .slice(0, 5); // Return top 5 most similar models
}
