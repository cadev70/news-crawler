/**
 * Crawl History Repository
 * Data access layer for crawl history
 */

import type { Low } from 'lowdb';
import type { Database } from '../index.js';
import type { CrawlHistory, CrawlStatus } from '../../models/crawl-history.js';
import type { ArticleSource } from '../../config/types.js';

export interface CrawlStats {
    totalCrawls: number;
    successfulCrawls: number;
    failedCrawls: number;
    partialCrawls: number;
    totalArticlesFound: number;
    totalArticlesSaved: number;
    averageDuration: number;
    lastCrawl?: CrawlHistory;
    crawlsBySource: Record<ArticleSource, number>;
}

export class CrawlHistoryRepository {
    constructor(private db: Low<Database>) { }

    /**
     * Insert a crawl history entry
     */
    async insert(history: CrawlHistory): Promise<void> {
        this.db.data.crawlHistory.push(history);
        await this.db.write();
    }

    /**
     * Find recent crawl history
     */
    findRecent(limit: number = 20): CrawlHistory[] {
        return this.db.data.crawlHistory
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    /**
     * Find crawl history by source
     */
    findBySource(source: ArticleSource, limit?: number): CrawlHistory[] {
        const filtered = this.db.data.crawlHistory
            .filter(h => h.source === source)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return limit ? filtered.slice(0, limit) : filtered;
    }

    /**
     * Find crawl history by status
     */
    findByStatus(status: CrawlStatus, limit?: number): CrawlHistory[] {
        const filtered = this.db.data.crawlHistory
            .filter(h => h.status === status)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return limit ? filtered.slice(0, limit) : filtered;
    }

    /**
     * Get last crawl for a source
     */
    getLastCrawl(source?: ArticleSource): CrawlHistory | undefined {
        const history = source
            ? this.db.data.crawlHistory.filter(h => h.source === source)
            : this.db.data.crawlHistory;

        return history.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
    }

    /**
     * Get aggregated statistics
     */
    getStats(): CrawlStats {
        const history = this.db.data.crawlHistory;

        const crawlsBySource: Record<string, number> = {
            twitter: 0,
            instagram: 0,
            threads: 0,
            website: 0
        };

        let totalArticlesFound = 0;
        let totalArticlesSaved = 0;
        let totalDuration = 0;
        let successfulCrawls = 0;
        let failedCrawls = 0;
        let partialCrawls = 0;

        for (const entry of history) {
            crawlsBySource[entry.source] = (crawlsBySource[entry.source] || 0) + 1;
            totalArticlesFound += entry.articlesFound;
            totalArticlesSaved += entry.articlesSaved;
            totalDuration += entry.duration;

            switch (entry.status) {
                case 'success':
                    successfulCrawls++;
                    break;
                case 'failed':
                    failedCrawls++;
                    break;
                case 'partial':
                    partialCrawls++;
                    break;
            }
        }

        return {
            totalCrawls: history.length,
            successfulCrawls,
            failedCrawls,
            partialCrawls,
            totalArticlesFound,
            totalArticlesSaved,
            averageDuration: history.length > 0 ? Math.round(totalDuration / history.length) : 0,
            lastCrawl: this.getLastCrawl(),
            crawlsBySource: crawlsBySource as Record<ArticleSource, number>
        };
    }

    /**
     * Get count
     */
    count(): number {
        return this.db.data.crawlHistory.length;
    }

    /**
     * Delete history older than a date
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const before = this.db.data.crawlHistory.length;
        this.db.data.crawlHistory = this.db.data.crawlHistory
            .filter(h => new Date(h.timestamp) >= date);
        await this.db.write();
        return before - this.db.data.crawlHistory.length;
    }

    /**
     * Clear all history
     */
    async clear(): Promise<void> {
        this.db.data.crawlHistory = [];
        await this.db.write();
    }
}
