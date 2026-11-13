import { readFile } from "node:fs/promises";
import { countWords } from "@test-project/wordcount";

export const DEFAULT_TOP = 10;
export const USAGE = "Usage: wordfreq <file> [--top N]";

export interface Args {
  file: string;
  top: number;
}

export function parseArgs(argv: string[]): Args {
  let file: string | undefined;
  let top = DEFAULT_TOP;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--top") {
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
  return { file, top };
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
}

export async function run(argv: string[], io: Io): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    io.err(`${(e as Error).message}\n${USAGE}`);
    return 1;
  }
  let text: string;
  try {
    text = await readFile(args.file, "utf8");
  } catch {
    io.err(`Error: cannot read file: ${args.file}`);
    return 1;
  }
  for (const [word, count] of topWords(countWords(text), args.top)) {
    io.out(`${word}: ${count}`);
  }
  return 0;
}
