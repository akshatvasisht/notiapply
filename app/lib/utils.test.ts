import { describe, it, expect } from 'vitest';
import { timeAgo, formatSalary } from './utils';

describe('timeAgo', () => {
    it('formats minutes correctly', () => {
        const date = new Date(Date.now() - 5 * 60000).toISOString();
        expect(timeAgo(date)).toBe('5m ago');
    });

    it('formats hours correctly', () => {
        const date = new Date(Date.now() - 3 * 60 * 60000).toISOString();
        expect(timeAgo(date)).toBe('3h ago');
    });

    it('formats days correctly', () => {
        const date = new Date(Date.now() - 48 * 60 * 60000).toISOString();
        expect(timeAgo(date)).toBe('2d ago');
    });

    it('handles future dates gracefully', () => {
        const date = new Date(Date.now() + 60000).toISOString();
        expect(timeAgo(date)).toBe('Just now');
    });
});

describe('formatSalary', () => {
    it('formats min and max range', () => {
        expect(formatSalary(120000, 150000)).toBe('$120k–$150k');
    });

    it('formats only min', () => {
        expect(formatSalary(100000, null)).toBe('$100k');
    });

    it('formats only max', () => {
        expect(formatSalary(null, 200000)).toBe('$200k');
    });

    it('returns empty string if both null', () => {
        expect(formatSalary(null, null)).toBe('');
    });
});
