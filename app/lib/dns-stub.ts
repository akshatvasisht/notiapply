/** Stub for dns/dns.promises when bundled for browser.
 * DNS lookups require server-side Node.js context.
 */

function notAvailable(): never {
    throw new Error('dns is not available in browser context');
}

export const resolveTxt = () => notAvailable();
export const resolve = () => notAvailable();
export const lookup = () => notAvailable();

const promises = { resolveTxt, resolve, lookup };

const dnsStub = { resolveTxt, resolve, lookup, promises };
export default dnsStub;
