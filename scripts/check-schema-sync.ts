#!/usr/bin/env npx tsx
/**
 * Schema Sync Check — verifies that enum values match across
 * TypeScript types, Zod schemas, and Python Pydantic enums.
 *
 * Run: npx tsx scripts/check-schema-sync.ts
 * Exit code 0 = all synced, 1 = drift detected
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function extractTsUnionValues(content: string, typeName: string): string[] {
    // Match: export type TypeName = 'val1' | 'val2' | ...;
    // May span multiple lines
    const regex = new RegExp(`type\\s+${typeName}\\s*=\\s*([^;]+);`, 's');
    const match = content.match(regex);
    if (!match) return [];
    const values = match[1].match(/'([^']+)'/g);
    return values ? values.map(v => v.replace(/'/g, '')) : [];
}

function extractZodEnumValues(content: string, schemaName: string): string[] {
    // Match: export const SchemaName = z.enum([\n  'val1',\n  'val2',\n]);
    const regex = new RegExp(`${schemaName}\\s*=\\s*z\\.enum\\(\\[([^\\]]+)\\]`, 's');
    const match = content.match(regex);
    if (!match) return [];
    const values = match[1].match(/'([^']+)'/g);
    return values ? values.map(v => v.replace(/'/g, '')) : [];
}

function extractPythonEnumValues(content: string, className: string): string[] {
    // Match: class ClassName(str, Enum):\n    VAL = "val"\n    ...
    const classRegex = new RegExp(`class\\s+${className}\\(str,\\s*Enum\\):\\s*\\n((?:[ \\t]+.+\\n?)*)`, 'g');
    const match = classRegex.exec(content);
    if (!match) return [];
    const body = match[1];
    const values = body.match(/"([^"]+)"/g);
    return values ? values.map(v => v.replace(/"/g, '')) : [];
}

function compareEnums(name: string, ts: string[], zod: string[], py: string[]): boolean {
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
            const missing: string[] = [];
            if (!inTs) missing.push('types.ts');
            if (!inZod) missing.push('validation.ts');
            if (!inPy) missing.push('schemas.py');
            console.error(`  ✗ "${val}" missing from: ${missing.join(', ')}`);
            ok = false;
        }
    }
    if (ok) console.log(`  ✓ All ${all.size} values match`);
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

        if (tsVals.length === 0) console.warn(`  ⚠ Could not parse ${check.tsType} from types.ts`);
        if (zodVals.length === 0) console.warn(`  ⚠ Could not parse ${check.zodSchema} from validation.ts`);
        if (pyVals.length === 0) console.warn(`  ⚠ Could not parse ${check.pyClass} from schemas.py`);

        if (!compareEnums(check.name, tsVals, zodVals, pyVals)) allOk = false;
    }

    console.log(allOk ? '\n✓ All schemas in sync' : '\n✗ Schema drift detected');
    process.exit(allOk ? 0 : 1);
}

main();
