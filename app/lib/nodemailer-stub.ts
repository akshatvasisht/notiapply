/** Stub for nodemailer when bundled for browser.
 * Email sending requires server-side Node.js context.
 * This stub prevents build errors when Turbopack tries to bundle nodemailer.
 */

function notAvailable(): never {
    throw new Error('nodemailer is not available in browser context — use an API route or server action');
}

export function createTransport() { notAvailable(); }

const nodemailerStub = { createTransport };
export default nodemailerStub;
