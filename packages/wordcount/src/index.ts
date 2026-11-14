// Anything that isn't a letter or digit at either end of a token; inner apostrophes survive.
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export function countWords(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of text.split(/\s+/)) {
    const word = token.replace(EDGE_PUNCTUATION, "").toLowerCase();
    if (!word) continue;
    counts[word] = Object.hasOwn(counts, word) ? counts[word] + 1 : 1;
  }
  return counts;
}

export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "of",
  "on", "or", "she", "that", "the", "their", "they", "this", "to", "was",
  "were", "will", "with", "you",
]);

export function filterStopWords(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).filter(([word]) => !STOP_WORDS.has(word)));
}
