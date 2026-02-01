/**
 * Sanitizer Utility Tests
 * TDD: Tests for article sanitization functions (Task 2.1, 2.2, 6.1, 6.2)
 */

import { sanitizeArticle, sanitizeArticles, getDefaultConfig } from '../../src/utils/sanitizer.js';
import type { Article } from '../../src/models/article.js';

// Helper to create a mock article
function createMockArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'test-id-123',
        title: 'Test Article',
        content: 'Test content',
        source: 'website',
        sourceUrl: 'https://example.com/article',
        crawledAt: new Date().toISOString(),
        tags: [],
        metadata: {},
        ...overrides
    };
}

describe('Sanitizer Utility', () => {
    describe('getDefaultConfig', () => {
        it('should return default configuration with trim enabled and preserve paragraphs enabled', () => {
            const config = getDefaultConfig();

            expect(config.trimWhitespace).toBe(true);
            expect(config.preserveParagraphs).toBe(true);
        });
    });

    describe('sanitizeArticle', () => {
        // Requirement 1.1: Remove leading/trailing whitespace from title
        describe('title sanitization', () => {
            it('should remove leading whitespace from title', () => {
                const article = createMockArticle({ title: '   Leading spaces' });
                const result = sanitizeArticle(article);

                expect(result.article.title).toBe('Leading spaces');
                expect(result.fieldsModified).toContain('title');
            });

            it('should remove trailing whitespace from title', () => {
                const article = createMockArticle({ title: 'Trailing spaces   ' });
                const result = sanitizeArticle(article);

                expect(result.article.title).toBe('Trailing spaces');
                expect(result.fieldsModified).toContain('title');
            });

            it('should remove both leading and trailing whitespace from title', () => {
                const article = createMockArticle({ title: '  Both sides  ' });
                const result = sanitizeArticle(article);

                expect(result.article.title).toBe('Both sides');
            });

            it('should not modify title that has no whitespace to trim', () => {
                const article = createMockArticle({ title: 'Clean title' });
                const result = sanitizeArticle(article);

                expect(result.article.title).toBe('Clean title');
                expect(result.fieldsModified).not.toContain('title');
            });
        });

        // Requirement 1.2: Remove leading/trailing whitespace from content
        describe('content sanitization', () => {
            it('should remove leading whitespace from content', () => {
                const article = createMockArticle({ content: '   Leading content' });
                const result = sanitizeArticle(article);

                expect(result.article.content).toBe('Leading content');
                expect(result.fieldsModified).toContain('content');
            });

            it('should remove trailing whitespace from content', () => {
                const article = createMockArticle({ content: 'Trailing content   ' });
                const result = sanitizeArticle(article);

                expect(result.article.content).toBe('Trailing content');
            });
        });

        // Requirement 1.3: Remove leading/trailing whitespace from author
        describe('author sanitization', () => {
            it('should remove leading and trailing whitespace from author', () => {
                const article = createMockArticle({ author: '  John Doe  ' });
                const result = sanitizeArticle(article);

                expect(result.article.author).toBe('John Doe');
                expect(result.fieldsModified).toContain('author');
            });

            it('should handle undefined author gracefully', () => {
                const article = createMockArticle({ author: undefined });
                const result = sanitizeArticle(article);

                expect(result.article.author).toBeUndefined();
                expect(result.fieldsModified).not.toContain('author');
            });
        });

        // Requirement 1.4: Remove leading/trailing whitespace from sourceUrl
        describe('sourceUrl sanitization', () => {
            it('should remove leading and trailing whitespace from sourceUrl', () => {
                const article = createMockArticle({ sourceUrl: '  https://example.com  ' });
                const result = sanitizeArticle(article);

                expect(result.article.sourceUrl).toBe('https://example.com');
                expect(result.fieldsModified).toContain('sourceUrl');
            });
        });

        // Requirement 1.5: Preserve paragraph breaks in content
        describe('paragraph preservation', () => {
            it('should preserve single newlines (paragraph breaks) in content', () => {
                const article = createMockArticle({
                    content: '  Paragraph one.\n\nParagraph two.\n\nParagraph three.  '
                });
                const result = sanitizeArticle(article);

                expect(result.article.content).toBe('Paragraph one.\n\nParagraph two.\n\nParagraph three.');
            });

            it('should preserve single newlines within content', () => {
                const article = createMockArticle({
                    content: 'Line one\nLine two\nLine three'
                });
                const result = sanitizeArticle(article);

                expect(result.article.content).toBe('Line one\nLine two\nLine three');
            });

            it('should normalize excessive newlines to double newlines', () => {
                const article = createMockArticle({
                    content: 'Paragraph one.\n\n\n\nParagraph two.'
                });
                const result = sanitizeArticle(article);

                expect(result.article.content).toBe('Paragraph one.\n\nParagraph two.');
            });
        });

        // Requirement 4.1, 4.2, 4.3: Configurable sanitization
        describe('configuration handling', () => {
            it('should apply default configuration when none specified', () => {
                const article = createMockArticle({ title: '  Test  ' });
                const result = sanitizeArticle(article);

                expect(result.article.title).toBe('Test');
            });

            it('should skip whitespace trimming when disabled in config', () => {
                const article = createMockArticle({ title: '  Test  ' });
                const result = sanitizeArticle(article, { trimWhitespace: false });

                expect(result.article.title).toBe('  Test  ');
                expect(result.fieldsModified).not.toContain('title');
            });

            it('should not normalize newlines when preserveParagraphs is disabled', () => {
                const article = createMockArticle({
                    content: 'Line one\n\n\n\nLine two'
                });
                const result = sanitizeArticle(article, { preserveParagraphs: false });

                // When preserveParagraphs is disabled, excessive newlines are collapsed to single space
                expect(result.article.content).toBe('Line one Line two');
            });
        });

        // Invariants: id and source should never be modified
        describe('invariants', () => {
            it('should never modify article id', () => {
                const article = createMockArticle({ id: 'original-id' });
                const result = sanitizeArticle(article);

                expect(result.article.id).toBe('original-id');
            });

            it('should never modify article source', () => {
                const article = createMockArticle({ source: 'twitter' });
                const result = sanitizeArticle(article);

                expect(result.article.source).toBe('twitter');
            });
        });
    });

    describe('sanitizeArticles', () => {
        it('should sanitize multiple articles', () => {
            const articles = [
                createMockArticle({ title: '  Article 1  ' }),
                createMockArticle({ title: '  Article 2  ' })
            ];

            const results = sanitizeArticles(articles);

            expect(results).toHaveLength(2);
            expect(results[0].article.title).toBe('Article 1');
            expect(results[1].article.title).toBe('Article 2');
        });

        it('should apply same configuration to all articles', () => {
            const articles = [
                createMockArticle({ title: '  Article 1  ' }),
                createMockArticle({ title: '  Article 2  ' })
            ];

            const results = sanitizeArticles(articles, { trimWhitespace: false });

            expect(results[0].article.title).toBe('  Article 1  ');
            expect(results[1].article.title).toBe('  Article 2  ');
        });

        it('should return empty array for empty input', () => {
            const results = sanitizeArticles([]);

            expect(results).toHaveLength(0);
        });
    });
});
