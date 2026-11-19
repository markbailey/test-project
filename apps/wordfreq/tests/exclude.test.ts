import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  it("drops the listed words", async () => {
    const c = capture("cat cat dog bird bird bird fish");
    expect(await run(["-", "--exclude", "cat,dog"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 3", "fish: 1"]);
    expect(c.err).toEqual([]);
  });

  it("works before or after the file argument", async () => {
    const a = capture("cat dog bird");
    expect(await run(["--exclude", "cat", "-"], a.io)).toBe(0);
    expect(a.out).toEqual(["bird: 1", "dog: 1"]);
    const b = capture("cat dog bird");
    expect(await run(["-", "--exclude", "cat"], b.io)).toBe(0);
    expect(b.out).toEqual(["bird: 1", "dog: 1"]);
  });

  it("ignores case in the list and in the text", async () => {
    const c = capture("Cat CAT cat DOG dog bird");
    expect(await run(["-", "--exclude", "cAt,Dog"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 1"]);
  });

  it("ignores empty entries", async () => {
    const c = capture("a b c d");
    expect(await run(["-", "--exclude", "a,,b"], c.io)).toBe(0);
    expect(c.out).toEqual(["c: 1", "d: 1"]);
    const d = capture("a b c");
    expect(await run(["-", "--exclude", ",a,"], d.io)).toBe(0);
    expect(d.out).toEqual(["b: 1", "c: 1"]);
  });

  it("does not drop partial matches", async () => {
    const c = capture("cat category concat");
    expect(await run(["-", "--exclude", "cat"], c.io)).toBe(0);
    expect(c.out).toEqual(["category: 1", "concat: 1"]);
  });

  it("combines with --ignore-common", async () => {
    const c = capture("The cat and the dog of a cat to the bird");
    expect(await run(["-", "--ignore-common", "--exclude", "cat"], c.io)).toBe(0);
    expect(c.out).toEqual(["bird: 1", "dog: 1"]);
    const d = capture("The cat and the dog of a cat to the bird");
    expect(await run(["--exclude", "CAT", "-", "--ignore-common"], d.io)).toBe(0);
    expect(d.out).toEqual(["bird: 1", "dog: 1"]);
  });

  it("applies before --top", async () => {
    const c = capture("cat cat cat dog dog bird");
    expect(await run(["-", "--exclude", "cat", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["dog: 2", "bird: 1"]);
  });

  it("applies to --json output", async () => {
    const c = capture("cat cat dog");
    expect(await run(["-", "--exclude", "cat", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([{ word: "dog", count: 1 }]);
  });

  it("reports no words when everything is excluded", async () => {
    const c = capture("cat dog");
    expect(await run(["-", "--exclude", "cat,dog"], c.io)).toBe(0);
    expect(c.out).toEqual([]);
    expect(c.err).toEqual(["No words found in -"]);
  });

  it("exits 1 with message and usage when value is missing", async () => {
    const c = capture("cat dog");
    expect(await run(["-", "--exclude"], c.io)).toBe(1);
    expect(c.err).toEqual([`Missing value for --exclude\n${USAGE}`]);
    expect(c.out).toEqual([]);
  });

  it("parseArgs throws when value is missing", () => {
    expect(() => parseArgs(["f.txt", "--exclude"])).toThrow("Missing value for --exclude");
  });

  it("USAGE and HELP list --exclude", () => {
    expect(USAGE).toContain("--exclude");
    expect(HELP.split("\n").slice(1).filter((l) => l.includes("--exclude"))).toHaveLength(1);
  });

  it("README options list documents --exclude", () => {
    const readme = readFileSync(fileURLToPath(new URL("../../../README.md", import.meta.url)), "utf8");
    const line = readme.split("\n").find((l) => l.includes("`--exclude"));
    expect(line).toBeDefined();
    expect(line).toMatch(/comma/i);
  });
});
