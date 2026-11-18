// Anything that isn't a letter or digit at either end of a token; inner apostrophes survive.
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

// Words per sentence; a raw token ending in . ! or ? closes its sentence.
function tokenizeSentences(text: string): string[][] {
  const sentences: string[][] = [[]];
  for (const token of text.split(/(?:\s|[—–/]|-{2,})+/u)) {
    const word = token.replace(EDGE_PUNCTUATION, "").toLowerCase();
    if (word) sentences[sentences.length - 1].push(word);
    if (/[.!?]$/u.test(token)) sentences.push([]);
  }
  return sentences;
}

export function countWords(text: string): Record<string, number> {
  return countNgrams(text, 1);
}

export function countNgrams(text: string, n: number): Record<string, number> {
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new RangeError(`n must be an integer from 1 to 5, got ${n}`);
  }
  const counts: Record<string, number> = {};
  for (const words of tokenizeSentences(text)) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      counts[gram] = Object.hasOwn(counts, gram) ? counts[gram] + 1 : 1;
    }
  }
  return counts;
}

export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "of",
  "on", "or", "she", "that", "the", "their", "they", "this", "to", "was",
  "were", "will", "with", "you",
]);

export function filterStopWords(
  counts: Record<string, number>,
  stopWords: ReadonlySet<string> = STOP_WORDS,
): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).filter(([word]) => !stopWords.has(word)));
}

export function ngramIsAllStopWords(
  ngram: string,
  stopWords: ReadonlySet<string> = STOP_WORDS,
): boolean {
  return ngram.split(" ").every((word) => stopWords.has(word));
}
