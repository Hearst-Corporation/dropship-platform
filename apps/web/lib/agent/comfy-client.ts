/**
 * ComfyUI client. Two backends, one interface, **N deployments per asset**.
 *
 *  - **comfy-deploy** (cloud.comfy.org): managed serverless, hits
 *    api.comfydeploy.com with an API key. Each workflow is a "deployment"
 *    with an ID. Inputs are passed as named slots that the workflow's
 *    ExternalImage / ExternalText nodes pick up.
 *
 *  - **local** (raw ComfyUI): hits /prompt and polls /history. Used when
 *    COMFYUI_URL points to a self-hosted instance (LAN, tunnel, GPU box).
 *
 * Pick by env: COMFY_BACKEND=deploy|local. Default: 'deploy' if
 * COMFY_DEPLOY_API_KEY is set, else 'local' if COMFYUI_URL is set, else
 * generation is skipped silently (the agent falls back to supplier images).
 *
 * ============================================================
 * P1.5 — Round-robin across multiple deployments
 * ============================================================
 *
 * Each `COMFY_DEPLOYMENT_*` env var (HERO, CUTOUT, LIFESTYLE, VIDEO) accepts
 * **either** a single ID **or** a comma-separated list of IDs:
 *
 *   COMFY_DEPLOYMENT_HERO=dep_a                  # legacy, single
 *   COMFY_DEPLOYMENT_HERO=dep_a,dep_b,dep_c      # round-robin across 3
 *
 * A module-level counter per deployment-list rotates picks across calls.
 * The N+1 call uses dep_a again. With N=2 deployments, three parallel
 * stores cost (1 + 1 + 1) ≈ 1× wall-clock instead of 3× — that's the whole
 * point of P1.5: stop the 3rd parallel store from waiting 15 min on the
 * single GPU queue and timing out the SSE.
 *
 * The counter lives in-process (Map<string, number>). On Vercel a cold
 * start resets it to 0. That is acceptable at our volume — what matters is
 * that *within a single Lambda exec* sequential requests fan out, not that
 * the global distribution is strictly even across all containers.
 *
 * ============================================================
 * Per-asset override (e.g. video pinned to one deployment)
 * ============================================================
 *
 * Pass `deploymentIdOverride` to bypass round-robin entirely. Useful when
 * one workflow needs a beefier GPU profile (typical for the 5-second promo
 * video) and we want to pin it to a single specific deployment regardless
 * of the rotation state. The override does *not* increment the counter.
 *
 * The asset-generator only ever calls runWorkflow() — backend choice and
 * deployment selection are invisible above this layer.
 */

interface WorkflowInputs {
  /** Prompt slot name → value. The workflow defines which slots exist. */
  [key: string]: string | number | boolean;
}

interface WorkflowResult {
  /** Base64-encoded image bytes if the workflow produced an image. */
  images: Buffer[];
  /** Base64-encoded MP4 if the workflow produced a video. */
  videos: Buffer[];
  /** Run identifier (provider-specific). */
  runId: string;
  /**
   * Deployment that actually ran this workflow. For the local backend this
   * is the literal string 'local'. Surfaced so callers can log to Sentry /
   * `dropship_ai_runs` and audit load distribution across deployments.
   */
  deploymentId: string;
}

type ComfyBackend = 'deploy' | 'local' | 'none';

function detectBackend(): ComfyBackend {
  // Explicit override first — the header doc always promised this, the code
  // now honors it. Lets a config with both COMFY_DEPLOY_API_KEY and
  // COMFYUI_URL pin the backend deterministically.
  const forced = process.env.COMFY_BACKEND?.trim().toLowerCase();
  if (forced === 'deploy') return process.env.COMFY_DEPLOY_API_KEY ? 'deploy' : 'none';
  if (forced === 'local') return process.env.COMFYUI_URL ? 'local' : 'none';
  if (process.env.COMFY_DEPLOY_API_KEY) return 'deploy';
  if (process.env.COMFYUI_URL) return 'local';
  return 'none';
}

/**
 * Parse a comma-separated env var into a deduplicated, trimmed list of
 * deployment IDs. Empty entries are dropped. Returns [] when the var is
 * unset or whitespace-only.
 *
 * Used both inline and via {@link getDeploymentIds} which adds the
 * legacy single-id env fallback.
 */
function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Resolve the deployment ID pool for a given env key.
 *
 * Resolution order:
 *  1. `<envKey>` (e.g. `COMFY_DEPLOYMENT_HERO`) — may be a single id or a
 *     comma-separated list. This is the *primary* source; existing single-
 *     value configs keep working transparently.
 *  2. `COMFY_DEPLOYMENT_IDS` — global comma-separated list, used as a
 *     fallback when the per-asset key is empty. Lets you point every
 *     asset at the same pool without setting four env vars.
 *  3. `COMFY_DEPLOYMENT_ID` — legacy single-id global fallback. Kept for
 *     backwards compatibility with the pre-P1.5 env layout.
 *
 * Always returns a deduplicated array. Empty when nothing is configured.
 */
export function getDeploymentIds(envKey?: string): string[] {
  if (envKey) {
    const fromKey = parseIdList(process.env[envKey]);
    if (fromKey.length > 0) return fromKey;
  }
  const fromGlobalList = parseIdList(process.env.COMFY_DEPLOYMENT_IDS);
  if (fromGlobalList.length > 0) return fromGlobalList;
  const legacy = process.env.COMFY_DEPLOYMENT_ID?.trim();
  if (legacy) return [legacy];
  return [];
}

/**
 * `true` when at least one ComfyUI backend is reachable. For the deploy
 * backend that means both an API key *and* at least one deployment ID
 * (either per-asset, global list, or legacy single). For the local
 * backend, the URL alone is enough — the graph is constructed inline.
 */
export function isComfyConfigured(): boolean {
  const backend = detectBackend();
  if (backend === 'none') return false;
  if (backend === 'local') return true;
  // For 'deploy' we need at least one deployment id resolvable from any
  // source (per-asset, global list, legacy single).
  return getDeploymentIds().length > 0;
}

/**
 * Per-pool round-robin counters. Keyed by the joined pool string so two
 * env vars sharing the same id list don't desync. In-process only.
 */
const rrCounters: Map<string, number> = new Map();

/**
 * Pick the next deployment ID from a pool using round-robin. Increments
 * the per-pool counter so successive calls fan out. Pure function w.r.t.
 * `ids` — call ordering is the only side effect.
 *
 * Exported for the unit tests; not meant for direct use by callers.
 */
export function pickRoundRobin(ids: string[]): string {
  if (ids.length === 0) {
    throw new Error('pickRoundRobin: empty deployment pool');
  }
  if (ids.length === 1) return ids[0]!;
  const key = ids.join('|');
  const n = rrCounters.get(key) ?? 0;
  rrCounters.set(key, n + 1);
  return ids[n % ids.length]!;
}

/**
 * Test-only reset of the round-robin counter map. Lets unit tests start
 * from a deterministic state without juggling module-load order.
 */
export function __resetRoundRobinForTests(): void {
  rrCounters.clear();
}

/* ============================================================
 * Comfy Deploy (cloud.comfy.org)
 * ============================================================
 * Docs: https://docs.comfydeploy.com/api-reference/run/queue-run
 *
 * Each workflow you publish there gets a `deployment_id`. Inputs map to the
 * `External*` nodes inside that workflow. We POST to /v2/run/deployment/queue
 * then poll /v2/run/{run_id} until status is "success" or "failed".
 */

const DEPLOY_BASE = process.env.COMFY_DEPLOY_API_URL || 'https://api.comfydeploy.com/api';

interface DeployQueueResponse {
  run_id: string;
}
interface DeployRunStatus {
  id: string;
  status: 'not-started' | 'running' | 'uploading' | 'success' | 'failed' | 'cancelled' | 'timeout';
  outputs?: Array<{
    data?: { images?: Array<{ url: string }>; gifs?: Array<{ url: string }>; files?: Array<{ url: string }> };
  }>;
  error?: string;
}

async function deployRun(deploymentId: string, inputs: WorkflowInputs): Promise<WorkflowResult> {
  const apiKey = process.env.COMFY_DEPLOY_API_KEY;
  if (!apiKey) throw new Error('COMFY_DEPLOY_API_KEY missing');

  const queueRes = await fetch(`${DEPLOY_BASE}/v2/run/deployment/queue`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ deployment_id: deploymentId, inputs }),
  });
  if (!queueRes.ok) {
    throw new Error(`comfy-deploy queue failed: ${queueRes.status} ${await queueRes.text()}`);
  }
  const { run_id: runId } = (await queueRes.json()) as DeployQueueResponse;

  // Poll. Generations take 20-90s for images, 60-180s for videos.
  const start = Date.now();
  const TIMEOUT_MS = 5 * 60_000;
  const POLL_MS = 3_000;
  const POLL_MAX_MS = 30_000;
  let pollMs = POLL_MS;

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, pollMs));
    pollMs = Math.min(Math.round(pollMs * 1.5), POLL_MAX_MS);
    const statusRes = await fetch(`${DEPLOY_BASE}/v2/run/${runId}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as DeployRunStatus;

    if (status.status === 'success') {
      const images: Buffer[] = [];
      const videos: Buffer[] = [];
      for (const out of status.outputs || []) {
        for (const img of out.data?.images || []) {
          const b = await fetchBinary(img.url);
          if (b) images.push(b);
        }
        for (const vid of out.data?.gifs || []) {
          const b = await fetchBinary(vid.url);
          if (b) videos.push(b);
        }
        for (const f of out.data?.files || []) {
          if (/\.(mp4|webm|mov)(\?|$)/i.test(f.url)) {
            const b = await fetchBinary(f.url);
            if (b) videos.push(b);
          }
        }
      }
      return { images, videos, runId, deploymentId };
    }
    if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'timeout') {
      throw new Error(`comfy-deploy run ${status.status}: ${status.error || 'no detail'}`);
    }
  }
  throw new Error(`comfy-deploy run ${runId} timed out after ${TIMEOUT_MS / 1000}s`);
}

/* ============================================================
 * Local ComfyUI (/prompt + /history + /view)
 * ============================================================
 * Used when you point COMFYUI_URL at a raw ComfyUI server (LAN, Tailscale,
 * or the Cloudflare tunnel https://comfy.hearst.app → GPU2). Two ways in:
 *
 *  - `graph`: a full ComfyUI prompt-JSON, sent verbatim. Escape hatch for
 *    bespoke workflows.
 *  - `inputs.prompt`: when no graph is given, runWorkflow builds a FLUX
 *    txt2img graph inline ({@link buildFluxTxt2ImgGraph}) from the same
 *    named slots the deploy backend uses (prompt / negative_prompt /
 *    width / height / seed). This keeps asset-generator backend-agnostic:
 *    it always passes `inputs`, and the local backend synthesizes the graph.
 *
 * Note: the local txt2img path ignores `reference_image` / `source_image`
 * slots (a stock ComfyUI has no load-image-from-URL node). Image-to-image
 * and video callers on the local backend get a fresh txt2img render from
 * the prompt alone — acceptable for hero/lifestyle assets, and runVideo's
 * "no video returned" guard fails loudly rather than silently.
 */

/** Models verified present on comfy.hearst.app (ComfyUI 0.18.1, GPU2 4x4090). */
const DEFAULT_FLUX_CHECKPOINT = 'FLUX1/flux1-dev-fp8.safetensors';
/** Full-bleed 16:9 hero default; both dims are multiples of 16 as FLUX requires. */
const DEFAULT_WIDTH = 1344;
const DEFAULT_HEIGHT = 768;
/** flux1-dev sweet spot. Schnell checkpoints only need 4 — tune via COMFYUI_STEPS. */
const DEFAULT_STEPS = 20;

export interface FluxTxt2ImgOptions {
  prompt: string;
  /** FLUX largely ignores negatives at cfg=1 but the slot is wired anyway. */
  negativePrompt?: string;
  width?: number;
  height?: number;
  /** Random per call when omitted, so retries don't replay the same image. */
  seed?: number;
  /** Defaults to COMFYUI_CHECKPOINT env, then the verified FLUX dev fp8. */
  checkpoint?: string;
  steps?: number;
}

/**
 * Build a ComfyUI prompt-JSON graph for FLUX txt2img via an all-in-one
 * checkpoint (CheckpointLoaderSimple → CLIPTextEncode ×2 →
 * EmptySD3LatentImage → KSampler(cfg=1) → VAEDecode → SaveImage).
 *
 * Matches the stock "flux dev checkpoint" workflow that ships with ComfyUI:
 * cfg pinned to 1.0 (FLUX guidance is baked into the distilled checkpoint),
 * euler/simple sampler-scheduler pair, SD3-class 16-channel empty latent.
 * Node classes used (CheckpointLoaderSimple, CLIPTextEncode,
 * EmptySD3LatentImage, KSampler, VAEDecode, SaveImage) are all core nodes,
 * verified against comfy.hearst.app 0.18.1 /object_info.
 */
export function buildFluxTxt2ImgGraph(opts: FluxTxt2ImgOptions): Record<string, object> {
  const checkpoint =
    opts.checkpoint || process.env.COMFYUI_CHECKPOINT?.trim() || DEFAULT_FLUX_CHECKPOINT;
  const stepsEnv = Number.parseInt(process.env.COMFYUI_STEPS || '', 10);
  const steps = opts.steps ?? (Number.isFinite(stepsEnv) && stepsEnv > 0 ? stepsEnv : DEFAULT_STEPS);
  // Snap dims to the /16 grid FLUX latents require; bad inputs 400 otherwise.
  const snap16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  const width = snap16(opts.width ?? DEFAULT_WIDTH);
  const height = snap16(opts.height ?? DEFAULT_HEIGHT);
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffff_ffff);

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['1', 1] },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.negativePrompt ?? '', clip: ['1', 1] },
    },
    '4': {
      class_type: 'EmptySD3LatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'dropship-asset', images: ['6', 0] },
    },
  };
}

interface LocalQueueResponse {
  prompt_id: string;
}

async function localRun(graph: object): Promise<WorkflowResult> {
  const base = (process.env.COMFYUI_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('COMFYUI_URL missing');

  const queueRes = await fetch(`${base}/prompt`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph }),
  });
  if (!queueRes.ok) {
    throw new Error(`local comfy queue failed: ${queueRes.status} ${await queueRes.text()}`);
  }
  const { prompt_id: promptId } = (await queueRes.json()) as LocalQueueResponse;

  const start = Date.now();
  const TIMEOUT_MS = 5 * 60_000;
  const POLL_MS = 2_000;

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const histRes = await fetch(`${base}/history/${promptId}`, { signal: AbortSignal.timeout(15_000) });
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<string, {
      outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }>; gifs?: Array<{ filename: string; subfolder: string; type: string }> }>;
      status?: { status_str?: string; completed?: boolean };
    }>;
    const entry = hist[promptId];
    if (!entry || !entry.status?.completed) continue;

    if (entry.status.status_str !== 'success') {
      throw new Error(`local comfy run failed: ${entry.status.status_str}`);
    }

    const images: Buffer[] = [];
    const videos: Buffer[] = [];
    for (const node of Object.values(entry.outputs || {})) {
      for (const img of node.images || []) {
        const url = `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        const b = await fetchBinary(url);
        if (b) images.push(b);
      }
      for (const gif of node.gifs || []) {
        const url = `${base}/view?filename=${encodeURIComponent(gif.filename)}&subfolder=${encodeURIComponent(gif.subfolder)}&type=${encodeURIComponent(gif.type)}`;
        const b = await fetchBinary(url);
        if (b) videos.push(b);
      }
    }
    return { images, videos, runId: promptId, deploymentId: 'local' };
  }
  throw new Error(`local comfy run ${promptId} timed out after ${TIMEOUT_MS / 1000}s`);
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/* ============================================================
 * Public surface
 * ============================================================ */

interface RunOptions {
  /**
   * Deploy backend: deployment id(s). Accepts a single string (legacy, for
   * one-deployment configs) or an array (round-robin pool).
   *
   * When omitted, falls back to {@link getDeploymentIds} with no envKey,
   * which reads `COMFY_DEPLOYMENT_IDS` then legacy `COMFY_DEPLOYMENT_ID`.
   */
  deploymentId?: string | string[];
  /**
   * Bypass round-robin and force a specific deployment id. Use this for
   * the video workflow if you want it pinned to one specific GPU profile.
   * Does not advance the round-robin counter.
   */
  deploymentIdOverride?: string;
  /** Local backend: full ComfyUI graph (prompt JSON). */
  graph?: object;
  /** Deploy backend: input slot map. */
  inputs?: WorkflowInputs;
}

export async function runWorkflow(opts: RunOptions): Promise<WorkflowResult> {
  const backend = detectBackend();
  if (backend === 'deploy') {
    // Resolve the pool: explicit override > opts.deploymentId list > env.
    let chosen: string | null = null;
    if (opts.deploymentIdOverride) {
      chosen = opts.deploymentIdOverride.trim();
    } else if (Array.isArray(opts.deploymentId)) {
      const pool = parseIdList(opts.deploymentId.join(','));
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    } else if (typeof opts.deploymentId === 'string') {
      // Single string may itself be comma-separated (env passthrough case).
      const pool = parseIdList(opts.deploymentId);
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    } else {
      const pool = getDeploymentIds();
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    }
    if (!chosen) throw new Error('deploymentId required for comfy-deploy backend');
    return deployRun(chosen, opts.inputs || {});
  }
  if (backend === 'local') {
    // Explicit graph wins. Otherwise synthesize a FLUX txt2img graph from
    // the deploy-style input slots so callers stay backend-agnostic.
    if (opts.graph) return localRun(opts.graph);
    const prompt = opts.inputs?.prompt;
    if (typeof prompt === 'string' && prompt.trim()) {
      const { negative_prompt, width, height, seed } = opts.inputs || {};
      return localRun(
        buildFluxTxt2ImgGraph({
          prompt,
          negativePrompt: typeof negative_prompt === 'string' ? negative_prompt : undefined,
          width: typeof width === 'number' ? width : undefined,
          height: typeof height === 'number' ? height : undefined,
          seed: typeof seed === 'number' ? seed : undefined,
        }),
      );
    }
    throw new Error('graph or inputs.prompt required for local comfy backend');
  }
  throw new Error('No ComfyUI backend configured (set COMFY_DEPLOY_API_KEY or COMFYUI_URL)');
}
