import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { LatexUploader } from './LatexUploader';

// sonner and @/lib/logger are globally mocked in vitest.setup.ts.

type UploadFn = (latexSource: string) => Promise<number>;

describe('LatexUploader', () => {
    let onUpload: Mock<UploadFn>;

    beforeEach(() => {
        onUpload = vi.fn<UploadFn>();
    });

    const makeFile = (content: string, name = 'resume.tex'): File => {
        return new File([content], name, { type: 'text/x-tex' });
    };

    it('renders the label and description', () => {
        render(<LatexUploader label="Master Resume" description="LaTeX source" onUpload={onUpload} />);
        expect(screen.getByText('Master Resume')).toBeInTheDocument();
        expect(screen.getByText('LaTeX source')).toBeInTheDocument();
        expect(screen.getByText('No upload this session.')).toBeInTheDocument();
    });

    it('calls onUpload with the file text on successful select', async () => {
        onUpload.mockResolvedValue(42);
        const { container } = render(
            <LatexUploader label="Master Resume" description="LaTeX source" onUpload={onUpload} />
        );
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = makeFile('\\documentclass{article}\\begin{document}hello\\end{document}');

        await fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
            expect(onUpload).toHaveBeenCalledWith(expect.stringContaining('\\documentclass{article}'));
        });
        await waitFor(() => {
            expect(screen.getByText(/Uploaded/)).toBeInTheDocument();
        });
    });

    it('surfaces an error chip when the file is empty', async () => {
        const { container } = render(
            <LatexUploader label="Master" description="desc" onUpload={onUpload} />
        );
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await fireEvent.change(input, { target: { files: [makeFile('')] } });

        await waitFor(() => {
            expect(screen.getByText(/Error: file is empty/)).toBeInTheDocument();
        });
        expect(onUpload).not.toHaveBeenCalled();
    });

    it('rejects files larger than 256 KB', async () => {
        const big = 'x'.repeat(260 * 1024);
        const { container } = render(
            <LatexUploader label="Master" description="desc" onUpload={onUpload} />
        );
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await fireEvent.change(input, { target: { files: [makeFile(big)] } });

        await waitFor(() => {
            expect(screen.getByText(/file larger than 256 KB/)).toBeInTheDocument();
        });
        expect(onUpload).not.toHaveBeenCalled();
    });

    it('surfaces an error when onUpload rejects', async () => {
        onUpload.mockRejectedValue(new Error('pg connection refused'));
        const { container } = render(
            <LatexUploader label="Master" description="desc" onUpload={onUpload} />
        );
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await fireEvent.change(input, { target: { files: [makeFile('valid body')] } });

        await waitFor(() => {
            expect(screen.getByText(/Error: pg connection refused/)).toBeInTheDocument();
        });
    });

    it('shows a preview of the first 20 lines after a successful upload', async () => {
        onUpload.mockResolvedValue(1);
        const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
        const { container } = render(
            <LatexUploader label="Master" description="desc" onUpload={onUpload} />
        );
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;

        await fireEvent.change(input, { target: { files: [makeFile(lines)] } });

        await waitFor(() => {
            expect(screen.getByText('Preview (first 20 lines)')).toBeInTheDocument();
        });
        // The preview element should contain line 1 through line 20, but not line 21.
        const pre = container.querySelector('pre');
        expect(pre?.textContent).toContain('line 1');
        expect(pre?.textContent).toContain('line 20');
        expect(pre?.textContent).not.toContain('line 21');
    });
});
