'use client';
import { getContacts } from '@/lib/db';
import { useDbQuery } from './useDbQuery';
import type { Contact } from '@/lib/types';
import { MOCK_CONTACTS } from '@/lib/mock-data';

export function useContacts() {
    return useDbQuery<Contact[]>('contacts', getContacts, { fallback: MOCK_CONTACTS });
}
