# 🏀 Basketball News Crawler

A powerful Node.js CLI tool that crawls basketball news from multiple sources including Twitter, Instagram, Threads, and sports news websites. Articles are stored in a local JSON database for easy access and export.

## ✨ Features

- **Multi-Source Crawling**: Fetch news from Twitter, Instagram, Threads, and websites
- **Account-Based Social Media**: Follow specific accounts (not keyword search)
- **Website Flexibility**: Support for RSS feeds and HTML scraping with CSS selectors
- **Local Storage**: Human-readable JSON database using LowDB
- **Scheduled Crawling**: Automatic periodic crawling with node-cron
- **CLI Interface**: Easy-to-use command line tools
- **Duplicate Detection**: Automatic deduplication of articles
- **Export Capability**: Export articles to JSON format

## 📋 Requirements

- **Node.js**: v24 or higher
- **pnpm**: Package manager (recommended)
- **Playwright Browsers**: Chromium (auto-installed)

## 🚀 Installation

```bash
# Clone the repository
git clone <repository-url>
cd news-crawler

# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium
```

## ⚙️ Configuration

### Source Configuration

Edit `config/sources.json` to configure your news sources:

```json
{
  "twitter": {
    "enabled": true,
    "crawlIntervalMinutes": 30,
    "accounts": ["wojespn", "ShamsCharania", "WindhorstESPN"]
  },
  "instagram": {
    "enabled": true,
    "crawlIntervalMinutes": 60,
    "accounts": ["nba", "espn", "bleacherreport"]
  },
  "threads": {
    "enabled": false,
    "crawlIntervalMinutes": 60,
    "accounts": []
  },
  "websites": {
    "enabled": true,
    "crawlIntervalMinutes": 120,
    "sources": [
      {
        "name": "ESPN NBA",
        "url": "https://www.espn.com/nba/",
        "type": "rss",
        "feedUrl": "https://www.espn.com/espn/rss/nba/news"
      }
    ]
  }
}
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Optional: API Keys (for enhanced access)
TWITTER_BEARER_TOKEN=your_token_here

# Optional: Proxy configuration
HTTP_PROXY=http://proxy:8080

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Database path (default: data/db.json)
DB_PATH=data/db.json
```

## 📖 Usage

### Run Development Mode

```bash
# Run any command with tsx (no build required)
pnpm dev <command>
```

### Available Commands

#### Crawl News

```bash
# Crawl all enabled sources
pnpm dev crawl

# Crawl specific source only
pnpm dev crawl -s twitter
pnpm dev crawl -s instagram
pnpm dev crawl -s website
```

#### List Articles

```bash
# List recent 20 articles
pnpm dev list

# List with custom limit
pnpm dev list -n 50

# Filter by source
pnpm dev list -s twitter
```

#### Search Articles

```bash
# Search by keyword
pnpm dev search -k "LeBron"

# Search with limit
pnpm dev search -k "trade" -n 10
```

#### View Statistics

```bash
pnpm dev stats
```

#### View Crawl History

```bash
# Show recent 10 crawl entries
pnpm dev history

# Filter by source
pnpm dev history -s website
```

#### Export Articles

```bash
# Export all articles to export.json
pnpm dev export

# Custom output path
pnpm dev export -o articles.json

# Export specific source
pnpm dev export -s twitter -o twitter.json
```

#### Cleanup Old Articles

```bash
# Remove articles older than 30 days
pnpm dev cleanup

# Custom retention period
pnpm dev cleanup -d 7

# Skip confirmation
pnpm dev cleanup -d 30 -f
```

#### Start Scheduler

```bash
# Start automatic scheduled crawling
pnpm dev schedule

# Skip initial crawl on startup
pnpm dev schedule --no-initial
```

## 🏗️ Project Structure

```
news-crawler/
├── config/
│   └── sources.json       # Source configuration
├── data/
│   └── db.json            # LowDB database (auto-created)
├── logs/
│   ├── crawler.log        # All logs
│   └── error.log          # Error logs only
├── src/
│   ├── index.ts           # CLI entry point
│   ├── config/            # Configuration loader
│   ├── crawlers/          # Crawler implementations
│   │   ├── base.ts        # Base crawler class
│   │   ├── twitter.ts     # Twitter crawler
│   │   ├── instagram.ts   # Instagram crawler
│   │   ├── threads.ts     # Threads crawler
│   │   ├── website.ts     # Website crawler (RSS + HTML)
│   │   └── orchestrator.ts# Crawler orchestrator
│   ├── database/          # LowDB setup
│   │   └── repositories/  # Data access layer
│   ├── models/            # Data models
│   ├── scheduler/         # Cron scheduler
│   └── utils/             # Utilities (logger, http, id)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Adding New Sources

### Adding Twitter Accounts

Edit `config/sources.json`:

```json
{
  "twitter": {
    "accounts": [
      "wojespn",
      "ShamsCharania",
      "your_new_account"
    ]
  }
}
```

### Adding Website Sources

#### RSS Feed

```json
{
  "name": "NBA.com News",
  "url": "https://www.nba.com/news",
  "type": "rss",
  "feedUrl": "https://www.nba.com/feeds/news.xml"
}
```

#### HTML Scraping

```json
{
  "name": "Bleacher Report NBA",
  "url": "https://bleacherreport.com/nba",
  "type": "html",
  "selectors": {
    "article": "article.articleCard",
    "title": "h3",
    "link": "a.articleCard__link",
    "content": ".articleCard__content",
    "date": "time"
  }
}
```

## 📄 Database Schema

Articles are stored in `data/db.json`:

```json
{
  "articles": [
    {
      "id": "abc123",
      "title": "Article Title",
      "content": "Full article content...",
      "summary": "First 200 characters...",
      "source": "twitter",
      "sourceUrl": "https://twitter.com/...",
      "author": "wojespn",
      "authorUrl": "https://twitter.com/wojespn",
      "imageUrl": "https://...",
      "publishedAt": "2024-01-15T10:30:00Z",
      "crawledAt": "2024-01-15T11:00:00Z",
      "tags": ["trade", "nba"],
      "metadata": {}
    }
  ],
  "crawlHistory": [...],
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastCrawledAt": "2024-01-15T11:00:00Z"
  }
}
```

## ⚠️ Limitations & Considerations

1. **Rate Limiting**: The crawler includes delays between requests to avoid being blocked
2. **Login Walls**: Some platforms may require authentication for full access
3. **Dynamic Content**: Website selectors may break if sites redesign
4. **Platform TOS**: Ensure crawling complies with each platform's terms of service

## 🛠️ Development

```bash
# Type check
pnpm exec tsc --noEmit

# Build for production
pnpm build

# Run production build
pnpm start
```

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
