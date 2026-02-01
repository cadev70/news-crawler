/**
 * Sanitizer Utility
 * Clean article text fields by removing unwanted whitespace and characters
 */

import type { Article } from '../models/article.js';
import type { SanitizationConfig } from '../config/types.js';
import { log } from './logger.js';

/**
 * Result of sanitizing a single article
 */
export interface SanitizationResult {
    article: Article;
    fieldsModified: string[];
}

/**
 * Get default sanitization configuration
 */
export function getDefaultConfig(): SanitizationConfig {
    return {
        trimWhitespace: true,
        preserveParagraphs: true
    };
}

/**
 * Sanitize content field preserving paragraph breaks
 */
function sanitizeContent(content: string, config: SanitizationConfig): string {
    let result = content;

    if (config.trimWhitespace) {
        // Trim leading and trailing whitespace
        result = result.trim();
    }

    if (config.preserveParagraphs) {
        // Normalize excessive newlines to double newlines (paragraph breaks)
        result = result.replace(/\n{3,}/g, '\n\n');
    } else {
        // Collapse all whitespace including newlines to single space
        result = result.replace(/\s+/g, ' ').trim();
    }

    return result;
}

/**
 * Sanitize a single article's text fields
 */
export function sanitizeArticle(
    article: Article,
    config?: Partial<SanitizationConfig>
): SanitizationResult {
    const fullConfig = { ...getDefaultConfig(), ...config };
    const fieldsModified: string[] = [];

    // Create a copy to avoid mutating the original
    const sanitized: Article = { ...article };

    // Sanitize title (Requirement 1.1)
    if (fullConfig.trimWhitespace && sanitized.title !== sanitized.title.trim()) {
        sanitized.title = sanitized.title.trim();
        fieldsModified.push('title');
    }

    // Sanitize content (Requirements 1.2, 1.5)
    const originalContent = sanitized.content;
    sanitized.content = sanitizeContent(sanitized.content, fullConfig);
    if (sanitized.content !== originalContent) {
        fieldsModified.push('content');
    }

    // Sanitize author (Requirement 1.3)
    if (sanitized.author !== undefined) {
        const trimmedAuthor = fullConfig.trimWhitespace ? sanitized.author.trim() : sanitized.author;
        if (trimmedAuthor !== sanitized.author) {
            sanitized.author = trimmedAuthor;
            fieldsModified.push('author');
        }
    }

    // Sanitize sourceUrl (Requirement 1.4)
    if (fullConfig.trimWhitespace && sanitized.sourceUrl !== sanitized.sourceUrl.trim()) {
        sanitized.sourceUrl = sanitized.sourceUrl.trim();
        fieldsModified.push('sourceUrl');
    }

    // Log warning if fields are empty after sanitization
    if (sanitized.title === '' || sanitized.content === '') {
        log.warn(`Article ${sanitized.id} has empty title or content after sanitization`, {
            emptyTitle: sanitized.title === '',
            emptyContent: sanitized.content === ''
        });
    }

    return {
        article: sanitized,
        fieldsModified
    };
}

/**
 * Sanitize multiple articles
 */
export function sanitizeArticles(
    articles: Article[],
    config?: Partial<SanitizationConfig>
): SanitizationResult[] {
    return articles.map(article => sanitizeArticle(article, config));
}
