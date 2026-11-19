import { describe, expect, it } from "vitest";
import { HELP, USAGE, run } from "../src/wordfreq.ts";

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

describe("--percent", () => {
  it("text lines become `word: count (P%)`", async () => {
    const c = capture("a b a");
    expect(await run(["-", "--percent"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 2 (66.7%)", "b: 1 (33.3%)"]);
    expect(c.err).toEqual([]);
  });

  it("rounds 1 of 3 to 33.3%", async () => {
    const c = capture("x y z");
    expect(await run(["-", "--percent"], c.io)).toBe(0);
    expect(c.out).toEqual(["x: 1 (33.3%)", "y: 1 (33.3%)", "z: 1 (33.3%)"]);
  });

  it("rounds to one decimal place (3 of 7 → 42.9%)", async () => {
    const c = capture("a a a b c d e");
    expect(await run(["-", "--percent"], c.io)).toBe(0);
    expect(c.out[0]).toBe("a: 3 (42.9%)");
    expect(c.out[1]).toBe("b: 1 (14.3%)");
  });

  it("without --percent output is unchanged", async () => {
    const c = capture("a b a");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 2", "b: 1"]);
  });

  it("total counts words removed by --ignore-common", async () => {
    const c = capture("the cat the dog the bird");
    expect(await run(["-", "--percent", "--ignore-common"], c.io)).toBe(0);
    // total is 6 words, not 3
    expect(c.out).toEqual(["bird: 1 (16.7%)", "cat: 1 (16.7%)", "dog: 1 (16.7%)"]);
  });

  it("total counts words hidden by --min-count", async () => {
    const c = capture("a a a b c d e");
    expect(await run(["-", "--percent", "--min-count", "2"], c.io)).toBe(0);
    // total is 7 words, not 3
    expect(c.out).toEqual(["a: 3 (42.9%)"]);
  });

  it("total counts words cut by --top", async () => {
    const c = capture("a a b c d e f");
    expect(await run(["-", "--percent", "--top", "1"], c.io)).toBe(0);
    // total is 7 words, not 2
    expect(c.out).toEqual(["a: 2 (28.6%)"]);
  });

  it("with --json each object gets a numeric percent field", async () => {
    const c = capture("a b a");
    expect(await run(["-", "--percent", "--json"], c.io)).toBe(0);
    expect(c.out).toHaveLength(1);
    const parsed = JSON.parse(c.out[0]);
    expect(parsed).toEqual([
      { word: "a", count: 2, percent: 66.7 },
      { word: "b", count: 1, percent: 33.3 },
    ]);
    for (const o of parsed) expect(typeof o.percent).toBe("number");
  });

  it("--json without --percent has no percent field", async () => {
    const c = capture("a b a");
    expect(await run(["-", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "a", count: 2 },
      { word: "b", count: 1 },
    ]);
  });

  it("--json percent uses the full-text total too", async () => {
    const c = capture("the cat the dog the bird");
    expect(await run(["-", "--percent", "--json", "--ignore-common", "--top", "1"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([{ word: "bird", count: 1, percent: 16.7 }]);
  });

  it("usage and help text list --percent", () => {
    expect(USAGE).toContain("--percent");
    expect(HELP).toContain("--percent");
  });
});
