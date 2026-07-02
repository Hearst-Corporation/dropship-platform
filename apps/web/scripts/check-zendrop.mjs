#!/usr/bin/env node
/**
 * Zendrop connectivity check — run from apps/web:  node scripts/check-zendrop.mjs
 *
 * Reads ZENDROP_API_TOKEN from the environment or .env.local, then hits the
 * live Zendrop MCP API: get_stores (connectivity) + get_catalog_products
 * (catalog:read). Prints a pass/fail summary. Never prints the full token.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MCP_URL = (process.env.SUPPLIER_ZENDROP_MCP_URL || 'https://app.zendrop.com/mcp/v1').trim();

function loadToken() {
  if (process.env.ZENDROP_API_TOKEN) return process.env.ZENDROP_API_TOKEN.trim();
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
    const line = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('ZENDROP_API_TOKEN='));
    return line ? line.slice('ZENDROP_API_TOKEN='.length).trim() : '';
  } catch {
    return '';
  }
}

async function call(token, tool, args = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  });
  if (!res.ok) throw new Error(`${tool} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${tool} error ${json.error.code}: ${json.error.message}`);
  if (json.result?.isError) throw new Error(`${tool} tool error`);
  return json.result?.structuredContent ?? {};
}

const token = loadToken();
if (!token) {
  console.error('🔴 ZENDROP_API_TOKEN absent (env ou .env.local).');
  process.exit(1);
}
console.log(`→ token: ${token.slice(0, 6)}…(${token.length} chars) · endpoint: ${MCP_URL}`);

try {
  const stores = await call(token, 'get_stores', { limit: 1 });
  console.log(`🟢 get_stores OK · stores connectés: ${stores.total ?? 0}`);

  const catalog = await call(token, 'get_catalog_products', { limit: 3 });
  const products = catalog.products ?? [];
  console.log(`🟢 get_catalog_products OK · total catalogue: ${catalog.total ?? '?'} · échantillon: ${products.length}`);
  for (const p of products) {
    console.log(`   - [${p.id}] ${String(p.name).slice(0, 60)} · ${p.price} USD`);
  }
  console.log('\n✅ Zendrop opérationnel (catalog:read + stores:read).');
} catch (e) {
  console.error(`🔴 Échec Zendrop: ${e.message}`);
  process.exit(1);
}
