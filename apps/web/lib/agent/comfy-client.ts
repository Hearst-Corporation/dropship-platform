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
 *  - `inputs.prompt` + `inputs.reference_image` (http URL): runWorkflow
 *    downloads the reference image Node-side, uploads it to the instance
 *    via POST /upload/image (unique filename under a `dropship-refs/`
 *    subfolder), then builds a **FLUX Kontext img2img graph**
 *    ({@link buildFluxKontextGraph}): LoadImage → FluxKontextImageScale →
 *    VAEEncode → ReferenceLatent + FluxGuidance → KSampler → SaveImage.
 *    This is what keeps the *actual supplier product* in cutout/lifestyle
 *    renders instead of hallucinating a lookalike (critical for mono-
 *    product landings). If the reference download/upload fails, we fall
 *    back to txt2img with a loud console.warn rather than failing the run.
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

/* ------------------------------------------------------------
 * FLUX Kontext img2img (reference-preserving edit)
 * ------------------------------------------------------------
 * Mirrors the official ComfyUI "flux_kontext_dev" template (0.18.x):
 * the reference image is scaled to a Kontext-friendly resolution
 * (FluxKontextImageScale), VAE-encoded, and injected into the text
 * conditioning via ReferenceLatent so the sampler edits *that* product
 * instead of imagining a new one. All node classes and model filenames
 * below are verified against comfy.hearst.app /object_info:
 *
 *   UNETLoader        flux1-dev-kontext_fp8_scaled.safetensors
 *   DualCLIPLoader    clip_l.safetensors + t5xxl_fp8_e4m3fn_scaled.safetensors (type=flux)
 *   VAELoader         ae.safetensors
 *   LoadImage / FluxKontextImageScale / VAEEncode / CLIPTextEncode /
 *   ReferenceLatent / FluxGuidance / ConditioningZeroOut / KSampler /
 *   VAEDecode / SaveImage — all core 0.18 nodes.
 */

/** Verified on comfy.hearst.app via /object_info (UNETLoader.unet_name). */
const DEFAULT_KONTEXT_UNET = 'flux1-dev-kontext_fp8_scaled.safetensors';
const DEFAULT_KONTEXT_CLIP_L = 'clip_l.safetensors';
const DEFAULT_KONTEXT_T5 = 't5xxl_fp8_e4m3fn_scaled.safetensors';
const DEFAULT_KONTEXT_VAE = 'ae.safetensors';
/** Official kontext template default (FluxGuidance node ships 2.5 there). */
const DEFAULT_KONTEXT_GUIDANCE = 2.5;

export interface FluxKontextOptions {
  prompt: string;
  /**
   * Server-side image name as returned by /upload/image — either a bare
   * filename or `subfolder/filename` when uploaded with a subfolder.
   * LoadImage resolves it against the ComfyUI input directory.
   */
  referenceImageName: string;
  /** Random per call when omitted, so retries don't replay the same image. */
  seed?: number;
  steps?: number;
  /** FluxGuidance strength; kontext template default is 2.5. */
  guidance?: number;
  /** Defaults to COMFYUI_KONTEXT_UNET env, then the verified fp8 kontext UNET. */
  unetName?: string;
}

/**
 * Build a ComfyUI prompt-JSON graph for FLUX Kontext img2img:
 * LoadImage → FluxKontextImageScale → VAEEncode gives the reference latent;
 * CLIPTextEncode(prompt) → ReferenceLatent(latent) → FluxGuidance is the
 * positive conditioning; ConditioningZeroOut is the negative (FLUX cfg=1).
 * The KSampler denoises *from* the reference latent at denoise=1.0 — with
 * kontext weights that means "edit this image", not "start from noise".
 */
export function buildFluxKontextGraph(opts: FluxKontextOptions): Record<string, object> {
  const unetName = opts.unetName || process.env.COMFYUI_KONTEXT_UNET?.trim() || DEFAULT_KONTEXT_UNET;
  const stepsEnv = Number.parseInt(process.env.COMFYUI_STEPS || '', 10);
  const steps = opts.steps ?? (Number.isFinite(stepsEnv) && stepsEnv > 0 ? stepsEnv : DEFAULT_STEPS);
  const guidance = opts.guidance ?? DEFAULT_KONTEXT_GUIDANCE;
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffff_ffff);

  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: unetName, weight_dtype: 'default' },
    },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: DEFAULT_KONTEXT_CLIP_L,
        clip_name2: DEFAULT_KONTEXT_T5,
        type: 'flux',
      },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: DEFAULT_KONTEXT_VAE },
    },
    '4': {
      class_type: 'LoadImage',
      inputs: { image: opts.referenceImageName },
    },
    '5': {
      class_type: 'FluxKontextImageScale',
      inputs: { image: ['4', 0] },
    },
    '6': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['5', 0], vae: ['3', 0] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['2', 0] },
    },
    '8': {
      class_type: 'ReferenceLatent',
      inputs: { conditioning: ['7', 0], latent: ['6', 0] },
    },
    '9': {
      class_type: 'FluxGuidance',
      inputs: { conditioning: ['8', 0], guidance },
    },
    '10': {
      class_type: 'ConditioningZeroOut',
      inputs: { conditioning: ['7', 0] },
    },
    '11': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['9', 0],
        negative: ['10', 0],
        latent_image: ['6', 0],
      },
    },
    '12': {
      class_type: 'VAEDecode',
      inputs: { samples: ['11', 0], vae: ['3', 0] },
    },
    '13': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'dropship-kontext', images: ['12', 0] },
    },
  };
}

/* ------------------------------------------------------------
 * Wan 2.1 image-to-video (5-second promo clip)
 * ------------------------------------------------------------
 * Mirrors the stock ComfyUI wan2.1 i2v template: the source image (hero or
 * cutout of the actual product) is uploaded to the instance, CLIP-Vision-
 * encoded (clip_vision_h) and injected as `start_image` +
 * `clip_vision_output` into WanImageToVideo, which emits the i2v latent the
 * KSampler denoises. Output goes through CreateVideo → SaveVideo as an
 * **mp4 (h264)** — both nodes verified present on comfy.hearst.app 0.18.1.
 *
 * Model stack, all filenames verified against /object_info listers:
 *
 *   UNETLoader        wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors (+bf16)
 *   CLIPLoader        umt5_xxl_fp8_e4m3fn_scaled.safetensors (type=wan)
 *   CLIPVisionLoader  clip_vision_h.safetensors
 *   VAELoader         wan_2.1_vae.safetensors
 *   LoadImage / CLIPVisionEncode / CLIPTextEncode / ModelSamplingSD3 /
 *   WanImageToVideo / KSampler / VAEDecode / CreateVideo / SaveVideo —
 *   all core 0.18 nodes.
 *
 * Defaults follow the WanImageToVideo node defaults (832×480, 81 frames)
 * at 16 fps → (81-1)/16 = 5.0 s of video. The 720p UNET renders fine at
 * 480p and it's the resolution/VRAM/time compromise that fits a single
 * 4090. Steps are kept low (15) — wan i2v is watchable at 15 and every
 * step is ~linear in wall-clock on this box.
 */

/** Verified on comfy.hearst.app via /object_info (UNETLoader.unet_name). */
const DEFAULT_WAN_UNET = 'wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors';
const DEFAULT_WAN_CLIP = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors';
const DEFAULT_WAN_CLIP_VISION = 'clip_vision_h.safetensors';
const DEFAULT_WAN_VAE = 'wan_2.1_vae.safetensors';
/**
 * WanImageToVideo node defaults. 832×480×81 OOMs on the shared GPU box (the
 * card also hosts vllm/invokeai residents) — 512×288×61 fits with headroom.
 * Override via COMFYUI_VIDEO_WIDTH/HEIGHT env when the box is dedicated.
 */
const DEFAULT_WAN_WIDTH = 512;
const DEFAULT_WAN_HEIGHT = 288;
/** 61 frames @ 16 fps = 3.75 s ((length-1)/fps). */
const DEFAULT_WAN_LENGTH = 61;
const DEFAULT_WAN_FPS = 16;
/** Low on purpose: promo-watchable, ~linear time per step on one 4090. */
const DEFAULT_WAN_STEPS = 12;
/** Stock wan template values: shift 8 (ModelSamplingSD3), cfg 6, uni_pc. */
const DEFAULT_WAN_SHIFT = 8.0;
const DEFAULT_WAN_CFG = 6.0;
/** Stock wan template negative prompt (the model was trained against it). */
const DEFAULT_WAN_NEGATIVE =
  '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';
/**
 * Video runs are far heavier than images: 81 frames × 15 steps of a 14B
 * DiT on one 4090 measured ≈ 9-10 min via the tunnel. Default generous,
 * overridable via COMFYUI_VIDEO_TIMEOUT_MS.
 */
const DEFAULT_VIDEO_TIMEOUT_MS = 15 * 60_000;

function wanVideoTimeoutMs(): number {
  const env = Number.parseInt(process.env.COMFYUI_VIDEO_TIMEOUT_MS || '', 10);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_VIDEO_TIMEOUT_MS;
}

export interface WanI2VOptions {
  /** Camera/motion description ("slow cinematic push-in…"). */
  prompt: string;
  /** Defaults to the stock wan negative the model was trained against. */
  negativePrompt?: string;
  /**
   * Server-side image name as returned by /upload/image (either bare
   * filename or `subfolder/filename`). LoadImage resolves it against the
   * ComfyUI input directory. Upload first via {@link uploadReferenceImage}.
   */
  sourceImageName: string;
  width?: number;
  height?: number;
  /** Frame count. Snapped to the 4k+1 grid WanImageToVideo requires. */
  lengthFrames?: number;
  /** Output frame rate (CreateVideo). Duration = (length-1)/fps. */
  fps?: number;
  /** Random per call when omitted, so retries don't replay the same clip. */
  seed?: number;
  /** Defaults to COMFYUI_VIDEO_STEPS env, then 15. */
  steps?: number;
  /** Defaults to COMFYUI_VIDEO_UNET env, then the verified fp8 i2v UNET. */
  unetName?: string;
}

/**
 * Build a ComfyUI prompt-JSON graph for Wan 2.1 image-to-video:
 * LoadImage → CLIPVisionEncode(clip_vision_h) feeds WanImageToVideo
 * together with the text conditioning (umt5 CLIPTextEncode ×2) and the wan
 * VAE; the resulting latent is denoised by KSampler under
 * ModelSamplingSD3(shift=8), decoded, then packed to **mp4 h264** via
 * CreateVideo(fps) → SaveVideo.
 */
export function buildWanI2VGraph(opts: WanI2VOptions): Record<string, object> {
  const unetName = opts.unetName || process.env.COMFYUI_VIDEO_UNET?.trim() || DEFAULT_WAN_UNET;
  const stepsEnv = Number.parseInt(process.env.COMFYUI_VIDEO_STEPS || '', 10);
  const steps =
    opts.steps ?? (Number.isFinite(stepsEnv) && stepsEnv > 0 ? stepsEnv : DEFAULT_WAN_STEPS);
  // WanImageToVideo wants /16 dims (step 16) and a 4k+1 frame count (step 4
  // from min 1). Off-grid values 400 at /prompt validation.
  const snap16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  const width = snap16(opts.width ?? DEFAULT_WAN_WIDTH);
  const height = snap16(opts.height ?? DEFAULT_WAN_HEIGHT);
  const rawLength = opts.lengthFrames ?? DEFAULT_WAN_LENGTH;
  const length = Math.max(1, Math.round((rawLength - 1) / 4) * 4 + 1);
  const fps = opts.fps ?? DEFAULT_WAN_FPS;
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffff_ffff);

  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: { unet_name: unetName, weight_dtype: 'default' },
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: DEFAULT_WAN_CLIP, type: 'wan' },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: DEFAULT_WAN_VAE },
    },
    '4': {
      class_type: 'CLIPVisionLoader',
      inputs: { clip_name: DEFAULT_WAN_CLIP_VISION },
    },
    '5': {
      class_type: 'LoadImage',
      inputs: { image: opts.sourceImageName },
    },
    '6': {
      class_type: 'CLIPVisionEncode',
      inputs: { clip_vision: ['4', 0], image: ['5', 0], crop: 'none' },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['2', 0] },
    },
    '8': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.negativePrompt ?? DEFAULT_WAN_NEGATIVE, clip: ['2', 0] },
    },
    '9': {
      class_type: 'ModelSamplingSD3',
      inputs: { model: ['1', 0], shift: DEFAULT_WAN_SHIFT },
    },
    '10': {
      class_type: 'WanImageToVideo',
      inputs: {
        positive: ['7', 0],
        negative: ['8', 0],
        vae: ['3', 0],
        clip_vision_output: ['6', 0],
        start_image: ['5', 0],
        width,
        height,
        length,
        batch_size: 1,
      },
    },
    '11': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: DEFAULT_WAN_CFG,
        sampler_name: 'uni_pc',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['9', 0],
        positive: ['10', 0],
        negative: ['10', 1],
        latent_image: ['10', 2],
      },
    },
    '12': {
      class_type: 'VAEDecode',
      inputs: { samples: ['11', 0], vae: ['3', 0] },
    },
    '13': {
      class_type: 'CreateVideo',
      inputs: { images: ['12', 0], fps },
    },
    '14': {
      class_type: 'SaveVideo',
      inputs: {
        video: ['13', 0],
        filename_prefix: 'video/dropship-promo',
        format: 'mp4',
        codec: 'h264',
      },
    },
  };
}

/** Subfolder inside the ComfyUI input dir where reference uploads land. */
const REF_UPLOAD_SUBFOLDER = 'dropship-refs';

interface UploadImageResponse {
  name: string;
  subfolder?: string;
  type?: string;
}

/**
 * Derive a safe image file extension from a Content-Type header or URL
 * path. Defaults to .png — ComfyUI's LoadImage sniffs actual bytes, the
 * extension only needs to pass the upload endpoint's image filter.
 */
function refImageExtension(contentType: string | null, url: string): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  const m = /\.(jpe?g|png|webp)(?:\?|$)/i.exec(url);
  if (m) return m[1]!.toLowerCase().replace('jpeg', 'jpg');
  return 'png';
}

/**
 * Download `imageUrl` Node-side and push it to the local ComfyUI instance
 * via POST /upload/image (multipart). Returns the server-side image name
 * (`subfolder/filename`) ready for a LoadImage node. Filenames are unique
 * per call (timestamp + random) so parallel store creations never clash
 * and `overwrite` semantics never bite.
 */
export async function uploadReferenceImage(base: string, imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) {
    throw new Error(`reference image download failed: ${imgRes.status} ${imageUrl}`);
  }
  const bytes = await imgRes.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error(`reference image download empty: ${imageUrl}`);
  }
  const ext = refImageExtension(imgRes.headers.get('content-type'), imageUrl);
  const filename = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const form = new FormData();
  form.append('image', new Blob([bytes], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` }), filename);
  form.append('subfolder', REF_UPLOAD_SUBFOLDER);
  form.append('type', 'input');

  const upRes = await fetch(`${base}/upload/image`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    body: form,
  });
  if (!upRes.ok) {
    throw new Error(`comfy /upload/image failed: ${upRes.status} ${await upRes.text()}`);
  }
  const uploaded = (await upRes.json()) as UploadImageResponse;
  const sub = uploaded.subfolder || '';
  return sub ? `${sub}/${uploaded.name}` : uploaded.name;
}

interface LocalQueueResponse {
  prompt_id: string;
}

/** One output file entry in a /history node result. */
interface LocalHistoryFile {
  filename: string;
  subfolder: string;
  type: string;
  /** Some video nodes annotate a MIME-ish format, e.g. "video/h264-mp4". */
  format?: string;
}

/**
 * Video outputs land under different keys depending on the node family:
 * SaveVideo/SaveWEBM report under `images` (with an `animated` flag and a
 * video filename/format), VHS-style nodes use `gifs`, and some report a
 * literal `videos` array. We collect all three and classify by content.
 */
interface LocalHistoryNodeOutput {
  images?: LocalHistoryFile[];
  gifs?: LocalHistoryFile[];
  videos?: LocalHistoryFile[];
}

/** True when a history output entry is a video file, whatever key it sat under. */
function isVideoFile(f: LocalHistoryFile): boolean {
  if (f.format && f.format.toLowerCase().startsWith('video/')) return true;
  return /\.(mp4|webm|mov)$/i.test(f.filename);
}

async function localRun(graph: object, timeoutMs = 5 * 60_000): Promise<WorkflowResult> {
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
  const POLL_MS = 2_000;

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const histRes = await fetch(`${base}/history/${promptId}`, { signal: AbortSignal.timeout(15_000) });
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<string, {
      outputs?: Record<string, LocalHistoryNodeOutput>;
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
        const b = await fetchBinary(viewUrl(base, img));
        if (!b) continue;
        // SaveVideo/SaveWEBM report their output under `images` — route
        // by actual content so promo.mp4 never masquerades as a hero PNG.
        if (isVideoFile(img)) videos.push(b);
        else images.push(b);
      }
      for (const vid of [...(node.gifs || []), ...(node.videos || [])]) {
        const b = await fetchBinary(viewUrl(base, vid));
        if (b) videos.push(b);
      }
    }
    return { images, videos, runId: promptId, deploymentId: 'local' };
  }
  throw new Error(`local comfy run ${promptId} timed out after ${timeoutMs / 1000}s`);
}

function viewUrl(base: string, f: LocalHistoryFile): string {
  return `${base}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder)}&type=${encodeURIComponent(f.type)}`;
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
    // Explicit graph wins. Otherwise synthesize a graph from the deploy-
    // style input slots so callers stay backend-agnostic:
    //  - reference_image (http URL) + prompt → FLUX Kontext img2img that
    //    preserves the actual supplier product in the render;
    //  - prompt alone → FLUX txt2img (unchanged legacy path).
    if (opts.graph) return localRun(opts.graph);
    const prompt = opts.inputs?.prompt;
    if (typeof prompt === 'string' && prompt.trim()) {
      const { negative_prompt, width, height, seed, reference_image, source_image } = opts.inputs || {};

      // source_image (without reference_image) → Wan 2.1 image-to-video:
      // the promo clip animates the actual product still. Heaviest workflow,
      // so it runs under the dedicated (longer) video poll timeout.
      if (
        typeof source_image === 'string' &&
        /^https?:\/\//i.test(source_image.trim()) &&
        typeof reference_image !== 'string'
      ) {
        const base = (process.env.COMFYUI_URL || '').replace(/\/$/, '');
        const sourceImageName = await uploadReferenceImage(base, source_image.trim());
        return localRun(
          buildWanI2VGraph({
            prompt,
            negativePrompt: typeof negative_prompt === 'string' ? negative_prompt : undefined,
            sourceImageName,
            seed: typeof seed === 'number' ? seed : undefined,
          }),
          wanVideoTimeoutMs(),
        );
      }

      if (typeof reference_image === 'string' && /^https?:\/\//i.test(reference_image.trim())) {
        const base = (process.env.COMFYUI_URL || '').replace(/\/$/, '');
        try {
          const referenceImageName = await uploadReferenceImage(base, reference_image.trim());
          return await localRun(
            buildFluxKontextGraph({
              prompt,
              referenceImageName,
              seed: typeof seed === 'number' ? seed : undefined,
            }),
          );
        } catch (err) {
          // Reference path failed (download, upload, or kontext run):
          // degrade to txt2img rather than losing the asset entirely.
          // Loud on purpose — a mono store landing with a generic product
          // is a quality incident someone should notice in the logs.
          console.warn(
            `[comfy-client] kontext reference path failed, falling back to txt2img: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

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
