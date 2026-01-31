/**
 * Website Crawler
 * Crawls articles from sports news websites using RSS feeds and HTML parsing
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'playwright';
import Parser from 'rss-parser';
import { BaseCrawler } from './base.js';
import type { Article } from '../models/article.js';
import type { WebsiteConfig, WebsiteSource } from '../config/types.js';
import { createArticle } from '../models/article.js';
import { log } from '../utils/logger.js';
import { generateUrlHash } from '../utils/id.js';

// Add stealth plugin to avoid detection
chromium.use(StealthPlugin());

/**
 * Website crawler implementation
 * Supports both RSS feeds and HTML scraping
 */
export class WebsiteCrawler extends BaseCrawler<WebsiteConfig> {
    private browser: Browser | null = null;
    private rssParser: Parser;

    constructor(config: WebsiteConfig) {
        super('website', config);
        this.rssParser = new Parser({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        });
    }

    /**
     * Fetch articles from all configured sources
     */
    protected async fetchArticles(): Promise<Article[]> {
        const articles: Article[] = [];

        if (this.config.sources.length === 0) {
            log.warn('No website sources configured');
            return articles;
        }

        for (const source of this.config.sources) {
            try {
                const sourceArticles = source.type === 'rss'
                    ? await this.fetchRssArticles(source)
                    : await this.fetchHtmlArticles(source);

                articles.push(...sourceArticles);

                // Rate limiting delay between sources
                await this.delay(1000 + Math.random() * 1000);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                log.error(`Error fetching from ${source.name}: ${msg}`);
            }
        }

        // Cleanup browser if it was used
        await this.cleanup();

        return articles;
    }

    /**
     * Fetch articles from RSS feed
     */
    private async fetchRssArticles(source: WebsiteSource): Promise<Article[]> {
        const articles: Article[] = [];

        if (!source.feedUrl) {
            log.warn(`No feed URL for ${source.name}`);
            return articles;
        }

        log.info(`Fetching RSS feed from ${source.name}: ${source.feedUrl}`);

        try {
            const feed = await this.rssParser.parseURL(source.feedUrl);

            for (const item of feed.items.slice(0, 20)) {
                if (!item.link) continue;

                const content = item.contentSnippet || item.content || item.summary || '';
                const title = item.title || content.substring(0, 100);

                const article = createArticle({
                    id: generateUrlHash(item.link),
                    title,
                    content,
                    source: 'website',
                    sourceUrl: item.link,
                    author: item.creator || item.author || undefined,
                    publishedAt: item.isoDate || item.pubDate || undefined,
                    tags: item.categories || [],
                    metadata: {
                        platform: 'website',
                        siteName: source.name,
                        siteUrl: source.url,
                        feedUrl: source.feedUrl
                    }
                });

                articles.push(article);
            }

            log.info(`Extracted ${articles.length} articles from ${source.name} RSS`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`RSS parsing error for ${source.name}: ${msg}`);
        }

        return articles;
    }

    /**
     * Fetch articles from HTML page
     */
    private async fetchHtmlArticles(source: WebsiteSource): Promise<Article[]> {
        const articles: Article[] = [];

        if (!source.selectors) {
            log.warn(`No selectors configured for ${source.name}`);
            return articles;
        }

        log.info(`Fetching HTML from ${source.name}: ${source.url}`);

        try {
            // Initialize browser if not already done
            if (!this.browser) {
                this.browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--no-sandbox'
                    ]
                });
            }

            const page = await this.browser.newPage();

            try {
                await page.setViewportSize({ width: 1280, height: 800 });

                // Set extra headers to appear more like a real browser
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                });

                // Use domcontentloaded instead of networkidle for faster loading
                await page.goto(source.url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 45000
                });

                // Wait a bit for JavaScript to render content
                await this.delay(3000);

                // Wait for articles to load
                await page.waitForSelector(source.selectors.article, { timeout: 10000 })
                    .catch(() => log.warn(`No articles found with selector: ${source.selectors?.article}`));

                await this.delay(2000);

                // Extract articles using configured selectors
                const selectors = source.selectors;
                const extractedData = await page.evaluate((sel) => {
                    const results: Array<{
                        title: string | null;
                        content: string | null;
                        link: string | null;
                        date: string | null;
                        author: string | null;
                    }> = [];

                    // Track URLs we've already added to avoid duplicates
                    const seenUrls = new Set<string>();

                    const articleElements = document.querySelectorAll(sel.article);

                    articleElements.forEach((article, index) => {
                        // Limit to first 30 articles
                        if (index >= 30) return;

                        // Get title
                        const titleEl = article.querySelector(sel.title);
                        const title = titleEl?.textContent?.trim() || article.textContent?.trim().split('\n')[0]?.substring(0, 200) || null;

                        // Get link - check if the article container itself is an anchor
                        let link: string | null = null;
                        if (article.tagName === 'A') {
                            // Article container is an anchor, get its href
                            link = (article as HTMLAnchorElement).getAttribute('href');
                        } else {
                            // Look for anchor inside
                            const linkEl = article.querySelector(sel.link) as HTMLAnchorElement | null;
                            link = linkEl?.getAttribute('href') || null;
                        }

                        // Make relative URLs absolute
                        if (link && !link.startsWith('http')) {
                            link = new URL(link, window.location.origin).href;
                        }

                        // Skip invalid links or non-article URLs
                        if (!link) return;
                        if (link.includes('#') && !link.includes('/article')) return;  // Skip hash-only links
                        if (seenUrls.has(link)) return;  // Skip duplicates
                        seenUrls.add(link);

                        // Get content (optional)
                        const contentEl = sel.content ? article.querySelector(sel.content) : null;
                        const content = contentEl?.textContent?.trim() || title || '';

                        // Get date (optional)
                        const dateEl = sel.date ? article.querySelector(sel.date) : null;
                        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || null;

                        // Get author (optional)
                        const authorEl = sel.author ? article.querySelector(sel.author) : null;
                        const author = authorEl?.textContent?.trim() || null;

                        // Only add if we have a meaningful title (not just short nav text)
                        if (title && title.length > 10 && link) {
                            results.push({ title: title.substring(0, 500), content, link, date, author });
                        }
                    });

                    return results;
                }, selectors);

                // Convert to articles
                for (const item of extractedData) {
                    if (!item.link || !item.title) continue;

                    const article = createArticle({
                        id: generateUrlHash(item.link),
                        title: item.title,
                        content: item.content || item.title,
                        source: 'website',
                        sourceUrl: item.link,
                        author: item.author || undefined,
                        publishedAt: item.date || undefined,
                        tags: [],
                        metadata: {
                            platform: 'website',
                            siteName: source.name,
                            siteUrl: source.url,
                            scraped: true
                        }
                    });

                    articles.push(article);
                }

                log.info(`Extracted ${articles.length} articles from ${source.name} HTML`);
            } finally {
                await page.close();
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(`HTML parsing error for ${source.name}: ${msg}`);
        }

        return articles;
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
