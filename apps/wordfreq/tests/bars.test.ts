import { describe, expect, it } from "vitest";
import { BAR_WIDTH, HELP, USAGE, parseArgs, run } from "../src/wordfreq.ts";

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

const rep = (w: string, n: number) => Array(n).fill(w).join(" ");

describe("--bars", () => {
  it("exports BAR_WIDTH = 40", () => {
    expect(BAR_WIDTH).toBe(40);
  });

  it("parseArgs sets bars true", () => {
    expect(parseArgs(["-", "--bars"]).bars).toBe(true);
  });

  it("parseArgs leaves bars unset by default", () => {
    expect(parseArgs(["-"]).bars).toBeFalsy();
  });

  it("top word gets 40 #, others scale (4 vs 1 → 40 and 10)", async () => {
    const c = capture(`${rep("cat", 4)} dog`);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${"#".repeat(40)}`, `dog: 1 ${"#".repeat(10)}`]);
    expect(c.err).toEqual([]);
  });

  it("rounds bar length (3 vs 1 → 40 and 13)", async () => {
    const c = capture("a a a b");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 3 ${"#".repeat(40)}`, `b: 1 ${"#".repeat(13)}`]);
  });

  it("every word shown gets at least one # (1 vs 100)", async () => {
    const c = capture(`${rep("big", 100)} tiny`);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`big: 100 ${"#".repeat(40)}`, `tiny: 1 #`]);
  });

  it("equal counts all get 40 #", async () => {
    const c = capture("x y");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`x: 1 ${"#".repeat(40)}`, `y: 1 ${"#".repeat(40)}`]);
  });

  it("max is the top count among shown words, after --min-count", async () => {
    const c = capture("a a a a b b c");
    expect(await run(["-", "--bars", "--min-count", "2"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 4 ${"#".repeat(40)}`, `b: 2 ${"#".repeat(20)}`]);
  });

  it("without --bars output is unchanged", async () => {
    const c = capture("a b a");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 2", "b: 1"]);
  });

  it("--json ignores the flag without error", async () => {
    const c = capture("a b a");
    expect(await run(["-", "--bars", "--json"], c.io)).toBe(0);
    expect(c.err).toEqual([]);
    expect(c.out).toHaveLength(1);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "a", count: 2 },
      { word: "b", count: 1 },
    ]);
  });

  it("--csv output is unchanged by --bars", async () => {
    const c = capture("a b a");
    expect(await run(["-", "--bars", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "a,2", "b,1"]);
  });

  it("usage and help text list --bars", () => {
    expect(USAGE).toContain("--bars");
    expect(HELP).toContain("--bars");
  });
});
