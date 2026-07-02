import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import {
  buildStableAudioGraph,
  extractAudioFileRefs,
  generateAmbientTrack,
  isAudioConfigured,
  muxAudioIntoVideo,
} from './audio-client';

/**
 * Ambient audio client tests. Zero real network, zero real ffmpeg:
 *
 *   1. buildStableAudioGraph — the graph shape the mono pipeline queues on
 *      comfy.hearst.app: stable-audio checkpoint + separately-loaded t5-base
 *      encoder + the seconds window on both the latent and the conditioning.
 *
 *   2. extractAudioFileRefs / generateAmbientTrack — parse the audio outputs
 *      out of /history and pull the file over /view (MSW-stubbed).
 *
 *   3. muxAudioIntoVideo — returns null cleanly when the ffmpeg binary can't
 *      be found (we point FFMPEG_PATH at a guaranteed-missing path), never
 *      throwing so the pipeline still ships the silent video.
 */

type GraphNode = { class_type: string; inputs: Record<string, unknown> };
const nodesOf = (g: Record<string, object>) => Object.values(g) as GraphNode[];
const nodeByClass = (g: Record<string, object>, cls: string) =>
  nodesOf(g).find((n) => n.class_type === cls)!;

describe('isAudioConfigured', () => {
  beforeEach(() => {
    vi.stubEnv('COMFYUI_URL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when COMFYUI_URL is unset', () => {
    expect(isAudioConfigured()).toBe(false);
  });

  it('is false when COMFYUI_URL is whitespace only', () => {
    vi.stubEnv('COMFYUI_URL', '   ');
    expect(isAudioConfigured()).toBe(false);
  });

  it('is true when COMFYUI_URL is set', () => {
    vi.stubEnv('COMFYUI_URL', 'https://comfy.hearst.app');
    expect(isAudioConfigured()).toBe(true);
  });
});

describe('buildStableAudioGraph', () => {
  beforeEach(() => {
    vi.stubEnv('COMFYUI_AUDIO_CHECKPOINT', '');
    vi.stubEnv('COMFYUI_AUDIO_CLIP', '');
    vi.stubEnv('COMFYUI_AUDIO_STEPS', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads the verified stable-audio-open checkpoint and t5-base encoder', () => {
    const g = buildStableAudioGraph({ prompt: 'calm ambient', seconds: 6 });
    expect(nodeByClass(g, 'CheckpointLoaderSimple').inputs.ckpt_name).toBe(
      'audio/stable-audio-open-1.0.safetensors',
    );
    const clip = nodeByClass(g, 'CLIPLoader').inputs;
    expect(clip.clip_name).toBe('t5-base/model.safetensors');
    expect(clip.type).toBe('stable_audio');
  });

  it('wires text encoders off the CLIPLoader, not the checkpoint (ckpt has no clip)', () => {
    const g = buildStableAudioGraph({ prompt: 'p', seconds: 6 });
    const clipNodeKey = Object.keys(g).find(
      (k) => (g[k] as GraphNode).class_type === 'CLIPLoader',
    )!;
    for (const n of nodesOf(g)) {
      if (n.class_type === 'CLIPTextEncode') {
        expect(n.inputs.clip).toEqual([clipNodeKey, 0]);
      }
    }
  });

  it('feeds the seconds window into both EmptyLatentAudio and ConditioningStableAudio', () => {
    const g = buildStableAudioGraph({ prompt: 'p', seconds: 6 });
    expect(nodeByClass(g, 'EmptyLatentAudio').inputs.seconds).toBe(6);
    const cond = nodeByClass(g, 'ConditioningStableAudio').inputs;
    expect(cond.seconds_start).toBe(0);
    expect(cond.seconds_total).toBe(6);
  });

  it('clamps seconds to the model window [1, 47.6]', () => {
    expect(nodeByClass(buildStableAudioGraph({ prompt: 'p', seconds: 0 }), 'EmptyLatentAudio').inputs.seconds).toBe(1);
    expect(nodeByClass(buildStableAudioGraph({ prompt: 'p', seconds: 999 }), 'EmptyLatentAudio').inputs.seconds).toBe(47.6);
  });

  it('routes VAEDecodeAudio → SaveAudioMP3 and passes prompt/negative/seed through', () => {
    const g = buildStableAudioGraph({
      prompt: 'warm pads',
      seconds: 6,
      negativePrompt: 'drums',
      seed: 42,
    });
    expect(nodeByClass(g, 'VAEDecodeAudio')).toBeDefined();
    expect(nodeByClass(g, 'SaveAudioMP3')).toBeDefined();
    const texts = nodesOf(g)
      .filter((n) => n.class_type === 'CLIPTextEncode')
      .map((n) => n.inputs.text);
    expect(texts).toContain('warm pads');
    expect(texts).toContain('drums');
    expect(nodeByClass(g, 'KSampler').inputs.seed).toBe(42);
  });

  it('honors env + option overrides for checkpoint, clip, and steps', () => {
    vi.stubEnv('COMFYUI_AUDIO_STEPS', '25');
    const fromEnv = buildStableAudioGraph({ prompt: 'p', seconds: 6 });
    expect(nodeByClass(fromEnv, 'KSampler').inputs.steps).toBe(25);

    const explicit = buildStableAudioGraph({
      prompt: 'p',
      seconds: 6,
      checkpoint: 'audio/other.safetensors',
      clipName: 'custom/t5.safetensors',
      steps: 10,
    });
    expect(nodeByClass(explicit, 'CheckpointLoaderSimple').inputs.ckpt_name).toBe('audio/other.safetensors');
    expect(nodeByClass(explicit, 'CLIPLoader').inputs.clip_name).toBe('custom/t5.safetensors');
    expect(nodeByClass(explicit, 'KSampler').inputs.steps).toBe(10);
  });
});

describe('extractAudioFileRefs', () => {
  it('pulls audio file refs from a SaveAudioMP3 history entry (audio: [...])', () => {
    const refs = extractAudioFileRefs({
      status: { status_str: 'success', completed: true },
      outputs: {
        '8': {
          audio: [{ filename: 'dropship-ambient_00001_.mp3', subfolder: 'audio', type: 'output' }],
        },
      },
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      filename: 'dropship-ambient_00001_.mp3',
      subfolder: 'audio',
      type: 'output',
    });
  });

  it('handles flac/wav/opus filenames and a SaveAudio→SaveAudioOpus node key swap', () => {
    const refs = extractAudioFileRefs({
      outputs: {
        '8': { audio: [{ filename: 'a.flac', subfolder: '', type: 'output' }] },
        '9': { audio: [{ filename: 'b.opus', subfolder: '', type: 'output' }] },
      },
    });
    expect(refs.map((r) => r.filename).sort()).toEqual(['a.flac', 'b.opus']);
  });

  it('ignores non-audio output arrays (e.g. images) and empty outputs', () => {
    expect(
      extractAudioFileRefs({
        outputs: { '7': { images: [{ filename: 'x.png', subfolder: '', type: 'output' }] } },
      }),
    ).toEqual([]);
    expect(extractAudioFileRefs({})).toEqual([]);
  });
});

describe('generateAmbientTrack local backend', () => {
  const BASE = 'http://127.0.0.1:8188';
  const MP3_BYTES = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]); // "ID3.."
  let submittedGraphs: Array<Record<string, GraphNode>> = [];

  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    submittedGraphs = [];
    vi.stubEnv('COMFYUI_URL', BASE);
    vi.stubEnv('COMFYUI_AUDIO_CHECKPOINT', '');
    vi.stubEnv('COMFYUI_AUDIO_CLIP', '');
    vi.stubEnv('COMFYUI_AUDIO_STEPS', '');

    // Collapse the 2s poll delay to a 0ms tick — ordering only.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout,
    );

    server.use(
      http.post(`${BASE}/prompt`, async ({ request }) => {
        const body = (await request.json()) as { prompt: Record<string, GraphNode> };
        submittedGraphs.push(body.prompt);
        return HttpResponse.json({ prompt_id: 'audio_prompt_1' });
      }),
      http.get(`${BASE}/history/audio_prompt_1`, () =>
        HttpResponse.json({
          audio_prompt_1: {
            status: { status_str: 'success', completed: true },
            outputs: {
              '8': {
                audio: [
                  { filename: 'dropship-ambient_00001_.mp3', subfolder: 'audio', type: 'output' },
                ],
              },
            },
          },
        }),
      ),
      http.get(`${BASE}/view`, () =>
        HttpResponse.arrayBuffer(MP3_BYTES.buffer as ArrayBuffer, {
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('queues the stable-audio graph and returns the downloaded mp3 buffer', async () => {
    const result = await generateAmbientTrack({ prompt: 'calm spa music', seconds: 6 });

    expect(result.promptId).toBe('audio_prompt_1');
    expect(result.extension).toBe('mp3');
    expect(Buffer.from(MP3_BYTES).equals(result.buffer)).toBe(true);

    expect(submittedGraphs).toHaveLength(1);
    const classes = Object.values(submittedGraphs[0]!).map((n) => n.class_type);
    expect(classes).toEqual(
      expect.arrayContaining([
        'CheckpointLoaderSimple',
        'CLIPLoader',
        'CLIPTextEncode',
        'ConditioningStableAudio',
        'EmptyLatentAudio',
        'KSampler',
        'VAEDecodeAudio',
        'SaveAudioMP3',
      ]),
    );
    const ckpt = Object.values(submittedGraphs[0]!).find(
      (n) => n.class_type === 'CheckpointLoaderSimple',
    )!;
    expect(ckpt.inputs.ckpt_name).toBe('audio/stable-audio-open-1.0.safetensors');
    const latent = Object.values(submittedGraphs[0]!).find(
      (n) => n.class_type === 'EmptyLatentAudio',
    )!;
    expect(latent.inputs.seconds).toBe(6);
  });

  it('throws when COMFYUI_URL is unset', async () => {
    vi.stubEnv('COMFYUI_URL', '');
    await expect(generateAmbientTrack({ prompt: 'p', seconds: 6 })).rejects.toThrow(
      /COMFYUI_URL missing/,
    );
  });

  it('throws when the run reports an error status', async () => {
    server.use(
      http.get(`${BASE}/history/audio_prompt_1`, () =>
        HttpResponse.json({
          audio_prompt_1: { status: { status_str: 'error', completed: true }, outputs: {} },
        }),
      ),
    );
    await expect(generateAmbientTrack({ prompt: 'p', seconds: 6 })).rejects.toThrow(
      /comfy audio run failed/,
    );
  });

  it('throws when a successful run produced no audio output', async () => {
    server.use(
      http.get(`${BASE}/history/audio_prompt_1`, () =>
        HttpResponse.json({
          audio_prompt_1: { status: { status_str: 'success', completed: true }, outputs: {} },
        }),
      ),
    );
    await expect(generateAmbientTrack({ prompt: 'p', seconds: 6 })).rejects.toThrow(
      /produced no audio output/,
    );
  });
});

describe('muxAudioIntoVideo', () => {
  const video = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]); // fake ftyp
  const audio = Buffer.from([0x49, 0x44, 0x33]); // "ID3"

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns null (never throws) when the ffmpeg binary cannot be found', async () => {
    // Point FFMPEG_PATH at a guaranteed-missing binary so execFile ENOENTs.
    vi.stubEnv('FFMPEG_PATH', '/nonexistent/definitely-not-ffmpeg');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = await muxAudioIntoVideo({
      videoBuffer: video,
      videoExt: 'mp4',
      audioBuffer: audio,
      audioExt: 'mp3',
    });

    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ffmpeg not found'));
  });

  it('returns null on a webm source too (transcode path also hits missing ffmpeg)', async () => {
    vi.stubEnv('FFMPEG_PATH', '/nonexistent/definitely-not-ffmpeg');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = await muxAudioIntoVideo({
      videoBuffer: video,
      videoExt: 'webm',
      audioBuffer: audio,
      audioExt: 'flac',
    });

    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ffmpeg not found'));
  });
});
