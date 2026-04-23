#!/usr/bin/env node
/**
 * Schema Sync Check — verifies that enum values match across
 * TypeScript types, Zod schemas, and Python Pydantic enums.
 *
 * Run: node scripts/check-schema-sync.mjs
 * Exit code 0 = all synced, 1 = drift detected
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function extractTsUnionValues(content, typeName) {
    const regex = new RegExp(`type\\s+${typeName}\\s*=\\s*([^;]+);`, 's');
    const match = content.match(regex);
    if (!match) return [];
    const values = match[1].match(/'([^']+)'/g);
    return values ? values.map(v => v.replace(/'/g, '')) : [];
}

function extractZodEnumValues(content, schemaName) {
    const regex = new RegExp(`${schemaName}\\s*=\\s*z\\.enum\\(\\[([^\\]]+)\\]`, 's');
    const match = content.match(regex);
    if (!match) return [];
    const values = match[1].match(/'([^']+)'/g);
    return values ? values.map(v => v.replace(/'/g, '')) : [];
}

function extractPythonEnumValues(content, className) {
    const classRegex = new RegExp(`class\\s+${className}\\(str,\\s*Enum\\):\\s*\\n((?:[ \\t]+.+\\n?)*)`, 'g');
    const match = classRegex.exec(content);
    if (!match) return [];
    const body = match[1];
    const values = body.match(/"([^"]+)"/g);
    return values ? values.map(v => v.replace(/"/g, '')) : [];
}

function compareEnums(name, ts, zod, py) {
    const tsSet = new Set(ts);
    const zodSet = new Set(zod);
    const pySet = new Set(py);
    const all = new Set([...ts, ...zod, ...py]);

    let ok = true;
    for (const val of all) {
        const inTs = tsSet.has(val);
        const inZod = zodSet.has(val);
        const inPy = pySet.has(val);
        if (!inTs || !inZod || !inPy) {
            const missing = [];
            if (!inTs) missing.push('types.ts');
            if (!inZod) missing.push('validation.ts');
            if (!inPy) missing.push('schemas.py');
            console.error(`  \u2717 "${val}" missing from: ${missing.join(', ')}`);
            ok = false;
        }
    }
    if (ok) console.log(`  \u2713 All ${all.size} values match`);
    return ok;
}

function main() {
    const typesContent = readFileSync(join(ROOT, 'app/lib/types.ts'), 'utf8');
    const validationContent = readFileSync(join(ROOT, 'app/lib/validation.ts'), 'utf8');
    const schemasContent = readFileSync(join(ROOT, 'server/scraper/schemas.py'), 'utf8');

    let allOk = true;

    const checks = [
        { name: 'JobState', tsType: 'JobState', zodSchema: 'JobStateSchema', pyClass: 'JobState' },
        { name: 'ContactState', tsType: 'ContactState', zodSchema: 'ContactStateSchema', pyClass: 'ContactState' },
        { name: 'JobSource', tsType: 'JobSource', zodSchema: 'JobSourceSchema', pyClass: 'JobSource' },
    ];

    for (const check of checks) {
        console.log(`\n${check.name}:`);
        const tsVals = extractTsUnionValues(typesContent, check.tsType);
        const zodVals = extractZodEnumValues(validationContent, check.zodSchema);
        const pyVals = extractPythonEnumValues(schemasContent, check.pyClass);

        if (tsVals.length === 0) console.warn(`  \u26A0 Could not parse ${check.tsType} from types.ts`);
        if (zodVals.length === 0) console.warn(`  \u26A0 Could not parse ${check.zodSchema} from validation.ts`);
        if (pyVals.length === 0) console.warn(`  \u26A0 Could not parse ${check.pyClass} from schemas.py`);

        if (!compareEnums(check.name, tsVals, zodVals, pyVals)) allOk = false;
    }

    console.log(allOk ? '\n\u2713 All schemas in sync' : '\n\u2717 Schema drift detected');
    process.exit(allOk ? 0 : 1);
}

main();
