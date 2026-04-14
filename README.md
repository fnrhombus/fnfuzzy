# fnfuzzy

**Fuzzy search that doesn't hate your bundle.**

[![npm version](https://img.shields.io/npm/v/fnfuzzy)](https://www.npmjs.com/package/fnfuzzy)
[![bundle size](https://img.shields.io/bundlephobia/minzip/fnfuzzy)](https://bundlephobia.com/package/fnfuzzy)
[![license](https://img.shields.io/npm/l/fnfuzzy)](./LICENSE)

```ts
import { fuzzyFilter } from "fnfuzzy";

fuzzyFilter("fb", ["fooBar", "fizBuzz", "baz"]);
// => ["fooBar", "fizBuzz"]
```

1.1KB gzipped. Zero dependencies. TypeScript-first. ESM + CJS.

---

## The problem

[`fuzzy`](https://www.npmjs.com/package/fuzzy) has 3.5M weekly downloads and hasn't been updated since 2016. No TypeScript, no ESM, no maintenance. [`fuse.js`](https://www.npmjs.com/package/fuse.js) is a full-text search engine when all you wanted was `array.filter()` but fuzzy.

**fnfuzzy** is the thing in between — tiny, typed, and smart enough to know that `"fb"` matches `"fooBar"` at the word boundary.

## How it scores

The algorithm is modeled after fzf and Sublime Text:

- Exact prefix matches score highest
- Word boundaries (camelCase, `snake_case`, `kebab-case`) get a bonus
- Consecutive runs beat scattered matches
- Case-exact matches get a slight edge
- Gaps are penalized

Scores are normalized 0–1 so you can set thresholds without guessing.

## What's in the box

```ts
import { fuzzyFilter, fuzzyMatch, fuzzyScore } from "fnfuzzy";

// Filter: returns matching items, sorted by relevance
fuzzyFilter("hlo", ["hello", "world", "help"]);
// => ["hello", "help"]

// Match: same thing, but with scores + highlighting
fuzzyMatch("hlo", ["hello", "world", "help"]);
// => [{ item: "hello", score: 0.82, highlighted: "<mark>h</mark>e<mark>l</mark>lo" }, ...]

// Score: single-item check (null = no match)
fuzzyScore("fb", "fooBar");   // 0.82
fuzzyScore("fb", "baz");      // null
```

Object arrays work with an `extract` function:

```ts
const users = [{ name: "Alice" }, { name: "Bob" }];
fuzzyFilter("ali", users, { extract: (u) => u.name });
// => [{ name: "Alice" }]
```

All functions accept optional `threshold`, `limit`, `caseSensitive`, and `highlightTag` options — see the [wiki](https://github.com/fnrhombus/fnfuzzy/wiki) for the full API.

## Comparison

| | fnfuzzy | fuzzy | fuse.js | fast-fuzzy |
|---|---|---|---|---|
| **Size** (min+gz) | **1.1KB** | ~1KB | ~6KB | ~4KB |
| TypeScript | ✅ native | ❌ | ✅ | ✅ |
| ESM + CJS | ✅ | ❌ CJS only | ✅ | ✅ |
| Highlighting | ✅ | ✅ | ❌ | ❌ |
| Zero deps | ✅ | ✅ | ❌ | ❌ |
| Maintained | ✅ | ❌ abandoned | ✅ | ✅ |

## Install

```bash
npm install fnfuzzy
pnpm add fnfuzzy
```

Requires Node 20+. Works in all modern browsers.

## Support

If fnfuzzy saved you a `node_modules` headache, consider buying it a coffee:

- **[GitHub Sponsors](https://github.com/sponsors/fnrhombus)**
- **[Buy Me a Coffee](https://buymeacoffee.com/fnrhombus)**

## License

MIT © [fnrhombus](https://github.com/fnrhombus)
