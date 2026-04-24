import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

afterEach(() => {
    cleanup();
});

// Ensure window is defined in the JSDOM test environment
global.window = global.window || (global as unknown as { window: Window }).window;

// Mock getUserConfig for all tests
vi.mock('./lib/db', async () => {
    const actual = await vi.importActual('./lib/db');
    return {
        ...actual,
        getUserConfig: vi.fn().mockResolvedValue({
            llm_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            llm_api_key: 'test-key',
            llm_model: 'gemini-1.5-flash',
        }),
    };
});

// ─── Global component mocks ──────────────────────────────────────────────────

vi.mock('next/image', () => ({
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) =>
        React.createElement('img', { src, alt, ...props }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
