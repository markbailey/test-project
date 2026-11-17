import { readFile } from "node:fs/promises";
import { countNgrams, ngramIsAllStopWords, STOP_WORDS } from "@test-project/wordcount";

export const DEFAULT_TOP = 10;
export const USAGE =
  "Usage: wordfreq <file|-> [--top N] [--min-count N] [--ngram N] [--ignore-common] [--stop-words <path>] [--json]";
export const HELP = [
  USAGE,
  `  --top N          show the N most frequent words (default ${DEFAULT_TOP})`,
  "  --min-count N    hide words seen fewer than N times (default 1)",
  "  --ngram N        count phrases of N words, 1 to 5 (default 1)",
  "  --ignore-common  skip common stop words",
  "  --stop-words <path>  skip words listed in a file, one per line",
  "  --json           print results as JSON",
  "  -h, --help       show this help",
].join("\n");

export interface Args {
  file: string;
  top: number;
  ignoreCommon: boolean;
  json: boolean;
  ngram: number;
  minCount: number;
  stopWordsFile?: string;
}

export function parseArgs(argv: string[]): Args {
  let file: string | undefined;
  let top = DEFAULT_TOP;
  let ignoreCommon = false;
  let json = false;
  let ngram = 1;
  let minCount = 1;
  let stopWordsFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--stop-words") {
      const value = argv[++i];
      if (value === undefined) throw new Error("Missing --stop-words value");
      stopWordsFile = value;
    } else if (arg === "--ignore-common") {
      ignoreCommon = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--top") {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 0) {
        throw new Error(`Invalid --top value: ${value ?? "(missing)"}`);
      }
      top = n;
    } else if (arg === "--min-count") {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 1) {
        throw new Error(`Invalid --min-count value: ${value ?? "(missing)"}`);
      }
      minCount = n;
    } else if (arg === "--ngram") {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error(`Invalid --ngram value: ${value ?? "(missing)"}`);
      }
      ngram = n;
    } else if (file === undefined) {
      file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (file === undefined) throw new Error("Missing <file> argument");
  return stopWordsFile === undefined
    ? { file, top, ignoreCommon, json, ngram, minCount }
    : { file, top, ignoreCommon, json, ngram, minCount, stopWordsFile };
}

export function topWords(
  counts: Record<string, number>,
  n: number,
): Array<[string, number]> {
  return Object.entries(counts)
    .sort(([a, ca], [b, cb]) => cb - ca || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, n);
}

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  in: () => Promise<string>;
}

export async function run(argv: string[], io: Io): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    io.out(HELP);
    return 0;
  }
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    io.err(`${(e as Error).message}\n${USAGE}`);
    return 1;
  }
  let text: string;
  if (args.file === "-") {
    text = await io.in();
  } else {
    try {
      text = await readFile(args.file, "utf8");
    } catch {
      io.err(`Error: cannot read file: ${args.file}`);
      return 1;
    }
  }
  let fileStopWords: Set<string> | undefined;
  if (args.stopWordsFile !== undefined) {
    let content: string;
    try {
      content = await readFile(args.stopWordsFile, "utf8");
    } catch {
      io.err(`Error: cannot read stop words file: ${args.stopWordsFile}`);
      return 1;
    }
    fileStopWords = new Set(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.toLowerCase()),
    );
  }
  let counts = countNgrams(text, args.ngram);
  const stopWords = fileStopWords
    ? (args.ignoreCommon ? new Set([...STOP_WORDS, ...fileStopWords]) : fileStopWords)
    : (args.ignoreCommon ? STOP_WORDS : undefined);
  if (stopWords) {
    counts = Object.fromEntries(
      Object.entries(counts).filter(([gram]) => !ngramIsAllStopWords(gram, stopWords)),
    );
  }
  if (!args.json && Object.keys(counts).length === 0) {
    io.err(`No words found in ${args.file}`);
    return 0;
  }
  counts = Object.fromEntries(
    Object.entries(counts).filter(([, count]) => count >= args.minCount),
  );
  const top = topWords(counts, args.top);
  if (args.json) {
    io.out(JSON.stringify(top.map(([word, count]) => ({ word, count }))));
    return 0;
  }
  for (const [word, count] of top) {
    io.out(`${word}: ${count}`);
  }
  return 0;
}
