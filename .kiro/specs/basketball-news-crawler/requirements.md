# Basketball News Crawler - Requirements

## Overview
A comprehensive basketball news aggregation system that automatically crawls and collects basketball-related content from multiple social media platforms (Threads, X/Twitter, Instagram) and sports news websites, with configurable sources and local database storage.

---

## Functional Requirements

### FR-1: Multi-Source Crawling (Account-Based)
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.1 | Support crawling from Threads accounts | High | System fetches posts from configured Threads account list |
| FR-1.2 | Support crawling from X (Twitter) accounts | High | System fetches tweets from configured Twitter account list |
| FR-1.3 | Support crawling from Instagram accounts | Medium | System fetches posts from configured Instagram account list |
| FR-1.4 | Support crawling from sports news websites | High | System can parse articles from configured website URLs (RSS or HTML) |
| FR-1.5 | Support adding new sources/accounts without code changes | High | New accounts/URLs can be added via configuration file (JSON) |

> **Note**: Social media crawling follows an **Account-Based** approach. The system fetches posts from a curated list of trusted accounts (e.g., @wojespn, @ShamsCharania) rather than searching the entire platform for keywords.

### FR-2: Configurable Source Management
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.1 | Provide a JSON-based source configuration file | High | Sources defined in `config/sources.json` with account lists and website URLs |
| FR-2.2 | Support enabling/disabling individual sources | Medium | Each source has an `enabled` flag in configuration |
| FR-2.3 | Support source-specific crawl intervals | Medium | Each source can define its own crawl frequency |
| FR-2.4 | Support managing account lists per platform | High | Each social media platform has its own list of accounts to follow |
| FR-2.5 | Support website-specific selectors | Medium | Each website can define CSS selectors or RSS feed URL for parsing |

### FR-3: Crawl Execution Modes
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.1 | Support manual crawl trigger via CLI | High | User can run `npm run crawl` or similar command to trigger immediate crawl |
| FR-3.2 | Support automatic scheduled crawling | High | System can run in daemon mode with cron-based scheduling |
| FR-3.3 | Support crawling specific sources on-demand | Medium | User can specify source name(s) to crawl: `npm run crawl -- --source twitter` |
| FR-3.4 | Provide crawl status and progress output | Medium | CLI displays progress, success/failure counts during crawl |

### FR-4: Data Storage
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-4.1 | Store crawled data in local LowDB (JSON) database | High | All articles stored in `data/db.json` with proper structure |
| FR-4.2 | Prevent duplicate entries | High | Same article from same source is not stored twice (deduplication by URL/ID) |
| FR-4.3 | Store article metadata | High | Each entry includes: title, content, source, URL, author, published date, crawled date |
| FR-4.4 | Support content categorization | Medium | Articles can be tagged with categories (NBA, WNBA, College, International) |

### FR-5: Data Management
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-5.1 | Provide CLI command to view stored articles | Medium | `npm run list` shows recent articles in table format |
| FR-5.2 | Provide CLI command to search articles | Medium | `npm run search -- --keyword "Lakers"` filters stored articles |
| FR-5.3 | Support data export to JSON | Low | `npm run export` exports all data to JSON file |
| FR-5.4 | Support database cleanup/pruning | Low | `npm run cleanup` removes articles older than configurable days |

---

## Non-Functional Requirements

### NFR-1: Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Single source crawl completion time | < 30 seconds |
| NFR-1.2 | Full crawl cycle (all sources) | < 5 minutes |
| NFR-1.3 | Database query response time | < 100ms for standard queries |

### NFR-2: Reliability
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-2.1 | Graceful handling of source failures | System continues with other sources if one fails |
| NFR-2.2 | Retry mechanism for failed requests | 3 retries with exponential backoff |
| NFR-2.3 | Comprehensive error logging | All errors logged with timestamp, source, and stack trace |

### NFR-3: Configurability
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | No code changes for adding sources | Configuration-driven source management |
| NFR-3.2 | Environment-based settings | API keys and sensitive data in `.env` |

### NFR-4: Security
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-4.1 | Secure credential storage | API keys stored in environment variables, not code |
| NFR-4.2 | Rate limit compliance | Respect platform rate limits to avoid bans |

---

## Constraints

| ID | Constraint | Description |
|----|------------|-------------|
| C-1 | Local-only operation | System runs on local machine, no cloud deployment required |
| C-2 | LowDB database | Must use LowDB (JSON file) for simplicity and human-readability |
| C-3 | Node.js runtime | Built with Node.js and TypeScript |
| C-4 | Platform API limitations | Social media crawling limited by platform API access/restrictions |

---

## Assumptions

| ID | Assumption |
|----|------------|
| A-1 | User has Node.js v18+ installed |
| A-2 | User may need to obtain API keys for social media platforms |
| A-3 | Some platforms may require alternative scraping approaches if API is restricted |
| A-4 | Internet connection available during crawl operations |

---

## Out of Scope (v1.0)

- Web-based user interface
- Push notifications
- Cloud storage integration
- Multi-user support
- Real-time streaming
- Sentiment analysis
- Translation services
