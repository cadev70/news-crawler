/**
 * Crawler Orchestrator
 * Coordinates multiple crawlers and manages crawl operations
 */

import type { SourceConfig, ArticleSource } from '../config/types.js';
import { loadConfig, getEnabledSources } from '../config/index.js';
import { BaseCrawler, CrawlResult } from './base.js';
import { TwitterCrawler } from './twitter.js';
import { InstagramCrawler } from './instagram.js';
import { ThreadsCrawler } from './threads.js';
import { WebsiteCrawler } from './website.js';
import { log } from '../utils/logger.js';

/**
 * Aggregated crawl results
 */
export interface OrchestratorResult {
    timestamp: Date;
    totalDuration: number;
    sources: CrawlResult[];
    summary: {
        totalArticlesFound: number;
        totalArticlesSaved: number;
        successCount: number;
        failedCount: number;
        partialCount: number;
    };
}

/**
 * Crawler factory - creates crawler instances based on source type
 */
function createCrawler(source: ArticleSource, config: SourceConfig): BaseCrawler | null {
    switch (source) {
        case 'twitter':
            return new TwitterCrawler(config.twitter);
        case 'instagram':
            return new InstagramCrawler(config.instagram);
        case 'threads':
            return new ThreadsCrawler(config.threads);
        case 'website':
            return new WebsiteCrawler(config.websites);
        default:
            log.warn(`Unknown source type: ${source}`);
            return null;
    }
}

/**
 * Crawler Orchestrator
 */
export class CrawlerOrchestrator {
    private config: SourceConfig;
    private crawlers: Map<ArticleSource, BaseCrawler> = new Map();

    constructor(config?: SourceConfig) {
        this.config = config || loadConfig();
    }

    /**
     * Get or create a crawler for a source
     */
    private getCrawler(source: ArticleSource): BaseCrawler | null {
        if (!this.crawlers.has(source)) {
            const crawler = createCrawler(source, this.config);
            if (crawler) {
                this.crawlers.set(source, crawler);
            }
        }
        return this.crawlers.get(source) || null;
    }

    /**
     * Crawl all enabled sources
     */
    async crawlAll(): Promise<OrchestratorResult> {
        const startTime = Date.now();
        const enabledSources = getEnabledSources(this.config);

        log.info(`Starting crawl for ${enabledSources.length} enabled sources: ${enabledSources.join(', ')}`);

        const results: CrawlResult[] = [];

        // Run crawlers sequentially to avoid rate limiting issues
        for (const source of enabledSources) {
            try {
                const result = await this.crawlSource(source);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log.error(`Orchestrator error for ${source}: ${msg}`);

                // Add failed result
                results.push({
                    source,
                    timestamp: new Date(),
                    duration: 0,
                    articlesFound: 0,
                    articlesSaved: 0,
                    errors: [msg],
                    status: 'failed'
                });
            }
        }

        const totalDuration = Date.now() - startTime;
        return this.buildOrchestratorResult(results, totalDuration);
    }

    /**
     * Crawl a specific source
     */
    async crawlSource(source: ArticleSource): Promise<CrawlResult | null> {
        const crawler = this.getCrawler(source);

        if (!crawler) {
            log.warn(`No crawler available for source: ${source}`);
            return null;
        }

        if (!crawler.isEnabled()) {
            log.info(`Skipping disabled source: ${source}`);
            return null;
        }

        try {
            return await crawler.crawl();
        } finally {
            // Cleanup crawler resources
            await crawler.cleanup();
        }
    }

    /**
     * Crawl multiple specific sources
     */
    async crawlSources(sources: ArticleSource[]): Promise<OrchestratorResult> {
        const startTime = Date.now();
        const results: CrawlResult[] = [];

        log.info(`Starting crawl for specified sources: ${sources.join(', ')}`);

        for (const source of sources) {
            try {
                const result = await this.crawlSource(source);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log.error(`Orchestrator error for ${source}: ${msg}`);
            }
        }

        const totalDuration = Date.now() - startTime;
        return this.buildOrchestratorResult(results, totalDuration);
    }

    /**
     * Get list of enabled sources
     */
    getEnabledSources(): ArticleSource[] {
        return getEnabledSources(this.config);
    }

    /**
     * Get list of all configured sources
     */
    getAllSources(): ArticleSource[] {
        return ['twitter', 'instagram', 'threads', 'website'];
    }

    /**
     * Build aggregated result
     */
    private buildOrchestratorResult(
        results: CrawlResult[],
        totalDuration: number
    ): OrchestratorResult {
        const summary = {
            totalArticlesFound: 0,
            totalArticlesSaved: 0,
            successCount: 0,
            failedCount: 0,
            partialCount: 0
        };

        for (const result of results) {
            summary.totalArticlesFound += result.articlesFound;
            summary.totalArticlesSaved += result.articlesSaved;

            switch (result.status) {
                case 'success':
                    summary.successCount++;
                    break;
                case 'failed':
                    summary.failedCount++;
                    break;
                case 'partial':
                    summary.partialCount++;
                    break;
            }
        }

        log.info(`Crawl complete`, {
            duration: `${totalDuration}ms`,
            found: summary.totalArticlesFound,
            saved: summary.totalArticlesSaved,
            success: summary.successCount,
            failed: summary.failedCount,
            partial: summary.partialCount
        });

        return {
            timestamp: new Date(),
            totalDuration,
            sources: results,
            summary
        };
    }

    /**
     * Cleanup all crawler resources
     */
    async cleanup(): Promise<void> {
        for (const crawler of this.crawlers.values()) {
            await crawler.cleanup();
        }
        this.crawlers.clear();
    }
}
