import { describe, expect, it } from "vitest";
import { countWords } from "../src/index";

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
    expect(countWords("Hi, hi! HI? hi.")).toEqual({ hi: 4 });
  });

  it("handles words that shadow Object.prototype keys", () => {
    expect(countWords("constructor Constructor")).toEqual({ constructor: 2 });
  });

  it("skips tokens that are only punctuation", () => {
    expect(countWords("wow ! ...")).toEqual({ wow: 1 });
  });
});
