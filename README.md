# test-project

Turborepo monorepo managed with pnpm.

- `apps/*` — applications
- `packages/*` — shared packages

```sh
pnpm install
pnpm build   # turbo run build
pnpm dev     # turbo run dev
pnpm test    # turbo run test
pnpm lint    # turbo run lint (ESLint, config in eslint.config.js)
```

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`. It installs with `pnpm install --frozen-lockfile`, then runs:

- `pnpm lint`: ESLint over `apps/wordfreq` and `packages/wordcount`
- `pnpm test`: the vitest suites in `apps/wordfreq` and `packages/wordcount`
- `python -m unittest discover -s tests`: the repo setup checks in `tests/`
- `pnpm build`
- a smoke run of `node apps/wordfreq/bin/wordfreq.js --version` and `--help`

Any failing step fails the job. A new push cancels the earlier run on the same ref.

## wordfreq

CLI in `apps/wordfreq` that prints the most frequent words in a text file.

```sh
pnpm --filter @test-project/wordfreq start <file> [--top N] [--ignore-common] [--json]
```

pnpm runs the script from inside `apps/wordfreq`, so a relative `<file>` path is resolved from that folder, not from where you ran the command. Use an absolute path to avoid this.

Options:

- `--top N`: show the N most frequent words. N must be an integer of 0 or more. Default is 10.
- `--min-count N`: hide words seen fewer than N times, applied before `--top`. N must be an integer of 1 or more. Default is 1.
- `--sort count|alpha`: `count` (default) sorts by count, highest first, ties alphabetical. `alpha` sorts by word, A–Z. `--min-count` and `--top` apply after sorting. Any other value prints `Invalid --sort value: <v>` plus usage to stderr and exits 1.
- `--ignore-common`: drop the words in `STOP_WORDS` (see below); matched case-insensitively.
- `--exclude <words>`: comma-separated words to drop, e.g. `--exclude cat,dog`. Matching ignores case; empty entries (`a,,b`) are skipped. Works with `--ignore-common`. With `--ngram`, any phrase containing an excluded word is dropped. A missing value prints `Missing value for --exclude` plus usage and exits 1.
- `--case-sensitive`: count `The` and `the` separately and keep original case (default: fold to lowercase).
- `--json`: print a JSON array of `{word, count}` objects instead of `word: count` lines.

By default, output is sorted by count, highest first. Words with the same count are sorted alphabetically. Use `--sort alpha` for A–Z order.

Errors: a bad or missing argument prints the message plus the usage line to stderr and exits 1, e.g.

```
Invalid --top value: x
Usage: wordfreq <file> [--top N] [--ignore-common] [--json]
```

A file that can't be read prints `Error: cannot read file: <file>` and exits 1.

### Example

`/tmp/sample.txt`:

```
The cat sat on the mat.
The dog didn't sit; the cat did!
```

```sh
$ pnpm --silent --filter @test-project/wordfreq start /tmp/sample.txt --top 3 --ignore-common
cat: 2
did: 1
didn't: 1

$ pnpm --silent --filter @test-project/wordfreq start /tmp/sample.txt --top 3 --ignore-common --json
[{"word":"cat","count":2},{"word":"did","count":1},{"word":"didn't","count":1}]
```

## wordcount

`@test-project/wordcount` (`packages/wordcount`) is the word counting library that wordfreq uses.

```ts
import { countWords, filterStopWords, STOP_WORDS } from "@test-project/wordcount";
```

- `countWords(text: string): Record<string, number>`: counts how often each word appears in `text`.

  ```ts
  countWords("Don't stop. don't STOP!"); // { "don't": 2, stop: 2 }
  ```

- `filterStopWords(counts): Record<string, number>`: returns a copy of `counts` without the words in `STOP_WORDS`.

  ```ts
  filterStopWords(countWords("The cat and the hat")); // { cat: 1, hat: 1 }
  ```

- `STOP_WORDS: ReadonlySet<string>`: the common English words (lowercase) that `--ignore-common` drops.

  ```ts
  STOP_WORDS.has("the"); // true
  STOP_WORDS.has("cat"); // false
  ```

### Word rules

Text is normalized to Unicode NFC before splitting, so a word written with precomposed characters (`café` with U+00E9) and with combining marks (`e` + U+0301) counts as one word; output uses the NFC form. Text is split on whitespace. Matching ignores case, and output is lowercase. Anything other than a letter or digit is stripped from both ends of a word. Punctuation inside a word, such as an apostrophe, is kept, so `don't` stays `don't`. A token that becomes empty after stripping is skipped.
