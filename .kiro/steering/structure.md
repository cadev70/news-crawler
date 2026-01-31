# Basketball News Crawler - Project Structure

## Directory Layout

```
news-crawler/
├── .kiro/
│   ├── steering/          # Project steering documents
│   ├── specs/             # Feature specifications
│   └── settings/          # Kiro settings
├── src/
│   ├── index.ts           # Application entry point
│   ├── crawlers/
│   │   ├── base.ts        # Base crawler class
│   │   ├── threads.ts     # Threads crawler
│   │   ├── twitter.ts     # X/Twitter crawler
│   │   ├── instagram.ts   # Instagram crawler
│   │   └── web.ts         # Generic web news crawler
│   ├── config/
│   │   ├── index.ts       # Configuration loader
│   │   └── sources.ts     # Source configuration types
│   ├── database/
│   │   ├── index.ts       # LowDB initialization
│   │   └── repositories/  # Data access layer
│   ├── scheduler/
│   │   └── index.ts       # Cron job scheduler
│   ├── models/
│   │   └── news.ts        # News article model
│   └── utils/
│       ├── logger.ts      # Logging utility
│       └── http.ts        # HTTP client wrapper
├── config/
│   └── sources.json       # Source configuration file
├── data/
│   └── db.json            # LowDB JSON database
├── logs/                  # Application logs
├── tests/                 # Test files
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point |
| `config/sources.json` | Configurable news sources |
| `src/crawlers/base.ts` | Abstract crawler interface |
| `src/database/index.ts` | SQLite connection management |
| `src/scheduler/index.ts` | Automatic crawl scheduling |
