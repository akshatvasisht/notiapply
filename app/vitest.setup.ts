import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
});

// Mock Tauri APIs if needed
global.window = global.window || ({} as any);

// Mock getUserConfig for all tests
vi.mock('./lib/db', async () => {
    const actual = await vi.importActual('./lib/db');
    return {
        ...actual,
        getUserConfig: vi.fn().mockResolvedValue({
            llm_provider: 'gemini',
            llm_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            llm_api_key: 'test-key',
            llm_model: 'gemini-1.5-flash',
        }),
    };
});
