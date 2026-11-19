import { describe, expect, it } from "vitest";
import { HELP, parseArgs, run, USAGE } from "../src/wordfreq.ts";

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
  describe("parseArgs", () => {
    it("collects lowercased words into a set", () => {
      expect(parseArgs(["f.txt", "--exclude", "Cat,DOG"]).exclude).toEqual(
        new Set(["cat", "dog"]),
      );
    });

    it("works before or after file", () => {
      expect(parseArgs(["--exclude", "cat", "f.txt"]).exclude).toEqual(new Set(["cat"]));
      expect(parseArgs(["f.txt", "--exclude", "cat"]).exclude).toEqual(new Set(["cat"]));
    });

    it("skips empty entries", () => {
      expect(parseArgs(["f.txt", "--exclude", "a,,b,"]).exclude).toEqual(new Set(["a", "b"]));
    });

    it("leaves exclude unset when option absent", () => {
      expect(parseArgs(["f.txt"]).exclude).toBeUndefined();
    });

    it("throws when value is missing", () => {
      expect(() => parseArgs(["f.txt", "--exclude"])).toThrow("Missing value for --exclude");
    });
  });

  describe("run", () => {
    it("drops excluded words from output", async () => {
      const c = capture("cat dog cat bird");
      expect(await run(["-", "--exclude", "cat,dog"], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1"]);
      expect(c.err).toEqual([]);
    });

    it("ignores case in both the option and the text", async () => {
      const c = capture("Cat CAT cat Dog bird");
      expect(await run(["-", "--exclude", "cAt,DOG"], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1"]);
    });

    it("skips empty entries without dropping anything extra", async () => {
      const c = capture("a b c a");
      expect(await run(["-", "--exclude", "a,,b"], c.io)).toBe(0);
      expect(c.out).toEqual(["c: 1"]);
    });

    it("an all-empty list excludes nothing", async () => {
      const c = capture("a b a");
      expect(await run(["-", "--exclude", ",,"], c.io)).toBe(0);
      expect(c.out).toEqual(["a: 2", "b: 1"]);
    });

    it("works with --json", async () => {
      const c = capture("x y x z");
      expect(await run(["-", "--exclude", "x", "--json"], c.io)).toBe(0);
      expect(JSON.parse(c.out[0])).toEqual([
        { word: "y", count: 1 },
        { word: "z", count: 1 },
      ]);
    });

    it("applies before --top", async () => {
      const c = capture("a a a b b c");
      expect(await run(["-", "--exclude", "a", "--top", "1"], c.io)).toBe(0);
      expect(c.out).toEqual(["b: 2"]);
    });

    it("combines with --ignore-common", async () => {
      const c = capture("The cat and the dog and a bird");
      expect(await run(["-", "--ignore-common", "--exclude", "cat"], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1", "dog: 1"]);
    });

    it("drops any n-gram containing an excluded word", async () => {
      const c = capture("big cat sat. big dog sat. big bird sat");
      expect(await run(["-", "--ngram", "2", "--exclude", "cat,dog"], c.io)).toBe(0);
      expect(c.out).toEqual(["big bird: 1", "bird sat: 1"]);
    });

    it("reports no words when everything is excluded", async () => {
      const c = capture("cat Cat");
      expect(await run(["-", "--exclude", "cat"], c.io)).toBe(0);
      expect(c.out).toEqual([]);
      expect(c.err).toEqual(["No words found in -"]);
    });
  });

  describe("missing value", () => {
    it("prints error and usage, exits 1", async () => {
      const c = capture("cat");
      expect(await run(["-", "--exclude"], c.io)).toBe(1);
      expect(c.out).toEqual([]);
      expect(c.err).toHaveLength(1);
      expect(c.err[0]).toContain("Missing value for --exclude");
      expect(c.err[0]).toContain(USAGE);
    });
  });

  describe("help text", () => {
    it("usage and help list --exclude", () => {
      expect(USAGE).toContain("--exclude");
      expect(HELP).toContain("--exclude");
    });
  });
});
