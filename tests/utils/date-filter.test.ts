/**
 * DateFilter Utility Tests
 * TDD: Tests for date validation and filtering functions (Task 3.1, 3.2, 7.1, 7.2)
 */

import {
    isValidDateFormat,
    parseDate,
    validateDateRange,
    filterByDateRange
} from '../../src/utils/date-filter.js';
import type { Article } from '../../src/models/article.js';

// Helper to create a mock article
function createMockArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'test-id-123',
        title: 'Test Article',
        content: 'Test content',
        source: 'website',
        sourceUrl: 'https://example.com/article',
        crawledAt: new Date().toISOString(),
        tags: [],
        metadata: {},
        ...overrides
    };
}

describe('DateFilter Utility', () => {
    describe('isValidDateFormat', () => {
        // Requirement 2.4: Validate ISO 8601 date format
        it('should accept valid ISO 8601 date (YYYY-MM-DD)', () => {
            expect(isValidDateFormat('2026-02-01')).toBe(true);
            expect(isValidDateFormat('2025-12-31')).toBe(true);
            expect(isValidDateFormat('2024-01-15')).toBe(true);
        });

        it('should reject invalid date formats', () => {
            expect(isValidDateFormat('02-01-2026')).toBe(false);  // MM-DD-YYYY
            expect(isValidDateFormat('2026/02/01')).toBe(false);  // slashes
            expect(isValidDateFormat('2026-2-1')).toBe(false);    // missing leading zeros
            expect(isValidDateFormat('Feb 1, 2026')).toBe(false); // text format
            expect(isValidDateFormat('invalid')).toBe(false);
            expect(isValidDateFormat('')).toBe(false);
        });

        it('should reject invalid dates even in correct format', () => {
            expect(isValidDateFormat('2026-13-01')).toBe(false);  // invalid month
            expect(isValidDateFormat('2026-02-30')).toBe(false);  // Feb 30 doesn't exist
            expect(isValidDateFormat('2026-00-01')).toBe(false);  // month 0
        });
    });

    describe('parseDate', () => {
        it('should parse valid date string to Dayjs object', () => {
            const result = parseDate('2026-02-01');

            expect(result).not.toBeNull();
            expect(result!.format('YYYY-MM-DD')).toBe('2026-02-01');
        });

        it('should return null for invalid date string', () => {
            expect(parseDate('invalid')).toBeNull();
            expect(parseDate('2026-13-01')).toBeNull();
        });
    });

    describe('validateDateRange', () => {
        // Requirement 2.5: Validate start date is not after end date
        it('should accept valid date range where start is before end', () => {
            const result = validateDateRange('2026-01-01', '2026-02-01');

            expect(result.start).not.toBeUndefined();
            expect(result.end).not.toBeUndefined();
        });

        it('should accept date range where start equals end', () => {
            const result = validateDateRange('2026-02-01', '2026-02-01');

            expect(result.start).not.toBeUndefined();
            expect(result.end).not.toBeUndefined();
        });

        it('should throw error when start date is after end date', () => {
            expect(() => validateDateRange('2026-02-01', '2026-01-01'))
                .toThrow('--start-date must be before or equal to --end-date');
        });

        it('should throw error for invalid start date format', () => {
            expect(() => validateDateRange('invalid', '2026-02-01'))
                .toThrow('Invalid date format. Use YYYY-MM-DD');
        });

        it('should throw error for invalid end date format', () => {
            expect(() => validateDateRange('2026-01-01', 'invalid'))
                .toThrow('Invalid date format. Use YYYY-MM-DD');
        });

        it('should accept undefined start date', () => {
            const result = validateDateRange(undefined, '2026-02-01');

            expect(result.start).toBeUndefined();
            expect(result.end).not.toBeUndefined();
        });

        it('should accept undefined end date', () => {
            const result = validateDateRange('2026-01-01', undefined);

            expect(result.start).not.toBeUndefined();
            expect(result.end).toBeUndefined();
        });

        it('should accept both dates undefined', () => {
            const result = validateDateRange(undefined, undefined);

            expect(result.start).toBeUndefined();
            expect(result.end).toBeUndefined();
        });
    });

    describe('filterByDateRange', () => {
        const articlesWithDates: Article[] = [
            createMockArticle({ id: '1', publishedAt: '2026-01-15T10:00:00Z' }),
            createMockArticle({ id: '2', publishedAt: '2026-02-01T10:00:00Z' }),
            createMockArticle({ id: '3', publishedAt: '2026-02-15T10:00:00Z' }),
            createMockArticle({ id: '4', publishedAt: '2026-03-01T10:00:00Z' })
        ];

        // Requirement 2.1: Filter by start date
        describe('start date filtering', () => {
            it('should include articles on or after start date', () => {
                const result = filterByDateRange(articlesWithDates, { startDate: '2026-02-01' });

                expect(result.included).toHaveLength(3);
                expect(result.included.map(a => a.id)).toEqual(['2', '3', '4']);
            });

            it('should include article exactly on start date (inclusive)', () => {
                const result = filterByDateRange(articlesWithDates, { startDate: '2026-02-01' });

                expect(result.included.some(a => a.id === '2')).toBe(true);
            });
        });

        // Requirement 2.2: Filter by end date
        describe('end date filtering', () => {
            it('should include articles on or before end date', () => {
                const result = filterByDateRange(articlesWithDates, { endDate: '2026-02-15' });

                expect(result.included).toHaveLength(3);
                expect(result.included.map(a => a.id)).toEqual(['1', '2', '3']);
            });

            it('should include article exactly on end date (inclusive)', () => {
                const result = filterByDateRange(articlesWithDates, { endDate: '2026-02-15' });

                expect(result.included.some(a => a.id === '3')).toBe(true);
            });
        });

        // Requirement 2.3: Filter by both start and end dates
        describe('date range filtering', () => {
            it('should include only articles within the date range', () => {
                const result = filterByDateRange(articlesWithDates, {
                    startDate: '2026-02-01',
                    endDate: '2026-02-28'
                });

                expect(result.included).toHaveLength(2);
                expect(result.included.map(a => a.id)).toEqual(['2', '3']);
            });
        });

        // Requirement 2.6: Default behavior (no filtering)
        describe('no date range', () => {
            it('should include all articles when no date range specified', () => {
                const result = filterByDateRange(articlesWithDates, {});

                expect(result.included).toHaveLength(4);
                expect(result.excludedCount).toBe(0);
            });
        });

        // Requirement 2.7: Log filtered article count
        describe('filtering statistics', () => {
            it('should return count of excluded articles', () => {
                const result = filterByDateRange(articlesWithDates, { startDate: '2026-02-01' });

                expect(result.excludedCount).toBe(1);
            });

            it('should return count of articles with missing dates', () => {
                const articlesWithMissingDates = [
                    ...articlesWithDates,
                    createMockArticle({ id: '5', publishedAt: undefined })
                ];

                const result = filterByDateRange(articlesWithMissingDates, { startDate: '2026-02-01' });

                expect(result.missingDateCount).toBe(1);
            });
        });

        // Design decision: Include articles with missing publishedAt
        describe('missing publication date handling', () => {
            it('should include articles with missing publishedAt when filtering is active', () => {
                const articlesWithMissingDate = [
                    createMockArticle({ id: '1', publishedAt: '2026-01-15T10:00:00Z' }),
                    createMockArticle({ id: '2', publishedAt: undefined })
                ];

                const result = filterByDateRange(articlesWithMissingDate, { startDate: '2026-02-01' });

                // Article 1 is excluded (before start date)
                // Article 2 is included (missing date)
                expect(result.included).toHaveLength(1);
                expect(result.included[0].id).toBe('2');
                expect(result.missingDateCount).toBe(1);
            });

            it('should include all articles with missing dates when no filtering', () => {
                const articlesWithMissingDate = [
                    createMockArticle({ id: '1', publishedAt: undefined }),
                    createMockArticle({ id: '2', publishedAt: undefined })
                ];

                const result = filterByDateRange(articlesWithMissingDate, {});

                expect(result.included).toHaveLength(2);
                expect(result.missingDateCount).toBe(0); // No "missing date" counted when no filtering
            });
        });

        describe('edge cases', () => {
            it('should handle empty article array', () => {
                const result = filterByDateRange([], { startDate: '2026-02-01' });

                expect(result.included).toHaveLength(0);
                expect(result.excludedCount).toBe(0);
                expect(result.missingDateCount).toBe(0);
            });

            it('should not modify original articles array', () => {
                const original = [...articlesWithDates];
                filterByDateRange(articlesWithDates, { startDate: '2026-02-01' });

                expect(articlesWithDates).toEqual(original);
            });
        });
    });
});
