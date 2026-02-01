/**
 * Article Model
 * Represents a news article or social media post
 */

import type { ArticleSource } from '../config/types.js';

export interface Article {
    /** Unique identifier (UUID or hash of URL) */
    id: string;

    /** Article title or post headline */
    title: string;

    /** Full content of the article/post */
    content: string;

    /** Short summary (first 200 chars or excerpt) */
    summary?: string;

    /** Source platform */
    source: ArticleSource;

    /** Original URL of the article/post */
    sourceUrl: string;

    /** Author name or handle */
    author?: string;

    /** Author's profile URL */
    authorUrl?: string;

    /** Featured image URL */
    imageUrl?: string;

    /** Original publication date */
    publishedAt?: string;

    /** When the article was crawled */
    crawledAt: string;

    /** Tags for categorization */
    tags: string[];

    /** Platform-specific metadata */
    metadata: Record<string, unknown>;

    /** Full extracted article content (clean plain text from source URL) */
    fullContent?: string | null;

    /** Timestamp when fullContent was fetched */
    fullContentFetchedAt?: string | null;

    /** AI-generated summary of the article */
    aiSummary?: string | null;
}

/**
 * Create a summary from content
 */
export function createSummary(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
        return content;
    }

    // Find the last complete word within maxLength
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
        return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
}

/**
 * Create a new article with defaults
 */
export function createArticle(partial: Partial<Article> & Pick<Article, 'id' | 'title' | 'content' | 'source' | 'sourceUrl'>): Article {
    return {
        ...partial,
        summary: partial.summary ?? createSummary(partial.content),
        crawledAt: partial.crawledAt ?? new Date().toISOString(),
        tags: partial.tags ?? [],
        metadata: partial.metadata ?? {}
    };
}
