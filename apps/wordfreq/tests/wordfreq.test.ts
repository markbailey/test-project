import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_TOP, parseArgs, run, topWords } from "../src/wordfreq.ts";

describe("topWords", () => {
  it("sorts by count descending", () => {
    expect(topWords({ a: 1, b: 3, c: 2 }, 10)).toEqual([
      ["b", 3],
      ["c", 2],
      ["a", 1],
    ]);
  });

  it("breaks ties alphabetically", () => {
    expect(topWords({ pear: 2, apple: 2, zoo: 5, fig: 2 }, 10)).toEqual([
      ["zoo", 5],
      ["apple", 2],
      ["fig", 2],
      ["pear", 2],
    ]);
  });

  it("limits to n entries", () => {
    expect(topWords({ a: 3, b: 2, c: 1 }, 2)).toEqual([
      ["a", 3],
      ["b", 2],
    ]);
  });

  it("handles empty counts", () => {
    expect(topWords({}, 5)).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("defaults top to 10", () => {
    expect(DEFAULT_TOP).toBe(10);
    expect(parseArgs(["f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: false });
  });

  it("parses --top before or after file", () => {
    expect(parseArgs(["f.txt", "--top", "3"])).toEqual({ file: "f.txt", top: 3, ignoreCommon: false, json: false });
    expect(parseArgs(["--top", "3", "f.txt"])).toEqual({ file: "f.txt", top: 3, ignoreCommon: false, json: false });
  });

  it("parses --ignore-common", () => {
    expect(parseArgs(["--ignore-common", "f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: true, json: false });
  });

  it("parses --json", () => {
    expect(parseArgs(["f.txt", "--json"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: true });
  });

  it("rejects bad input", () => {
    expect(() => parseArgs([])).toThrow(/Missing/);
    expect(() => parseArgs(["f.txt", "--top"])).toThrow(/--top/);
    expect(() => parseArgs(["f.txt", "--top", "abc"])).toThrow(/--top/);
    expect(() => parseArgs(["f.txt", "--top", "-1"])).toThrow(/--top/);
    expect(() => parseArgs(["a", "b"])).toThrow(/Unexpected/);
  });
});

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
  };
}

describe("run", () => {
  it("prints top words from file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "The cat. the dog, THE bird! cat dog");
    const c = capture();
    expect(await run([file, "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["the: 3", "cat: 2"]);
  });

  it("defaults to top 10", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "a b c d e f g h i j k l");
    const c = capture();
    expect(await run([file], c.io)).toBe(0);
    expect(c.out).toHaveLength(10);
  });

  it("skips stop words with --ignore-common", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "The cat and the dog of a cat to the bird");
    const c = capture();
    expect(await run([file, "--ignore-common", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 2", "bird: 1"]);
  });

  it("prints JSON with --json in text-output order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "The cat. the dog, THE bird! cat dog");
    const c = capture();
    expect(await run([file, "--json"], c.io)).toBe(0);
    expect(c.out).toHaveLength(1);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "the", count: 3 },
      { word: "cat", count: 2 },
      { word: "dog", count: 2 },
      { word: "bird", count: 1 },
    ]);
  });

  it("combines --json with --top and --ignore-common", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "The cat and the dog of a cat to the bird");
    const c = capture();
    expect(await run(["--json", file, "--ignore-common", "--top", "2"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "cat", count: 2 },
      { word: "bird", count: 1 },
    ]);
  });

  it("prints empty JSON array when no words", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wordfreq-"));
    const file = join(dir, "in.txt");
    writeFileSync(file, "-- ... {");
    const c = capture();
    expect(await run([file, "--json"], c.io)).toBe(0);
    expect(c.out).toEqual(["[]"]);
  });

  it("exits 1 with error for missing file", async () => {
    const c = capture();
    expect(await run([join(tmpdir(), "nope-wordfreq-xyz.txt")], c.io)).toBe(1);
    expect(c.err.join("\n")).toMatch(/cannot read file/);
    expect(c.out).toEqual([]);
  });

  it("exits 1 on bad args", async () => {
    const c = capture();
    expect(await run([], c.io)).toBe(1);
    expect(c.err.join("\n")).toMatch(/Usage/);
  });
});
