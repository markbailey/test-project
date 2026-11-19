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

// a:4 b:3 c:2 d:2 e:1 f:1
const TEXT = "a a a a b b b c c d d e f";

describe("parseArgs --reverse", () => {
  it("sets reverse to true when given", () => {
    expect(parseArgs(["f.txt", "--reverse"]).reverse).toBe(true);
  });

  it("works before the file", () => {
    const args = parseArgs(["--reverse", "f.txt"]);
    expect(args.reverse).toBe(true);
    expect(args.file).toBe("f.txt");
  });

  it("leaves reverse unset when the flag is absent", () => {
    const args = parseArgs(["f.txt"]);
    expect(args).not.toHaveProperty("reverse");
  });
});

describe("topWords reverse", () => {
  const counts = { b: 2, a: 2, c: 5, d: 1, e: 1 };

  it("sorts counts ascending with A-Z tiebreak", () => {
    expect(topWords(counts, 10, "count", true)).toEqual([
      ["d", 1],
      ["e", 1],
      ["a", 2],
      ["b", 2],
      ["c", 5],
    ]);
  });

  it("limits to the N least frequent words", () => {
    expect(topWords(counts, 3, "count", true)).toEqual([
      ["d", 1],
      ["e", 1],
      ["a", 2],
    ]);
  });

  it("is unchanged when reverse is false or omitted", () => {
    const expected = [
      ["c", 5],
      ["a", 2],
      ["b", 2],
      ["d", 1],
      ["e", 1],
    ];
    expect(topWords(counts, 10, "count", false)).toEqual(expected);
    expect(topWords(counts, 10, "count")).toEqual(expected);
  });

  it("--sort alpha ignores reverse", () => {
    expect(topWords(counts, 10, "alpha", true)).toEqual([
      ["a", 2],
      ["b", 2],
      ["c", 5],
      ["d", 1],
      ["e", 1],
    ]);
  });
});

describe("--reverse CLI", () => {
  it("prints least frequent words first", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--reverse"], c.io)).toBe(0);
    expect(c.out).toEqual(["e: 1", "f: 1", "c: 2", "d: 2", "b: 3", "a: 4"]);
    expect(c.err).toEqual([]);
  });

  it("ties stay alphabetical A-Z", async () => {
    const c = capture("z y x z y x w");
    expect(await run(["-", "--reverse"], c.io)).toBe(0);
    expect(c.out).toEqual(["w: 1", "x: 2", "y: 2", "z: 2"]);
  });

  it("without --reverse the order is unchanged", async () => {
    const c = capture(TEXT);
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 4", "b: 3", "c: 2", "d: 2", "e: 1", "f: 1"]);
  });

  it("--top N gives the N least frequent words", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--reverse", "--top", "3"], c.io)).toBe(0);
    expect(c.out).toEqual(["e: 1", "f: 1", "c: 2"]);
  });

  it("-n N works with --reverse", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--reverse", "-n", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["e: 1", "f: 1"]);
  });

  it("--sort alpha ignores --reverse", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--reverse", "--sort", "alpha"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 4", "b: 3", "c: 2", "d: 2", "e: 1", "f: 1"]);
  });

  it("--json lists in reverse order", async () => {
    const c = capture(TEXT);
    expect(await run(["-", "--reverse", "--json", "--top", "3"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "e", count: 1 },
      { word: "f", count: 1 },
      { word: "c", count: 2 },
    ]);
  });
});

describe("--reverse help", () => {
  it("usage and help text list --reverse", () => {
    expect(USAGE).toContain("--reverse");
    expect(HELP).toContain("--reverse");
  });
});
