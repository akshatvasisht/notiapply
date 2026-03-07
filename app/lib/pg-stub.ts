/** Stub for pg module when bundled for browser.
 * The actual pg module should never be imported in browser code.
 * This stub prevents build errors when Turbopack tries to bundle pg.
 */

export class Pool {
  constructor() {
    throw new Error('PostgreSQL is not available in browser context');
  }
}

const pgStub = { Pool };
export default pgStub;
