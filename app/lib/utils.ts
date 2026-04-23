export function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const time = new Date(dateStr).getTime();
    if (!Number.isFinite(time)) return '—';
    const diff = Date.now() - time;
    if (diff < 0) return 'Just now'; // Handle future dates gracefully in tests
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export function formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return '';
    const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
    if (min && max) return `${fmt(min)}–${fmt(max)}`;
    if (min) return fmt(min);
    return fmt(max!);
}
