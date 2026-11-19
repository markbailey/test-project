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

describe("--exclude", () => {
  it("parseArgs collects lowercased words into a set", () => {
    const args = parseArgs(["f.txt", "--exclude", "Cat,DOG"]);
    expect(args.exclude).toEqual(new Set(["cat", "dog"]));
  });

  it("parseArgs works before the file and skips empty entries", () => {
    const args = parseArgs(["--exclude", "a,,b,", "f.txt"]);
    expect(args.file).toBe("f.txt");
    expect(args.exclude).toEqual(new Set(["a", "b"]));
  });

  it("parseArgs leaves exclude unset by default", () => {
    expect(parseArgs(["f.txt"]).exclude).toBeUndefined();
  });

  it("parseArgs throws when value is missing", () => {
    expect(() => parseArgs(["f.txt", "--exclude"])).toThrow("Missing value for --exclude");
  });

  it("drops excluded words from output", async () => {
    const c = capture("cat dog cat bird dog fish");
    expect(await run(["-", "--exclude", "cat,dog"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 1", "fish: 1"]);
    expect(c.err).toEqual([]);
  });

  it("matching ignores case", async () => {
    const c = capture("Cat CAT cat Dog bird");
    expect(await run(["-", "--exclude", "cAt,DOG"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 1"]);
  });

  it("skips empty entries", async () => {
    const c = capture("a b c a b a");
    expect(await run(["-", "--exclude", "a,,b"], c.io)).toBe(0);
    expect(c.out).toEqual(["c: 1"]);
  });

  it("works alongside --ignore-common", async () => {
    const c = capture("the cat and the dog and the bird");
    expect(await run(["-", "--ignore-common", "--exclude", "cat"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 1", "dog: 1"]);
  });

  it("works with --json", async () => {
    const c = capture("cat dog cat");
    expect(await run(["-", "--exclude", "cat", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([{ word: "dog", count: 1 }]);
  });

  it("missing value prints message and usage, exits 1", async () => {
    const c = capture("cat");
    expect(await run(["-", "--exclude"], c.io)).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err).toHaveLength(1);
    expect(c.err[0]).toContain("Missing value for --exclude");
    expect(c.err[0]).toContain(USAGE);
  });

  it("with --ngram drops any phrase containing an excluded word", async () => {
    const c = capture("the cat sat on the mat");
    expect(await run(["-", "--ngram", "2", "--exclude", "cat"], c.io)).toBe(0);
    expect(c.out).toEqual(["on the: 1", "sat on: 1", "the mat: 1"]);
  });

  it("usage and help text list --exclude", () => {
    expect(USAGE).toContain("--exclude");
    expect(HELP).toContain("--exclude");
  });
});
