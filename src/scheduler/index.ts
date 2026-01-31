/**
 * Crawler Scheduler
 * Uses node-cron to schedule automatic crawls based on configuration
 */

import cron from 'node-cron';
import type { SourceConfig, ArticleSource } from '../config/types.js';
import { loadConfig } from '../config/index.js';
import { CrawlerOrchestrator } from '../crawlers/orchestrator.js';
import { log } from '../utils/logger.js';

/**
 * Cron expression for interval in minutes
 */
function minutesToCron(minutes: number): string {
    if (minutes <= 0) {
        throw new Error('Interval must be positive');
    }

    // For intervals less than 60 minutes, use minute-based cron
    if (minutes < 60) {
        return `*/${minutes} * * * *`;
    }

    // For intervals in hours
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `0 */${hours} * * *`;
    }

    // For daily or longer, run at midnight
    return '0 0 * * *';
}

/**
 * Scheduled task info
 */
interface ScheduledTask {
    source: ArticleSource;
    cronExpression: string;
    intervalMinutes: number;
    task: cron.ScheduledTask;
    lastRun?: Date;
    nextRun?: Date;
    isActive: boolean;
}

/**
 * Crawler Scheduler
 */
export class CrawlerScheduler {
    private config: SourceConfig;
    private orchestrator: CrawlerOrchestrator;
    private tasks: Map<ArticleSource, ScheduledTask> = new Map();
    private isRunning = false;

    constructor(config?: SourceConfig) {
        this.config = config || loadConfig();
        this.orchestrator = new CrawlerOrchestrator(this.config);
    }

    /**
     * Start all scheduled tasks
     */
    start(): void {
        if (this.isRunning) {
            log.warn('Scheduler is already running');
            return;
        }

        log.info('Starting crawler scheduler...');

        // Schedule each enabled source
        this.scheduleSource('twitter', this.config.twitter.crawlIntervalMinutes);
        this.scheduleSource('instagram', this.config.instagram.crawlIntervalMinutes);
        this.scheduleSource('threads', this.config.threads.crawlIntervalMinutes);
        this.scheduleSource('website', this.config.websites.crawlIntervalMinutes);

        this.isRunning = true;

        const activeTasks = Array.from(this.tasks.values()).filter(t => t.isActive);
        log.info(`Scheduler started with ${activeTasks.length} active tasks`);

        // Print schedule
        this.printSchedule();
    }

    /**
     * Schedule a source for automatic crawling
     */
    private scheduleSource(source: ArticleSource, intervalMinutes: number): void {
        // Check if source is enabled
        const isEnabled = this.isSourceEnabled(source);

        if (!isEnabled) {
            log.info(`Skipping disabled source: ${source}`);
            return;
        }

        const cronExpression = minutesToCron(intervalMinutes);

        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            log.error(`Invalid cron expression for ${source}: ${cronExpression}`);
            return;
        }

        // Create scheduled task
        const task = cron.schedule(cronExpression, async () => {
            await this.runCrawl(source);
        });

        this.tasks.set(source, {
            source,
            cronExpression,
            intervalMinutes,
            task,
            isActive: true
        });

        log.info(`Scheduled ${source} to run every ${intervalMinutes} minutes (${cronExpression})`);
    }

    /**
     * Check if a source is enabled
     */
    private isSourceEnabled(source: ArticleSource): boolean {
        switch (source) {
            case 'twitter':
                return this.config.twitter.enabled && this.config.twitter.accounts.length > 0;
            case 'instagram':
                return this.config.instagram.enabled && this.config.instagram.accounts.length > 0;
            case 'threads':
                return this.config.threads.enabled && this.config.threads.accounts.length > 0;
            case 'website':
                return this.config.websites.enabled && this.config.websites.sources.length > 0;
            default:
                return false;
        }
    }

    /**
     * Run a crawl for a specific source
     */
    private async runCrawl(source: ArticleSource): Promise<void> {
        log.info(`Running scheduled crawl for ${source}`);

        const taskInfo = this.tasks.get(source);
        if (taskInfo) {
            taskInfo.lastRun = new Date();
        }

        try {
            const result = await this.orchestrator.crawlSource(source);

            if (result) {
                log.info(`Scheduled crawl complete for ${source}`, {
                    found: result.articlesFound,
                    saved: result.articlesSaved,
                    status: result.status
                });
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`Scheduled crawl failed for ${source}: ${msg}`);
        }
    }

    /**
     * Stop all scheduled tasks
     */
    stop(): void {
        if (!this.isRunning) {
            log.warn('Scheduler is not running');
            return;
        }

        log.info('Stopping crawler scheduler...');

        for (const [source, taskInfo] of this.tasks) {
            taskInfo.task.stop();
            taskInfo.isActive = false;
            log.info(`Stopped scheduled task for ${source}`);
        }

        this.tasks.clear();
        this.isRunning = false;

        log.info('Scheduler stopped');
    }

    /**
     * Run an immediate crawl for all enabled sources
     */
    async runNow(): Promise<void> {
        log.info('Running immediate crawl for all sources');
        await this.orchestrator.crawlAll();
    }

    /**
     * Run an immediate crawl for a specific source
     */
    async runSourceNow(source: ArticleSource): Promise<void> {
        log.info(`Running immediate crawl for ${source}`);
        await this.runCrawl(source);
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        tasks: Array<{
            source: ArticleSource;
            intervalMinutes: number;
            cronExpression: string;
            lastRun?: Date;
            isRunning: boolean;
        }>;
    } {
        return {
            isRunning: this.isRunning,
            tasks: Array.from(this.tasks.values()).map(t => ({
                source: t.source,
                intervalMinutes: t.intervalMinutes,
                cronExpression: t.cronExpression,
                lastRun: t.lastRun,
                isRunning: t.isActive
            }))
        };
    }

    /**
     * Print schedule to console
     */
    printSchedule(): void {
        console.log('\n📅 Scheduled Tasks:\n');
        console.log('─'.repeat(60));

        for (const [source, taskInfo] of this.tasks) {
            const status = taskInfo.isActive ? '🟢 Active' : '🔴 Stopped';
            console.log(`${status} ${source}`);
            console.log(`   Interval: Every ${taskInfo.intervalMinutes} minutes`);
            console.log(`   Cron: ${taskInfo.cronExpression}`);
            if (taskInfo.lastRun) {
                console.log(`   Last Run: ${taskInfo.lastRun.toLocaleString()}`);
            }
            console.log('');
        }

        console.log('─'.repeat(60));
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.stop();
        await this.orchestrator.cleanup();
    }
}

/**
 * Start scheduler as a daemon (for CLI command)
 */
export async function startSchedulerDaemon(): Promise<void> {
    const scheduler = new CrawlerScheduler();

    // Handle graceful shutdown
    const shutdown = async () => {
        console.log('\n\n🛑 Shutting down scheduler...');
        await scheduler.cleanup();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Run initial crawl
    console.log('\n🏀 Running initial crawl...\n');
    await scheduler.runNow();

    // Start scheduled tasks
    scheduler.start();

    console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.\n');

    // Keep process alive
    await new Promise(() => { });
}
