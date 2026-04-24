/** Scraped companies & document upload queries */

import { getPool } from './pool';
import type { ScrapedCompany } from '../types';

export async function getScrapedCompanies(): Promise<ScrapedCompany[]> {
    const { rows } = await getPool().query('SELECT * FROM scraped_companies ORDER BY added_at DESC');
    return rows;
}

export async function addScrapedCompany(company: {
    name: string;
    ats_platform: string;
    ats_slug: string;
}): Promise<void> {
    await getPool().query(
        'INSERT INTO scraped_companies (name, ats_platform, ats_slug) VALUES ($1, $2, $3)',
        [company.name, company.ats_platform, company.ats_slug]
    );
}

export async function removeScrapedCompany(id: number): Promise<void> {
    await getPool().query('DELETE FROM scraped_companies WHERE id = $1', [id]);
}

export async function uploadMasterResume(latexSource: string): Promise<number> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE master_resume SET is_active = false WHERE is_active = true');
        const { rows } = await client.query(
            'INSERT INTO master_resume (latex_source) VALUES ($1) RETURNING id',
            [latexSource]
        );
        await client.query('COMMIT');
        return rows[0].id;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function uploadCoverLetterTemplate(latexSource: string): Promise<number> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE cover_letter_templates SET is_active = false WHERE is_active = true');
        const { rows } = await client.query(
            'INSERT INTO cover_letter_templates (latex_source) VALUES ($1) RETURNING id',
            [latexSource]
        );
        await client.query('COMMIT');
        return rows[0].id;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
