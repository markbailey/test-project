import { describe, expect, it } from "vitest";
import { countWords } from "../src/index";

describe("countWords caseSensitive option", () => {
  it("counts The and the separately and keeps original case", () => {
    expect(countWords("The cat saw the dog. THE end", { caseSensitive: true })).toEqual({
      The: 1,
      cat: 1,
      saw: 1,
      the: 1,
      dog: 1,
      THE: 1,
      end: 1,
    });
  });

  it("counts identical casings together", () => {
    expect(countWords("Cat cat Cat CAT cat", { caseSensitive: true })).toEqual({ Cat: 2, cat: 2, CAT: 1 });
  });

  it("defaults to case-insensitive with no options", () => {
    expect(countWords("The the THE")).toEqual({ the: 3 });
  });

  it("defaults to case-insensitive with empty options", () => {
    expect(countWords("The the THE", {})).toEqual({ the: 3 });
  });

  it("caseSensitive: false matches the default", () => {
    expect(countWords("The the THE", { caseSensitive: false })).toEqual({ the: 3 });
  });

  it("still strips punctuation and splits separators", () => {
    expect(countWords('"Hello," (hello) Hello! well—Known', { caseSensitive: true })).toEqual({
      Hello: 2,
      hello: 1,
      well: 1,
      Known: 1,
    });
  });

  it("still normalises NFC/NFD forms to one word, keeping case", () => {
    const nfc = "Café";
    const nfd = "Café";
    const counts = countWords(`${nfc} ${nfd} café`, { caseSensitive: true });
    expect(counts).toEqual({ [nfc]: 2, café: 1 });
    expect(Object.keys(counts)[0]).toBe(nfc);
  });

  it("handles words that shadow Object.prototype keys", () => {
    expect(countWords("constructor Constructor constructor", { caseSensitive: true })).toEqual({
      constructor: 2,
      Constructor: 1,
    });
  });

  it("returns empty object for empty string", () => {
    expect(countWords("", { caseSensitive: true })).toEqual({});
  });
});
