import { describe, expect, it } from "vitest";
import { BAR_WIDTH, HELP, USAGE, run } from "../src/wordfreq.ts";

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
  it("BAR_WIDTH is 40", () => {
    expect(BAR_WIDTH).toBe(40);
  });

  it("top word gets 40 #, others scaled (cat 4 / dog 1)", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${"#".repeat(40)}`, `dog: 1 ${"#".repeat(10)}`]);
    expect(c.err).toEqual([]);
  });

  it("bar length is rounded (3 and 1 → 40 and 13; 2 of 3 → 27)", async () => {
    const c = capture("a a a b");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 3 ${"#".repeat(40)}`, `b: 1 ${"#".repeat(13)}`]);

    const d = capture("a a a b b");
    expect(await run(["-", "--bars"], d.io)).toBe(0);
    expect(d.out).toEqual([`a: 3 ${"#".repeat(40)}`, `b: 2 ${"#".repeat(27)}`]);
  });

  it("every word shown gets at least one # (1 of 100 → 1)", async () => {
    const c = capture(`${rep("big", 100)} tiny`);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`big: 100 ${"#".repeat(40)}`, `tiny: 1 #`]);
  });

  it("equal counts all get 40 #", async () => {
    const c = capture("x y");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`x: 1 ${"#".repeat(40)}`, `y: 1 ${"#".repeat(40)}`]);
  });

  it("without --bars output is unchanged", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 4", "dog: 1"]);
  });

  it("works with --top", async () => {
    const c = capture("cat cat cat cat dog dog bird");
    expect(await run(["-", "--bars", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${"#".repeat(40)}`, `dog: 2 ${"#".repeat(20)}`]);
  });

  it("--json ignores --bars without error", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-", "--bars", "--json"], c.io)).toBe(0);
    expect(c.err).toEqual([]);
    expect(c.out).toHaveLength(1);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "cat", count: 4 },
      { word: "dog", count: 1 },
    ]);
    expect(c.out[0]).not.toContain("#");
  });

  it("--csv output is unchanged by --bars", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-", "--bars", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "cat,4", "dog,1"]);
  });

  it("usage and help text list --bars", () => {
    expect(USAGE).toContain("--bars");
    expect(HELP).toContain("--bars");
  });
});
