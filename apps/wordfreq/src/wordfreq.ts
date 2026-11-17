import { readFile } from "node:fs/promises";
import { countWords, filterStopWords } from "@test-project/wordcount";

export const DEFAULT_TOP = 10;
export const USAGE = "Usage: wordfreq <file|-> [--top N] [--ignore-common] [--json]";
export const HELP = [
  USAGE,
  `  --top N          show the N most frequent words (default ${DEFAULT_TOP})`,
  "  --ignore-common  skip common stop words",
  "  --json           print results as JSON",
  "  -h, --help       show this help",
].join("\n");

export interface Args {
  file: string;
  top: number;
  ignoreCommon: boolean;
  json: boolean;
}

export function parseArgs(argv: string[]): Args {
  let file: string | undefined;
  let top = DEFAULT_TOP;
  let ignoreCommon = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ignore-common") {
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
    } else if (file === undefined) {
      file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (file === undefined) throw new Error("Missing <file> argument");
  return { file, top, ignoreCommon, json };
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
  let counts = countWords(text);
  if (args.ignoreCommon) counts = filterStopWords(counts);
  if (!args.json && Object.keys(counts).length === 0) {
    io.err(`No words found in ${args.file}`);
    return 0;
  }
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
