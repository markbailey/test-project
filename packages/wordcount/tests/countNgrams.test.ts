import { describe, expect, it } from "vitest";
import { countNgrams, countWords, ngramIsAllStopWords } from "../src/index";

describe("countNgrams", () => {
  it("n=1 matches countWords", () => {
    for (const text of ["", "The cat sat. The dog ran!", "Hi, hi! HI? hi.", "wow ! ... wow", "well-known—and/or"]) {
      expect(countNgrams(text, 1)).toEqual(countWords(text));
    }
  });

  it("counts bigrams (spec example)", () => {
    expect(countNgrams("Of the people, of the land", 2)).toEqual({
      "of the": 2,
      "the people": 1,
      "people of": 1,
      "the land": 1,
    });
  });

  it("counts trigrams", () => {
    expect(countNgrams("a b c a b c", 3)).toEqual({ "a b c": 2, "b c a": 1, "c a b": 1 });
  });

  it("does not span sentence boundaries", () => {
    const counts = countNgrams("The cat sat. The dog ran", 2);
    expect(counts).toEqual({ "the cat": 1, "cat sat": 1, "the dog": 1, "dog ran": 1 });
    expect(Object.hasOwn(counts, "sat the")).toBe(false);
  });

  it("treats ! and ? as sentence ends", () => {
    expect(countNgrams("Stop! Go now? Yes sir", 2)).toEqual({ "go now": 1, "yes sir": 1 });
  });

  it("punctuation-only tokens end a sentence", () => {
    expect(countNgrams("cat sat . dog ran", 2)).toEqual({ "cat sat": 1, "dog ran": 1 });
  });

  it("returns {} when sentence shorter than n", () => {
    expect(countNgrams("hi there", 3)).toEqual({});
    expect(countNgrams("", 2)).toEqual({});
    expect(countNgrams("a b. c d.", 3)).toEqual({});
  });

  it("handles keys shadowing Object.prototype", () => {
    expect(countNgrams("constructor Constructor", 1)).toEqual({ constructor: 2 });
    expect(countNgrams("toString valueOf. toString valueOf", 2)).toEqual({ "tostring valueof": 2 });
  });

  it("throws RangeError for invalid n", () => {
    for (const n of [0, 6, 2.5, -1, NaN]) {
      expect(() => countNgrams("a b c", n)).toThrow(RangeError);
    }
  });
});

describe("ngramIsAllStopWords", () => {
  it("true only when every word is a stop word", () => {
    expect(ngramIsAllStopWords("of the")).toBe(true);
    expect(ngramIsAllStopWords("end of")).toBe(false);
    expect(ngramIsAllStopWords("the")).toBe(true);
    expect(ngramIsAllStopWords("cat")).toBe(false);
  });

  it("uses a custom stop-word set", () => {
    expect(ngramIsAllStopWords("cat dog", new Set(["cat", "dog"]))).toBe(true);
    expect(ngramIsAllStopWords("of the", new Set(["of"]))).toBe(false);
  });
});
