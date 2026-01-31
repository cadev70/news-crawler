# Basketball News Crawler - Implementation Tasks

## Overview

This document outlines the implementation tasks for the Basketball News Crawler. Tasks are organized by phase and include dependencies, complexity, and acceptance criteria.

---

## Task Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Project Setup | 4 tasks | 1 hour |
| 2. Core Infrastructure | 5 tasks | 2 hours |
| 3. Crawler Implementation | 5 tasks | 4 hours |
| 4. CLI & Commands | 4 tasks | 2 hours |
| 5. Scheduler & Automation | 2 tasks | 1 hour |
| 6. Testing & Polish | 3 tasks | 1 hour |
| **Total** | **23 tasks** | **~11 hours** |

---

## Phase 1: Project Setup

### Task 1.1: Initialize Node.js Project
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: None
- **Files**:
  - `package.json`
  - `tsconfig.json`
  - `.gitignore`
  - `.env.example`

**Description**:
Initialize a new Node.js project with TypeScript support.

**Acceptance Criteria**:
- [ ] `package.json` created with name, version, and scripts
- [ ] `tsconfig.json` configured for ES2022, ESM modules
- [ ] `.gitignore` excludes node_modules, data/, logs/, .env
- [ ] `.env.example` with placeholder API keys
- [ ] `engines.node` set to `>=24.0.0`

**Implementation**:
```bash
pnpm init
pnpm add -D typescript tsx @types/node
pnpm exec tsc --init
```

---

### Task 1.2: Install Dependencies
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 1.1

**Description**:
Install all required production and development dependencies.

**Acceptance Criteria**:
- [ ] All dependencies from design.md installed
- [ ] Playwright browsers installed
- [ ] No version conflicts or vulnerabilities

**Implementation**:
```bash
pnpm add playwright commander lowdb node-cron rss-parser uuid winston
pnpm add -D @types/node-cron @types/uuid typescript tsx
pnpm exec playwright install chromium
```

---

### Task 1.3: Create Directory Structure
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 1.1

**Description**:
Create the project directory structure as defined in design.md.

**Acceptance Criteria**:
- [ ] `src/` directory with subdirectories created
- [ ] `config/` directory created
- [ ] `data/` directory created (gitignored except .gitkeep)
- [ ] `logs/` directory created (gitignored except .gitkeep)

**Files to Create**:
```
src/
├── index.ts
├── crawlers/
├── config/
├── database/
│   └── repositories/
├── models/
├── scheduler/
└── utils/
config/
data/.gitkeep
logs/.gitkeep
```

---

### Task 1.4: Create Source Configuration File
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 1.3

**Description**:
Create the initial `config/sources.json` with sample sources.

**Acceptance Criteria**:
- [ ] JSON file with valid structure
- [ ] Sample Twitter accounts configured
- [ ] Sample Instagram accounts configured
- [ ] Sample website sources configured
- [ ] Threads placeholder (disabled by default)

**File**: `config/sources.json`

---

## Phase 2: Core Infrastructure

### Task 2.1: Implement Configuration Loader
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 1.4
- **Files**:
  - `src/config/types.ts`
  - `src/config/index.ts`

**Description**:
Create TypeScript types and configuration loader for sources.json.

**Acceptance Criteria**:
- [ ] TypeScript interfaces for all config types
- [ ] `loadConfig()` function reads and validates sources.json
- [ ] Validation errors throw descriptive messages
- [ ] Environment variables loaded from .env

---

### Task 2.2: Implement LowDB Database Setup
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 1.2
- **Files**:
  - `src/database/index.ts`
  - `src/models/article.ts`
  - `src/models/crawl-history.ts`

**Description**:
Set up LowDB with TypeScript types and singleton pattern.

**Acceptance Criteria**:
- [ ] Database interface with articles, crawlHistory, metadata
- [ ] `initDatabase()` async function creates/loads db.json
- [ ] Default data structure when file doesn't exist
- [ ] TypeScript types for Article and CrawlHistory

---

### Task 2.3: Implement Article Repository
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 2.2
- **Files**:
  - `src/database/repositories/article.ts`

**Description**:
Create data access layer for articles with CRUD operations.

**Acceptance Criteria**:
- [ ] `insert(article)` adds single article
- [ ] `insertMany(articles)` adds multiple articles
- [ ] `findById(id)` returns article or undefined
- [ ] `findByUrl(url)` for deduplication
- [ ] `exists(url)` returns boolean
- [ ] `findBySource(source, limit?)` with sorting
- [ ] `search(keyword)` searches title and content
- [ ] `findRecent(limit)` returns latest articles
- [ ] `deleteOlderThan(date)` for cleanup

---

### Task 2.4: Implement Crawl History Repository
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 2.2
- **Files**:
  - `src/database/repositories/history.ts`

**Description**:
Create data access layer for crawl history tracking.

**Acceptance Criteria**:
- [ ] `insert(history)` logs crawl result
- [ ] `findRecent(limit)` returns latest history
- [ ] `findBySource(source, limit?)` filters by source
- [ ] `getStats()` returns aggregated statistics

---

### Task 2.5: Implement Utility Modules
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 1.2
- **Files**:
  - `src/utils/logger.ts`
  - `src/utils/http.ts`
  - `src/utils/id.ts`

**Description**:
Create shared utility modules for logging, HTTP, and IDs.

**Acceptance Criteria**:
- [ ] Winston logger with console and file transports
- [ ] Log format: timestamp, level, message, metadata
- [ ] Axios client with retry and exponential backoff
- [ ] UUID generator for article IDs
- [ ] URL hash function for deduplication

---

## Phase 3: Crawler Implementation

### Task 3.1: Implement Base Crawler
- [x] **Status**: Complete
- **Complexity**: High
- **Dependencies**: Task 2.3, Task 2.4, Task 2.5
- **Files**:
  - `src/crawlers/base.ts`

**Description**:
Create abstract base class with template method pattern.

**Acceptance Criteria**:
- [ ] Abstract `BaseCrawler` class
- [ ] `crawl()` template method orchestrates flow
- [ ] Abstract `fetchArticles()` for subclasses
- [ ] `filterDuplicates()` checks existing URLs
- [ ] `saveArticles()` persists to database
- [ ] `buildResult()` creates CrawlResult
- [ ] Error handling with logging
- [ ] Crawl history recording

---

### Task 3.2: Implement Twitter Crawler
- [x] **Status**: Complete
- **Complexity**: High
- **Dependencies**: Task 3.1
- **Files**:
  - `src/crawlers/twitter.ts`

**Description**:
Implement Twitter/X crawler using Playwright for scraping account timelines.

**Acceptance Criteria**:
- [ ] Extends BaseCrawler
- [ ] Fetches posts from configured accounts
- [ ] Handles Twitter's dynamic content loading
- [ ] Extracts: text, author, timestamp, URL, media
- [ ] Transforms to Article format
- [ ] Rate limiting between requests
- [ ] Error handling for private/suspended accounts

**Note**: Uses Playwright since Twitter API requires paid access.

---

### Task 3.3: Implement Instagram Crawler
- [x] **Status**: Complete
- **Complexity**: High
- **Dependencies**: Task 3.1
- **Files**:
  - `src/crawlers/instagram.ts`

**Description**:
Implement Instagram crawler using Playwright for public profiles.

**Acceptance Criteria**:
- [ ] Extends BaseCrawler
- [ ] Fetches posts from configured accounts
- [ ] Handles Instagram's dynamic loading
- [ ] Extracts: caption, timestamp, URL, images
- [ ] Transforms to Article format
- [ ] Handles login walls gracefully
- [ ] Rate limiting between requests

---

### Task 3.4: Implement Threads Crawler
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 3.1
- **Files**:
  - `src/crawlers/threads.ts`

**Description**:
Implement Threads crawler (similar pattern to Instagram).

**Acceptance Criteria**:
- [ ] Extends BaseCrawler
- [ ] Fetches posts from configured accounts
- [ ] Uses Playwright for dynamic content
- [ ] Transforms to Article format
- [ ] Disabled by default (platform still maturing)

---

### Task 3.5: Implement Website Crawler
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 3.1
- **Files**:
  - `src/crawlers/website.ts`

**Description**:
Implement website crawler supporting RSS feeds and HTML parsing.

**Acceptance Criteria**:
- [ ] Extends BaseCrawler
- [ ] Supports RSS feed parsing using rss-parser
- [ ] Supports HTML parsing using Playwright
- [ ] Uses configured CSS selectors for HTML mode
- [ ] Extracts: title, content, author, date, URL
- [ ] Transforms to Article format
- [ ] Handles different website structures

---

## Phase 4: CLI & Commands

### Task 4.1: Implement Crawler Orchestrator
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 3.2, Task 3.3, Task 3.4, Task 3.5
- **Files**:
  - `src/crawlers/orchestrator.ts`

**Description**:
Create orchestrator to coordinate multiple crawlers.

**Acceptance Criteria**:
- [ ] `crawlAll()` runs all enabled crawlers
- [ ] `crawlSource(name)` runs specific crawler
- [ ] Parallel execution with concurrency limit
- [ ] Aggregates results from all crawlers
- [ ] Handles individual crawler failures gracefully
- [ ] Reports overall success/failure status

---

### Task 4.2: Implement CLI Entry Point
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 4.1
- **Files**:
  - `src/index.ts`

**Description**:
Create CLI using Commander.js with all commands.

**Acceptance Criteria**:
- [ ] `crawl` command runs all sources
- [ ] `crawl --source <name>` runs specific source
- [ ] `list` command shows recent articles
- [ ] `list --limit <n>` limits output
- [ ] `list --source <name>` filters by source
- [ ] Proper exit codes (0 success, 1 error)
- [ ] Help text for all commands

---

### Task 4.3: Implement Search & Export Commands
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 4.2
- **Files**:
  - `src/index.ts` (extend)

**Description**:
Add search, export, and history commands to CLI.

**Acceptance Criteria**:
- [ ] `search --keyword <term>` searches articles
- [ ] `export` exports all data to JSON file
- [ ] `export --output <path>` custom output path
- [ ] `history` shows recent crawl history
- [ ] `stats` shows crawl statistics
- [ ] Formatted table output for list/history

---

### Task 4.4: Implement Cleanup Command
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 4.2
- **Files**:
  - `src/index.ts` (extend)

**Description**:
Add cleanup command for database maintenance.

**Acceptance Criteria**:
- [ ] `cleanup` removes articles older than 30 days (default)
- [ ] `cleanup --days <n>` custom retention period
- [ ] Confirmation prompt before deletion
- [ ] `cleanup --force` skips confirmation
- [ ] Reports number of deleted articles

---

## Phase 5: Scheduler & Automation

### Task 5.1: Implement Scheduler
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: Task 4.1
- **Files**:
  - `src/scheduler/index.ts`

**Description**:
Create scheduler for automatic crawling using node-cron.

**Acceptance Criteria**:
- [ ] Reads crawl intervals from config
- [ ] Creates cron jobs for each enabled source
- [ ] Logs scheduled job info on startup
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] Handles job execution errors

---

### Task 5.2: Implement Schedule CLI Command
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 5.1
- **Files**:
  - `src/index.ts` (extend)

**Description**:
Add schedule command for daemon mode operation.

**Acceptance Criteria**:
- [ ] `schedule` starts daemon mode
- [ ] Displays active schedules on startup
- [ ] Runs until terminated
- [ ] Logs each scheduled crawl execution
- [ ] Ctrl+C gracefully stops scheduler

---

## Phase 6: Testing & Polish

### Task 6.1: Add pnpm Scripts
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 4.2, Task 5.2
- **Files**:
  - `package.json`

**Description**:
Add convenient pnpm scripts for all operations.

**Acceptance Criteria**:
- [ ] `pnpm crawl` - run crawler
- [ ] `pnpm list` - list articles
- [ ] `pnpm search` - search articles
- [ ] `pnpm export` - export data
- [ ] `pnpm history` - show history
- [ ] `pnpm cleanup` - cleanup old data
- [ ] `pnpm schedule` - start scheduler
- [ ] `pnpm dev` - development mode with tsx

---

### Task 6.2: Create README Documentation
- [x] **Status**: Complete
- **Complexity**: Low
- **Dependencies**: Task 6.1
- **Files**:
  - `README.md`

**Description**:
Create comprehensive project documentation.

**Acceptance Criteria**:
- [ ] Project overview and features
- [ ] Installation instructions
- [ ] Configuration guide (sources.json)
- [ ] CLI command reference
- [ ] Example usage
- [ ] Troubleshooting section

---

### Task 6.3: End-to-End Testing
- [x] **Status**: Complete
- **Complexity**: Medium
- **Dependencies**: All previous tasks

**Description**:
Manual end-to-end testing of all features.

**Acceptance Criteria**:
- [ ] Manual crawl works for all source types
- [ ] Articles stored correctly in db.json
- [ ] List/search/export commands work
- [ ] History tracking accurate
- [ ] Scheduler runs correctly
- [ ] Error handling works as expected
- [ ] Logs written correctly

---

## Implementation Order

```
Phase 1: Project Setup
    1.1 → 1.2 → 1.3 → 1.4
           ↓
Phase 2: Core Infrastructure
    2.1   2.2 → 2.3 → 2.4
     ↓     ↓
    2.5 ←──┘
     ↓
Phase 3: Crawler Implementation
    3.1 → 3.2
      ↓    ↓
    3.3   3.4
      ↓    ↓
    3.5 ←──┘
     ↓
Phase 4: CLI & Commands
    4.1 → 4.2 → 4.3 → 4.4
                 ↓
Phase 5: Scheduler
    5.1 → 5.2
           ↓
Phase 6: Polish
    6.1 → 6.2 → 6.3
```

---

## Quick Start Guide (After Implementation)

```bash
# Install dependencies
pnpm install

# Configure sources
# Edit config/sources.json with your accounts

# Run manual crawl
pnpm crawl

# View articles
pnpm list

# Search articles
pnpm search -- --keyword "Lakers"

# Start automatic scheduler
pnpm schedule

# Export data
pnpm export
```
