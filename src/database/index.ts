/**
 * LowDB Database Setup
 * Singleton pattern for database access
 */

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import type { Article } from '../models/article.js';
import type { CrawlHistory } from '../models/crawl-history.js';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Default database path
const DEFAULT_DB_PATH = process.env.DB_PATH || join(PROJECT_ROOT, 'data', 'db.json');

/**
 * Database schema
 */
export interface Database {
    articles: Article[];
    crawlHistory: CrawlHistory[];
    metadata: {
        version: string;
        createdAt: string;
        lastCrawledAt?: string;
    };
}

/**
 * Default data for new database
 */
const defaultData: Database = {
    articles: [],
    crawlHistory: [],
    metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString()
    }
};

// Singleton instance
let db: Low<Database> | null = null;

/**
 * Initialize and return database instance
 */
export async function initDatabase(dbPath: string = DEFAULT_DB_PATH): Promise<Low<Database>> {
    if (db) {
        return db;
    }

    // Ensure data directory exists
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    // Create adapter and database
    const adapter = new JSONFile<Database>(dbPath);
    db = new Low<Database>(adapter, defaultData);

    // Read existing data or initialize with defaults
    await db.read();

    // Ensure all required properties exist (schema migration)
    if (!db.data.articles) {
        db.data.articles = [];
    }
    if (!db.data.crawlHistory) {
        db.data.crawlHistory = [];
    }
    if (!db.data.metadata) {
        db.data.metadata = {
            version: '1.0.0',
            createdAt: new Date().toISOString()
        };
    }

    return db;
}

/**
 * Get database instance (must call initDatabase first)
 */
export function getDatabase(): Low<Database> {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Update last crawled timestamp
 */
export async function updateLastCrawled(): Promise<void> {
    const database = getDatabase();
    database.data.metadata.lastCrawledAt = new Date().toISOString();
    await database.write();
}

/**
 * Reset database (for testing)
 */
export async function resetDatabase(): Promise<void> {
    const database = getDatabase();
    database.data = { ...defaultData, metadata: { ...defaultData.metadata, createdAt: new Date().toISOString() } };
    await database.write();
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    db = null;
}

// Re-export Low type for repositories
export type { Low } from 'lowdb';
