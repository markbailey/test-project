import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { csvField, DEFAULT_TOP, HELP, markdownCell, parseArgs, run, topWords, USAGE } from "../src/wordfreq.ts";

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
    expect(parseArgs(["f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
  });

  it("parses --top before or after file", () => {
    expect(parseArgs(["f.txt", "--top", "3"])).toEqual({ file: "f.txt", top: 3, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
    expect(parseArgs(["--top", "3", "f.txt"])).toEqual({ file: "f.txt", top: 3, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
  });

  it("parses --ignore-common", () => {
    expect(parseArgs(["--ignore-common", "f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: true, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
  });

  it("parses --json", () => {
    expect(parseArgs(["f.txt", "--json"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: true, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
  });

  it("parses --csv", () => {
    expect(parseArgs(["--csv", "f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: true, markdown: false, ngram: 1, minCount: 1, sort: "count" });
  });

  it("rejects --csv with --json", () => {
    expect(() => parseArgs(["f.txt", "--csv", "--json"])).toThrow("--csv and --json cannot be used together");
  });

  it("parses --stop-words before or after file", () => {
    expect(parseArgs(["f.txt", "--stop-words", "s.txt"])).toEqual({
      file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count", stopWordsFile: "s.txt",
    });
    expect(parseArgs(["--stop-words", "s.txt", "f.txt"])).toEqual({
      file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count", stopWordsFile: "s.txt",
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

  it("parses --ngram before or after file", () => {
    expect(parseArgs(["f.txt", "--ngram", "2"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 2, minCount: 1, sort: "count" });
    expect(parseArgs(["--ngram", "5", "f.txt"])).toEqual({ file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 5, minCount: 1, sort: "count" });
  });

  it("rejects bad --ngram values", () => {
    expect(() => parseArgs(["f.txt", "--ngram"])).toThrow("Invalid --ngram value: (missing)");
    for (const v of ["0", "6", "abc", "2.5", "-1"]) {
      expect(() => parseArgs(["f.txt", "--ngram", v])).toThrow(`Invalid --ngram value: ${v}`);
    }
  });
});

describe("csvField", () => {
  it("leaves plain words unquoted", () => {
    expect(csvField("cat")).toBe("cat");
    expect(csvField("don't")).toBe("don't");
  });

  it("quotes words with commas", () => {
    expect(csvField("a,b")).toBe('"a,b"');
  });

  it("quotes and doubles inner quotes", () => {
    expect(csvField('say"hi')).toBe('"say""hi"');
  });
});

describe("--ngram", () => {
  it("prints top bigrams from stdin", async () => {
    const c = capture("Of the people, of the land. The end of the story");
    expect(await run(["-", "--ngram", "2", "--top", "3"], c.io)).toBe(0);
    expect(c.out).toEqual(["of the: 3", "end of: 1", "people of: 1"]);
  });

  it("prints bigrams as JSON", async () => {
    const c = capture("a b. a b c");
    expect(await run(["-", "--ngram", "2", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([
      { word: "a b", count: 2 },
      { word: "b c", count: 1 },
    ]);
  });

  it("drops only all-stop-word n-grams with --ignore-common", async () => {
    const c = capture("Of the people, of the land. The end of the story");
    expect(await run(["-", "--ngram", "2", "--ignore-common"], c.io)).toBe(0);
    expect(c.out).toEqual(["end of: 1", "people of: 1", "the end: 1", "the land: 1", "the people: 1", "the story: 1"]);
  });

  it("reports no words when no n-grams remain", async () => {
    const t = capture("of the. in a");
    expect(await run(["-", "--ngram", "2", "--ignore-common"], t.io)).toBe(0);
    expect(t.out).toEqual([]);
    expect(t.err).toEqual(["No words found in -"]);
    const j = capture("hi there");
    expect(await run(["-", "--ngram", "3", "--json"], j.io)).toBe(0);
    expect(j.out).toEqual(["[]"]);
  });

  for (const v of ["0", "abc"]) {
    it(`exits 1 on --ngram ${v}`, async () => {
      const c = capture("cat dog");
      expect(await run(["-", "--ngram", v], c.io)).toBe(1);
      expect(c.err.join("\n")).toContain(`Invalid --ngram value: ${v}`);
      expect(c.err.join("\n")).toContain(USAGE);
      expect(c.out).toEqual([]);
    });
  }

  it("USAGE and HELP list --ngram", () => {
    expect(USAGE.startsWith("Usage: wordfreq <file|->")).toBe(true);
    expect(USAGE).toContain("[--ngram N]");
    const lines = HELP.split("\n").slice(1).filter((l) => l.includes("--ngram N"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/default 1/);
  });
});

describe("--min-count", () => {
  const base = { file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, sort: "count" };

  it("parseArgs defaults minCount to 1", () => {
    expect(parseArgs(["f.txt"]).minCount).toBe(1);
  });

  it("parses --min-count before or after file", () => {
    expect(parseArgs(["f.txt", "--min-count", "3"])).toEqual({ ...base, minCount: 3 });
    expect(parseArgs(["--min-count", "3", "f.txt"])).toEqual({ ...base, minCount: 3 });
  });

  it("rejects bad --min-count values", () => {
    expect(() => parseArgs(["f.txt", "--min-count"])).toThrow("Invalid --min-count value: (missing)");
    for (const v of ["0", "-2", "abc", "1.5"]) {
      expect(() => parseArgs(["f.txt", "--min-count", v])).toThrow(`Invalid --min-count value: ${v}`);
    }
  });

  for (const v of ["0", "abc"]) {
    it(`run exits 1 on --min-count ${v}`, async () => {
      const c = capture("cat dog");
      expect(await run(["-", "--min-count", v], c.io)).toBe(1);
      const err = c.err.join("\n");
      expect(err).toContain(`Invalid --min-count value: ${v}`);
      expect(err).toContain("Usage");
      expect(err).toContain("[--min-count N]");
      expect(c.out).toEqual([]);
    });
  }

  it("USAGE and HELP list --min-count", () => {
    expect(USAGE).toContain("[--top N] [--min-count N]");
    expect(HELP.split("\n").slice(1).filter((l) => l.includes("--min-count N"))).toHaveLength(1);
  });

  it("prints only words with count >= N", async () => {
    const c = capture("cat cat dog dog dog bird");
    expect(await run(["-", "--min-count", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["dog: 3", "cat: 2"]);
  });

  it("filters before --top", async () => {
    const text = "a a a a b b b b c c c d d d e e e f f f g g h";
    const c = capture(text);
    expect(await run(["-", "--min-count", "3", "--top", "5"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 4", "b: 4", "c: 3", "d: 3", "e: 3"]);
  });

  it("prints fewer than --top when few words reach threshold", async () => {
    const c = capture("a a a b b b c c d");
    expect(await run(["-", "--min-count", "3", "--top", "5"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 3", "b: 3"]);
  });

  it("combines with --ignore-common --json", async () => {
    const c = capture("the the the cat cat cat dog and and bird");
    expect(await run(["-", "--min-count", "2", "--ignore-common", "--json"], c.io)).toBe(0);
    expect(JSON.parse(c.out[0])).toEqual([{ word: "cat", count: 3 }]);
  });

  it("filters --csv output", async () => {
    const c = capture("cat cat dog");
    expect(await run(["-", "--min-count", "2", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "cat,2"]);
  });

  it("prints [] with --json when no word reaches threshold", async () => {
    const c = capture("cat dog bird");
    expect(await run(["-", "--min-count", "2", "--json"], c.io)).toBe(0);
    expect(c.out).toEqual(["[]"]);
  });
});

describe("--sort", () => {
  const base = { file: "f.txt", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1 };
  // zebra 5, mango 3, banana 2, apple 1
  const text = "zebra zebra zebra zebra zebra mango mango mango banana banana apple";

  it("parseArgs defaults sort to count", () => {
    expect(parseArgs(["f.txt"]).sort).toBe("count");
  });

  it("parses --sort before or after file", () => {
    expect(parseArgs(["f.txt", "--sort", "alpha"])).toEqual({ ...base, sort: "alpha" });
    expect(parseArgs(["--sort", "alpha", "f.txt"])).toEqual({ ...base, sort: "alpha" });
    expect(parseArgs(["f.txt", "--sort", "count"])).toEqual({ ...base, sort: "count" });
  });

  it("rejects bad --sort values in parseArgs", () => {
    expect(() => parseArgs(["f.txt", "--sort"])).toThrow("Invalid --sort value: (missing)");
    for (const v of ["foo", "", "freq"]) {
      expect(() => parseArgs(["f.txt", "--sort", v])).toThrow(`Invalid --sort value: ${v}`);
    }
  });

  it("defaults to count desc, ties alphabetical", async () => {
    const c = capture("pear pear apple fig fig zoo");
    expect(await run(["-"], c.io)).toBe(0);
    expect(c.out).toEqual(["fig: 2", "pear: 2", "apple: 1", "zoo: 1"]);
  });

  it("--sort count matches the default order", async () => {
    const a = capture("pear pear apple fig fig zoo");
    const b = capture("pear pear apple fig fig zoo");
    expect(await run(["-"], a.io)).toBe(0);
    expect(await run(["-", "--sort", "count"], b.io)).toBe(0);
    expect(b.out).toEqual(a.out);
  });

  it("--sort alpha orders words A-Z", async () => {
    const c = capture("pear pear apple fig fig zoo");
    expect(await run(["-", "--sort", "alpha"], c.io)).toBe(0);
    expect(c.out).toEqual(["apple: 1", "fig: 2", "pear: 2", "zoo: 1"]);
    expect(c.err).toEqual([]);
  });

  it("--sort alpha works before the file argument", async () => {
    const c = capture("b a c");
    expect(await run(["--sort", "alpha", "-"], c.io)).toBe(0);
    expect(c.out).toEqual(["a: 1", "b: 1", "c: 1"]);
  });

  it("--top applies after sorting with count", async () => {
    const c = capture(text);
    expect(await run(["-", "--sort", "count", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["zebra: 5", "mango: 3"]);
  });

  it("--top applies after sorting with alpha", async () => {
    const c = capture(text);
    expect(await run(["-", "--sort", "alpha", "--top", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["apple: 1", "banana: 2"]);
  });

  it("--min-count applies after sorting with alpha, then --top", async () => {
    const c = capture(text);
    expect(await run(["-", "--sort", "alpha", "--min-count", "2"], c.io)).toBe(0);
    expect(c.out).toEqual(["banana: 2", "mango: 3", "zebra: 5"]);
    const d = capture(text);
    expect(await run(["-", "--sort", "alpha", "--min-count", "2", "--top", "2"], d.io)).toBe(0);
    expect(d.out).toEqual(["banana: 2", "mango: 3"]);
  });

  it("applies to --json, --csv and --markdown output", async () => {
    const j = capture("b b a");
    expect(await run(["-", "--sort", "alpha", "--json"], j.io)).toBe(0);
    expect(JSON.parse(j.out[0])).toEqual([
      { word: "a", count: 1 },
      { word: "b", count: 2 },
    ]);
    const c = capture("b b a");
    expect(await run(["-", "--sort", "alpha", "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "a,1", "b,2"]);
    const m = capture("b b a");
    expect(await run(["-", "--sort", "alpha", "--markdown"], m.io)).toBe(0);
    expect(m.out).toEqual(["| word | count |", "| --- | ---: |", "| a | 1 |", "| b | 2 |"]);
  });

  it("sorts n-grams alphabetically with --ngram", async () => {
    const c = capture("b c b c a b");
    expect(await run(["-", "--ngram", "2", "--sort", "alpha"], c.io)).toBe(0);
    expect(c.out).toEqual(["a b: 1", "b c: 2", "c a: 1", "c b: 1"]);
  });

  for (const v of ["foo", "COUNT"]) {
    it(`exits 1 on --sort ${v}`, async () => {
      const c = capture("cat dog");
      expect(await run(["-", "--sort", v], c.io)).toBe(1);
      const err = c.err.join("\n");
      expect(err).toContain(`Invalid --sort value: ${v}`);
      expect(err).toContain(USAGE);
      expect(c.out).toEqual([]);
    });
  }

  it("exits 1 when --sort has no value", async () => {
    const c = capture("cat dog");
    expect(await run(["-", "--sort"], c.io)).toBe(1);
    expect(c.err.join("\n")).toContain("Invalid --sort value: (missing)");
    expect(c.out).toEqual([]);
  });

  it("USAGE and HELP list --sort", () => {
    expect(USAGE).toContain("--sort");
    expect(HELP.split("\n").slice(1).filter((l) => l.includes("--sort"))).toHaveLength(1);
  });

  it("README options list documents --sort", () => {
    const readme = readFileSync(fileURLToPath(new URL("../../../README.md", import.meta.url)), "utf8");
    const line = readme.split("\n").find((l) => l.includes("`--sort"));
    expect(line).toBeDefined();
    expect(line).toContain("alpha");
    expect(line).toContain("count");
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
    expect(parseArgs(["-"])).toEqual({ file: "-", top: 10, ignoreCommon: false, json: false, csv: false, markdown: false, ngram: 1, minCount: 1, sort: "count" });
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

  it("prints CSV with --csv in text-output order", async () => {
    const file = tempFile("The cat. the dog, THE bird! cat dog");
    const c = capture();
    expect(await run([file, "--csv"], c.io)).toBe(0);
    expect(c.out).toEqual(["word,count", "the,3", "cat,2", "dog,2", "bird,1"]);
    expect(c.err).toEqual([]);
  });

  it("combines --csv with --top and --ignore-common in any order", async () => {
    const file = tempFile("The cat and the dog of a cat to the bird");
    for (const argv of [
      ["--csv", file, "--ignore-common", "--top", "2"],
      ["--top", "2", "--ignore-common", file, "--csv"],
    ]) {
      const c = capture();
      expect(await run(argv, c.io)).toBe(0);
      expect(c.out).toEqual(["word,count", "cat,2", "bird,1"]);
    }
  });

  for (const [name, content, extra] of [
    ["empty file", "", []],
    ["stop-words-only file with --ignore-common", "the and of a", ["--ignore-common"]],
  ] as Array<[string, string, string[]]>) {
    it(`prints only header with --csv and no message for ${name}`, async () => {
      const file = tempFile(content);
      const c = capture();
      expect(await run([file, "--csv", ...extra], c.io)).toBe(0);
      expect(c.out).toEqual(["word,count"]);
      expect(c.err).toEqual([]);
    });
  }

  it("exits 1 when --csv and --json are combined, either order", async () => {
    const file = tempFile("cat dog");
    for (const argv of [
      [file, "--csv", "--json"],
      ["--json", file, "--csv"],
    ]) {
      const c = capture();
      expect(await run(argv, c.io)).toBe(1);
      expect(c.err).toEqual([`--csv and --json cannot be used together\n${USAGE}`]);
      expect(c.out).toEqual([]);
    }
  });

  it("prints a Markdown table with --markdown in text-output order", async () => {
    const file = tempFile("cat dog cat");
    const c = capture();
    expect(await run([file, "--markdown"], c.io)).toBe(0);
    expect(c.out).toEqual(["| word | count |", "| --- | ---: |", "| cat | 2 |", "| dog | 1 |"]);
    expect(c.err).toEqual([]);
  });

  for (const [name, content, extra] of [
    ["empty file", "", []],
    ["stop-words-only file with --ignore-common", "the and of a", ["--ignore-common"]],
  ] as Array<[string, string, string[]]>) {
    it(`prints only header with --markdown and no message for ${name}`, async () => {
      const file = tempFile(content);
      const c = capture();
      expect(await run([file, "--markdown", ...extra], c.io)).toBe(0);
      expect(c.out).toEqual(["| word | count |", "| --- | ---: |"]);
      expect(c.err).toEqual([]);
    });
  }

  it("escapes | in words with --markdown", async () => {
    const file = tempFile("a|b a|b c");
    const c = capture();
    expect(await run([file, "--markdown"], c.io)).toBe(0);
    expect(c.out).toEqual(["| word | count |", "| --- | ---: |", "| a\\|b | 2 |", "| c | 1 |"]);
  });

  it("markdownCell escapes every |", () => {
    expect(markdownCell("a|b|c")).toBe("a\\|b\\|c");
    expect(markdownCell("plain")).toBe("plain");
  });

  it("exits 1 when --markdown and --json are combined, either order", async () => {
    const file = tempFile("cat dog");
    for (const argv of [
      [file, "--markdown", "--json"],
      ["--json", file, "--markdown"],
    ]) {
      const c = capture();
      expect(await run(argv, c.io)).toBe(1);
      expect(c.err).toEqual([`Options --markdown and --json cannot be combined\n${USAGE}`]);
      expect(c.out).toEqual([]);
    }
  });

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

  it("prints package.json version with --version and no file", async () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    const c = capture();
    expect(await run(["--version"], c.io)).toBe(0);
    expect(c.out).toEqual([pkg.version]);
    expect(c.err).toEqual([]);
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
    for (const opt of ["--top N", "--ignore-common", "--json", "--stop-words", "--csv"]) {
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
      ["--csv", "--json", "--help", missing],
    ]) {
      const c = capture();
      expect(await run(argv, c.io)).toBe(0);
      expectHelp(c);
    }
  });
});
