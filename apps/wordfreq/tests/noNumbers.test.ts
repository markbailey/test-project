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

describe("--no-numbers", () => {
  it("parseArgs sets noNumbers before or after file", () => {
    expect(parseArgs(["f.txt", "--no-numbers"]).noNumbers).toBe(true);
    expect(parseArgs(["--no-numbers", "f.txt"]).noNumbers).toBe(true);
  });

  it("parseArgs leaves noNumbers off by default", () => {
    expect(parseArgs(["f.txt"]).noNumbers).toBeFalsy();
  });

  it("default keeps pure-digit tokens", async () => {
    const c = capture("cat 2024 cat 42 2024");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["2024: 2", "cat: 2", "42: 1"]);
  });

  it("drops pure-digit tokens", async () => {
    const c = capture("cat 2024 cat 42 2024 dog");
    expect(await run(["-", "--no-numbers"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 2", "dog: 1"]);
    expect(c.err).toEqual([]);
  });

  it("keeps mixed letter-digit tokens", async () => {
    const c = capture("mp3 covid19 mp3 2024 42 b2b");
    expect(await run(["-", "--no-numbers"], c.io)).toBe(0);
    expect(c.out).toEqual(["mp3: 2", "b2b: 1", "covid19: 1"]);
  });

  it("works with --json", async () => {
    const c = capture("mp3 2024 mp3 42");
    expect(await run(["-", "--no-numbers", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([{ word: "mp3", count: 2 }]);
  });

  it("works with --csv and --markdown", async () => {
    const c = capture("cat 7 cat");
    expect(await run(["-", "--no-numbers", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "cat,2"]);
    const m = capture("cat 7 cat");
    expect(await run(["-", "--no-numbers", "--markdown"], m.io)).toBe(0);
    expect(m.out).toEqual(["| word | count |", "| --- | ---: |", "| cat | 2 |"]);
  });

  it("reports no words when only numbers remain", async () => {
    const c = capture("2024 42 7");
    expect(await run(["-", "--no-numbers"], c.io)).toBe(0);
    expect(c.out).toEqual([]);
    expect(c.err).toEqual(["No words found in -"]);
  });
});
