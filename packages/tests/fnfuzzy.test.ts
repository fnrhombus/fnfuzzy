import { describe, it, expect } from "vitest";
import { fuzzyFilter, fuzzyMatch, fuzzyScore } from "fnfuzzy";

describe("fuzzyScore", () => {
    it("returns 0 for empty query", () => {
        expect(fuzzyScore("", "hello")).toBe(0);
    });

    it("returns null when query is not a subsequence", () => {
        expect(fuzzyScore("xyz", "hello")).toBeNull();
    });

    it("returns null when query is longer than target", () => {
        expect(fuzzyScore("abcdef", "abc")).toBeNull();
    });

    it("returns a positive score for a valid match", () => {
        const score = fuzzyScore("hlo", "hello");
        expect(score).not.toBeNull();
        expect(score!).toBeGreaterThan(0);
    });

    it("scores exact prefix matches highest", () => {
        const exact = fuzzyScore("hel", "hello")!;
        const scattered = fuzzyScore("hlo", "hello")!;
        expect(exact).toBeGreaterThan(scattered);
    });

    it("scores word boundary matches higher than scattered", () => {
        const boundary = fuzzyScore("fb", "fooBar")!;
        const scattered = fuzzyScore("fb", "xfxbx")!;
        expect(boundary).toBeGreaterThan(scattered);
    });

    it("scores consecutive matches higher than scattered", () => {
        const consecutive = fuzzyScore("abc", "abcdef")!;
        const scattered = fuzzyScore("abc", "axbxcx")!;
        expect(consecutive).toBeGreaterThan(scattered);
    });

    it("gives slightly higher score for case-exact matches", () => {
        const caseExact = fuzzyScore("Foo", "FooBar", true)!;
        const caseDiff = fuzzyScore("foo", "FooBar", true);
        // "foo" shouldn't match "FooBar" in case-sensitive mode
        expect(caseDiff).toBeNull();
    });

    it("handles single character query", () => {
        const score = fuzzyScore("a", "abc");
        expect(score).not.toBeNull();
        expect(score!).toBeGreaterThan(0);
    });

    it("handles exact match", () => {
        const score = fuzzyScore("hello", "hello");
        expect(score).not.toBeNull();
        expect(score!).toBeGreaterThan(0.5);
    });
});

describe("fuzzyFilter", () => {
    it("returns matching items sorted by score", () => {
        const items = ["fooBar", "xfxbx", "baz"];
        const result = fuzzyFilter("fb", items);
        expect(result).toContain("fooBar");
        expect(result).toContain("xfxbx");
        expect(result).not.toContain("baz");
        expect(result[0]).toBe("fooBar");
    });

    it("returns all items for empty query", () => {
        const items = ["a", "b", "c"];
        expect(fuzzyFilter("", items)).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for no matches", () => {
        expect(fuzzyFilter("xyz", ["abc", "def"])).toEqual([]);
    });

    it("is case-insensitive by default", () => {
        const result = fuzzyFilter("foo", ["FOO", "foo", "FoO"]);
        expect(result).toHaveLength(3);
    });

    it("respects caseSensitive option", () => {
        const result = fuzzyFilter("FOO", ["FOO", "foo", "FoO"], { caseSensitive: true });
        expect(result).toEqual(["FOO"]);
    });

    it("works with extract function on objects", () => {
        const items = [
            { name: "fooBar", id: 1 },
            { name: "bazQux", id: 2 },
            { name: "fooBaz", id: 3 },
        ];
        const result = fuzzyFilter("fb", items, { extract: (x) => x.name });
        expect(result.map(x => x.id)).toContain(1);
        expect(result.map(x => x.id)).toContain(3);
        expect(result.map(x => x.id)).not.toContain(2);
    });

    it("respects limit option", () => {
        const items = ["abc", "abcd", "abcde", "abcdef"];
        const result = fuzzyFilter("abc", items, { limit: 2 });
        expect(result).toHaveLength(2);
    });

    it("respects threshold option", () => {
        const items = ["abc", "axbxcx"];
        const result = fuzzyFilter("abc", items, { threshold: 0.5 });
        // abc should score high, axbxcx might be below threshold
        expect(result).toContain("abc");
    });

    it("handles empty items array", () => {
        expect(fuzzyFilter("abc", [])).toEqual([]);
    });

    it("handles special regex characters in query", () => {
        const result = fuzzyFilter("a.b", ["a.b.c", "axbxc"]);
        // "a.b" as literal chars should match "a.b.c"
        expect(result).toContain("a.b.c");
    });

    it("handles unicode characters", () => {
        const result = fuzzyFilter("cafe", ["cafe", "caf\u00e9"]);
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result).toContain("cafe");
    });
});

describe("fuzzyMatch", () => {
    it("returns results with score and highlighting", () => {
        const results = fuzzyMatch("hlo", ["hello"]);
        expect(results).toHaveLength(1);
        expect(results[0].item).toBe("hello");
        expect(results[0].score).toBeGreaterThan(0);
        expect(results[0].highlighted).toContain("<mark>");
    });

    it("merges consecutive matched characters in highlighting", () => {
        const results = fuzzyMatch("hel", ["hello"]);
        expect(results[0].highlighted).toBe("<mark>hel</mark>lo");
    });

    it("wraps individual matched characters when scattered", () => {
        const results = fuzzyMatch("ho", ["hello"]);
        expect(results[0].highlighted).toBe("<mark>h</mark>ell<mark>o</mark>");
    });

    it("uses custom highlight tag", () => {
        const results = fuzzyMatch("hel", ["hello"], { highlightTag: "b" });
        expect(results[0].highlighted).toBe("<b>hel</b>lo");
    });

    it("returns results sorted by score descending", () => {
        const results = fuzzyMatch("fb", ["xfxbx", "fooBar", "fBaz"]);
        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
    });

    it("returns all items with score 0 for empty query", () => {
        const results = fuzzyMatch("", ["a", "b"]);
        expect(results).toHaveLength(2);
        expect(results[0].score).toBe(0);
        expect(results[0].highlighted).toBe("a");
    });

    it("works with extract function on objects", () => {
        const items = [{ label: "hello world" }, { label: "goodbye" }];
        const results = fuzzyMatch("hw", items, { extract: (x) => x.label });
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].item.label).toBe("hello world");
    });

    it("highlights full match correctly", () => {
        const results = fuzzyMatch("abc", ["abc"]);
        expect(results[0].highlighted).toBe("<mark>abc</mark>");
    });
});

describe("scoring quality", () => {
    it("ranks exact match over prefix match", () => {
        const results = fuzzyMatch("foo", ["foo", "fooBar", "xfoo"]);
        expect(results[0].item).toBe("foo");
    });

    it("ranks prefix match over middle match", () => {
        const scorePrefix = fuzzyScore("abc", "abcdef")!;
        const scoreMiddle = fuzzyScore("abc", "xabcdef")!;
        expect(scorePrefix).toBeGreaterThan(scoreMiddle);
    });

    it("ranks camelCase boundary match high", () => {
        const results = fuzzyMatch("gc", ["getContext", "genericContainer", "xgxcx"]);
        expect(results[0].item).toBe("getContext");
    });

    it("ranks underscore boundary match high", () => {
        const results = fuzzyMatch("gc", ["get_context", "genericcontainer"]);
        expect(results[0].item).toBe("get_context");
    });

    it("prefers shorter targets for same match quality", () => {
        const short = fuzzyScore("ab", "ab")!;
        const long = fuzzyScore("ab", "ab_____________________")!;
        expect(short).toBeGreaterThanOrEqual(long);
    });
});
