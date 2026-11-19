import { describe, expect, it } from "vitest";
import { run } from "../src/wordfreq.ts";

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

const hashes = (n: number) => "#".repeat(n);

describe("--bars", () => {
  it("top word gets 40 # and others scale proportionally", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${hashes(40)}`, `dog: 1 ${hashes(10)}`]);
    expect(c.err).toEqual([]);
  });

  it("scales several counts against the max", async () => {
    const c = capture("a a a a b b c");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`a: 4 ${hashes(40)}`, `b: 2 ${hashes(20)}`, `c: 1 ${hashes(10)}`]);
  });

  it("a single word gets 40 #", async () => {
    const c = capture("cat");
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 1 ${hashes(40)}`]);
  });

  it("any shown word gets at least 1 #", async () => {
    const text = `${"big ".repeat(100)}tiny`;
    const c = capture(text);
    expect(await run(["-", "--bars"], c.io)).toBe(0);
    expect(c.out).toEqual([`big: 100 ${hashes(40)}`, `tiny: 1 #`]);
  });

  it("scales against the top shown word, not the hidden ones", async () => {
    const c = capture("cat cat cat cat dog dog bird");
    expect(await run(["-", "--bars", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual([`cat: 4 ${hashes(40)}`, `dog: 2 ${hashes(20)}`]);
  });

  it("without --bars no bars are printed", async () => {
    const c = capture("cat cat cat cat dog");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 4", "dog: 1"]);
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

  it("--json output is identical with and without --bars", async () => {
    const a = capture("cat cat dog");
    const b = capture("cat cat dog");
    await run(["-", "--json"], a.io);
    await run(["-", "--json", "--bars"], b.io);
    expect(b.out).toEqual(a.out);
  });
});
