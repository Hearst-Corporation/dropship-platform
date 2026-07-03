/**
 * Vitest coverage for run_sql read-only enforcement in super-agent.
 *
 * Strategy:
 *   - `assertReadOnlySql` is a pure exported function — tested directly with
 *     no mocking needed.
 *   - `execRunSql` is exported and exercised with a mocked getDb pool so we
 *     can confirm the DB is never called when the query is rejected, and IS
 *     called when a valid SELECT is issued in read mode.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock heavy dependencies so the module can be imported ─────────────────

// getDb / pg pool — we don't want a real Postgres connection in unit tests.
// mode=write goes through db.query() directly; mode=read now goes through
// db.connect() → client.query('BEGIN TRANSACTION READ ONLY') → ... → COMMIT,
// so the mock pool needs both surfaces. mockClientQuery is a separate spy
// from mockQuery so tests can assert on the transaction-wrapped path
// specifically (BEGIN/COMMIT/ROLLBACK calls plus the actual query).
const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn(() => ({
  query: mockClientQuery,
  release: mockRelease,
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: mockQuery, connect: mockConnect }),
  getDbRead: () => ({ query: mockQuery, connect: mockConnect }),
}));

// OpenAI agent client — not under test here.
vi.mock('./openai-agent', () => ({
  trackedOpenAIMessage: vi.fn(),
}));

// dev-copilot — not under test here.
vi.mock('./dev-copilot', () => ({
  executeDevTool: vi.fn(),
  DEV_TOOLS: [],
}));

// asset-regenerator — not under test here.
vi.mock('./asset-regenerator', () => ({
  regenerateAsset: vi.fn(),
  ASSET_KINDS: [],
}));

// comfy-client — not under test here.
vi.mock('./comfy-client', () => ({
  isComfyConfigured: vi.fn(() => false),
  getDeploymentIds: vi.fn(() => []),
}));

// fal-client — not under test here.
vi.mock('./fal-client', () => ({
  isFalConfigured: vi.fn(() => false),
}));

// medusa — not under test here.
vi.mock('@/lib/medusa', () => ({
  getMedusaBaseUrl: vi.fn(() => 'http://medusa.test'),
  getMedusaAuthMode: vi.fn(() => 'jwt'),
  medusa: {},
}));

import { assertReadOnlySql, execRunSql } from './super-agent';

// ── assertReadOnlySql — unit tests (pure function, no I/O) ────────────────

describe('assertReadOnlySql — allowed queries', () => {
  it('allows plain SELECT 1', () => {
    expect(assertReadOnlySql('SELECT 1')).toBeNull();
  });

  it('allows SELECT with WHERE and params placeholder', () => {
    expect(assertReadOnlySql('SELECT id, name FROM dropship_stores WHERE id = $1')).toBeNull();
  });

  it('allows SELECT with trailing semicolon', () => {
    expect(assertReadOnlySql('SELECT 1;')).toBeNull();
  });

  it('allows read-only WITH … SELECT CTE (leading comments + whitespace)', () => {
    expect(
      assertReadOnlySql('  -- un commentaire\n WITH x AS (SELECT 1) SELECT * FROM x'),
    ).toBeNull();
  });

  it('allows WITH … SELECT with block comment', () => {
    expect(
      assertReadOnlySql('/* bloc */ WITH cte AS (SELECT id FROM dropship_stores) SELECT * FROM cte'),
    ).toBeNull();
  });

  it('does not false-positive on column name "updated_at"', () => {
    expect(assertReadOnlySql('SELECT updated_at FROM dropship_stores')).toBeNull();
  });

  it('does not false-positive on column alias containing a keyword', () => {
    expect(assertReadOnlySql('SELECT count(*) AS total_count FROM dropship_stores')).toBeNull();
  });

  // AC1: replace() is a standard Postgres read function — must NOT be blocked.
  it('allows SELECT with replace() string function (AC1)', () => {
    expect(
      assertReadOnlySql("SELECT replace(description, 'a', 'b') FROM dropship_stores"),
    ).toBeNull();
  });
});

describe('assertReadOnlySql — rejected queries', () => {
  it('rejects DELETE FROM dropship_stores', () => {
    const result = assertReadOnlySql('DELETE FROM dropship_stores');
    expect(result).not.toBeNull();
    expect(result).toMatch(/DELETE/i);
  });

  it('rejects UPDATE statement', () => {
    const result = assertReadOnlySql('UPDATE dropship_stores SET name = $1 WHERE id = $2');
    expect(result).not.toBeNull();
    expect(result).toMatch(/UPDATE/i);
  });

  it('rejects DROP TABLE', () => {
    const result = assertReadOnlySql('DROP TABLE foo');
    expect(result).not.toBeNull();
    expect(result).toMatch(/DROP/i);
  });

  it('rejects INSERT', () => {
    const result = assertReadOnlySql("INSERT INTO dropship_stores (name) VALUES ('x')");
    expect(result).not.toBeNull();
    expect(result).toMatch(/INSERT/i);
  });

  it('rejects TRUNCATE', () => {
    const result = assertReadOnlySql('TRUNCATE dropship_stores');
    expect(result).not.toBeNull();
    expect(result).toMatch(/TRUNCATE/i);
  });

  it('rejects ALTER TABLE', () => {
    const result = assertReadOnlySql('ALTER TABLE foo ADD COLUMN bar text');
    expect(result).not.toBeNull();
    expect(result).toMatch(/ALTER/i);
  });

  it('rejects multiple statements separated by semicolon', () => {
    const result = assertReadOnlySql('SELECT 1; DROP TABLE foo');
    expect(result).not.toBeNull();
    expect(result).toMatch(/plusieurs instructions/i);
  });

  it('rejects WITH CTE containing DELETE … RETURNING', () => {
    const result = assertReadOnlySql(
      'WITH d AS (DELETE FROM dropship_stores RETURNING id) SELECT * FROM d',
    );
    expect(result).not.toBeNull();
    expect(result).toMatch(/DELETE/i);
  });

  it('rejects non-SELECT/WITH first keyword (raw UPDATE)', () => {
    const result = assertReadOnlySql('UPDATE foo SET x = 1');
    expect(result).not.toBeNull();
  });

  it('rejects GRANT', () => {
    const result = assertReadOnlySql('GRANT ALL ON TABLE foo TO bar');
    expect(result).not.toBeNull();
    expect(result).toMatch(/GRANT/i);
  });

  it('rejects REVOKE', () => {
    const result = assertReadOnlySql('REVOKE ALL ON TABLE foo FROM bar');
    expect(result).not.toBeNull();
    expect(result).toMatch(/REVOKE/i);
  });

  it('rejects SELECT 1; DELETE FROM x (multi-statement injection)', () => {
    const result = assertReadOnlySql('SELECT 1; DELETE FROM x');
    expect(result).not.toBeNull();
  });

  it('rejects WITH d AS (DELETE .. RETURNING) SELECT (data-modifying CTE)', () => {
    const result = assertReadOnlySql(
      'WITH d AS (DELETE FROM x RETURNING id) SELECT * FROM d',
    );
    expect(result).not.toBeNull();
  });

  // Stopgap blocklist additions (defense in depth alongside the DB-level
  // READ ONLY transaction boundary — see execRunSql).
  it('rejects COPY', () => {
    const result = assertReadOnlySql("COPY (SELECT 1) TO '/tmp/x.csv'");
    expect(result).not.toBeNull();
  });

  it('rejects a query containing COPY as a later keyword', () => {
    const result = assertReadOnlySql("SELECT 1; COPY foo TO '/tmp/x.csv'");
    expect(result).not.toBeNull();
  });

  it('rejects CALL', () => {
    const result = assertReadOnlySql('CALL some_write_procedure()');
    expect(result).not.toBeNull();
  });

  it('rejects DO', () => {
    const result = assertReadOnlySql("DO $$ BEGIN PERFORM 1; END $$");
    expect(result).not.toBeNull();
  });

  it('rejects SET', () => {
    const result = assertReadOnlySql("SET session_replication_role = 'replica'");
    expect(result).not.toBeNull();
  });

  it('rejects LOCK', () => {
    const result = assertReadOnlySql('LOCK TABLE dropship_stores');
    expect(result).not.toBeNull();
  });

  it('rejects NOTIFY', () => {
    const result = assertReadOnlySql("NOTIFY channel, 'payload'");
    expect(result).not.toBeNull();
  });
});

// ── execRunSql integration — real function calls with mocked DB pool ──────
//
// AC4: these tests actually invoke execRunSql (not just assertReadOnlySql)
// so we can confirm: (a) destructive read → throws AND db not called,
// (b) valid SELECT read → db IS called and rows are returned.

describe('execRunSql integration — mocked DB pool', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockClear();
  });

  it('(a) throws and does NOT call db.query/db.connect for DELETE in mode=read', async () => {
    // The regex guard throws before getDb()/connect() is ever reached.
    await expect(
      execRunSql({ query: 'DELETE FROM dropship_stores', mode: 'read' }, {}),
    ).rejects.toThrow(/DELETE/i);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('(b) calls db.connect and returns rows for SELECT 1 in mode=read, wrapped in a READ ONLY transaction', async () => {
    const fakeRows = [{ '?column?': 1 }];
    // BEGIN TRANSACTION READ ONLY -> {}, actual query -> rows, COMMIT -> {}
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN TRANSACTION READ ONLY
      .mockResolvedValueOnce({ rows: fakeRows }) // SELECT 1
      .mockResolvedValueOnce({}); // COMMIT

    const result = await execRunSql({ query: 'SELECT 1', mode: 'read' }, {});

    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION READ ONLY');
    expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'SELECT 1', []);
    expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mockRelease).toHaveBeenCalledOnce();
    expect(result.output).toEqual({ rows: fakeRows, count: 1, truncated: false, returned: 1 });
  });

  // AC4(a): a disguised-write query using one of the newly-blocklisted
  // keywords (COPY) is now rejected by the regex layer immediately — the
  // fast-fail UX path. The real boundary (the READ ONLY transaction) is
  // exercised separately below by simulating what Postgres itself would do
  // for a write that somehow reached the transaction (e.g. a write-capable
  // function call the regex cannot see, like `SELECT some_write_fn()`).
  it('(a2) rejects a disguised write using the newly-blocklisted COPY keyword before touching the DB', async () => {
    await expect(
      execRunSql({ query: "COPY (SELECT 1) TO '/tmp/pwn.csv'", mode: 'read' }, {}),
    ).rejects.toThrow(/COPY/i);

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('(c) a write-capable function call that slips past the regex is rejected at the DB layer (READ ONLY transaction) and the client is rolled back + released', async () => {
    // `SELECT some_write_function()` passes assertReadOnlySql (first word is
    // SELECT, no blacklisted keyword appears) but Postgres itself rejects it
    // inside a READ ONLY transaction. Simulate that DB-level rejection here.
    const readOnlyViolation = new Error('cannot execute INSERT in a read-only transaction');
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN TRANSACTION READ ONLY
      .mockRejectedValueOnce(readOnlyViolation) // the disguised write itself
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      execRunSql({ query: 'SELECT some_write_function()', mode: 'read' }, {}),
    ).rejects.toThrow(/read-only transaction/i);

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION READ ONLY');
    expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'SELECT some_write_function()', []);
    expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('(d) mode=write is unaffected: still goes through db.query directly, no connect/transaction wrapping', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await execRunSql(
      { query: "UPDATE dropship_stores SET name = 'x' WHERE id = $1", mode: 'write', params: ['abc'] },
      { '*': true },
    );

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(result.output).toEqual({ rows: [{ id: 1 }], count: 1, truncated: false, returned: 1 });
  });
});
