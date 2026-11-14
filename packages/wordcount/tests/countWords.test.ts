import { describe, expect, it } from "vitest";
import { STOP_WORDS, countWords, filterStopWords } from "../src/index";

describe("filterStopWords", () => {
  it("removes stop words and keeps others", () => {
    expect(filterStopWords({ the: 3, a: 2, and: 1, of: 1, to: 1, cat: 2 })).toEqual({ cat: 2 });
  });

  it("does not mutate input", () => {
    const counts = { the: 1, dog: 1 };
    filterStopWords(counts);
    expect(counts).toEqual({ the: 1, dog: 1 });
  });

  it("handles empty counts", () => {
    expect(filterStopWords({})).toEqual({});
  });

  it("exposes common stop words", () => {
    for (const w of ["the", "a", "and", "of", "to"]) expect(STOP_WORDS.has(w)).toBe(true);
  });
});

describe("countWords", () => {
  it("returns empty object for empty string", () => {
    expect(countWords("")).toEqual({});
  });

  it("returns empty object for whitespace only", () => {
    expect(countWords("   \n\t ")).toEqual({});
  });

  it("counts words case-insensitively and strips punctuation (spec example)", () => {
    expect(countWords("The cat saw the dog.")).toEqual({
      the: 2,
      cat: 1,
      saw: 1,
      dog: 1,
    });
  });

  it("ignores trailing , ! ? punctuation", () => {
    expect(countWords("Hi, hi! HI? hi.")).toEqual({ hi: 5 });
  });

  it("handles words that shadow Object.prototype keys", () => {
    expect(countWords("constructor Constructor")).toEqual({ constructor: 2 });
  });

  it("skips tokens that are only punctuation", () => {
    expect(countWords("wow ! ...")).toEqual({ wow: 1 });
  });
});
