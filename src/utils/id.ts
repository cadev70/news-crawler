/**
 * ID Utility
 * Functions for generating unique identifiers
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';

/**
 * Generate a UUID v4
 */
export function generateId(): string {
    return uuidv4();
}

/**
 * Generate a deterministic ID from a URL
 * Useful for deduplication - same URL always generates same ID
 */
export function generateUrlHash(url: string): string {
    return createHash('sha256')
        .update(url.toLowerCase().trim())
        .digest('hex')
        .substring(0, 16);
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 8);
}

/**
 * Generate a timestamp-based ID
 * Format: timestamp-random
 */
export function generateTimestampId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
