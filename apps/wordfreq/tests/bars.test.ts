import { describe, expect, it } from "vitest";
import * as wordfreq from "../src/wordfreq.ts";
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

const rep = (word: string, n: number) => Array(n).fill(word).join(" ");

describe("--bars", () => {
  it("exports BAR_WIDTH = 40", () => {
    expect((wordfreq as Record<string, unknown>).BAR_WIDTH).toBe(40);
  });

  it("parseArgs sets bars to true", () => {
    expect(parseArgs(["-", "--bars"]).bars).toBe(true);
  });

  it("parseArgs leaves bars unset by default", () => {
    expect(parseArgs(["-"]).bars).toBeFalsy();
  });

  it("top word gets 40 #, others scale in proportion", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${"#".repeat(40)}`, `dog: 1 ${"#".repeat(10)}`]);
    expect(c.err).toEqual([]);
  });

  it("a single word gets a full 40-wide bar", async () => {
    const c = capture("a a a");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 3 ${"#".repeat(40)}`]);
  });

  it("bar length is rounded (3 of 7 → 17)", async () => {
    const c = capture(`${rep("a", 7)} ${rep("b", 3)}`);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 7 ${"#".repeat(40)}`, `b: 3 ${"#".repeat(17)}`]);
  });

  it("every word shown gets at least one #", async () => {
    const c = capture(`${rep("big", 100)} small`);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`big: 100 ${"#".repeat(40)}`, "small: 1 #"]);
  });

  it("works with --top", async () => {
    const c = capture("a a a a b b c");
    expect(await run(["-", "--bars", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 4 ${"#".repeat(40)}`, `b: 2 ${"#".repeat(20)}`]);
  });

  it("works with --sort alpha (max is still the top count)", async () => {
    const c = capture("b b b b a");
    expect(await run(["-", "--bars", "--sort", "alpha"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 1 ${"#".repeat(10)}`, `b: 4 ${"#".repeat(40)}`]);
  });

  it("without --bars output is unchanged", async () => {
    const c = capture("cat cat dog");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 2", "dog: 1"]);
  });

  it("--json ignores the flag without error", async () => {
    const withBars = capture("a b a");
    const plain = capture("a b a");
    expect(await run(["-", "--json", "--bars"], withBars.io)).toBe(0);
    expect(await run(["-", "--json"], plain.io)).toBe(0);
    expect(withBars.out).toEqual(plain.out);
    expect(withBars.err).toEqual([]);
    expect(withBars.out[0]).not.toContain("#");
  });

  it("--csv is unchanged by the flag", async () => {
    const withBars = capture("a b a");
    expect(await run(["-", "--csv", "--bars"], withBars.io)).toBe(0);
    expect(withBars.out).toEqual(["word,count", "a,2", "b,1"]);
  });

  it("usage and help text list --bars", () => {
    expect(USAGE).toContain("--bars");
    expect(HELP).toContain("--bars");
  });
});
