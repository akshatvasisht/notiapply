/** Notiapply — Structured logging utility
 *
 * Provides consistent logging across the application with severity levels.
 * In production, errors can be persisted to database for debugging.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    timestamp: string;
    data?: unknown;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV !== 'production';

    private formatEntry(entry: LogEntry): string {
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
        const context = entry.context ? `[${entry.context}]` : '';
        return `${prefix}${context} ${entry.message}`;
    }

    private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
        const entry: LogEntry = {
            level,
            message,
            context,
            timestamp: new Date().toISOString(),
            data,
        };

        const formatted = this.formatEntry(entry);

        // Console output with appropriate method
        switch (level) {
            case 'debug':
                if (this.isDevelopment) console.debug(formatted, data ?? '');
                break;
            case 'info':
                console.info(formatted, data ?? '');
                break;
            case 'warn':
                console.warn(formatted, data ?? '');
                break;
            case 'error':
                console.error(formatted, data ?? '');
                break;
        }

        // In production, persist errors to database
        // if (level === 'error' && !this.isDevelopment) {
        //     persistErrorToDatabase(entry);
        // }
    }

    debug(message: string, context?: string, data?: unknown): void {
        this.log('debug', message, context, data);
    }

    info(message: string, context?: string, data?: unknown): void {
        this.log('info', message, context, data);
    }

    warn(message: string, context?: string, data?: unknown): void {
        this.log('warn', message, context, data);
    }

    error(message: string, context?: string, data?: unknown): void {
        this.log('error', message, context, data);
    }
}

// Singleton instance
export const logger = new Logger();
