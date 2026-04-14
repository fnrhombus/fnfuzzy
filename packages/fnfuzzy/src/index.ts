export interface FuzzyResult<T> {
    item: T;
    score: number;
    highlighted: string;
}

export interface FuzzyOptions<T> {
    extract?: (item: T) => string;
    threshold?: number;
    limit?: number;
    caseSensitive?: boolean;
    highlightTag?: string;
}

interface MatchInfo {
    score: number;
    indices: number[];
}

const BONUS_CONSECUTIVE = 8;
const BONUS_FIRST_CHAR = 12;
const BONUS_WORD_BOUNDARY = 10;
const BONUS_CAMEL_CASE = 10;
const BONUS_CASE_EXACT = 2;
const PENALTY_GAP_START = -4;
const PENALTY_GAP_EXTEND = -1;
const PENALTY_DISTANCE = -0.5;

function isWordBoundary(target: string, i: number): boolean {
    if (i === 0) return true;
    const prev = target[i - 1];
    return prev === " " || prev === "-" || prev === "_" || prev === "." || prev === "/";
}

function isCamelBoundary(target: string, i: number): boolean {
    if (i === 0) return false;
    const curr = target[i];
    const prev = target[i - 1];
    return (
        (curr >= "A" && curr <= "Z" && prev >= "a" && prev <= "z") ||
        (curr >= "A" && curr <= "Z" && i + 1 < target.length && target[i + 1] >= "a" && target[i + 1] <= "z" && prev >= "A" && prev <= "Z")
    );
}

function computeMatch(query: string, target: string, caseSensitive: boolean): MatchInfo | null {
    const qLen = query.length;
    const tLen = target.length;

    if (qLen === 0) return { score: 0, indices: [] };
    if (qLen > tLen) return null;

    const qNorm = caseSensitive ? query : query.toLowerCase();
    const tNorm = caseSensitive ? target : target.toLowerCase();

    // Quick check: is query a subsequence of target?
    let qi = 0;
    for (let ti = 0; ti < tLen && qi < qLen; ti++) {
        if (qNorm[qi] === tNorm[ti]) qi++;
    }
    if (qi < qLen) return null;

    // Dynamic programming approach inspired by fzf's Smith-Waterman-like algorithm.
    // For each (qi, ti), track the best score ending with query[qi] matched at target[ti].
    // We also track whether the previous match was consecutive to apply bonuses properly.

    // score[qi][ti] = best score matching query[0..qi] with query[qi] matched at target[ti]
    // We use two arrays (current and previous row) to save memory.

    const NO_MATCH = -Infinity;

    // For each query char position, store best score at each target position
    // and track the chosen indices for highlighting.

    // Since we need to reconstruct indices, we use a full matrix approach but
    // keep it efficient with early termination.

    // Allocate scoring matrix and consecutive-bonus tracking
    const H = Array.from({ length: qLen }, () => new Float64Array(tLen).fill(NO_MATCH));
    const consecutive = Array.from({ length: qLen }, () => new Uint8Array(tLen));

    // Fill first row: match query[0] at each possible target position
    for (let ti = 0; ti < tLen; ti++) {
        if (qNorm[0] !== tNorm[ti]) continue;

        let s = 0;
        if (ti === 0) {
            s += BONUS_FIRST_CHAR;
        } else {
            s += PENALTY_DISTANCE * ti;
        }

        if (isWordBoundary(target, ti)) s += BONUS_WORD_BOUNDARY;
        else if (isCamelBoundary(target, ti)) s += BONUS_CAMEL_CASE;

        if (caseSensitive || query[0] === target[ti]) s += BONUS_CASE_EXACT;

        H[0][ti] = s;
        consecutive[0][ti] = 1;
    }

    // Fill remaining rows
    for (let qi = 1; qi < qLen; qi++) {
        // The earliest target position for this query char
        // (need at least qi chars before it)
        let bestPrev = NO_MATCH;

        for (let ti = qi; ti < tLen; ti++) {
            // Update bestPrev from previous row up to ti-1
            if (ti > 0 && H[qi - 1][ti - 1] > bestPrev) {
                bestPrev = H[qi - 1][ti - 1];
            }

            if (qNorm[qi] !== tNorm[ti]) continue;

            let s = NO_MATCH;

            // Option 1: consecutive match (query[qi-1] matched at ti-1)
            if (ti > 0 && H[qi - 1][ti - 1] > NO_MATCH) {
                const consLen = consecutive[qi - 1][ti - 1];
                const consBonus = BONUS_CONSECUTIVE * consLen;
                const candidateS = H[qi - 1][ti - 1] + consBonus;
                if (candidateS > s) {
                    s = candidateS;
                    consecutive[qi][ti] = consLen + 1;
                }
            }

            // Option 2: non-consecutive match (query[qi-1] matched at some tj < ti-1)
            // Use bestPrev which tracks max H[qi-1][0..ti-2]
            // We need to check H[qi-1][0..ti-2], but bestPrev includes ti-1.
            // Actually bestPrev is updated with H[qi-1][ti-1] at the top, which is correct
            // for the non-consecutive case (gap of at least 1).
            // But we already handle the consecutive case above. For non-consecutive,
            // we want the best from H[qi-1][0..ti-2].
            // Let's track a separate variable.

            // Actually let's reconsider: bestPrev includes H[qi-1][ti-1] which is the
            // consecutive case. We need bestPrev excluding ti-1 for a clean gap penalty.
            // Simpler: just check both and take the max.

            // For non-consecutive: find best H[qi-1][tj] for tj < ti, with gap penalty
            // The gap is (ti - tj - 1). We approximate by just using a start penalty.
            if (bestPrev > NO_MATCH) {
                const gapS = bestPrev + PENALTY_GAP_START;
                if (gapS > s) {
                    s = gapS;
                    consecutive[qi][ti] = 1;
                }
            }

            if (s <= NO_MATCH) continue;

            // Position bonuses
            if (isWordBoundary(target, ti)) s += BONUS_WORD_BOUNDARY;
            else if (isCamelBoundary(target, ti)) s += BONUS_CAMEL_CASE;

            if (caseSensitive || query[qi] === target[ti]) s += BONUS_CASE_EXACT;

            H[qi][ti] = s;
        }
    }

    // Find best ending position
    let bestScore = NO_MATCH;
    let bestEnd = -1;
    for (let ti = qLen - 1; ti < tLen; ti++) {
        if (H[qLen - 1][ti] > bestScore) {
            bestScore = H[qLen - 1][ti];
            bestEnd = ti;
        }
    }

    if (bestEnd < 0) return null;

    // Backtrack to find matched indices
    const indices: number[] = new Array(qLen);
    indices[qLen - 1] = bestEnd;

    for (let qi = qLen - 2; qi >= 0; qi--) {
        const nextTi = indices[qi + 1];
        // Prefer consecutive (ti = nextTi - 1) if available
        if (nextTi > 0 && H[qi][nextTi - 1] > NO_MATCH) {
            indices[qi] = nextTi - 1;
        } else {
            // Find the best ti < nextTi
            let best = NO_MATCH;
            let bestTi = -1;
            for (let ti = qi; ti < nextTi; ti++) {
                if (H[qi][ti] > best) {
                    best = H[qi][ti];
                    bestTi = ti;
                }
            }
            indices[qi] = bestTi;
        }
    }

    // Normalize score to 0-1 range
    // Max theoretical score: all chars matched consecutively at position 0 with word boundaries
    const maxScore = BONUS_FIRST_CHAR + BONUS_WORD_BOUNDARY + BONUS_CASE_EXACT
        + (qLen - 1) * (BONUS_CONSECUTIVE * qLen + BONUS_WORD_BOUNDARY + BONUS_CASE_EXACT);
    const normalizedScore = Math.max(0, Math.min(1, (bestScore - qLen * PENALTY_GAP_START) / (maxScore - qLen * PENALTY_GAP_START + 1)));

    return { score: normalizedScore, indices };
}

function highlight(target: string, indices: number[], tag: string): string {
    if (indices.length === 0) return target;

    const indexSet = new Set(indices);
    const parts: string[] = [];
    let i = 0;

    while (i < target.length) {
        if (indexSet.has(i)) {
            const start = i;
            while (i < target.length && indexSet.has(i)) i++;
            parts.push(`<${tag}>${target.slice(start, i)}</${tag}>`);
        } else {
            const start = i;
            while (i < target.length && !indexSet.has(i)) i++;
            parts.push(target.slice(start, i));
        }
    }

    return parts.join("");
}

function processItems<T>(
    query: string,
    items: T[],
    options: FuzzyOptions<T> = {}
): FuzzyResult<T>[] {
    const {
        extract,
        threshold = 0,
        limit,
        caseSensitive = false,
        highlightTag = "mark",
    } = options;

    const getText = extract ?? ((item: T) => item as unknown as string);

    if (query.length === 0) {
        const results = items.map(item => ({
            item,
            score: 0,
            highlighted: getText(item),
        }));
        return limit != null ? results.slice(0, limit) : results;
    }

    const results: FuzzyResult<T>[] = [];

    for (const item of items) {
        const target = getText(item);
        const match = computeMatch(query, target, caseSensitive);
        if (match === null) continue;
        if (match.score < threshold) continue;

        results.push({
            item,
            score: match.score,
            highlighted: highlight(target, match.indices, highlightTag),
        });
    }

    results.sort((a, b) => b.score - a.score);

    return limit != null ? results.slice(0, limit) : results;
}

export function fuzzyFilter(query: string, items: string[]): string[];
export function fuzzyFilter<T>(query: string, items: T[], options: FuzzyOptions<T>): T[];
export function fuzzyFilter<T>(query: string, items: T[], options: FuzzyOptions<T> = {}): T[] {
    return processItems(query, items, options).map(r => r.item);
}

export function fuzzyMatch(query: string, items: string[]): FuzzyResult<string>[];
export function fuzzyMatch<T>(query: string, items: T[], options: FuzzyOptions<T>): FuzzyResult<T>[];
export function fuzzyMatch<T>(query: string, items: T[], options: FuzzyOptions<T> = {}): FuzzyResult<T>[] {
    return processItems(query, items, options);
}

export function fuzzyScore(query: string, target: string, caseSensitive = false): number | null {
    if (query.length === 0) return 0;
    const match = computeMatch(query, target, caseSensitive);
    return match === null ? null : match.score;
}
