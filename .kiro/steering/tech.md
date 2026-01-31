# Basketball News Crawler - Technical Guidelines

## Technology Stack

### Runtime & Language
- **Runtime**: Node.js (v24+)
- **Package Manager**: pnpm
- **Language**: TypeScript for type safety

### Core Dependencies
- **Web Scraping**: Playwright (headless browser automation)
- **HTTP Client**: Native fetch (Node.js built-in)
- **Database**: LowDB (JSON file-based, human-readable, TypeScript-ready)
- **Scheduling**: node-cron for automatic crawling
- **CLI**: Commander.js for command-line interface

### Project Structure
```
news-crawler/
├── src/
│   ├── crawlers/          # Source-specific crawlers
│   ├── config/            # Configuration management
│   ├── database/          # Database operations
│   ├── scheduler/         # Cron job management
│   ├── models/            # Data models
│   └── utils/             # Utility functions
├── config/
│   └── sources.json       # Configurable source list
├── data/                  # SQLite database files
└── logs/                  # Crawl logs
```

## Development Practices

### Code Style
- ESLint with TypeScript rules
- Prettier for formatting
- Conventional commits

### Testing
- Jest for unit and integration tests
- Mock external APIs for testing

### Error Handling
- Graceful degradation on source failures
- Comprehensive logging
- Retry mechanisms for failed requests

## API Considerations

### Rate Limiting
- Respect platform rate limits
- Implement exponential backoff
- Use proxies if needed

### Authentication
- OAuth tokens for social media APIs
- API keys stored in environment variables
