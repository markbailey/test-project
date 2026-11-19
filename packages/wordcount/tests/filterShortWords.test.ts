import { describe, expect, it } from "vitest";
import { filterShortWords } from "../src/index";

describe("filterShortWords", () => {
  it("removes words shorter than minLength and keeps the rest", () => {
    expect(filterShortWords({ a: 3, to: 2, cat: 1, bird: 4 }, 3)).toEqual({ cat: 1, bird: 4 });
  });

  it("keeps words of exactly minLength", () => {
    expect(filterShortWords({ ab: 1, abc: 2 }, 2)).toEqual({ ab: 1, abc: 2 });
  });

  it("keeps everything when minLength is 1", () => {
    expect(filterShortWords({ a: 1, bb: 2 }, 1)).toEqual({ a: 1, bb: 2 });
  });

  it("returns empty when nothing is long enough", () => {
    expect(filterShortWords({ a: 1, bb: 2 }, 5)).toEqual({});
  });

  it("handles empty counts", () => {
    expect(filterShortWords({}, 3)).toEqual({});
  });

  it("returns a copy and does not mutate the input", () => {
    const counts = { a: 1, cat: 2 };
    const out = filterShortWords(counts, 1);
    expect(out).toEqual(counts);
    expect(out).not.toBe(counts);
    filterShortWords(counts, 3);
    expect(counts).toEqual({ a: 1, cat: 2 });
  });

  it("measures non-ASCII words in code points", () => {
    expect(filterShortWords({ café: 1, über: 2, ñ: 3 }, 4)).toEqual({ café: 1, über: 2 });
    expect(filterShortWords({ 日本語: 1, 日本: 2 }, 3)).toEqual({ 日本語: 1 });
  });

  it("counts astral characters as one code point, not two UTF-16 units", () => {
    // 𠮷 (U+20BB7) and 😀 are 1 code point but 2 UTF-16 units each
    expect(filterShortWords({ "𠮷野": 1 }, 3)).toEqual({});
    expect(filterShortWords({ "𠮷野": 1 }, 2)).toEqual({ "𠮷野": 1 });
    expect(filterShortWords({ "😀": 1 }, 2)).toEqual({});
    expect(filterShortWords({ "😀": 1 }, 1)).toEqual({ "😀": 1 });
  });

  it("handles keys that shadow Object.prototype", () => {
    expect(filterShortWords({ constructor: 2, a: 1 }, 2)).toEqual({ constructor: 2 });
  });
});
