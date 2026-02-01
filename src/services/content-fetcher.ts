/**
 * Content Fetcher Service
 * Fetches and extracts full article content from source URLs
 */

import { extract } from '@extractus/article-extractor';
import type { Low } from 'lowdb';
import type { Database } from '../database/index.js';
import { ArticleRepository } from '../database/repositories/article.js';
import type { ArticleSource } from '../config/types.js';
import { log } from '../utils/logger.js';

/**
 * Options for content fetching
 */
export interface FetchContentOptions {
    /** Maximum number of articles to process */
    limit?: number;
    /** Filter by source type */
    source?: ArticleSource;
    /** Re-fetch even if fullContent exists */
    force?: boolean;
    /** Fetch specific article by ID */
    articleId?: string;
    /** Filter by publish date (start) */
    startDate?: string;
    /** Filter by publish date (end) */
    endDate?: string;
    /** Maximum delay between requests in ms (default: 2000) */
    maxDelay?: number;
    /** Suppress progress output */
    quiet?: boolean;
}

/**
 * Result of content fetching operation
 */
export interface FetchContentResult {
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{ articleId: string; url: string; error: string }>;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (
    current: number,
    total: number,
    url: string,
    status: 'fetching' | 'success' | 'failed',
    details?: string
) => void;

/**
 * Content Fetcher Service
 * Handles fetching and extracting article content from URLs
 */
export class ContentFetcher {
    private articleRepo: ArticleRepository;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_BASE_DELAY = 1000;
    private readonly DEFAULT_MIN_DELAY = 1000;
    private readonly DEFAULT_MAX_DELAY = 10000;

    constructor(db: Low<Database>) {
        this.articleRepo = new ArticleRepository(db);
    }

    /**
     * Process articles and fetch their content
     */
    async processArticles(
        options: FetchContentOptions = {},
        onProgress?: ProgressCallback
    ): Promise<FetchContentResult> {
        const result: FetchContentResult = {
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Get articles needing content
        let articles = this.articleRepo.findNeedingContent({
            source: options.source,
            limit: options.limit,
            startDate: options.startDate,
            endDate: options.endDate,
            force: options.force
        });

        // If specific article ID requested, filter to just that one
        if (options.articleId) {
            articles = articles.filter(a => a.id === options.articleId);
            if (articles.length === 0) {
                // Try to find by ID even if it has content (for --force with --id)
                const article = this.articleRepo.findById(options.articleId);
                if (article) {
                    articles = [article];
                }
            }
        }

        const total = articles.length;
        const maxDelay = options.maxDelay ?? this.DEFAULT_MAX_DELAY;

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            result.processed++;

            // Report progress - fetching
            onProgress?.(i + 1, total, article.sourceUrl, 'fetching');

            try {
                // Random delay before fetching
                if (i > 0) {
                    await this.randomDelay(maxDelay);
                }

                // Fetch and extract content
                const content = await this.fetchWithRetry(article.sourceUrl);

                if (content) {
                    // Update article in database
                    await this.articleRepo.updateContent(
                        article.id,
                        content,
                        new Date().toISOString()
                    );
                    result.successful++;
                    onProgress?.(i + 1, total, article.sourceUrl, 'success', `${content.length.toLocaleString()} chars`);
                } else {
                    result.failed++;
                    const errorMsg = 'No content extracted';
                    result.errors.push({
                        articleId: article.id,
                        url: article.sourceUrl,
                        error: errorMsg
                    });
                    onProgress?.(i + 1, total, article.sourceUrl, 'failed', errorMsg);
                }
            } catch (error) {
                result.failed++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                result.errors.push({
                    articleId: article.id,
                    url: article.sourceUrl,
                    error: errorMsg
                });
                onProgress?.(i + 1, total, article.sourceUrl, 'failed', errorMsg);
                log.error(`Failed to fetch content for ${article.id}: ${errorMsg}`);
            }
        }

        return result;
    }

    /**
     * Fetch and extract content with retry logic
     */
    private async fetchWithRetry(url: string): Promise<string | null> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await this.fetchAndExtract(url);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on 4xx errors (client errors)
                if (this.isClientError(lastError)) {
                    throw lastError;
                }

                // Wait before retry (exponential backoff)
                if (attempt < this.MAX_RETRIES) {
                    const delay = this.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                    log.warn(`Retry ${attempt}/${this.MAX_RETRIES} for ${url} after ${delay}ms`);
                    await this.delay(delay);
                }
            }
        }

        throw lastError || new Error('Failed after retries');
    }

    /**
     * Fetch URL and extract article content
     */
    private async fetchAndExtract(url: string): Promise<string | null> {
        const result = await extract(url, {
            // Basic configuration for article extraction
        });

        if (!result || !result.content) {
            return null;
        }

        // Strip HTML and return plain text
        return this.stripHtml(result.content);
    }

    /**
     * Strip HTML tags and normalize whitespace
     */
    private stripHtml(html: string): string {
        // Remove HTML tags
        let text = html.replace(/<[^>]*>/g, ' ');

        // Decode common HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'");

        // Normalize whitespace
        text = text
            .replace(/\s+/g, ' ')
            .trim();

        return text;
    }

    /**
     * Check if error is a client error (4xx)
     */
    private isClientError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return message.includes('403') ||
            message.includes('404') ||
            message.includes('401') ||
            message.includes('400');
    }

    /**
     * Random delay within range
     */
    private randomDelay(maxMs: number): Promise<void> {
        const delay = Math.max(this.DEFAULT_MIN_DELAY, Math.floor(Math.random() * maxMs));
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Fixed delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
