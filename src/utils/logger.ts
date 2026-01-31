/**
 * Logger Utility
 * Winston-based logging with console and file transports
 */

import winston from 'winston';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Logs directory
const LOGS_DIR = join(PROJECT_ROOT, 'logs');

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
}

// Log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom format for console
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// Custom format for file
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        // File transport - all logs
        new winston.transports.File({
            filename: join(LOGS_DIR, 'crawler.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // File transport - errors only
        new winston.transports.File({
            filename: join(LOGS_DIR, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Export logger instance
export default logger;

// Export convenience methods
export const log = {
    info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
    error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
    verbose: (message: string, meta?: Record<string, unknown>) => logger.verbose(message, meta)
};
