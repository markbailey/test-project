import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HELP, USAGE, parseArgs, run } from "../src/wordfreq.ts";

function capture(stdinText = "") {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
      in: async () => stdinText,
    },
  };
}

const TEXT = "a a a a b b b c c d";

describe("-n short alias for --top", () => {
  it("-n 3 limits output to 3 words", async () => {
    const c = capture("a a a a b b b c c d e");
    expect(await run(["-", "-n", "3"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 4", "b: 3", "c: 2"]);
    expect(c.err).toEqual([]);
  });

  it("-n 3 gives same output as --top 3", async () => {
    const a = capture(TEXT);
    const b = capture(TEXT);
    expect(await run(["-", "-n", "3"], a.io)).toBe(0);
    expect(await run(["-", "--top", "3"], b.io)).toBe(0);
    expect(a.out).toEqual(b.out);
  });

  it("-n works before the file", async () => {
    const c = capture(TEXT);
    expect(await run(["-n", "2", "-"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 4", "b: 3"]);
  });

  it("-n 0 prints nothing", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "-n", "0"], c.io)).toBe(0);
    expect(c.out).toEqual([]);
  });

  it("parseArgs sets top from -n", () => {
    expect(parseArgs(["f.txt", "-n", "3"]).top).toBe(3);
  });

  it("-n x errors with the flag the user typed", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "-n", "x"], c.io)).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err).toEqual([`Invalid -n value: x\n${USAGE}`]);
  });

  it("-n with a negative value errors as -n", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "-n", "-1"], c.io)).toBe(1);
    expect(c.err[0]).toContain("Invalid -n value: -1");
  });

  it("-n with a non-integer errors as -n", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "-n", "1.5"], c.io)).toBe(1);
    expect(c.err[0]).toContain("Invalid -n value: 1.5");
  });

  it("-n with a missing value errors as -n", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "-n"], c.io)).toBe(1);
    expect(c.err[0]).toContain("Invalid -n value: (missing)");
  });

  it("--top errors still say --top", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--top", "x"], c.io)).toBe(1);
    expect(c.err[0]).toContain("Invalid --top value: x");
  });

  it("usage and help text mention -n", () => {
    expect(USAGE).toContain("-n N");
    expect(HELP).toContain("-n N");
  });
});

describe("README", () => {
  it("options list mentions the -n alias", () => {
    const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
    expect(readme).toMatch(/`--top N`[^\n]*`-n N`|`-n N`[^\n]*`--top N`|`--top N`, `-n N`|`-n N`, `--top N`/);
  });
});
