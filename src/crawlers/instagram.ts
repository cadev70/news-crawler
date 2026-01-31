/**
 * Instagram Crawler
 * Crawls posts from configured Instagram accounts using Playwright
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
 * Instagram crawler implementation
 */
export class InstagramCrawler extends BaseCrawler<PlatformConfig> {
    private browser: Browser | null = null;

    constructor(config: PlatformConfig) {
        super('instagram', config);
    }

    /**
     * Fetch posts from all configured accounts
     */
    protected async fetchArticles(): Promise<Article[]> {
        const articles: Article[] = [];

        if (this.config.accounts.length === 0) {
            log.warn('No Instagram accounts configured');
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

            for (const account of this.config.accounts) {
                try {
                    const accountArticles = await this.fetchAccountPosts(account);
                    articles.push(...accountArticles);

                    // Rate limiting delay between accounts
                    await this.delay(3000 + Math.random() * 2000);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    log.error(`Error fetching posts from @${account}: ${msg}`);
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

            const url = `https://www.instagram.com/${account.replace('@', '')}/`;
            log.info(`Fetching posts from ${url}`);

            // Navigate to profile - use domcontentloaded for speed
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // Wait for content to load
            await this.delay(3000);

            // Check for login wall
            const loginWall = await page.$('input[name="username"]');
            if (loginWall) {
                log.warn(`Instagram login wall detected for @${account} - limited access`);
            }

            // Try to find posts
            const posts = await page.evaluate(() => {
                const results: Array<{
                    link: string | null;
                    image: string | null;
                    alt: string | null;
                }> = [];

                // Look for post links
                const postLinks = document.querySelectorAll('a[href*="/p/"]');

                postLinks.forEach((link, index) => {
                    // Limit to first 12 posts
                    if (index >= 12) return;

                    const href = link.getAttribute('href');
                    const img = link.querySelector('img');

                    results.push({
                        link: href ? `https://www.instagram.com${href}` : null,
                        image: img?.getAttribute('src') || null,
                        alt: img?.getAttribute('alt') || null
                    });
                });

                return results;
            });

            // Convert to articles
            for (const post of posts) {
                if (!post.link) continue;

                // Use alt text as content (Instagram puts captions in alt text)
                const content = post.alt || 'Instagram post';
                const title = content.substring(0, 100) + (content.length > 100 ? '...' : '');

                const article = createArticle({
                    id: generateUrlHash(post.link),
                    title,
                    content,
                    source: 'instagram',
                    sourceUrl: post.link,
                    author: account.replace('@', ''),
                    authorUrl: `https://www.instagram.com/${account.replace('@', '')}/`,
                    imageUrl: post.image || undefined,
                    tags: this.extractHashtags(content),
                    metadata: {
                        platform: 'instagram',
                        accountHandle: account.replace('@', '')
                    }
                });

                articles.push(article);
            }

            log.info(`Extracted ${articles.length} posts from @${account}`);
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
