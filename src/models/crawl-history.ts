/**
 * Crawl History Model
 * Tracks the history of crawl operations
 */

import type { ArticleSource } from '../config/types.js';

export type CrawlStatus = 'success' | 'partial' | 'failed';

export interface CrawlHistory {
    /** Unique identifier */
    id: string;

    /** When the crawl started */
    timestamp: string;

    /** Source that was crawled */
    source: ArticleSource;

    /** Duration of the crawl in milliseconds */
    duration: number;

    /** Number of articles found */
    articlesFound: number;

    /** Number of new articles saved */
    articlesSaved: number;

    /** Crawl result status */
    status: CrawlStatus;

    /** Error messages if any */
    errors: string[];
}

/**
 * Create a new crawl history entry
 */
export function createCrawlHistory(
    partial: Partial<CrawlHistory> & Pick<CrawlHistory, 'id' | 'source'>
): CrawlHistory {
    return {
        timestamp: new Date().toISOString(),
        duration: 0,
        articlesFound: 0,
        articlesSaved: 0,
        status: 'success',
        errors: [],
        ...partial
    };
}

/**
 * Determine status based on results
 */
export function determineCrawlStatus(
    _articlesFound: number,
    articlesSaved: number,
    errors: string[]
): CrawlStatus {
    if (errors.length > 0 && articlesSaved === 0) {
        return 'failed';
    }
    if (errors.length > 0 && articlesSaved > 0) {
        return 'partial';
    }
    return 'success';
}
