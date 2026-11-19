import { describe, expect, it } from "vitest";
import { HELP, USAGE, parseArgs, run, topWords } from "../src/wordfreq.ts";

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

describe("--reverse", () => {
  it("parseArgs sets reverse, default unset", () => {
    expect(parseArgs(["f.txt", "--reverse"]).reverse).toBe(true);
    expect(parseArgs(["f.txt"]).reverse).toBeUndefined();
  });

  it("topWords reverse puts least frequent first, ties A-Z", () => {
    expect(topWords({ b: 1, a: 1, c: 3, d: 2 }, 10, "count", true)).toEqual([
      ["a", 1],
      ["b", 1],
      ["d", 2],
      ["c", 3],
    ]);
  });

  it("lists least frequent first", async () => {
    const c = capture("a a a b b c");
    expect(await run(["-", "--reverse"], c.io)).toBe(0);
    expect(c.out).toEqual(["c: 1", "b: 2", "a: 3"]);
  });

  it("ties stay alphabetical A-Z", async () => {
    const c = capture("zed yak apple b b");
    expect(await run(["-", "--reverse"], c.io)).toBe(0);
    expect(c.out).toEqual(["apple: 1", "yak: 1", "zed: 1", "b: 2"]);
  });

  it("--top N shows the N least frequent words", async () => {
    const c = capture("a a a b b c d d d d");
    expect(await run(["-", "--reverse", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["c: 1", "b: 2"]);
  });

  it("works with --json", async () => {
    const c = capture("a a b");
    expect(await run(["-", "--reverse", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "b", count: 1 },
      { word: "a", count: 2 },
    ]);
  });

  it("usage and help text list --reverse", () => {
    expect(USAGE).toContain("--reverse");
    expect(HELP).toContain("--reverse");
  });
});
