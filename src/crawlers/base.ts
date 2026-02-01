/**
 * Base Crawler
 * Abstract base class for all crawlers using Template Method pattern
 */

import type { Article } from '../models/article.js';
import type { CrawlHistory, CrawlStatus } from '../models/crawl-history.js';
import type { ArticleSource, SanitizationConfig } from '../config/types.js';
import { initDatabase } from '../database/index.js';
import { ArticleRepository } from '../database/repositories/article.js';
import { CrawlHistoryRepository } from '../database/repositories/history.js';
import { log } from '../utils/logger.js';
import { generateId } from '../utils/id.js';
import { sanitizeArticles } from '../utils/sanitizer.js';
import { filterByDateRange } from '../utils/date-filter.js';

/**
 * Crawl result returned by each crawler
 */
export interface CrawlResult {
    source: ArticleSource;
    timestamp: Date;
    duration: number;
    articlesFound: number;
    articlesSaved: number;
    errors: string[];
    status: CrawlStatus;
    target?: string;
    /** Number of articles excluded by date filter */
    articlesFilteredByDate?: number;
}

/**
 * Options for crawl operations
 */
export interface CrawlOptions {
    /** Target specific account (for social media) or source name (for websites) */
    target?: string;
    /** Start date for filtering (inclusive, YYYY-MM-DD) */
    startDate?: string;
    /** End date for filtering (inclusive, YYYY-MM-DD) */
    endDate?: string;
}

/**
 * Base crawler configuration
 */
export interface BaseCrawlerConfig {
    enabled: boolean;
    crawlIntervalMinutes: number;
}

/**
 * Abstract base class for crawlers
 */
export abstract class BaseCrawler<T extends BaseCrawlerConfig = BaseCrawlerConfig> {
    protected articleRepo!: ArticleRepository;
    protected historyRepo!: CrawlHistoryRepository;
    protected initialized = false;

    constructor(
        protected readonly name: ArticleSource,
        protected readonly config: T
    ) { }

    /**
     * Initialize database repositories
     */
    protected async init(): Promise<void> {
        if (this.initialized) return;

        const db = await initDatabase();
        this.articleRepo = new ArticleRepository(db);
        this.historyRepo = new CrawlHistoryRepository(db);
        this.initialized = true;
    }

    /**
     * Template method - orchestrates the crawl process
     */
    async crawl(options: CrawlOptions = {}): Promise<CrawlResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let articlesFound = 0;
        let articlesSaved = 0;
        let articlesFilteredByDate = 0;
        const { target, startDate, endDate } = options;

        try {
            // Initialize if needed
            await this.init();

            const targetInfo = target ? ` (target: ${target})` : '';
            const dateRangeInfo = (startDate || endDate)
                ? ` [${startDate || '*'} to ${endDate || '*'}]`
                : '';
            log.info(`Starting crawl for ${this.name}${targetInfo}${dateRangeInfo}`);

            // Fetch articles from source
            const articles = await this.fetchArticles(target);
            articlesFound = articles.length;
            log.info(`Found ${articlesFound} articles from ${this.name}${targetInfo}`);

            if (articles.length === 0) {
                log.info(`No articles found from ${this.name}`);
            } else {
                // Step 1: Sanitize articles
                const sanitizationConfig = this.getSanitizationConfig();
                const sanitizationResults = sanitizeArticles(articles, sanitizationConfig);
                const sanitizedArticles = sanitizationResults.map(r => r.article);

                // Log sanitization statistics
                const fieldsModifiedCount = sanitizationResults.filter(r => r.fieldsModified.length > 0).length;
                if (fieldsModifiedCount > 0) {
                    log.info(`Sanitized ${fieldsModifiedCount} articles`);
                }

                // Step 2: Apply date filtering
                let processedArticles = sanitizedArticles;
                if (startDate || endDate) {
                    const dateFilterResult = filterByDateRange(sanitizedArticles, { startDate, endDate });
                    processedArticles = dateFilterResult.included;
                    articlesFilteredByDate = dateFilterResult.excludedCount;

                    if (articlesFilteredByDate > 0) {
                        log.info(`Filtered ${articlesFilteredByDate} articles by date range`);
                    }
                    if (dateFilterResult.missingDateCount > 0) {
                        log.info(`Included ${dateFilterResult.missingDateCount} articles with missing publication date`);
                    }
                }

                // Step 3: Filter out duplicates
                const newArticles = await this.filterDuplicates(processedArticles);
                log.info(`${newArticles.length} new articles after deduplication`);

                if (newArticles.length > 0) {
                    // Save new articles
                    await this.saveArticles(newArticles);
                    articlesSaved = newArticles.length;
                    log.info(`Saved ${articlesSaved} new articles from ${this.name}`);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);
            log.error(`Error crawling ${this.name}: ${errorMessage}`, { error });
        }

        const duration = Date.now() - startTime;
        const status = this.determineStatus(articlesFound, articlesSaved, errors);

        // Build and save result
        const result = this.buildResult(
            articlesFound,
            articlesSaved,
            duration,
            errors,
            status,
            target,
            articlesFilteredByDate > 0 ? articlesFilteredByDate : undefined
        );
        await this.saveHistory(result);

        log.info(`Completed crawl for ${this.name}`, {
            duration: `${duration}ms`,
            found: articlesFound,
            saved: articlesSaved,
            filteredByDate: articlesFilteredByDate,
            status
        });

        return result;
    }

    /**
     * Get sanitization configuration for this crawler
     * Override in subclasses to provide source-specific config
     */
    protected getSanitizationConfig(): Partial<SanitizationConfig> | undefined {
        return undefined; // Use default config
    }

    /**
     * Abstract method - fetch articles from the source
     * Must be implemented by subclasses
     * @param target Optional target account (social media) or source name (website)
     */
    protected abstract fetchArticles(target?: string): Promise<Article[]>;

    /**
     * Filter out articles that already exist in database
     */
    protected async filterDuplicates(articles: Article[]): Promise<Article[]> {
        const urls = articles.map(a => a.sourceUrl);
        const existsMap = this.articleRepo.existsMany(urls);

        return articles.filter(article => !existsMap.get(article.sourceUrl));
    }

    /**
     * Save articles to database
     */
    protected async saveArticles(articles: Article[]): Promise<void> {
        await this.articleRepo.insertMany(articles);
    }

    /**
     * Determine crawl status based on results
     */
    protected determineStatus(
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

    /**
     * Build crawl result object
     */
    protected buildResult(
        articlesFound: number,
        articlesSaved: number,
        duration: number,
        errors: string[],
        status: CrawlStatus,
        target?: string,
        articlesFilteredByDate?: number
    ): CrawlResult {
        return {
            source: this.name,
            timestamp: new Date(),
            duration,
            articlesFound,
            articlesSaved,
            errors,
            status,
            target,
            articlesFilteredByDate
        };
    }

    /**
     * Save crawl history to database
     */
    protected async saveHistory(result: CrawlResult): Promise<void> {
        const history: CrawlHistory = {
            id: generateId(),
            timestamp: result.timestamp.toISOString(),
            source: result.source,
            duration: result.duration,
            articlesFound: result.articlesFound,
            articlesSaved: result.articlesSaved,
            status: result.status,
            errors: result.errors
        };

        await this.historyRepo.insert(history);
    }

    /**
     * Check if crawler is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get crawler name
     */
    getName(): ArticleSource {
        return this.name;
    }

    /**
     * Get crawl interval in minutes
     */
    getCrawlInterval(): number {
        return this.config.crawlIntervalMinutes;
    }

    /**
     * Cleanup resources (override in subclasses if needed)
     */
    async cleanup(): Promise<void> {
        // Default: no cleanup needed
    }
}
