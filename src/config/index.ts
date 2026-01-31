/**
 * Configuration Loader
 * Loads and validates source configuration from config/sources.json
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceConfig, PlatformConfig, WebsiteConfig, ValidationResult } from './types.js';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Default configuration path
const DEFAULT_CONFIG_PATH = join(PROJECT_ROOT, 'config', 'sources.json');

/**
 * Load configuration from file
 */
export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): SourceConfig {
    if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as SourceConfig;

        // Validate configuration
        const validation = validateConfig(config);
        if (!validation.valid) {
            throw new Error(`Invalid configuration:\n${validation.errors.join('\n')}`);
        }

        return config;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON in configuration file: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Validate platform configuration
 */
function validatePlatformConfig(name: string, config: PlatformConfig): string[] {
    const errors: string[] = [];

    if (typeof config.enabled !== 'boolean') {
        errors.push(`${name}.enabled must be a boolean`);
    }

    if (typeof config.crawlIntervalMinutes !== 'number' || config.crawlIntervalMinutes < 1) {
        errors.push(`${name}.crawlIntervalMinutes must be a positive number`);
    }

    if (!Array.isArray(config.accounts)) {
        errors.push(`${name}.accounts must be an array`);
    } else {
        config.accounts.forEach((account, index) => {
            if (typeof account !== 'string' || account.trim() === '') {
                errors.push(`${name}.accounts[${index}] must be a non-empty string`);
            }
        });
    }

    return errors;
}

/**
 * Validate website configuration
 */
function validateWebsiteConfig(config: WebsiteConfig): string[] {
    const errors: string[] = [];

    if (typeof config.enabled !== 'boolean') {
        errors.push('websites.enabled must be a boolean');
    }

    if (typeof config.crawlIntervalMinutes !== 'number' || config.crawlIntervalMinutes < 1) {
        errors.push('websites.crawlIntervalMinutes must be a positive number');
    }

    if (!Array.isArray(config.sources)) {
        errors.push('websites.sources must be an array');
    } else {
        config.sources.forEach((source, index) => {
            const prefix = `websites.sources[${index}]`;

            if (typeof source.name !== 'string' || source.name.trim() === '') {
                errors.push(`${prefix}.name must be a non-empty string`);
            }

            if (typeof source.url !== 'string' || !source.url.startsWith('http')) {
                errors.push(`${prefix}.url must be a valid URL`);
            }

            if (source.type !== 'rss' && source.type !== 'html') {
                errors.push(`${prefix}.type must be 'rss' or 'html'`);
            }

            if (source.type === 'rss' && (!source.feedUrl || !source.feedUrl.startsWith('http'))) {
                errors.push(`${prefix}.feedUrl is required for RSS type and must be a valid URL`);
            }

            if (source.type === 'html' && !source.selectors) {
                errors.push(`${prefix}.selectors is required for HTML type`);
            }

            if (source.type === 'html' && source.selectors) {
                if (!source.selectors.article) {
                    errors.push(`${prefix}.selectors.article is required`);
                }
                if (!source.selectors.title) {
                    errors.push(`${prefix}.selectors.title is required`);
                }
                if (!source.selectors.link) {
                    errors.push(`${prefix}.selectors.link is required`);
                }
            }
        });
    }

    return errors;
}

/**
 * Validate complete configuration
 */
export function validateConfig(config: SourceConfig): ValidationResult {
    const errors: string[] = [];

    // Validate required properties exist
    if (!config.twitter) {
        errors.push('twitter configuration is required');
    } else {
        errors.push(...validatePlatformConfig('twitter', config.twitter));
    }

    if (!config.instagram) {
        errors.push('instagram configuration is required');
    } else {
        errors.push(...validatePlatformConfig('instagram', config.instagram));
    }

    if (!config.threads) {
        errors.push('threads configuration is required');
    } else {
        errors.push(...validatePlatformConfig('threads', config.threads));
    }

    if (!config.websites) {
        errors.push('websites configuration is required');
    } else {
        errors.push(...validateWebsiteConfig(config.websites));
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get enabled sources from configuration
 */
export function getEnabledSources(config: SourceConfig): ArticleSource[] {
    const sources: ArticleSource[] = [];

    if (config.twitter.enabled && config.twitter.accounts.length > 0) {
        sources.push('twitter');
    }

    if (config.instagram.enabled && config.instagram.accounts.length > 0) {
        sources.push('instagram');
    }

    if (config.threads.enabled && config.threads.accounts.length > 0) {
        sources.push('threads');
    }

    if (config.websites.enabled && config.websites.sources.length > 0) {
        sources.push('website');
    }

    return sources;
}

// Type alias for ArticleSource
type ArticleSource = 'twitter' | 'instagram' | 'threads' | 'website';

// Re-export types
export type { SourceConfig, PlatformConfig, WebsiteConfig, WebsiteSource, HTMLSelectors } from './types.js';
