/**
 * Twitter/X Crawler
 * Crawls tweets from configured Twitter accounts using Playwright
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
 * Twitter crawler implementation
 */
export class TwitterCrawler extends BaseCrawler<PlatformConfig> {
    private browser: Browser | null = null;

    constructor(config: PlatformConfig) {
        super('twitter', config);
    }

    /**
     * Fetch tweets from all configured accounts
     */
    protected async fetchArticles(): Promise<Article[]> {
        const articles: Article[] = [];

        if (this.config.accounts.length === 0) {
            log.warn('No Twitter accounts configured');
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
                    const accountArticles = await this.fetchAccountTweets(account);
                    articles.push(...accountArticles);

                    // Rate limiting delay between accounts
                    await this.delay(2000 + Math.random() * 2000);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    log.error(`Error fetching tweets from @${account}: ${msg}`);
                }
            }
        } finally {
            await this.cleanup();
        }

        return articles;
    }

    /**
     * Fetch tweets from a single account
     */
    private async fetchAccountTweets(account: string): Promise<Article[]> {
        const articles: Article[] = [];

        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        const page = await this.browser.newPage();

        try {
            // Set realistic viewport
            await page.setViewportSize({ width: 1280, height: 800 });

            // Set extra headers to appear more like a real browser
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            const url = `https://twitter.com/${account.replace('@', '')}`;
            log.info(`Fetching tweets from ${url}`);

            // Navigate to profile - use domcontentloaded instead of networkidle
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            });

            // Wait a bit for JavaScript to render
            await this.delay(3000);

            // Wait for tweets to load
            await page.waitForSelector('article[data-testid="tweet"]', {
                timeout: 15000
            }).catch(() => {
                log.warn(`No tweets found for @${account} (may require login or be blocked)`);
            });

            // Give time for dynamic content
            await this.delay(2000);

            // Extract tweets
            const tweets = await page.evaluate(() => {
                const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
                const results: Array<{
                    text: string;
                    time: string | null;
                    link: string | null;
                    author: string | null;
                    authorHandle: string | null;
                    images: string[];
                }> = [];

                tweetElements.forEach((tweet, index) => {
                    // Limit to first 20 tweets
                    if (index >= 20) return;

                    // Get tweet text
                    const textEl = tweet.querySelector('[data-testid="tweetText"]');
                    const text = textEl?.textContent || '';

                    // Skip if no text
                    if (!text.trim()) return;

                    // Get time
                    const timeEl = tweet.querySelector('time');
                    const time = timeEl?.getAttribute('datetime') || null;

                    // Get tweet link
                    const linkEl = tweet.querySelector('a[href*="/status/"]');
                    const link = linkEl?.getAttribute('href') || null;

                    // Get author info
                    const authorEl = tweet.querySelector('[data-testid="User-Name"]');
                    const authorText = authorEl?.textContent || '';
                    const authorMatch = authorText.match(/@(\w+)/);
                    const authorHandle = authorMatch ? authorMatch[1] : null;
                    const author = authorText.split('@')[0]?.trim() || null;

                    // Get images
                    const imageEls = tweet.querySelectorAll('img[src*="pbs.twimg.com/media"]');
                    const images = Array.from(imageEls).map(img => img.getAttribute('src') || '').filter(Boolean);

                    results.push({
                        text,
                        time,
                        link: link ? `https://twitter.com${link}` : null,
                        author,
                        authorHandle,
                        images
                    });
                });

                return results;
            });

            // Convert to articles
            for (const tweet of tweets) {
                if (!tweet.link) continue;

                const article = createArticle({
                    id: generateUrlHash(tweet.link),
                    title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
                    content: tweet.text,
                    source: 'twitter',
                    sourceUrl: tweet.link,
                    author: tweet.author || undefined,
                    authorUrl: tweet.authorHandle ? `https://twitter.com/${tweet.authorHandle}` : undefined,
                    imageUrl: tweet.images[0] || undefined,
                    publishedAt: tweet.time || undefined,
                    tags: this.extractHashtags(tweet.text),
                    metadata: {
                        platform: 'twitter',
                        accountHandle: account.replace('@', ''),
                        images: tweet.images
                    }
                });

                articles.push(article);
            }

            log.info(`Extracted ${articles.length} tweets from @${account}`);
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
