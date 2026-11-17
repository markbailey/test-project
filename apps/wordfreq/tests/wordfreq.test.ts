import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_TOP, parseArgs, run, topWords, USAGE } from "../src/wordfreq.ts";

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

  it("parses --stop-words before or after file", () => {
    expect(parseArgs(["f.txt", "--stop-words", "s.txt"])).toEqual({
      file: "f.txt", top: 10, ignoreCommon: false, json: false, stopWordsFile: "s.txt",
    });
    expect(parseArgs(["--stop-words", "s.txt", "f.txt"])).toEqual({
      file: "f.txt", top: 10, ignoreCommon: false, json: false, stopWordsFile: "s.txt",
    });
  });

  it("rejects bad input", () => {
    expect(() => parseArgs([])).toThrow(/Missing/);
    expect(() => parseArgs(["f.txt", "--stop-words"])).toThrow(/--stop-words/);
    expect(() => parseArgs(["f.txt", "--top"])).toThrow(/--top/);
    expect(() => parseArgs(["f.txt", "--top", "abc"])).toThrow(/--top/);
    expect(() => parseArgs(["f.txt", "--top", "-1"])).toThrow(/--top/);
    expect(() => parseArgs(["a", "b"])).toThrow(/Unexpected/);
  });
});

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

describe("stdin", () => {
  it("parseArgs accepts - as file", () => {
    expect(parseArgs(["-"])).toEqual({ file: "-", top: 10, ignoreCommon: false, json: false });
  });

  it("USAGE mentions -", () => {
    expect(USAGE).toContain("<file|->");
  });

  it("reads text from stdin with -", async () => {
    const c = capture("The cat. the dog, THE bird! cat dog");
    expect(await run(["-", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["the: 3", "cat: 2"]);
  });

  it("prints JSON from stdin", async () => {
    const c = capture("The cat. the dog, THE bird! cat dog");
    expect(await run(["-", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "the", count: 3 },
      { word: "cat", count: 2 },
      { word: "dog", count: 2 },
      { word: "bird", count: 1 },
    ]);
  });

  it("applies --ignore-common to stdin", async () => {
    const c = capture("The cat and the dog of a cat to the bird");
    expect(await run(["-", "--ignore-common", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["cat: 2", "bird: 1"]);
  });

  it("handles empty stdin", async () => {
    const t = capture("");
    expect(await run(["-"], t.io)).toBe(0);
    expect(t.out).toEqual([]);
    const j = capture("");
    expect(await run(["-", "--json"], j.io)).toBe(0);
    expect(j.out).toEqual(["[]"]);
  });

  it("does not read stdin for a file argument", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "wordfreq-")), "in.txt");
    writeFileSync(file, "cat dog");
    const out: string[] = [];
    const io = {
      out: (l: string) => out.push(l),
      err: () => {},
      in: async (): Promise<string> => {
        throw new Error("stdin should not be read");
      },
    };
    expect(await run([file], io)).toBe(0);
    expect(out).toEqual(["cat: 1", "dog: 1"]);
  });
});

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

  function tempFile(content: string) {
    const file = join(mkdtempSync(join(tmpdir(), "wordfreq-")), "in.txt");
    writeFileSync(file, content);
    return file;
  }

  for (const [name, content, extra] of [
    ["empty file", "", []],
    ["whitespace-only file", "  \n\t ", []],
    ["punctuation-only file", "-- ... {", []],
    ["stop-words-only file with --ignore-common", "the and of a", ["--ignore-common"]],
  ] as Array<[string, string, string[]]>) {
    it(`reports no words for ${name}`, async () => {
      const file = tempFile(content);
      const c = capture();
      expect(await run([file, ...extra], c.io)).toBe(0);
      expect(c.out).toEqual([]);
      expect(c.err).toEqual([`No words found in ${file}`]);
    });
  }

  it("prints stop words without --ignore-common, no message", async () => {
    const file = tempFile("the and of a");
    const c = capture();
    expect(await run([file], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 1", "and: 1", "of: 1", "the: 1"]);
    expect(c.err).toEqual([]);
  });

  for (const [name, content, extra] of [
    ["empty file", "", []],
    ["stop-words-only file with --ignore-common", "the and of a", ["--ignore-common"]],
  ] as Array<[string, string, string[]]>) {
    it(`prints [] with --json and no message for ${name}`, async () => {
      const file = tempFile(content);
      const c = capture();
      expect(await run([file, "--json", ...extra], c.io)).toBe(0);
      expect(c.out).toEqual(["[]"]);
      expect(c.err).toEqual([]);
    });
  }

  it("--top 0 on file with words prints nothing, no message", async () => {
    const file = tempFile("cat dog");
    const c = capture();
    expect(await run([file, "--top", "0"], c.io)).toBe(0);
    expect(c.out).toEqual([]);
    expect(c.err).toEqual([]);
  });

  describe("--stop-words", () => {
    function stopFile(content: string) {
      const file = join(mkdtempSync(join(tmpdir(), "wordfreq-")), "stop.txt");
      writeFileSync(file, content);
      return file;
    }

    it("removes only the file's words", async () => {
      const file = tempFile("the cat the dog bird");
      const c = capture();
      expect(await run([file, "--stop-words", stopFile("cat\ndog\n")], c.io)).toBe(0);
      expect(c.out).toEqual(["the: 2", "bird: 1"]);
    });

    it("ignores blank, whitespace-only and # comment lines", async () => {
      const file = tempFile("cat dog bird");
      const c = capture();
      expect(await run([file, "--stop-words", stopFile("\n   \n# cat\ndog\n\t\n")], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1", "cat: 1"]);
    });

    it("matches case-insensitively", async () => {
      const file = tempFile("cat CAT Cat dog");
      const c = capture();
      expect(await run([file, "--stop-words", stopFile("Cat\n")], c.io)).toBe(0);
      expect(c.out).toEqual(["dog: 1"]);
    });

    it("combines with --ignore-common", async () => {
      const file = tempFile("the cat and dog bird");
      const c = capture();
      expect(await run([file, "--ignore-common", "--stop-words", stopFile("cat\n")], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1", "dog: 1"]);
    });

    it("handles CRLF line endings", async () => {
      const file = tempFile("cat dog bird");
      const c = capture();
      expect(await run([file, "--stop-words", stopFile("cat\r\ndog\r\n")], c.io)).toBe(0);
      expect(c.out).toEqual(["bird: 1"]);
    });

    it("exits 1 when the stop-words file is missing", async () => {
      const file = tempFile("cat dog");
      const missing = join(tmpdir(), "nope-wordfreq-stop.txt");
      const c = capture();
      expect(await run([file, "--stop-words", missing], c.io)).toBe(1);
      expect(c.err).toEqual([`Error: cannot read stop words file: ${missing}`]);
      expect(c.out).toEqual([]);
    });
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

  function expectHelp(c: ReturnType<typeof capture>) {
    const text = c.out.join("\n");
    expect(text.startsWith(USAGE)).toBe(true);
    const lines = text.split("\n");
    for (const opt of ["--top N", "--ignore-common", "--json", "--stop-words"]) {
      expect(lines.slice(1).filter((l) => l.includes(opt))).toHaveLength(1);
    }
    expect(c.err).toEqual([]);
  }

  it("prints help with --help", async () => {
    const c = capture();
    expect(await run(["--help"], c.io)).toBe(0);
    expectHelp(c);
  });

  it("prints same help with -h", async () => {
    const a = capture();
    const b = capture();
    expect(await run(["-h"], a.io)).toBe(0);
    expect(await run(["--help"], b.io)).toBe(0);
    expectHelp(a);
    expect(a.out).toEqual(b.out);
  });

  it("help wins wherever the flag sits, without reading a file", async () => {
    const missing = join(tmpdir(), "nope-wordfreq-help.txt");
    for (const argv of [
      [missing, "--top", "3", "--help"],
      ["--json", "-h", missing],
      ["--ignore-common", "--help"],
    ]) {
      const c = capture();
      expect(await run(argv, c.io)).toBe(0);
      expectHelp(c);
    }
  });
});
