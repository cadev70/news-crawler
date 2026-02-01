/**
 * Configuration Types for Basketball News Crawler
 */

// Source types
export type ArticleSource = 'twitter' | 'instagram' | 'threads' | 'website';

// Sanitization configuration
export interface SanitizationConfig {
    /** Enable/disable trimming of whitespace */
    trimWhitespace: boolean;
    /** Enable/disable preserving paragraph breaks */
    preserveParagraphs: boolean;
}

// Platform configuration (Twitter, Instagram, Threads)
export interface PlatformConfig {
    enabled: boolean;
    crawlIntervalMinutes: number;
    accounts: string[];
    /** Optional per-source sanitization configuration */
    sanitization?: Partial<SanitizationConfig>;
}

// HTML selectors for website scraping
export interface HTMLSelectors {
    article: string;
    title: string;
    link: string;
    content?: string;
    date?: string;
    author?: string;
}

// Website source definition
export interface WebsiteSource {
    name: string;
    url: string;
    type: 'rss' | 'html';
    feedUrl?: string;           // For RSS type
    selectors?: HTMLSelectors;  // For HTML type
    /** Optional per-source sanitization configuration */
    sanitization?: Partial<SanitizationConfig>;
}

// Website configuration
export interface WebsiteConfig {
    enabled: boolean;
    crawlIntervalMinutes: number;
    sources: WebsiteSource[];
}

// Complete source configuration
export interface SourceConfig {
    twitter: PlatformConfig;
    instagram: PlatformConfig;
    threads: PlatformConfig;
    websites: WebsiteConfig;
}

// Validation result
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
