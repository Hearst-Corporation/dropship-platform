/**
 * Ambient audio client for the mono promo pipeline.
 *
 * Two independent pieces:
 *
 *  1. **generateAmbientTrack** — text→music via the self-hosted ComfyUI
 *     instance (COMFYUI_URL, e.g. https://comfy.hearst.app) using the
 *     **stable-audio-open-1.0** checkpoint. Builds the stock stable-audio
 *     graph inline, POSTs /prompt, polls /history, downloads the track via
 *     /view. Node classes and the checkpoint filename below are all verified
 *     against comfy.hearst.app 0.18.1 /object_info:
 *
 *       CheckpointLoaderSimple  audio/stable-audio-open-1.0.safetensors
 *                               (diffusion + VAE only — this instance's ckpt
 *                                ships NO bundled text encoder)
 *       CLIPLoader              t5-base/model.safetensors, type=stable_audio
 *                               (the 768-dim T5 stable-audio expects; loaded
 *                                separately, not from the checkpoint)
 *       CLIPTextEncode ×2       (positive + negative, off the CLIPLoader)
 *       ConditioningStableAudio (dedicated audio conditioning: seconds window)
 *       EmptyLatentAudio        (seconds → latent length)
 *       KSampler                (dpmpp_3m_sde_gpu / exponential, cfg≈5 — the
 *                                stock stable-audio template values)
 *       VAEDecodeAudio          → AUDIO
 *       SaveAudioMP3            (history outputs land under `audio: [...]`)
 *
 *  2. **muxAudioIntoVideo** — ffmpeg helper that muxes the generated track
 *     into the (silent) 5s promo video. Tries a stream-copy of the video
 *     first (`-c:v copy`), falls back to an h264 transcode when the source
 *     codec can't live in an mp4 container (e.g. VP9 webm). Audio is always
 *     re-encoded to AAC so the result plays everywhere. **Never throws** —
 *     if ffmpeg is missing (ENOENT) or both attempts fail, it warns and
 *     returns null so the pipeline ships the silent video instead of dying.
 *
 * This module is deliberately standalone: it duplicates the tiny /prompt +
 * /history + /view plumbing instead of importing comfy-client.ts (which is
 * owned by another workstream and image/video-shaped anyway).
 */

import { execFile } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Verified present on comfy.hearst.app via /object_info (CheckpointLoaderSimple.ckpt_name). */
const DEFAULT_AUDIO_CHECKPOINT = 'audio/stable-audio-open-1.0.safetensors';
/**
 * T5-base text encoder for stable-audio, loaded via CLIPLoader(type=stable_audio).
 * The stable-audio-open checkpoint on comfy.hearst.app carries no bundled CLIP,
 * so the encoder must be supplied separately (768-dim T5, not the 4096-dim
 * t5xxl the image workflows use). Verified in /object_info CLIPLoader.clip_name.
 */
const DEFAULT_AUDIO_CLIP = 't5-base/model.safetensors';
/** Stock ComfyUI stable-audio template sampling values. */
const DEFAULT_AUDIO_STEPS = 50;
const DEFAULT_AUDIO_CFG = 4.98;
const DEFAULT_AUDIO_SAMPLER = 'dpmpp_3m_sde_gpu';
const DEFAULT_AUDIO_SCHEDULER = 'exponential';
/**
 * stable-audio-open-1.0 was trained on ≤47s windows (EmptyLatentAudio
 * defaults to 47.6). Clamp to the model's useful range so a bad caller
 * can't queue a 1000s generation on the shared GPU.
 */
const MIN_SECONDS = 1;
const MAX_SECONDS = 47.6;

/** Negative prompt that keeps ambient beds clean of the usual failure modes. */
const DEFAULT_NEGATIVE = 'vocals, speech, harsh noise, distortion, low quality';

/** `true` when the self-hosted ComfyUI instance is reachable by config. */
export function isAudioConfigured(): boolean {
  return Boolean(process.env.COMFYUI_URL?.trim());
}

export interface AmbientTrackOptions {
  /** Music description, e.g. "calm ambient spa music, soft piano, no vocals". */
  prompt: string;
  /** Track length in seconds. Clamped to [1, 47.6] (model window). */
  seconds: number;
  /** Defaults to a curated anti-artifact negative. */
  negativePrompt?: string;
  /** Random per call when omitted, so retries don't replay the same track. */
  seed?: number;
  /** Defaults to COMFYUI_AUDIO_STEPS env, then 50 (stock template). */
  steps?: number;
  /** Defaults to the verified stable-audio-open checkpoint. */
  checkpoint?: string;
  /** T5-base text encoder (CLIPLoader). Defaults to the verified t5-base file. */
  clipName?: string;
}

export interface AmbientTrackResult {
  /** Raw audio bytes as saved by ComfyUI. */
  buffer: Buffer;
  /** File extension without the dot: 'mp3' (SaveAudioMP3), 'flac', 'wav', … */
  extension: string;
  /** ComfyUI prompt id, for logging/audit. */
  promptId: string;
}

/**
 * Build the ComfyUI prompt-JSON graph for stable-audio-open text→music.
 *
 * CheckpointLoaderSimple (diffusion + VAE) + CLIPLoader(t5-base, stable_audio)
 * → CLIPTextEncode(pos/neg) → ConditioningStableAudio (injects the seconds
 * window into both conditionings) → EmptyLatentAudio → KSampler →
 * VAEDecodeAudio → SaveAudioMP3.
 *
 * The text encoder comes from CLIPLoader, not the checkpoint, because the
 * stable-audio-open ckpt on comfy.hearst.app bundles no CLIP (a checkpoint
 * `clip` output there is null → "clip input is invalid: None").
 *
 * Exported for the unit tests; generateAmbientTrack is the real entry point.
 */
export function buildStableAudioGraph(opts: AmbientTrackOptions): Record<string, object> {
  const checkpoint =
    opts.checkpoint || process.env.COMFYUI_AUDIO_CHECKPOINT?.trim() || DEFAULT_AUDIO_CHECKPOINT;
  const clipName =
    opts.clipName || process.env.COMFYUI_AUDIO_CLIP?.trim() || DEFAULT_AUDIO_CLIP;
  const stepsEnv = Number.parseInt(process.env.COMFYUI_AUDIO_STEPS || '', 10);
  const steps =
    opts.steps ?? (Number.isFinite(stepsEnv) && stepsEnv > 0 ? stepsEnv : DEFAULT_AUDIO_STEPS);
  const seconds = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, opts.seconds));
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffff_ffff);
  const negative = opts.negativePrompt ?? DEFAULT_NEGATIVE;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '9': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: clipName, type: 'stable_audio' },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['9', 0] },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negative, clip: ['9', 0] },
    },
    '4': {
      class_type: 'ConditioningStableAudio',
      inputs: {
        positive: ['2', 0],
        negative: ['3', 0],
        seconds_start: 0,
        seconds_total: seconds,
      },
    },
    '5': {
      class_type: 'EmptyLatentAudio',
      inputs: { seconds, batch_size: 1 },
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg: DEFAULT_AUDIO_CFG,
        sampler_name: DEFAULT_AUDIO_SAMPLER,
        scheduler: DEFAULT_AUDIO_SCHEDULER,
        denoise: 1.0,
        model: ['1', 0],
        positive: ['4', 0],
        negative: ['4', 1],
        latent_image: ['5', 0],
      },
    },
    '7': {
      class_type: 'VAEDecodeAudio',
      inputs: { samples: ['6', 0], vae: ['1', 2] },
    },
    '8': {
      class_type: 'SaveAudioMP3',
      inputs: { filename_prefix: 'audio/dropship-ambient', quality: 'V0', audio: ['7', 0] },
    },
  };
}

interface ComfyFileRef {
  filename: string;
  subfolder: string;
  type: string;
}

interface ComfyHistoryEntry {
  outputs?: Record<string, Record<string, unknown>>;
  status?: { status_str?: string; completed?: boolean };
}

/**
 * Collect every saved file reference from a history entry's outputs,
 * whatever key the node used (`audio` for SaveAudio*, but scan every
 * array defensively so a SaveAudio→SaveAudioOpus swap keeps working).
 */
export function extractAudioFileRefs(entry: ComfyHistoryEntry): ComfyFileRef[] {
  const refs: ComfyFileRef[] = [];
  for (const node of Object.values(entry.outputs || {})) {
    for (const value of Object.values(node)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as ComfyFileRef).filename === 'string'
        ) {
          const ref = item as ComfyFileRef;
          if (/\.(mp3|flac|wav|opus|ogg|m4a)$/i.test(ref.filename)) {
            refs.push({
              filename: ref.filename,
              subfolder: ref.subfolder ?? '',
              type: ref.type ?? 'output',
            });
          }
        }
      }
    }
  }
  return refs;
}

/** File extension (no dot, lowercased) from a ComfyUI output filename. */
function audioExtension(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  return m ? m[1]!.toLowerCase() : 'mp3';
}

/**
 * Generate an ambient music track on the self-hosted ComfyUI instance.
 * Throws when COMFYUI_URL is unset or the run fails/times out — callers
 * gate on {@link isAudioConfigured} and catch, same contract as the
 * image pipeline.
 */
export async function generateAmbientTrack(opts: AmbientTrackOptions): Promise<AmbientTrackResult> {
  const base = (process.env.COMFYUI_URL || '').trim().replace(/\/$/, '');
  if (!base) throw new Error('COMFYUI_URL missing — audio generation not configured');

  const graph = buildStableAudioGraph(opts);

  const queueRes = await fetch(`${base}/prompt`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph }),
  });
  if (!queueRes.ok) {
    throw new Error(`comfy audio queue failed: ${queueRes.status} ${await queueRes.text()}`);
  }
  const { prompt_id: promptId } = (await queueRes.json()) as { prompt_id: string };

  // A 6s track samples in ~10-20s on a 4090, but the queue is shared with
  // the image/video workflows — keep the same 5 min budget as comfy-client.
  const start = Date.now();
  const TIMEOUT_MS = 5 * 60_000;
  const POLL_MS = 2_000;

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const histRes = await fetch(`${base}/history/${promptId}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<string, ComfyHistoryEntry>;
    const entry = hist[promptId];
    if (!entry || !entry.status?.completed) continue;

    if (entry.status.status_str !== 'success') {
      throw new Error(`comfy audio run failed: ${entry.status.status_str}`);
    }

    const refs = extractAudioFileRefs(entry);
    if (refs.length === 0) {
      throw new Error('comfy audio run succeeded but produced no audio output');
    }
    const ref = refs[0]!;
    const url =
      `${base}/view?filename=${encodeURIComponent(ref.filename)}` +
      `&subfolder=${encodeURIComponent(ref.subfolder)}` +
      `&type=${encodeURIComponent(ref.type)}`;
    const fileRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!fileRes.ok) {
      throw new Error(`comfy audio /view failed: ${fileRes.status}`);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new Error('comfy audio /view returned an empty file');
    }
    return { buffer, extension: audioExtension(ref.filename), promptId };
  }
  throw new Error(`comfy audio run ${promptId} timed out after ${TIMEOUT_MS / 1000}s`);
}

/* ============================================================
 * ffmpeg mux — silent promo video + generated ambient track → mp4
 * ============================================================ */

export interface MuxOptions {
  /** The silent promo clip bytes. */
  videoBuffer: Buffer;
  /** Container extension of the clip, no dot: 'mp4', 'webm', 'mov', … */
  videoExt: string;
  /** Generated track bytes. */
  audioBuffer: Buffer;
  /** Track extension, no dot: 'mp3', 'flac', 'wav', … */
  audioExt: string;
}

/** Keep temp file extensions boring so a weird input can't escape the dir. */
function safeExt(ext: string, fallback: string): string {
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean || fallback;
}

/**
 * Mux `audioBuffer` into `videoBuffer` and return the resulting mp4 bytes.
 *
 * `-shortest` trims whichever stream is longer (the 6s track vs the 5s
 * promo clip), audio is re-encoded to AAC 128k, and the video stream is
 * stream-copied when the container allows it (mp4/mov/m4v h264 sources),
 * with an automatic h264 transcode fallback for everything else (webm…).
 *
 * **Never throws.** Missing ffmpeg binary (ENOENT) or a failed encode →
 * console.warn + `null`; the caller keeps the silent video.
 */
export async function muxAudioIntoVideo(opts: MuxOptions): Promise<Buffer | null> {
  const ffmpeg = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  let dir: string | null = null;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), 'dropship-mux-'));
    const videoPath = path.join(dir, `in-video.${safeExt(opts.videoExt, 'mp4')}`);
    const audioPath = path.join(dir, `in-audio.${safeExt(opts.audioExt, 'mp3')}`);
    const outPath = path.join(dir, 'out.mp4');
    await writeFile(videoPath, opts.videoBuffer);
    await writeFile(audioPath, opts.audioBuffer);

    const baseArgs = [
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
    ];

    // Attempt 1: stream-copy the video (fast, lossless) — only meaningful
    // when the source container already holds an mp4-compatible codec.
    const canTryCopy = /^(mp4|m4v|mov)$/.test(safeExt(opts.videoExt, 'mp4'));
    if (canTryCopy) {
      try {
        await execFileAsync(ffmpeg, [...baseArgs, '-c:v', 'copy', outPath], {
          timeout: 120_000,
          maxBuffer: 16 * 1024 * 1024,
        });
        return await readFile(outPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          console.warn('[audio-client] ffmpeg not found — shipping the silent video');
          return null;
        }
        // Copy failed (odd codec in an mp4 shell, etc.) — fall through to
        // the transcode attempt below.
      }
    }

    // Attempt 2: full h264 transcode (webm/VP9 sources, or copy failure).
    await execFileAsync(
      ffmpeg,
      [...baseArgs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outPath],
      { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return await readFile(outPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      console.warn('[audio-client] ffmpeg not found — shipping the silent video');
    } else {
      console.warn(
        `[audio-client] mux failed — shipping the silent video: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return null;
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
