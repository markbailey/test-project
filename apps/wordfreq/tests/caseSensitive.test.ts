import { describe, expect, it } from "vitest";
import { parseArgs, run } from "../src/wordfreq.ts";

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

describe("--case-sensitive", () => {
  it("parseArgs sets caseSensitive before or after file", () => {
    expect(parseArgs(["f.txt", "--case-sensitive"]).caseSensitive).toBe(true);
    expect(parseArgs(["--case-sensitive", "f.txt"]).caseSensitive).toBe(true);
  });

  it("parseArgs leaves caseSensitive off by default", () => {
    expect(parseArgs(["f.txt"]).caseSensitive).toBeFalsy();
  });

  it("default mode still folds case", async () => {
    const c = capture("The cat the dog THE bird");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["the: 3", "bird: 1", "cat: 1", "dog: 1"]);
  });

  it("counts The and the separately and keeps original case", async () => {
    const c = capture("The cat the dog The bird");
    expect(await run(["-", "--case-sensitive"], c.io)).toBe(0);
    expect(c.out).toEqual(["The: 2", "bird: 1", "cat: 1", "dog: 1", "the: 1"]);
    expect(c.err).toEqual([]);
  });

  it("works with --json", async () => {
    const c = capture("The the The");
    expect(await run(["-", "--case-sensitive", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "The", count: 2 },
      { word: "the", count: 1 },
    ]);
  });

  it("works with --csv and --markdown", async () => {
    const c = capture("Cat cat Cat");
    expect(await run(["-", "--case-sensitive", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "Cat,2", "cat,1"]);
    const m = capture("Cat cat Cat");
    expect(await run(["-", "--case-sensitive", "--markdown"], m.io)).toBe(0);
    expect(m.out).toEqual(["| word | count |", "| --- | ---: |", "| Cat | 2 |", "| cat | 1 |"]);
  });

  it("works with --ngram and keeps case", async () => {
    const c = capture("The end. the end. The end");
    expect(await run(["-", "--case-sensitive", "--ngram", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["The end: 2", "the end: 1"]);
  });

  describe("with --ignore-common", () => {
    it("removes stop words in any casing, keeps other words' case", async () => {
      const c = capture("The Cat and THE cat AND the Dog Of a OF");
      expect(await run(["-", "--case-sensitive", "--ignore-common"], c.io)).toBe(0);
      expect(c.out).toEqual(["Cat: 1", "Dog: 1", "cat: 1"]);
    });

    it("works with --json", async () => {
      const c = capture("The Cat the cat To");
      expect(await run(["-", "--case-sensitive", "--ignore-common", "--json"], c.io)).toBe(0);
      expect(JSON.parse(c.out[0])).toEqual([
        { word: "Cat", count: 1 },
        { word: "cat", count: 1 },
      ]);
    });

    it("drops all-stop-word n-grams regardless of case", async () => {
      const c = capture("Of The people. of the Land");
      expect(await run(["-", "--case-sensitive", "--ignore-common", "--ngram", "2"], c.io)).toBe(0);
      expect(c.out).toEqual(["The people: 1", "the Land: 1"]);
    });

    it("reports no words when only stop words in mixed case remain", async () => {
      const c = capture("The AND Of a");
      expect(await run(["-", "--case-sensitive", "--ignore-common"], c.io)).toBe(0);
      expect(c.out).toEqual([]);
      expect(c.err).toEqual(["No words found in -"]);
    });
  });
});
