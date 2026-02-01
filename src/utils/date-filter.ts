/**
 * DateFilter Utility
 * Filter articles by publication date range
 */

import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type { Article } from '../models/article.js';

// Enable strict parsing
dayjs.extend(customParseFormat);

/**
 * Date range for filtering
 */
export interface DateRange {
    /** Start date (inclusive), ISO 8601 format YYYY-MM-DD */
    startDate?: string;
    /** End date (inclusive), ISO 8601 format YYYY-MM-DD */
    endDate?: string;
}

/**
 * Parsed date range with Dayjs objects
 */
export interface ParsedDateRange {
    /** Parsed start date as Dayjs object */
    start?: Dayjs;
    /** Parsed end date as Dayjs object */
    end?: Dayjs;
}

/**
 * Result of date filtering
 */
export interface DateFilterResult {
    /** Articles that passed the filter */
    included: Article[];
    /** Number of articles excluded by date filter */
    excludedCount: number;
    /** Number of articles included due to missing publishedAt */
    missingDateCount: number;
}

/**
 * Validate date string format (ISO 8601 YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr: string): boolean {
    if (!dateStr || dateStr.length !== 10) {
        return false;
    }
    // Use strict parsing to validate format
    const parsed = dayjs(dateStr, 'YYYY-MM-DD', true);
    return parsed.isValid();
}

/**
 * Parse a date string to Dayjs object
 */
export function parseDate(dateStr: string): Dayjs | null {
    const parsed = dayjs(dateStr, 'YYYY-MM-DD', true);
    return parsed.isValid() ? parsed : null;
}

/**
 * Parse and validate date range
 * @throws Error if dates are invalid or startDate > endDate
 */
export function validateDateRange(startDate?: string, endDate?: string): ParsedDateRange {
    let start: Dayjs | undefined;
    let end: Dayjs | undefined;

    if (startDate !== undefined) {
        if (!isValidDateFormat(startDate)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD.');
        }
        start = parseDate(startDate)!;
    }

    if (endDate !== undefined) {
        if (!isValidDateFormat(endDate)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD.');
        }
        end = parseDate(endDate)!;
    }

    if (start && end && start.isAfter(end)) {
        throw new Error('--start-date must be before or equal to --end-date.');
    }

    return { start, end };
}

/**
 * Filter articles by publication date range
 */
export function filterByDateRange(articles: Article[], dateRange: DateRange): DateFilterResult {
    const { startDate, endDate } = dateRange;

    // No filtering if no date range specified
    if (!startDate && !endDate) {
        return {
            included: articles,
            excludedCount: 0,
            missingDateCount: 0
        };
    }

    const { start, end } = validateDateRange(startDate, endDate);

    const included: Article[] = [];
    let excludedCount = 0;
    let missingDateCount = 0;

    for (const article of articles) {
        // Include articles with missing publishedAt when filtering is active
        if (!article.publishedAt) {
            included.push(article);
            missingDateCount++;
            continue;
        }

        const articleDate = dayjs(article.publishedAt);

        // Check start date (inclusive) - use start of day
        if (start && articleDate.isBefore(start.startOf('day'))) {
            excludedCount++;
            continue;
        }

        // Check end date (inclusive) - use end of day
        if (end && articleDate.isAfter(end.endOf('day'))) {
            excludedCount++;
            continue;
        }

        included.push(article);
    }

    return {
        included,
        excludedCount,
        missingDateCount
    };
}
