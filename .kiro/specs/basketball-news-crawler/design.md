# Basketball News Crawler - Technical Design

## Overview

This document describes the technical architecture and design decisions for the Basketball News Crawler system. The system fetches basketball-related content from configured social media accounts and sports news websites, storing the data in a local LowDB (JSON) database.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLI Interface                                  │
│                    (Commander.js - Entry Point)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Commands: crawl | crawl --source <name> | list | search | export       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Crawler Orchestrator                             │
│                    (Coordinates crawl operations)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  - Loads source configuration                                           │
│  - Instantiates appropriate crawlers                                    │
│  - Manages parallel/sequential execution                                │
│  - Handles errors and retries                                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Social Media  │     │ Social Media  │     │   Website     │
│   Crawler     │     │   Crawler     │     │   Crawler     │
│  (Twitter)    │     │ (IG/Threads)  │     │  (RSS/HTML)   │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ BaseCrawler   │     │ BaseCrawler   │     │ BaseCrawler   │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Article Repository                               │
│                    (Data access layer for LowDB)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  - insert(article)          - findBySource(source)                      │
│  - findById(id)             - search(query)                             │
│  - exists(url)              - deleteOlderThan(date)                     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          LowDB (JSON File)                               │
│                         data/db.json                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. CLI Interface (`src/index.ts`)

The entry point using Commander.js to handle user commands.

```typescript
interface CLICommands {
  crawl(options: { source?: string }): Promise<void>;
  list(options: { limit?: number; source?: string }): Promise<void>;
  search(options: { keyword: string }): Promise<void>;
  export(options: { output?: string }): Promise<void>;
  cleanup(options: { days?: number }): Promise<void>;
  schedule(): Promise<void>;  // Daemon mode
}
```

| Command | Description |
|---------|-------------|
| `crawl` | Run crawl for all enabled sources |
| `crawl --source twitter` | Crawl specific source only |
| `list` | Display recent articles |
| `search --keyword "Lakers"` | Search stored articles |
| `export` | Export database to JSON file |
| `cleanup --days 30` | Remove articles older than N days |
| `schedule` | Run in daemon mode with cron |

---

### 2. Configuration Manager (`src/config/index.ts`)

Loads and validates source configuration from `config/sources.json`.

```typescript
interface SourceConfig {
  twitter: PlatformConfig;
  instagram: PlatformConfig;
  threads: PlatformConfig;
  websites: WebsiteConfig;
}

interface PlatformConfig {
  enabled: boolean;
  crawlIntervalMinutes: number;
  accounts: string[];
}

interface WebsiteConfig {
  enabled: boolean;
  crawlIntervalMinutes: number;
  sources: WebsiteSource[];
}

interface WebsiteSource {
  name: string;
  url: string;
  type: 'rss' | 'html';
  feedUrl?: string;           // For RSS
  selectors?: HTMLSelectors;  // For HTML
}

interface HTMLSelectors {
  article: string;
  title: string;
  link: string;
  content?: string;
  date?: string;
  author?: string;
}
```

---

### 3. Base Crawler (`src/crawlers/base.ts`)

Abstract base class that all crawlers extend.

```typescript
abstract class BaseCrawler {
  protected name: string;
  protected config: PlatformConfig | WebsiteConfig;
  protected httpClient: typeof fetch;
  protected logger: Logger;

  constructor(name: string, config: any);

  // Template method pattern
  async crawl(): Promise<CrawlResult> {
    this.logger.info(`Starting crawl for ${this.name}`);
    const articles = await this.fetchArticles();
    const newArticles = await this.filterDuplicates(articles);
    await this.saveArticles(newArticles);
    return this.buildResult(newArticles);
  }

  // Abstract methods for subclasses
  abstract fetchArticles(): Promise<Article[]>;
  
  // Common methods
  protected async filterDuplicates(articles: Article[]): Promise<Article[]>;
  protected async saveArticles(articles: Article[]): Promise<void>;
  protected buildResult(articles: Article[]): CrawlResult;
}

interface CrawlResult {
  source: string;
  timestamp: Date;
  articlesFound: number;
  articlesSaved: number;
  errors: string[];
  status: 'success' | 'partial' | 'failed';
}
```

---

### 4. Platform Crawlers

#### Twitter Crawler (`src/crawlers/twitter.ts`)

```typescript
class TwitterCrawler extends BaseCrawler {
  // Uses Twitter API v2 or scraping fallback
  async fetchArticles(): Promise<Article[]> {
    const articles: Article[] = [];
    for (const account of this.config.accounts) {
      const tweets = await this.fetchUserTweets(account);
      articles.push(...this.transformTweets(tweets));
    }
    return articles;
  }

  private async fetchUserTweets(username: string): Promise<Tweet[]>;
  private transformTweets(tweets: Tweet[]): Article[];
}
```

#### Instagram Crawler (`src/crawlers/instagram.ts`)

```typescript
class InstagramCrawler extends BaseCrawler {
  // Uses Instagram public API or scraping
  async fetchArticles(): Promise<Article[]> {
    const articles: Article[] = [];
    for (const account of this.config.accounts) {
      const posts = await this.fetchUserPosts(account);
      articles.push(...this.transformPosts(posts));
    }
    return articles;
  }
}
```

#### Threads Crawler (`src/crawlers/threads.ts`)

```typescript
class ThreadsCrawler extends BaseCrawler {
  // Similar pattern to Instagram (Meta platform)
  async fetchArticles(): Promise<Article[]>;
}
```

#### Website Crawler (`src/crawlers/website.ts`)

```typescript
class WebsiteCrawler extends BaseCrawler {
  async fetchArticles(): Promise<Article[]> {
    const articles: Article[] = [];
    for (const source of this.config.sources) {
      if (source.type === 'rss') {
        articles.push(...await this.parseRSS(source));
      } else {
        articles.push(...await this.parseHTML(source));
      }
    }
    return articles;
  }

  private async parseRSS(source: WebsiteSource): Promise<Article[]>;
  private async parseHTML(source: WebsiteSource): Promise<Article[]>;
}
```

---

### 5. Data Models (`src/models/`)

#### Article Model

```typescript
interface Article {
  id: string;                    // UUID or hash of URL
  title: string;
  content: string;
  summary?: string;              // First 200 chars or excerpt
  source: ArticleSource;
  sourceUrl: string;             // Original URL
  author?: string;
  authorUrl?: string;
  imageUrl?: string;
  publishedAt?: Date;
  crawledAt: Date;
  tags: string[];                // e.g., ["NBA", "Lakers"]
  metadata: Record<string, any>; // Platform-specific data
}

type ArticleSource = 'twitter' | 'instagram' | 'threads' | 'website';
```

#### Crawl History Model

```typescript
interface CrawlHistory {
  id: string;
  timestamp: Date;
  source: ArticleSource;
  duration: number;              // milliseconds
  articlesFound: number;
  articlesSaved: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}
```

---

### 6. Database Layer (`src/database/`)

#### LowDB Setup (`src/database/index.ts`)

```typescript
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

interface Database {
  articles: Article[];
  crawlHistory: CrawlHistory[];
  metadata: {
    version: string;
    createdAt: string;
    lastCrawledAt?: string;
  };
}

const defaultData: Database = {
  articles: [],
  crawlHistory: [],
  metadata: {
    version: '1.0.0',
    createdAt: new Date().toISOString()
  }
};

// Singleton pattern
let db: Low<Database>;

export async function initDatabase(): Promise<Low<Database>> {
  if (!db) {
    const adapter = new JSONFile<Database>('data/db.json');
    db = new Low(adapter, defaultData);
    await db.read();
  }
  return db;
}
```

#### Article Repository (`src/database/repositories/article.ts`)

```typescript
class ArticleRepository {
  private db: Low<Database>;

  constructor(db: Low<Database>);

  async insert(article: Article): Promise<void> {
    this.db.data.articles.push(article);
    await this.db.write();
  }

  async insertMany(articles: Article[]): Promise<void> {
    this.db.data.articles.push(...articles);
    await this.db.write();
  }

  findById(id: string): Article | undefined {
    return this.db.data.articles.find(a => a.id === id);
  }

  findByUrl(url: string): Article | undefined {
    return this.db.data.articles.find(a => a.sourceUrl === url);
  }

  exists(url: string): boolean {
    return this.findByUrl(url) !== undefined;
  }

  findBySource(source: ArticleSource, limit?: number): Article[] {
    const filtered = this.db.data.articles
      .filter(a => a.source === source)
      .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime());
    return limit ? filtered.slice(0, limit) : filtered;
  }

  search(keyword: string): Article[] {
    const lower = keyword.toLowerCase();
    return this.db.data.articles.filter(a =>
      a.title.toLowerCase().includes(lower) ||
      a.content.toLowerCase().includes(lower)
    );
  }

  findRecent(limit: number = 20): Article[] {
    return this.db.data.articles
      .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime())
      .slice(0, limit);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const before = this.db.data.articles.length;
    this.db.data.articles = this.db.data.articles
      .filter(a => new Date(a.crawledAt) >= date);
    await this.db.write();
    return before - this.db.data.articles.length;
  }
}
```

---

### 7. Scheduler (`src/scheduler/index.ts`)

Handles automatic crawling using node-cron.

```typescript
import cron from 'node-cron';

class CrawlScheduler {
  private jobs: Map<string, cron.ScheduledTask>;
  private orchestrator: CrawlerOrchestrator;

  constructor(orchestrator: CrawlerOrchestrator);

  start(): void {
    const config = loadConfig();
    
    // Schedule each source based on its interval
    if (config.twitter.enabled) {
      this.scheduleSource('twitter', config.twitter.crawlIntervalMinutes);
    }
    if (config.instagram.enabled) {
      this.scheduleSource('instagram', config.instagram.crawlIntervalMinutes);
    }
    // ... etc
  }

  private scheduleSource(source: string, intervalMinutes: number): void {
    const cronExpression = `*/${intervalMinutes} * * * *`;
    const job = cron.schedule(cronExpression, async () => {
      await this.orchestrator.crawlSource(source);
    });
    this.jobs.set(source, job);
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs.clear();
  }
}
```

---

### 8. Utilities

#### Logger (`src/utils/logger.ts`)

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: 'logs/crawler.log' 
    })
  ]
});

export default logger;
```

#### HTTP Client (`src/utils/http.ts`)

```typescript
interface FetchOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit & FetchOptions = {}
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, timeout = 30000, ...fetchOptions } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'User-Agent': 'BasketballNewsCrawler/1.0',
          ...fetchOptions.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok && attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(retryDelay * Math.pow(2, attempt - 1));
    }
  }
  
  throw new Error(`Failed after ${retries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Data Flow

### Manual Crawl Flow

```
User runs: npm run crawl
         │
         ▼
┌─────────────────────┐
│   CLI parses args   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Load sources.json │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Orchestrator starts │
│ enabled crawlers    │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Twitter │ │ Website │  (parallel)
│ Crawler │ │ Crawler │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           ▼
┌─────────────────────┐
│ Deduplicate articles│
│ by URL/ID           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Save to LowDB       │
│ (data/db.json)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Log crawl results   │
│ to console & file   │
└─────────────────────┘
```

---

## File Structure

```
news-crawler/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── crawlers/
│   │   ├── base.ts              # Abstract base crawler
│   │   ├── orchestrator.ts      # Crawl orchestrator
│   │   ├── twitter.ts           # Twitter crawler
│   │   ├── instagram.ts         # Instagram crawler
│   │   ├── threads.ts           # Threads crawler
│   │   └── website.ts           # RSS/HTML website crawler
│   ├── config/
│   │   ├── index.ts             # Config loader
│   │   └── types.ts             # Config TypeScript types
│   ├── database/
│   │   ├── index.ts             # LowDB initialization
│   │   └── repositories/
│   │       ├── article.ts       # Article repository
│   │       └── history.ts       # Crawl history repository
│   ├── models/
│   │   ├── article.ts           # Article interface
│   │   └── crawl-history.ts     # Crawl history interface
│   ├── scheduler/
│   │   └── index.ts             # Cron scheduler
│   └── utils/
│       ├── logger.ts            # Winston logger
│       ├── http.ts              # Axios client wrapper
│       └── id.ts                # ID generation utility
├── config/
│   └── sources.json             # Source configuration
├── data/
│   └── db.json                  # LowDB database file
├── logs/
│   └── crawler.log              # Application logs
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Dependencies

```json
{
  "engines": {
    "node": ">=24.0.0"
  },
  "dependencies": {
    "playwright": "^1.41.0",
    "commander": "^12.0.0",
    "lowdb": "^7.0.1",
    "node-cron": "^3.0.3",
    "rss-parser": "^3.13.0",
    "uuid": "^9.0.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0"
  }
}
```

---

## Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| Network timeout | Retry 3 times with exponential backoff |
| Rate limiting (429) | Wait and retry after delay |
| Source unavailable | Log error, continue with other sources |
| Invalid response | Log warning, skip malformed data |
| Database write fail | Throw error, halt operation |

---

## Security Considerations

1. **API Keys**: Stored in `.env` file, never committed to version control
2. **Rate Limiting**: Respect platform limits, configurable delays between requests
3. **User-Agent**: Identify as legitimate crawler in HTTP headers
4. **Data Sanitization**: Sanitize content before storing to prevent injection

---

## Future Enhancements (Out of Scope for v1.0)

- Web UI dashboard
- Push notifications for breaking news
- Sentiment analysis
- Multi-language support
- Cloud sync capability
