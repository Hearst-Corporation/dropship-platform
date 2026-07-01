import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import {
  buildFluxTxt2ImgGraph,
  getDeploymentIds,
  isComfyConfigured,
  pickRoundRobin,
  runWorkflow,
  __resetRoundRobinForTests,
} from './comfy-client';

/**
 * P1.5 — ComfyUI multi-instance round-robin.
 *
 * These tests cover the three pieces that P1.5 introduced:
 *
 *   1. `getDeploymentIds` — the env-resolver that turns single/multi/legacy
 *      env vars into a clean deduplicated pool of deployment ids.
 *
 *   2. `pickRoundRobin` — pure rotation across a fixed pool, with the
 *      module-level counter rotating on each call (1-id pool short-circuits
 *      so dedup edge cases stay quiet).
 *
 *   3. `runWorkflow` end-to-end with an MSW handler matching the real
 *      ComfyDeploy queue + status URLs. We assert (a) three sequential
 *      calls fan out a,b,a across a two-id pool, and (b) an explicit
 *      override bypasses the rotation without advancing the counter.
 */

describe('getDeploymentIds', () => {
  beforeEach(() => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', '');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns [single] for the legacy COMFY_DEPLOYMENT_ID env (no other source)', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'dep_legacy');
    expect(getDeploymentIds()).toEqual(['dep_legacy']);
  });

  it('parses comma-separated COMFY_DEPLOYMENT_IDS, dedupes, trims, drops empties', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', ' dep_a , dep_b ,, dep_a , dep_c ');
    expect(getDeploymentIds()).toEqual(['dep_a', 'dep_b', 'dep_c']);
  });

  it('returns [] when nothing is configured', () => {
    // All three stubs are empty strings from beforeEach.
    expect(getDeploymentIds()).toEqual([]);
  });

  it('prefers a per-asset env key over the global list and the legacy single', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', 'hero_a,hero_b');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'global_a,global_b');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'legacy');
    expect(getDeploymentIds('COMFY_DEPLOYMENT_HERO')).toEqual(['hero_a', 'hero_b']);
  });

  it('falls back from per-asset (empty) to COMFY_DEPLOYMENT_IDS', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'global_a,global_b');
    expect(getDeploymentIds('COMFY_DEPLOYMENT_HERO')).toEqual(['global_a', 'global_b']);
  });
});

describe('isComfyConfigured', () => {
  beforeEach(() => {
    vi.stubEnv('COMFY_BACKEND', '');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', '');
    vi.stubEnv('COMFYUI_URL', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', '');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when neither backend is set', () => {
    expect(isComfyConfigured()).toBe(false);
  });

  it('is false on deploy backend when no deployment id is reachable', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    expect(isComfyConfigured()).toBe(false);
  });

  it('is true on deploy backend with COMFY_DEPLOYMENT_IDS set', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'dep_a,dep_b');
    expect(isComfyConfigured()).toBe(true);
  });

  it('is true on deploy backend with the legacy single id', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'dep_legacy');
    expect(isComfyConfigured()).toBe(true);
  });

  it('is true on local backend regardless of deployment ids', () => {
    vi.stubEnv('COMFYUI_URL', 'http://localhost:8188');
    expect(isComfyConfigured()).toBe(true);
  });

  it('honors COMFY_BACKEND=local even when the deploy key is set', () => {
    vi.stubEnv('COMFY_BACKEND', 'local');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    vi.stubEnv('COMFYUI_URL', 'http://localhost:8188');
    // Deploy would need a deployment id; local needs none — true proves
    // the forced backend won, not the key-based default.
    expect(isComfyConfigured()).toBe(true);
  });

  it('is false when COMFY_BACKEND=local but COMFYUI_URL is missing', () => {
    vi.stubEnv('COMFY_BACKEND', 'local');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    expect(isComfyConfigured()).toBe(false);
  });
});

describe('buildFluxTxt2ImgGraph', () => {
  beforeEach(() => {
    vi.stubEnv('COMFYUI_CHECKPOINT', '');
    vi.stubEnv('COMFYUI_STEPS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  type GraphNode = { class_type: string; inputs: Record<string, unknown> };
  const nodesOf = (g: Record<string, object>) => Object.values(g) as GraphNode[];
  const nodeByClass = (g: Record<string, object>, cls: string) =>
    nodesOf(g).find((n) => n.class_type === cls)!;

  it('defaults to the verified FLUX dev fp8 checkpoint on comfy.hearst.app', () => {
    const g = buildFluxTxt2ImgGraph({ prompt: 'hero' });
    expect(nodeByClass(g, 'CheckpointLoaderSimple').inputs.ckpt_name).toBe(
      'FLUX1/flux1-dev-fp8.safetensors',
    );
  });

  it('honors COMFYUI_CHECKPOINT env and the explicit checkpoint option', () => {
    vi.stubEnv('COMFYUI_CHECKPOINT', 'FLUX1/flux1-schnell-fp8.safetensors');
    const fromEnv = buildFluxTxt2ImgGraph({ prompt: 'p' });
    expect(nodeByClass(fromEnv, 'CheckpointLoaderSimple').inputs.ckpt_name).toBe(
      'FLUX1/flux1-schnell-fp8.safetensors',
    );
    const explicit = buildFluxTxt2ImgGraph({ prompt: 'p', checkpoint: 'FLUX1/flux1-dev.safetensors' });
    expect(nodeByClass(explicit, 'CheckpointLoaderSimple').inputs.ckpt_name).toBe(
      'FLUX1/flux1-dev.safetensors',
    );
  });

  it('wires prompt + negative into the two CLIPTextEncode nodes', () => {
    const g = buildFluxTxt2ImgGraph({ prompt: 'a hero shot', negativePrompt: 'text, logo' });
    const texts = nodesOf(g)
      .filter((n) => n.class_type === 'CLIPTextEncode')
      .map((n) => n.inputs.text);
    expect(texts).toContain('a hero shot');
    expect(texts).toContain('text, logo');
  });

  it('uses FLUX-safe sampling defaults (cfg=1, euler/simple, 16:9 latent, /16 grid)', () => {
    const g = buildFluxTxt2ImgGraph({ prompt: 'p' });
    const sampler = nodeByClass(g, 'KSampler').inputs;
    expect(sampler.cfg).toBe(1.0);
    expect(sampler.sampler_name).toBe('euler');
    expect(sampler.scheduler).toBe('simple');
    const latent = nodeByClass(g, 'EmptySD3LatentImage').inputs;
    expect(latent.width).toBe(1344);
    expect(latent.height).toBe(768);
  });

  it('snaps custom dimensions to the /16 grid and passes seed through', () => {
    const g = buildFluxTxt2ImgGraph({ prompt: 'p', width: 1000, height: 777, seed: 42 });
    const latent = nodeByClass(g, 'EmptySD3LatentImage').inputs;
    expect((latent.width as number) % 16).toBe(0);
    expect((latent.height as number) % 16).toBe(0);
    expect(nodeByClass(g, 'KSampler').inputs.seed).toBe(42);
  });
});

/**
 * Local backend end-to-end via MSW: /prompt queue, /history poll, /view
 * binary fetch. The queue handler captures the submitted graph so we can
 * assert that deploy-style `inputs` get synthesized into a FLUX txt2img
 * graph — the conciliation path that lets asset-generator stay
 * backend-agnostic while comfy.hearst.app does the actual rendering.
 */
describe('runWorkflow local backend', () => {
  const BASE = 'http://127.0.0.1:8188';
  const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let submittedGraphs: Array<Record<string, { class_type: string; inputs: Record<string, unknown> }>> = [];

  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    submittedGraphs = [];
    vi.stubEnv('COMFY_BACKEND', '');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', '');
    vi.stubEnv('COMFYUI_URL', BASE);
    vi.stubEnv('COMFYUI_CHECKPOINT', '');
    vi.stubEnv('COMFYUI_STEPS', '');

    // Collapse the 2s poll delay to a 0ms tick — ordering only.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout,
    );

    server.use(
      http.post(`${BASE}/prompt`, async ({ request }) => {
        const body = (await request.json()) as { prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }> };
        submittedGraphs.push(body.prompt);
        return HttpResponse.json({ prompt_id: 'prompt_123' });
      }),
      http.get(`${BASE}/history/prompt_123`, () =>
        HttpResponse.json({
          prompt_123: {
            status: { status_str: 'success', completed: true },
            outputs: {
              '7': { images: [{ filename: 'dropship-asset_00001_.png', subfolder: '', type: 'output' }] },
            },
          },
        }),
      ),
      http.get(`${BASE}/view`, () =>
        HttpResponse.arrayBuffer(PNG_BYTES.buffer as ArrayBuffer, {
          headers: { 'Content-Type': 'image/png' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('synthesizes a FLUX txt2img graph from deploy-style inputs and returns the image', async () => {
    const result = await runWorkflow({
      inputs: { prompt: 'editorial hero', negative_prompt: 'text, logo', seed: 7 },
    });

    expect(result.runId).toBe('prompt_123');
    expect(result.deploymentId).toBe('local');
    expect(result.images).toHaveLength(1);
    expect(Buffer.from(PNG_BYTES).equals(result.images[0]!)).toBe(true);

    expect(submittedGraphs).toHaveLength(1);
    const graph = submittedGraphs[0]!;
    const classes = Object.values(graph).map((n) => n.class_type);
    expect(classes).toEqual(
      expect.arrayContaining([
        'CheckpointLoaderSimple',
        'CLIPTextEncode',
        'EmptySD3LatentImage',
        'KSampler',
        'VAEDecode',
        'SaveImage',
      ]),
    );
    const sampler = Object.values(graph).find((n) => n.class_type === 'KSampler')!;
    expect(sampler.inputs.seed).toBe(7);
  });

  it('sends an explicit graph verbatim, bypassing the builder', async () => {
    const custom = { '1': { class_type: 'CustomNode', inputs: { foo: 'bar' } } };
    const result = await runWorkflow({ graph: custom });
    expect(result.runId).toBe('prompt_123');
    expect(submittedGraphs[0]).toEqual(custom);
  });

  it('throws when neither graph nor inputs.prompt is provided', async () => {
    await expect(runWorkflow({ inputs: { reference_image: 'https://x/y.png' } })).rejects.toThrow(
      /graph or inputs\.prompt required/,
    );
  });

  it('COMFY_BACKEND=local forces the local path even with a deploy key set', async () => {
    vi.stubEnv('COMFY_BACKEND', 'local');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy-should-be-ignored');
    const result = await runWorkflow({ inputs: { prompt: 'forced local' } });
    expect(result.deploymentId).toBe('local');
    expect(submittedGraphs).toHaveLength(1);
  });
});

describe('pickRoundRobin', () => {
  beforeEach(() => {
    __resetRoundRobinForTests();
  });

  it('rotates across a multi-id pool deterministically', () => {
    const pool = ['dep_a', 'dep_b'];
    expect(pickRoundRobin(pool)).toBe('dep_a');
    expect(pickRoundRobin(pool)).toBe('dep_b');
    expect(pickRoundRobin(pool)).toBe('dep_a');
    expect(pickRoundRobin(pool)).toBe('dep_b');
  });

  it('short-circuits on a single-id pool (no counter side-effect)', () => {
    const solo = ['only_one'];
    expect(pickRoundRobin(solo)).toBe('only_one');
    expect(pickRoundRobin(solo)).toBe('only_one');
  });

  it('keeps independent counters per pool', () => {
    const poolA = ['a1', 'a2'];
    const poolB = ['b1', 'b2', 'b3'];
    expect(pickRoundRobin(poolA)).toBe('a1');
    expect(pickRoundRobin(poolB)).toBe('b1');
    expect(pickRoundRobin(poolA)).toBe('a2');
    expect(pickRoundRobin(poolB)).toBe('b2');
    expect(pickRoundRobin(poolA)).toBe('a1');
    expect(pickRoundRobin(poolB)).toBe('b3');
  });

  it('throws on an empty pool (caller bug)', () => {
    expect(() => pickRoundRobin([])).toThrow(/empty deployment pool/);
  });
});

/**
 * End-to-end runWorkflow via MSW. We mock both the queue POST and the
 * status GET so the polling loop completes on its first iteration.
 *
 * The queue handler records which deployment_id each call used. This is
 * how we verify the round-robin fanout — we don't peek at the counter,
 * we observe the wire.
 */
describe('runWorkflow round-robin', () => {
  let calledDeployments: string[] = [];

  // Patch setTimeout so the deployRun poll loop (3s base) resolves
  // immediately. Without this the suite would take ~30s on the four
  // tests below × multiple sequential runWorkflow calls.
  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    __resetRoundRobinForTests();
    calledDeployments = [];
    vi.stubEnv('COMFY_BACKEND', '');
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy-test');
    vi.stubEnv('COMFYUI_URL', '');

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      // Map every timer to a 0ms tick — we only care about ordering, not
      // wall-clock delays. Preserves the Timeout return type.
      ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout,
    );

    server.use(
      http.post('https://api.comfydeploy.com/api/v2/run/deployment/queue', async ({ request }) => {
        const body = (await request.json()) as { deployment_id: string };
        calledDeployments.push(body.deployment_id);
        // Echo the deployment id back as the run id so the status handler
        // can route the response without keeping its own state machine.
        return HttpResponse.json({ run_id: `run_for_${body.deployment_id}` });
      }),
      http.get('https://api.comfydeploy.com/api/v2/run/:runId', ({ params }) => {
        const runId = String(params.runId);
        return HttpResponse.json({
          id: runId,
          status: 'success',
          // No outputs → empty images/videos in the result. We're only
          // asserting on the deployment selection, not the asset payload.
          outputs: [],
        });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('rotates dep_a → dep_b → dep_a across 3 calls when the pool has 2 ids', async () => {
    const pool = ['dep_a', 'dep_b'];

    const r1 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p1' } });
    const r2 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p2' } });
    const r3 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['dep_a', 'dep_b', 'dep_a']);
    expect(r1.deploymentId).toBe('dep_a');
    expect(r2.deploymentId).toBe('dep_b');
    expect(r3.deploymentId).toBe('dep_a');
  });

  it('accepts a comma-separated string as the pool (env passthrough case)', async () => {
    const poolStr = 'dep_x,dep_y,dep_z';

    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p1' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p2' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p3' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p4' } });

    expect(calledDeployments).toEqual(['dep_x', 'dep_y', 'dep_z', 'dep_x']);
  });

  it('honors deploymentIdOverride without advancing the round-robin counter', async () => {
    const pool = ['dep_a', 'dep_b'];

    // Override on the first call: should hit dep_pinned and NOT consume
    // the counter slot — next round-robin call should start at dep_a.
    const overridden = await runWorkflow({
      deploymentId: pool,
      deploymentIdOverride: 'dep_pinned',
      inputs: { prompt: 'video' },
    });
    expect(overridden.deploymentId).toBe('dep_pinned');

    // Subsequent regular calls behave as if the override never happened.
    const r2 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p2' } });
    const r3 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['dep_pinned', 'dep_a', 'dep_b']);
    expect(r2.deploymentId).toBe('dep_a');
    expect(r3.deploymentId).toBe('dep_b');
  });

  it('falls back to env-resolved pool when deploymentId is omitted', async () => {
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'env_a,env_b');

    await runWorkflow({ inputs: { prompt: 'p1' } });
    await runWorkflow({ inputs: { prompt: 'p2' } });
    await runWorkflow({ inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['env_a', 'env_b', 'env_a']);
  });
});
