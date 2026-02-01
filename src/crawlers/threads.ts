/**
 * Threads Crawler
 * Crawls posts from configured Threads accounts using Playwright
 * Note: Threads is a relatively new platform, scraping capabilities may be limited
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'playwright';
import { BaseCrawler } from './base.js';
import type { Article } from '../models/article.js';
import type { PlatformConfig } from '../config/types.js';
import { createArticle } from '../models/article.js';
import { log } from '../utils/logger.js';
import { generateUrlHash } from '../utils/id.js';

// Add stealth plugin to avoid detection
chromium.use(StealthPlugin());

/**
 * Threads crawler implementation
 */
export class ThreadsCrawler extends BaseCrawler<PlatformConfig> {
    private browser: Browser | null = null;

    constructor(config: PlatformConfig) {
        super('threads', config);
    }

    /**
     * Fetch posts from all configured accounts or a specific target
     * @param target Optional target account to crawl
     */
    protected async fetchArticles(target?: string): Promise<Article[]> {
        const articles: Article[] = [];

        // Determine which accounts to crawl
        let accountsToCrawl = this.config.accounts;
        if (target) {
            const normalizedTarget = target.replace('@', '').toLowerCase();
            const matchedAccount = this.config.accounts.find(
                acc => acc.replace('@', '').toLowerCase() === normalizedTarget
            );
            if (!matchedAccount) {
                log.warn(`Target account "${target}" not found in configured Threads accounts`);
                return articles;
            }
            accountsToCrawl = [matchedAccount];
            log.info(`Targeting specific Threads account: @${matchedAccount}`);
        }

        if (accountsToCrawl.length === 0) {
            log.warn('No Threads accounts configured');
            return articles;
        }

        try {
            // Launch browser with stealth options
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox'
                ]
            });

            for (const account of accountsToCrawl) {
                try {
                    const accountArticles = await this.fetchAccountPosts(account);
                    articles.push(...accountArticles);

                    // Rate limiting delay between accounts
                    await this.delay(3000 + Math.random() * 2000);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    log.error(`Error fetching threads from @${account}: ${msg}`);
                }
            }
        } finally {
            await this.cleanup();
        }

        return articles;
    }

    /**
     * Fetch posts from a single account
     */
    private async fetchAccountPosts(account: string): Promise<Article[]> {
        const articles: Article[] = [];

        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        const page = await this.browser.newPage();

        try {
            // Set realistic viewport
            await page.setViewportSize({ width: 1280, height: 800 });

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            const url = `https://www.threads.net/@${account.replace('@', '')}`;
            log.info(`Fetching threads from ${url}`);

            // Navigate to profile - use domcontentloaded for speed
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // Wait for content to load
            await this.delay(3000);

            // Extract posts (Threads structure may change frequently)
            const posts = await page.evaluate(() => {
                const results: Array<{
                    link: string | null;
                    text: string | null;
                    time: string | null;
                    image: string | null;
                }> = [];

                // Look for thread posts - selectors may need adjustment
                const textElements = document.querySelectorAll('[data-pressable-container="true"]');

                textElements.forEach((element, index) => {
                    // Limit to first 12 posts
                    if (index >= 12) return;

                    // Get text content
                    const textContainer = element.querySelector('span');
                    const text = textContainer?.textContent || null;

                    if (!text) return;

                    // Try to find link
                    const linkEl = element.closest('a') || element.querySelector('a');
                    const link = linkEl?.getAttribute('href') || null;

                    // Try to find time
                    const timeEl = element.querySelector('time');
                    const time = timeEl?.getAttribute('datetime') || null;

                    // Try to find image
                    const imgEl = element.querySelector('img');
                    const image = imgEl?.getAttribute('src') || null;

                    results.push({
                        link: link ? (link.startsWith('http') ? link : `https://www.threads.net${link}`) : null,
                        text,
                        time,
                        image
                    });
                });

                return results;
            });

            // Convert to articles
            for (const post of posts) {
                if (!post.text) continue;

                const sourceUrl = post.link || `https://www.threads.net/@${account.replace('@', '')}#${Date.now()}`;
                const title = post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '');

                const article = createArticle({
                    id: generateUrlHash(sourceUrl),
                    title,
                    content: post.text,
                    source: 'threads',
                    sourceUrl,
                    author: account.replace('@', ''),
                    authorUrl: `https://www.threads.net/@${account.replace('@', '')}`,
                    imageUrl: post.image || undefined,
                    publishedAt: post.time || undefined,
                    tags: this.extractHashtags(post.text),
                    metadata: {
                        platform: 'threads',
                        accountHandle: account.replace('@', '')
                    }
                });

                articles.push(article);
            }

            log.info(`Extracted ${articles.length} threads from @${account}`);
        } finally {
            await page.close();
        }

        return articles;
    }

    /**
     * Extract hashtags from text
     */
    private extractHashtags(text: string): string[] {
        const matches = text.match(/#\w+/g) || [];
        return matches.map(tag => tag.replace('#', ''));
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup browser resources
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
