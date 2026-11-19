import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { USAGE } from "../src/wordfreq.ts";

const source = readFileSync(new URL("../src/wordfreq.ts", import.meta.url), "utf8");
const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

// Text of parseArgs only, so flags handled elsewhere (e.g. --help) don't count.
const parseArgsBody = source.slice(
  source.indexOf("export function parseArgs"),
  source.indexOf("export function topWords"),
);
const parsedOptions = [...new Set([...parseArgsBody.matchAll(/arg === "(--[\w-]+)"/g)].map((m) => m[1]))];

// Everything after "Usage: wordfreq <file|->", i.e. the option list.
const optionList = USAGE.replace(/^Usage: wordfreq\s+<[^>]+>\s*/, "");

describe("usage string", () => {
  it("finds the options parseArgs handles", () => {
    expect(parsedOptions).toContain("--top");
    expect(parsedOptions).toContain("--min-count");
    expect(parsedOptions.length).toBeGreaterThanOrEqual(12);
  });

  it("lists every option parsed by parseArgs", () => {
    const missing = parsedOptions.filter((o) => !USAGE.includes(o));
    expect(missing).toEqual([]);
  });

  it("lists --version", () => {
    expect(USAGE).toContain("--version");
  });
});

describe("README usage", () => {
  it("error example shows the current usage line", () => {
    expect(readme).toContain(USAGE);
  });

  it("usage command lists the full option list", () => {
    const start = readme.indexOf("pnpm --filter @test-project/wordfreq start <file");
    expect(start).toBeGreaterThanOrEqual(0);
    const line = readme.slice(start, readme.indexOf("\n", start));
    expect(line).toContain(optionList);
  });

  it("mentions every option parsed by parseArgs", () => {
    const missing = parsedOptions.filter((o) => !readme.includes(o));
    expect(missing).toEqual([]);
  });
});
