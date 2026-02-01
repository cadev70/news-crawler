#!/usr/bin/env node

/**
 * Basketball News Crawler - CLI Entry Point
 */

import { Command } from 'commander';
import { CrawlerOrchestrator } from './crawlers/orchestrator.js';
import { initDatabase } from './database/index.js';
import { ArticleRepository } from './database/repositories/article.js';
import { CrawlHistoryRepository } from './database/repositories/history.js';
import { log } from './utils/logger.js';
import { isValidDateFormat, validateDateRange } from './utils/date-filter.js';
import type { ArticleSource } from './config/types.js';
import type { Article } from './models/article.js';
import type { CrawlHistory } from './models/crawl-history.js';

const program = new Command();

program
    .name('news-crawler')
    .description('Basketball News Crawler - Aggregate basketball news from multiple sources')
    .version('1.0.0');

// ============================================================================
// CRAWL COMMAND
// ============================================================================
program
    .command('crawl')
    .description('Crawl news from configured sources')
    .option('-s, --source <source>', 'Crawl specific source only (twitter, instagram, threads, website)')
    .option('-t, --target <target>', 'Crawl specific target account or website name (requires --source)')
    .option('--start-date <date>', 'Only include articles published on or after this date (YYYY-MM-DD)')
    .option('--end-date <date>', 'Only include articles published on or before this date (YYYY-MM-DD)')
    .option('--all', 'Crawl all sources including disabled ones')
    .action(async (options) => {
        try {
            const orchestrator = new CrawlerOrchestrator();

            // Validate that --target requires --source
            if (options.target && !options.source) {
                console.error('Error: --target requires --source to be specified');
                console.log('Example: pnpm crawl --source twitter --target wojespn');
                process.exit(1);
            }

            // Validate date options
            if (options.startDate && !isValidDateFormat(options.startDate)) {
                console.error('Error: Invalid date format. Use YYYY-MM-DD.');
                process.exit(1);
            }
            if (options.endDate && !isValidDateFormat(options.endDate)) {
                console.error('Error: Invalid date format. Use YYYY-MM-DD.');
                process.exit(1);
            }
            if (options.startDate && options.endDate) {
                try {
                    validateDateRange(options.startDate, options.endDate);
                } catch (error) {
                    console.error(`Error: ${error instanceof Error ? error.message : error}`);
                    process.exit(1);
                }
            }

            // Build crawl options
            const crawlOptions: { target?: string; startDate?: string; endDate?: string } = {};
            if (options.target) crawlOptions.target = options.target;
            if (options.startDate) crawlOptions.startDate = options.startDate;
            if (options.endDate) crawlOptions.endDate = options.endDate;

            // Display date range info
            const dateRangeInfo = (options.startDate || options.endDate)
                ? `\n📅 Date range: ${options.startDate || '*'} to ${options.endDate || '*'}`
                : '';

            if (options.source) {
                const source = options.source as ArticleSource;
                const validSources: ArticleSource[] = ['twitter', 'instagram', 'threads', 'website'];

                if (!validSources.includes(source)) {
                    console.error(`Invalid source: ${source}`);
                    console.log(`Valid sources: ${validSources.join(', ')}`);
                    process.exit(1);
                }

                const targetInfo = options.target ? ` (target: ${options.target})` : '';
                console.log(`\n🏀 Crawling ${source}${targetInfo}...${dateRangeInfo}\n`);
                const result = await orchestrator.crawlSource(source, crawlOptions);

                if (result) {
                    printCrawlResult(result, options.startDate, options.endDate);
                } else {
                    console.log(`Source ${source} is disabled or not configured.`);
                }
            } else {
                console.log(`\n🏀 Starting full crawl...${dateRangeInfo}\n`);
                const result = await orchestrator.crawlAll(crawlOptions);
                printOrchestratorResult(result, options.startDate, options.endDate);
            }

            await orchestrator.cleanup();
        } catch (error) {
            log.error('Crawl failed', { error });
            console.error('Crawl failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// LIST COMMAND
// ============================================================================
program
    .command('list')
    .description('List recent articles')
    .option('-n, --limit <number>', 'Number of articles to show', '20')
    .option('-s, --source <source>', 'Filter by source')
    .action(async (options) => {
        try {
            const db = await initDatabase();
            const repo = new ArticleRepository(db);

            const limit = parseInt(options.limit, 10);
            let articles: Article[];

            if (options.source) {
                articles = repo.findBySource(options.source as ArticleSource, limit);
            } else {
                articles = repo.findRecent(limit);
            }

            if (articles.length === 0) {
                console.log('\n📭 No articles found.\n');
                return;
            }

            console.log(`\n📰 Recent Articles (${articles.length}):\n`);
            console.log('─'.repeat(80));

            for (const article of articles) {
                printArticle(article);
                console.log('─'.repeat(80));
            }
        } catch (error) {
            log.error('List failed', { error });
            console.error('Failed to list articles:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// SEARCH COMMAND
// ============================================================================
program
    .command('search')
    .description('Search articles by keyword')
    .requiredOption('-k, --keyword <keyword>', 'Search keyword')
    .option('-n, --limit <number>', 'Maximum results', '20')
    .action(async (options) => {
        try {
            const db = await initDatabase();
            const repo = new ArticleRepository(db);

            const limit = parseInt(options.limit, 10);
            const articles = repo.search(options.keyword, limit);

            if (articles.length === 0) {
                console.log(`\n🔍 No articles found matching "${options.keyword}".\n`);
                return;
            }

            console.log(`\n🔍 Search Results for "${options.keyword}" (${articles.length}):\n`);
            console.log('─'.repeat(80));

            for (const article of articles) {
                printArticle(article);
                console.log('─'.repeat(80));
            }
        } catch (error) {
            log.error('Search failed', { error });
            console.error('Search failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// HISTORY COMMAND
// ============================================================================
program
    .command('history')
    .description('Show crawl history')
    .option('-n, --limit <number>', 'Number of entries to show', '10')
    .option('-s, --source <source>', 'Filter by source')
    .action(async (options) => {
        try {
            const db = await initDatabase();
            const repo = new CrawlHistoryRepository(db);

            const limit = parseInt(options.limit, 10);
            let history: CrawlHistory[];

            if (options.source) {
                history = repo.findBySource(options.source as ArticleSource, limit);
            } else {
                history = repo.findRecent(limit);
            }

            if (history.length === 0) {
                console.log('\n📭 No crawl history found.\n');
                return;
            }

            console.log(`\n📜 Crawl History (${history.length}):\n`);
            console.log('─'.repeat(80));

            for (const entry of history) {
                printHistoryEntry(entry);
                console.log('─'.repeat(80));
            }
        } catch (error) {
            log.error('History failed', { error });
            console.error('Failed to show history:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// STATS COMMAND
// ============================================================================
program
    .command('stats')
    .description('Show crawl statistics')
    .action(async () => {
        try {
            const db = await initDatabase();
            const articleRepo = new ArticleRepository(db);
            const historyRepo = new CrawlHistoryRepository(db);

            const stats = historyRepo.getStats();
            const articleCounts = articleRepo.countBySource();
            const totalArticles = articleRepo.count();

            console.log('\n📊 Crawler Statistics:\n');
            console.log('═'.repeat(50));

            // Article stats
            console.log('\n📰 Articles:');
            console.log(`   Total: ${totalArticles}`);
            console.log(`   Twitter: ${articleCounts.twitter}`);
            console.log(`   Instagram: ${articleCounts.instagram}`);
            console.log(`   Threads: ${articleCounts.threads}`);
            console.log(`   Website: ${articleCounts.website}`);

            // Crawl stats
            console.log('\n🔄 Crawl History:');
            console.log(`   Total Crawls: ${stats.totalCrawls}`);
            console.log(`   Successful: ${stats.successfulCrawls}`);
            console.log(`   Failed: ${stats.failedCrawls}`);
            console.log(`   Partial: ${stats.partialCrawls}`);
            console.log(`   Average Duration: ${stats.averageDuration}ms`);

            if (stats.lastCrawl) {
                console.log(`\n⏰ Last Crawl:`);
                console.log(`   Time: ${new Date(stats.lastCrawl.timestamp).toLocaleString()}`);
                console.log(`   Source: ${stats.lastCrawl.source}`);
                console.log(`   Status: ${stats.lastCrawl.status}`);
            }

            console.log('\n' + '═'.repeat(50) + '\n');
        } catch (error) {
            log.error('Stats failed', { error });
            console.error('Failed to show stats:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// EXPORT COMMAND
// ============================================================================
program
    .command('export')
    .description('Export articles to JSON file')
    .option('-o, --output <path>', 'Output file path', 'export.json')
    .option('-s, --source <source>', 'Export only specific source')
    .action(async (options) => {
        try {
            const { writeFileSync } = await import('node:fs');

            const db = await initDatabase();
            const repo = new ArticleRepository(db);

            let articles: Article[];

            if (options.source) {
                articles = repo.findBySource(options.source as ArticleSource);
            } else {
                articles = repo.findAll();
            }

            const exportData = {
                exportedAt: new Date().toISOString(),
                totalArticles: articles.length,
                source: options.source || 'all',
                articles
            };

            writeFileSync(options.output, JSON.stringify(exportData, null, 2));
            console.log(`\n✅ Exported ${articles.length} articles to ${options.output}\n`);
        } catch (error) {
            log.error('Export failed', { error });
            console.error('Export failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// CLEANUP COMMAND
// ============================================================================
program
    .command('cleanup')
    .description('Remove old articles from database')
    .option('-d, --days <number>', 'Remove articles older than N days', '30')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
        try {
            const days = parseInt(options.days, 10);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const db = await initDatabase();
            const articleRepo = new ArticleRepository(db);
            const historyRepo = new CrawlHistoryRepository(db);

            // Count articles that would be deleted
            const allArticles = articleRepo.findAll();
            const toDelete = allArticles.filter(a => new Date(a.crawledAt) < cutoffDate);

            if (toDelete.length === 0) {
                console.log(`\n✨ No articles older than ${days} days.\n`);
                return;
            }

            console.log(`\n⚠️  Found ${toDelete.length} articles older than ${days} days.`);

            if (!options.force) {
                const { createInterface } = await import('node:readline');
                const rl = createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise<string>((resolve) => {
                    rl.question('Delete these articles? (y/N): ', resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== 'y') {
                    console.log('Cancelled.\n');
                    return;
                }
            }

            const deletedArticles = await articleRepo.deleteOlderThan(cutoffDate);
            const deletedHistory = await historyRepo.deleteOlderThan(cutoffDate);

            console.log(`\n✅ Deleted ${deletedArticles} articles and ${deletedHistory} history entries.\n`);
        } catch (error) {
            log.error('Cleanup failed', { error });
            console.error('Cleanup failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// SCHEDULE COMMAND
// ============================================================================
program
    .command('schedule')
    .description('Start automated scheduler for periodic crawling')
    .option('--no-initial', 'Skip initial crawl on startup')
    .action(async (options) => {
        try {
            const { CrawlerScheduler } = await import('./scheduler/index.js');

            console.log('\n🏀 Basketball News Crawler - Scheduler Mode\n');
            console.log('═'.repeat(50));

            const scheduler = new CrawlerScheduler();

            // Handle graceful shutdown
            const shutdown = async () => {
                console.log('\n\n🛑 Shutting down scheduler...');
                await scheduler.cleanup();
                process.exit(0);
            };

            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);

            // Run initial crawl unless --no-initial is set
            if (options.initial !== false) {
                console.log('\n📡 Running initial crawl...\n');
                await scheduler.runNow();
            }

            // Start scheduled tasks
            scheduler.start();

            console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.\n');

            // Keep process alive
            await new Promise(() => { });
        } catch (error) {
            log.error('Scheduler failed', { error });
            console.error('Scheduler failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// FETCH-CONTENT COMMAND
// ============================================================================
program
    .command('fetch-content')
    .description('Fetch full article content from source URLs')
    .option('--limit <n>', 'Maximum articles to process')
    .option('--source <type>', 'Filter by source type (e.g., website)')
    .option('--force', 'Re-fetch even if fullContent exists')
    .option('--id <articleId>', 'Fetch specific article by ID')
    .option('--start-date <date>', 'Filter by publish date (YYYY-MM-DD)')
    .option('--end-date <date>', 'Filter by publish date (YYYY-MM-DD)')
    .option('--max-delay <ms>', 'Maximum delay between requests (default: 2000)')
    .option('--quiet', 'Suppress progress output')
    .action(async (options) => {
        try {
            const { ContentFetcher } = await import('./services/content-fetcher.js');

            const db = await initDatabase();
            const fetcher = new ContentFetcher(db);

            // Validate date options
            if (options.startDate && !isValidDateFormat(options.startDate)) {
                console.error('Error: Invalid start date format. Use YYYY-MM-DD.');
                process.exit(1);
            }
            if (options.endDate && !isValidDateFormat(options.endDate)) {
                console.error('Error: Invalid end date format. Use YYYY-MM-DD.');
                process.exit(1);
            }

            console.log('\n🔍 Fetching article content...\n');

            // Progress callback
            const onProgress = options.quiet ? undefined : (
                current: number,
                total: number,
                url: string,
                status: 'fetching' | 'success' | 'failed',
                details?: string
            ) => {
                if (status === 'fetching') {
                    console.log(`[${current}/${total}] Fetching: ${url}`);
                } else if (status === 'success') {
                    console.log(`       ✅ Extracted ${details}`);
                } else {
                    console.log(`       ❌ Failed: ${details}`);
                }
            };

            const result = await fetcher.processArticles({
                limit: options.limit ? parseInt(options.limit, 10) : undefined,
                source: options.source as ArticleSource | undefined,
                force: options.force,
                articleId: options.id,
                startDate: options.startDate,
                endDate: options.endDate,
                maxDelay: options.maxDelay ? parseInt(options.maxDelay, 10) : undefined,
                quiet: options.quiet
            }, onProgress);

            // Print summary
            console.log('\n' + '═'.repeat(50));
            console.log('📊 Fetch Content Summary');
            console.log('═'.repeat(50));
            console.log(`   Processed: ${result.processed}`);
            console.log(`   Successful: ${result.successful}`);
            console.log(`   Failed: ${result.failed}`);
            console.log(`   Skipped: ${result.skipped}`);

            if (result.errors.length > 0 && !options.quiet) {
                console.log('\n❌ Errors:');
                for (const err of result.errors.slice(0, 5)) {
                    console.log(`   - ${err.articleId}: ${err.error}`);
                }
                if (result.errors.length > 5) {
                    console.log(`   ... and ${result.errors.length - 5} more`);
                }
            }

            console.log('');
        } catch (error) {
            log.error('Fetch content failed', { error });
            console.error('Fetch content failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function printArticle(article: Article): void {
    console.log(`📌 ${article.title}`);
    console.log(`   Source: ${article.source}${article.author ? ` | Author: ${article.author}` : ''}`);
    console.log(`   URL: ${article.sourceUrl}`);
    console.log(`   Crawled: ${new Date(article.crawledAt).toLocaleString()}`);
    if (article.tags.length > 0) {
        console.log(`   Tags: ${article.tags.join(', ')}`);
    }
}

function printHistoryEntry(entry: CrawlHistory): void {
    const statusIcon = entry.status === 'success' ? '✅' : entry.status === 'failed' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${entry.source} - ${new Date(entry.timestamp).toLocaleString()}`);
    console.log(`   Found: ${entry.articlesFound} | Saved: ${entry.articlesSaved} | Duration: ${entry.duration}ms`);
    if (entry.errors.length > 0) {
        console.log(`   Errors: ${entry.errors.join(', ')}`);
    }
}

function printCrawlResult(
    result: import('./crawlers/base.js').CrawlResult,
    startDate?: string,
    endDate?: string
): void {
    const statusIcon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    const targetInfo = result.target ? ` → ${result.target}` : '';
    console.log(`${statusIcon} ${result.source}${targetInfo}`);
    console.log(`   Found: ${result.articlesFound}`);
    console.log(`   Saved: ${result.articlesSaved}`);
    if (result.articlesFilteredByDate !== undefined && result.articlesFilteredByDate > 0) {
        console.log(`   Filtered by date: ${result.articlesFilteredByDate}`);
    }
    console.log(`   Duration: ${result.duration}ms`);
    if (startDate || endDate) {
        console.log(`   Date range: ${startDate || '*'} to ${endDate || '*'}`);
    }
    if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
    }
    console.log('');
}

function printOrchestratorResult(
    result: import('./crawlers/orchestrator.js').OrchestratorResult,
    startDate?: string,
    endDate?: string
): void {
    console.log('═'.repeat(50));
    console.log('🏀 Crawl Summary');
    if (startDate || endDate) {
        console.log(`📅 Date range: ${startDate || '*'} to ${endDate || '*'}`);
    }
    console.log('═'.repeat(50));

    for (const sourceResult of result.sources) {
        printCrawlResult(sourceResult);
    }

    // Calculate total filtered by date
    const totalFilteredByDate = result.sources.reduce(
        (sum, r) => sum + (r.articlesFilteredByDate || 0),
        0
    );

    console.log('─'.repeat(50));
    console.log(`📊 Total: ${result.summary.totalArticlesFound} found, ${result.summary.totalArticlesSaved} saved`);
    if (totalFilteredByDate > 0) {
        console.log(`📅 Filtered by date: ${totalFilteredByDate}`);
    }
    console.log(`⏱️  Duration: ${result.totalDuration}ms`);
    console.log(`✅ Success: ${result.summary.successCount} | ❌ Failed: ${result.summary.failedCount} | ⚠️  Partial: ${result.summary.partialCount}`);
    console.log('');
}

// Parse and run
program.parse();
