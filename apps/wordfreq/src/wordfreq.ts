import { readFile } from "node:fs/promises";
import { countNgrams, ngramIsAllStopWords, STOP_WORDS } from "@test-project/wordcount";

export const DEFAULT_TOP = 10;
export const USAGE =
  "Usage: wordfreq <file|-> [--top N] [--min-count N] [-n N] [--sort count|alpha] [--ngram N] [--ignore-common] [--case-sensitive] [--no-numbers] [--percent] [--reverse] [--stop-words <path>] [--exclude <words>] [--json] [--csv] [--markdown] [--version]";
export const HELP = [
  USAGE,
  `  --top N, -n N    show the N most frequent words (default ${DEFAULT_TOP})`,
  "  --min-count N    hide words seen fewer than N times (default 1)",
  "  --sort count|alpha  order by count (default) or alphabetically",
  "  --ngram N        count phrases of N words, 1 to 5 (default 1)",
  "  --ignore-common  skip common stop words",
  "  --case-sensitive  count words with different capitalisation separately",
  "  --no-numbers     drop tokens made only of digits",
  "  --percent        show each word's share of all words as a percentage",
  "  --reverse        show the least frequent words first (count order only; ties A-Z)",
  "  --stop-words <path>  skip words listed in a file, one per line",
  "  --exclude <words>  drop comma-separated words from the output (ignores case)",
  "  --json          print results as JSON",
  "  --csv            print results as CSV",
  "  --markdown       print results as a Markdown table",
  "  --version        print the version",
  "  -h, --help       show this help",
].join("\n");

export type SortMode = "count" | "alpha";

export interface Args {
  file: string;
  top: number;
  ignoreCommon: boolean;
  caseSensitive?: boolean;
  noNumbers?: boolean;
  percent?: boolean;
  reverse?: boolean;
  json: boolean;
  csv: boolean;
  markdown: boolean;
  ngram: number;
  minCount: number;
  sort: SortMode;
  stopWordsFile?: string;
  exclude?: Set<string>;
}

export function csvField(word: string): string {
  return /[,"]/.test(word) ? `"${word.replace(/"/g, '""')}"` : word;
}

export function markdownCell(word: string): string {
  return word.replace(/\|/g, "\\|");
}

export function parseArgs(argv: string[]): Args {
  let file: string | undefined;
  let top = DEFAULT_TOP;
  let ignoreCommon = false;
  let caseSensitive = false;
  let noNumbers = false;
  let percent = false;
  let reverse = false;
  let json = false;
  let csv = false;
  let markdown = false;
  let ngram = 1;
  let minCount = 1;
  let sort: SortMode = "count";
  let stopWordsFile: string | undefined;
  let exclude: Set<string> | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--stop-words") {
      const value = argv[++i];
      if (value === undefined) throw new Error("Missing --stop-words value");
      stopWordsFile = value;
    } else if (arg === "--exclude") {
      const value = argv[++i];
      if (value === undefined) throw new Error("Missing value for --exclude");
      exclude = new Set(
        value
          .split(",")
          .map((w) => w.trim().toLowerCase())
          .filter((w) => w),
      );
    } else if (arg === "--ignore-common") {
      ignoreCommon = true;
    } else if (arg === "--case-sensitive") {
      caseSensitive = true;
    } else if (arg === "--percent") {
      percent = true;
    } else if (arg === "--reverse") {
      reverse = true;
    } else if (arg === "--no-numbers") {
      noNumbers = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--csv") {
      csv = true;
    } else if (arg === "--markdown") {
      markdown = true;
    } else if (arg === "--top" || arg === "-n") {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 0) {
        throw new Error(`Invalid ${arg} value: ${value ?? "(missing)"}`);
      }
      top = n;
    } else if (arg === "--min-count") {
      const value = argv[++i];
      const n = Number(value);
      if (value === undefined || !Number.isInteger(n) || n < 1) {
        throw new Error(`Invalid --min-count value: ${value ?? "(missing)"}`);
      }
      minCount = n;
    } else if (arg === "--sort") {
      const value = argv[++i];
      if (value !== "count" && value !== "alpha") {
        throw new Error(`Invalid --sort value: ${value ?? "(missing)"}`);
      }
      sort = value;
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
  if (json && csv) throw new Error("--csv and --json cannot be used together");
  if (json && markdown) throw new Error("Options --markdown and --json cannot be combined");
  if (file === undefined) throw new Error("Missing <file> argument");
  const args: Args = { file, top, ignoreCommon, json, csv, markdown, ngram, minCount, sort };
  if (percent) args.percent = true;
  if (reverse) args.reverse = true;
  if (caseSensitive) args.caseSensitive = true;
  if (noNumbers) args.noNumbers = true;
  if (stopWordsFile !== undefined) args.stopWordsFile = stopWordsFile;
  if (exclude !== undefined) args.exclude = exclude;
  return args;
}

export function topWords(
  counts: Record<string, number>,
  n: number,
  sort: SortMode = "count",
  reverse = false,
): Array<[string, number]> {
  const byWord = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const dir = reverse ? -1 : 1;
  return Object.entries(counts)
    .sort(([a, ca], [b, cb]) => (sort === "alpha" ? byWord(a, b) : dir * (cb - ca) || byWord(a, b)))
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
  if (argv.includes("--version")) {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    io.out(pkg.version);
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
  let counts = countNgrams(text, args.ngram, { caseSensitive: args.caseSensitive });
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const percentOf = (count: number) => Math.round((count / total) * 1000) / 10;
  const stopWords = fileStopWords
    ? (args.ignoreCommon ? new Set([...STOP_WORDS, ...fileStopWords]) : fileStopWords)
    : (args.ignoreCommon ? STOP_WORDS : undefined);
  if (stopWords) {
    counts = Object.fromEntries(
      Object.entries(counts).filter(([gram]) => !ngramIsAllStopWords(gram, stopWords)),
    );
  }
  if (args.noNumbers) {
    counts = Object.fromEntries(
      Object.entries(counts).filter(([gram]) => !gram.split(" ").some((t) => /^\p{Nd}+$/u.test(t))),
    );
  }
  const exclude = args.exclude;
  if (exclude) {
    counts = Object.fromEntries(
      Object.entries(counts).filter(([gram]) => !gram.split(" ").some((t) => exclude.has(t.toLowerCase()))),
    );
  }
  if (!args.json && !args.csv && !args.markdown && Object.keys(counts).length === 0) {
    io.err(`No words found in ${args.file}`);
    return 0;
  }
  counts = Object.fromEntries(
    Object.entries(counts).filter(([, count]) => count >= args.minCount),
  );
  const top = topWords(counts, args.top, args.sort, args.reverse);
  if (args.json) {
    io.out(
      JSON.stringify(
        top.map(([word, count]) =>
          args.percent ? { word, count, percent: percentOf(count) } : { word, count },
        ),
      ),
    );
    return 0;
  }
  if (args.markdown) {
    io.out("| word | count |");
    io.out("| --- | ---: |");
    for (const [word, count] of top) io.out(`| ${markdownCell(word)} | ${count} |`);
    return 0;
  }
  if (args.csv) {
    io.out("word,count");
    for (const [word, count] of top) io.out(`${csvField(word)},${count}`);
    return 0;
  }
  for (const [word, count] of top) {
    io.out(args.percent ? `${word}: ${count} (${percentOf(count).toFixed(1)}%)` : `${word}: ${count}`);
  }
  return 0;
}
