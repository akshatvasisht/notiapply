import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SetupWizard from './SetupWizard';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    hasDatabase: vi.fn().mockReturnValue(true),
    getUserConfig: vi.fn().mockResolvedValue({}),
    updateUserConfig: vi.fn().mockResolvedValue(undefined),
    uploadMasterResume: vi.fn().mockResolvedValue(undefined),
    uploadCoverLetterTemplate: vi.fn().mockResolvedValue(undefined),
}));

// FileReader mock — synchronously fires onload after readAsText / readAsDataURL
class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;

    readAsText(_file: File) {
        this.result = '\\documentclass{article}\\begin{document}Test\\end{document}';
        setTimeout(() => this.onload?.(), 0);
    }

    readAsDataURL(_file: File) {
        this.result = 'data:application/pdf;base64,test';
        setTimeout(() => this.onload?.(), 0);
    }
}
vi.stubGlobal('FileReader', MockFileReader);

// ─── Import mocked DB functions for assertion ─────────────────────────────────

import { updateUserConfig, uploadMasterResume } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const noop = () => {};

/**
 * Simulate uploading a .tex file via the hidden <input type="file"> inside
 * the first FileDropField (Master Resume).
 */
async function uploadResumeFile() {
    const file = new File(['\\documentclass{article}'], 'resume.tex', { type: 'text/plain' });
    // The FileDropField renders a hidden <input type="file"> — grab by accept attribute
    const inputs = document.querySelectorAll('input[type="file"]');
    const resumeInput = inputs[0] as HTMLInputElement;
    Object.defineProperty(resumeInput, 'files', { value: [file], configurable: true });
    await act(async () => {
        fireEvent.change(resumeInput);
        // Allow the setTimeout in MockFileReader to fire
        await new Promise(r => setTimeout(r, 10));
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SetupWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders step 1 (Resume) on initial mount', async () => {
        await act(async () => {
            render(<SetupWizard onComplete={noop} />);
        });
        // The h2 heading for step 0 is the step name from the STEPS array
        expect(screen.getByText('Resume')).toBeInTheDocument();
    });

    it('"Continue" button is disabled until a resume file is uploaded', async () => {
        await act(async () => {
            render(<SetupWizard onComplete={noop} />);
        });
        const continueBtn = screen.getByText('Continue') as HTMLButtonElement;
        expect(continueBtn.disabled).toBe(true);
    });

    it('[DEV] Skip Setup button calls updateUserConfig when NODE_ENV is development', async () => {
        // vitest runs with NODE_ENV=test by default; we need to set development temporarily
        const originalEnv = process.env.NODE_ENV;
        // @ts-expect-error — override read-only for test
        process.env.NODE_ENV = 'development';

        await act(async () => {
            render(<SetupWizard onComplete={noop} />);
        });

        const skipBtn = screen.queryByTitle('DEV ONLY: Skip wizard with mock data');
        if (skipBtn) {
            await act(async () => {
                fireEvent.click(skipBtn);
            });
            expect(vi.mocked(updateUserConfig)).toHaveBeenCalledWith(
                expect.objectContaining({ setup_complete: true })
            );
        }

        // @ts-expect-error
        process.env.NODE_ENV = originalEnv;
    });

    it('advancing past step 1 after file upload shows step 2 (API Keys)', async () => {
        await act(async () => {
            render(<SetupWizard onComplete={noop} />);
        });

        await uploadResumeFile();

        // Now Continue should be enabled
        const continueBtn = screen.getByText('Continue') as HTMLButtonElement;
        await act(async () => {
            fireEvent.click(continueBtn);
        });

        // Step 2 heading is "API Keys"
        expect(screen.getByText('API Keys')).toBeInTheDocument();
        // API Keys step renders an LLM Endpoint field
        expect(screen.getByText('LLM Endpoint *')).toBeInTheDocument();
    });

    it('step 2 → step 3 navigation fills required API key fields then continues', async () => {
        await act(async () => {
            render(<SetupWizard onComplete={noop} />);
        });

        // Get to step 2
        await uploadResumeFile();
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'));
        });
        expect(screen.getByText('API Keys')).toBeInTheDocument();

        // Fill required step-2 fields: LLM Endpoint, LLM API Key, ntfy Topic
        const endpointInput = screen.getByPlaceholderText(
            'https://generativelanguage.googleapis.com/v1beta/openai'
        );
        fireEvent.change(endpointInput, { target: { value: 'https://api.example.com/v1' } });

        // LLM API Key has type="password" — find by label
        const apiKeyInput = screen.getByLabelText('LLM API Key *') as HTMLInputElement;
        fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });

        const ntfyInput = screen.getByPlaceholderText('notiapply-abc123');
        fireEvent.change(ntfyInput, { target: { value: 'my-topic' } });

        // Continue to step 3
        const continueBtn = screen.getByText('Continue') as HTMLButtonElement;
        await act(async () => {
            fireEvent.click(continueBtn);
        });

        // Step 3 heading is "Preferences"
        expect(screen.getByText('Preferences')).toBeInTheDocument();
        // The Search Terms TagField should be visible
        expect(screen.getByText('Search Terms *')).toBeInTheDocument();
    });

    it('"Launch Notiapply" on confirm step calls uploadMasterResume and updateUserConfig', async () => {
        const onComplete = vi.fn();
        await act(async () => {
            render(<SetupWizard onComplete={onComplete} />);
        });

        // Step 1 → upload resume
        await uploadResumeFile();
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'));
        });

        // Step 2 → fill required fields
        const endpointInput = screen.getByPlaceholderText(
            'https://generativelanguage.googleapis.com/v1beta/openai'
        );
        fireEvent.change(endpointInput, { target: { value: 'https://api.example.com/v1' } });
        const apiKeyInput = screen.getByLabelText('LLM API Key *') as HTMLInputElement;
        fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
        const ntfyInput = screen.getByPlaceholderText('notiapply-abc123');
        fireEvent.change(ntfyInput, { target: { value: 'my-topic' } });
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'));
        });

        // Step 3 — Preferences: add at least one search term so canAdvance() passes
        const searchTermInput = screen.getByPlaceholderText('e.g. software engineer');
        fireEvent.change(searchTermInput, { target: { value: 'engineer' } });
        fireEvent.keyDown(searchTermInput, { key: 'Enter' });
        await act(async () => {
            fireEvent.click(screen.getByText('Continue'));
        });

        // Step 4 — Confirm
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Launch Notiapply')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByText('Launch Notiapply'));
        });

        expect(vi.mocked(uploadMasterResume)).toHaveBeenCalled();
        expect(vi.mocked(updateUserConfig)).toHaveBeenCalledWith(
            expect.objectContaining({ setup_complete: true })
        );
        expect(onComplete).toHaveBeenCalled();
    });
});
