const EDGE_PUNCTUATION = /^[.,!?;:"'()]+|[.,!?;:"'()]+$/g;

export function countWords(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of text.split(/\s+/)) {
    const word = token.replace(EDGE_PUNCTUATION, "").toLowerCase();
    if (!word) continue;
    counts[word] = Object.hasOwn(counts, word) ? counts[word] + 1 : 1;
  }
  return counts;
}
