/**
 * Article Repository
 * Data access layer for articles
 */

import type { Low } from 'lowdb';
import type { Database } from '../index.js';
import type { Article } from '../../models/article.js';
import type { ArticleSource } from '../../config/types.js';

export class ArticleRepository {
    constructor(private db: Low<Database>) { }

    /**
     * Insert a single article
     */
    async insert(article: Article): Promise<void> {
        this.db.data.articles.push(article);
        await this.db.write();
    }

    /**
     * Insert multiple articles
     */
    async insertMany(articles: Article[]): Promise<void> {
        if (articles.length === 0) return;
        this.db.data.articles.push(...articles);
        await this.db.write();
    }

    /**
     * Find article by ID
     */
    findById(id: string): Article | undefined {
        return this.db.data.articles.find(a => a.id === id);
    }

    /**
     * Find article by URL
     */
    findByUrl(url: string): Article | undefined {
        return this.db.data.articles.find(a => a.sourceUrl === url);
    }

    /**
     * Check if article exists by URL
     */
    exists(url: string): boolean {
        return this.findByUrl(url) !== undefined;
    }

    /**
     * Check if multiple URLs exist
     */
    existsMany(urls: string[]): Map<string, boolean> {
        const result = new Map<string, boolean>();
        const existingUrls = new Set(this.db.data.articles.map(a => a.sourceUrl));

        for (const url of urls) {
            result.set(url, existingUrls.has(url));
        }

        return result;
    }

    /**
     * Find articles by source
     */
    findBySource(source: ArticleSource, limit?: number): Article[] {
        const filtered = this.db.data.articles
            .filter(a => a.source === source)
            .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime());

        return limit ? filtered.slice(0, limit) : filtered;
    }

    /**
     * Search articles by keyword in title and content
     */
    search(keyword: string, limit?: number): Article[] {
        const lower = keyword.toLowerCase();
        const filtered = this.db.data.articles
            .filter(a =>
                a.title.toLowerCase().includes(lower) ||
                a.content.toLowerCase().includes(lower) ||
                a.tags.some(tag => tag.toLowerCase().includes(lower))
            )
            .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime());

        return limit ? filtered.slice(0, limit) : filtered;
    }

    /**
     * Find recent articles
     */
    findRecent(limit: number = 20): Article[] {
        return this.db.data.articles
            .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime())
            .slice(0, limit);
    }

    /**
     * Find all articles
     */
    findAll(): Article[] {
        return [...this.db.data.articles];
    }

    /**
     * Get total count
     */
    count(): number {
        return this.db.data.articles.length;
    }

    /**
     * Get count by source
     */
    countBySource(): Record<ArticleSource, number> {
        const counts: Record<string, number> = {
            twitter: 0,
            instagram: 0,
            threads: 0,
            website: 0
        };

        for (const article of this.db.data.articles) {
            counts[article.source] = (counts[article.source] || 0) + 1;
        }

        return counts as Record<ArticleSource, number>;
    }

    /**
     * Delete articles older than a date
     */
    async deleteOlderThan(date: Date): Promise<number> {
        const before = this.db.data.articles.length;
        this.db.data.articles = this.db.data.articles
            .filter(a => new Date(a.crawledAt) >= date);
        await this.db.write();
        return before - this.db.data.articles.length;
    }

    /**
     * Delete article by ID
     */
    async deleteById(id: string): Promise<boolean> {
        const index = this.db.data.articles.findIndex(a => a.id === id);
        if (index === -1) return false;

        this.db.data.articles.splice(index, 1);
        await this.db.write();
        return true;
    }

    /**
     * Find articles that need content fetching
     * Returns articles where BOTH fullContent AND aiSummary are empty/null
     */
    findNeedingContent(options: {
        source?: ArticleSource;
        limit?: number;
        startDate?: string;
        endDate?: string;
        force?: boolean;
    } = {}): Article[] {
        let filtered = this.db.data.articles.filter(a => {
            // Skip if fullContent OR aiSummary already exists (unless force)
            if (!options.force) {
                const hasFullContent = a.fullContent && a.fullContent.trim().length > 0;
                const hasAiSummary = a.aiSummary && a.aiSummary.trim().length > 0;
                if (hasFullContent || hasAiSummary) {
                    return false;
                }
            }

            // Filter by source
            if (options.source && a.source !== options.source) {
                return false;
            }

            // Filter by date range
            if (a.publishedAt) {
                const pubDate = new Date(a.publishedAt);
                if (options.startDate && pubDate < new Date(options.startDate)) {
                    return false;
                }
                if (options.endDate && pubDate > new Date(options.endDate + 'T23:59:59')) {
                    return false;
                }
            }

            return true;
        });

        // Sort by crawledAt descending (most recent first)
        filtered = filtered.sort((a, b) =>
            new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime()
        );

        // Apply limit
        if (options.limit && options.limit > 0) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;
    }

    /**
     * Update article with fetched content
     */
    async updateContent(
        id: string,
        fullContent: string,
        fullContentFetchedAt: string
    ): Promise<boolean> {
        const article = this.db.data.articles.find(a => a.id === id);
        if (!article) return false;

        article.fullContent = fullContent;
        article.fullContentFetchedAt = fullContentFetchedAt;
        await this.db.write();
        return true;
    }
}
