/**
 * Base Crawler
 * Abstract base class for all crawlers using Template Method pattern
 */

import type { Article } from '../models/article.js';
import type { CrawlHistory, CrawlStatus } from '../models/crawl-history.js';
import type { ArticleSource } from '../config/types.js';
import { initDatabase } from '../database/index.js';
import { ArticleRepository } from '../database/repositories/article.js';
import { CrawlHistoryRepository } from '../database/repositories/history.js';
import { log } from '../utils/logger.js';
import { generateId } from '../utils/id.js';

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
    async crawl(): Promise<CrawlResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let articlesFound = 0;
        let articlesSaved = 0;

        try {
            // Initialize if needed
            await this.init();

            log.info(`Starting crawl for ${this.name}`);

            // Fetch articles from source
            const articles = await this.fetchArticles();
            articlesFound = articles.length;
            log.info(`Found ${articlesFound} articles from ${this.name}`);

            if (articles.length === 0) {
                log.info(`No articles found from ${this.name}`);
            } else {
                // Filter out duplicates
                const newArticles = await this.filterDuplicates(articles);
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
        const result = this.buildResult(articlesFound, articlesSaved, duration, errors, status);
        await this.saveHistory(result);

        log.info(`Completed crawl for ${this.name}`, {
            duration: `${duration}ms`,
            found: articlesFound,
            saved: articlesSaved,
            status
        });

        return result;
    }

    /**
     * Abstract method - fetch articles from the source
     * Must be implemented by subclasses
     */
    protected abstract fetchArticles(): Promise<Article[]>;

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
        status: CrawlStatus
    ): CrawlResult {
        return {
            source: this.name,
            timestamp: new Date(),
            duration,
            articlesFound,
            articlesSaved,
            errors,
            status
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
