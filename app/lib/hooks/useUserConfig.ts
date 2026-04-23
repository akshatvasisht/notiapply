'use client';
import { getUserConfig } from '@/lib/db';
import { useDbQuery } from './useDbQuery';
import type { UserConfig } from '@/lib/types';
import { MOCK_CONFIG } from '@/lib/mock-data';

export function useUserConfig() {
    return useDbQuery<UserConfig>('config', getUserConfig, { fallback: MOCK_CONFIG });
}
