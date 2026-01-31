/**
 * Configuration Types for Basketball News Crawler
 */

// Source types
export type ArticleSource = 'twitter' | 'instagram' | 'threads' | 'website';

// Platform configuration (Twitter, Instagram, Threads)
export interface PlatformConfig {
    enabled: boolean;
    crawlIntervalMinutes: number;
    accounts: string[];
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
