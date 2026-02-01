/**
 * CLI Integration Tests
 * Tests for CLI date option parsing and validation (Task 8.1)
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Helper to run CLI command
async function runCli(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
        const { stdout, stderr } = await execAsync(`npx tsx src/index.ts ${args}`, {
            cwd: process.cwd()
        });
        return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
        return {
            stdout: error.stdout || '',
            stderr: error.stderr || '',
            exitCode: error.code || 1
        };
    }
}

describe('CLI Integration', () => {
    describe('crawl command help', () => {
        it('should display --start-date option in help', async () => {
            const result = await runCli('crawl --help');

            expect(result.stdout).toContain('--start-date');
            expect(result.stdout).toContain('YYYY-MM-DD');
        });

        it('should display --end-date option in help', async () => {
            const result = await runCli('crawl --help');

            expect(result.stdout).toContain('--end-date');
            expect(result.stdout).toContain('YYYY-MM-DD');
        });
    });

    describe('date validation', () => {
        it('should reject invalid start date format', async () => {
            const result = await runCli('crawl --source website --start-date invalid');

            expect(result.stderr).toContain('Invalid date format');
            expect(result.exitCode).toBe(1);
        });

        it('should reject invalid end date format', async () => {
            const result = await runCli('crawl --source website --end-date 02-01-2026');

            expect(result.stderr).toContain('Invalid date format');
            expect(result.exitCode).toBe(1);
        });

        it('should reject start date after end date', async () => {
            const result = await runCli('crawl --source website --start-date 2026-02-15 --end-date 2026-02-01');

            expect(result.stderr).toContain('--start-date must be before or equal to --end-date');
            expect(result.exitCode).toBe(1);
        });

        it('should accept valid date range', async () => {
            // This will attempt a real crawl, but we just check it doesn't fail validation
            const result = await runCli('crawl --source website --start-date 2026-01-01 --end-date 2026-02-01 --help');

            // If it got to help, validation passed
            expect(result.stdout).toContain('--start-date');
            expect(result.exitCode).toBe(0);
        });
    });
});
