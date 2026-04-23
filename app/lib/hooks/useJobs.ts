'use client';
import { getJobs } from '@/lib/db';
import { useDbQuery } from './useDbQuery';
import type { Job } from '@/lib/types';
import { MOCK_JOBS } from '@/lib/mock-data';

export function useJobs() {
    return useDbQuery<Job[]>('jobs', getJobs, { fallback: MOCK_JOBS });
}
