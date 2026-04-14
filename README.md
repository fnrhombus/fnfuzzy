# fnfuzzy

Lightweight, TypeScript-first fuzzy filter and search.

[![npm version](https://img.shields.io/npm/v/fnfuzzy)](https://www.npmjs.com/package/fnfuzzy)
[![bundle size](https://img.shields.io/bundlephobia/minzip/fnfuzzy)](https://bundlephobia.com/package/fnfuzzy)
[![license](https://img.shields.io/npm/l/fnfuzzy)](./LICENSE)

## Why?

The [`fuzzy`](https://www.npmjs.com/package/fuzzy) package has 3.5M weekly downloads but is abandoned -- no TypeScript, no ESM, no updates since 2016. [`fuse.js`](https://fusejs.io/) is full-featured but heavy (~6KB min+gz) and overkill for simple filtering. **fnfuzzy** fills the gap: a modern, typed, dual-publish (ESM + CJS) fuzzy search library under 1.5KB min+gz with zero dependencies.

## Install

```bash
npm install fnfuzzy
# or
pnpm add fnfuzzy
```

## Quick Start

### Simple filtering

```typescript
import { fuzzyFilter } from "fnfuzzy";

const files = ["index.ts", "utils.ts", "fuzzyMatch.ts", "README.md"];
fuzzyFilter("fz", files);
// => ["fuzzyMatch.ts"]
```

### Detailed results with highlighting

```typescript
import { fuzzyMatch } from "fnfuzzy";

const results = fuzzyMatch("fb", ["fooBar", "fizBuzz", "baz"]);
// [
//   { item: "fooBar",  score: 0.82, highlighted: "<mark>f</mark>oo<mark>B</mark>ar" },
//   { item: "fizBuzz", score: 0.78, highlighted: "<mark>f</mark>iz<mark>B</mark>uzz" },
// ]
```

### Object arrays

```typescript
import { fuzzyFilter } from "fnfuzzy";

const users = [
    { name: "Alice Johnson", id: 1 },
    { name: "Bob Jackson", id: 2 },
    { name: "Charlie Brown", id: 3 },
];

fuzzyFilter("aj", users, { extract: (u) => u.name });
// => [{ name: "Alice Johnson", id: 1 }, { name: "Bob Jackson", id: 2 }]
```

### Single item scoring

```typescript
import { fuzzyScore } from "fnfuzzy";

fuzzyScore("fb", "fooBar");  // 0.82
fuzzyScore("fb", "baz");     // null (no match)
fuzzyScore("", "anything");  // 0
```

## API

### `fuzzyFilter(query, items, options?)`

Returns matching items sorted by relevance (best first).

```typescript
function fuzzyFilter(query: string, items: string[]): string[];
function fuzzyFilter<T>(query: string, items: T[], options: FuzzyOptions<T>): T[];
```

### `fuzzyMatch(query, items, options?)`

Returns matching items with scores and highlighted strings, sorted by relevance.

```typescript
function fuzzyMatch(query: string, items: string[]): FuzzyResult<string>[];
function fuzzyMatch<T>(query: string, items: T[], options: FuzzyOptions<T>): FuzzyResult<T>[];
```

### `fuzzyScore(query, target, caseSensitive?)`

Scores a single query against a single target. Returns a number between 0 and 1, or `null` if the query is not a subsequence of the target.

```typescript
function fuzzyScore(query: string, target: string, caseSensitive?: boolean): number | null;
```

### `FuzzyResult<T>`

```typescript
interface FuzzyResult<T> {
    item: T;
    score: number;        // 0-1, higher is better
    highlighted: string;  // HTML with <mark> tags around matched characters
}
```

### `FuzzyOptions<T>`

```typescript
interface FuzzyOptions<T> {
    extract?: (item: T) => string;  // accessor for object arrays
    threshold?: number;              // minimum score to include (default: 0)
    limit?: number;                  // max results to return
    caseSensitive?: boolean;         // default: false
    highlightTag?: string;           // default: 'mark'
}
```

## Algorithm

fnfuzzy uses subsequence matching with a scoring model inspired by fzf and Sublime Text:

- **Exact prefix matches** score highest
- **Word boundary matches** (camelCase, `snake_case`, `kebab-case`) are rewarded
- **Consecutive character runs** score higher than scattered matches
- **Case-exact matches** receive a slight bonus
- **Gaps** between matched characters are penalized
- Scores are normalized to a 0-1 range

## Comparison

| Feature | fnfuzzy | fuzzy | fuse.js | fast-fuzzy |
|---|---|---|---|---|
| Bundle size (min+gz) | **~1.1KB** | ~1KB | ~6KB | ~4KB |
| TypeScript | Yes | No | Yes | Yes |
| ESM + CJS | Yes | CJS only | Yes | Yes |
| Highlighting | Yes | Yes | No | No |
| Maintained | Yes | No (since 2016) | Yes | Yes |
| Zero dependencies | Yes | Yes | No | No |
| Score normalization | 0-1 | raw | 0-1 | 0-1 |

## License

[MIT](./LICENSE)
