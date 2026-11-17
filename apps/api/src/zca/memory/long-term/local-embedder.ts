import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { DEFAULT_EMBEDDING_MODEL } from '../../../config/configuration';

/** Size of the MiniLM vectors; the `zca_message_embeddings.embedding` column has this size. */
export const EMBEDDING_DIMENSIONS = 384;
/**
 * Texts per model call. A batch is padded to its longest text, so small batches keep the peak low
 * (measured on 1500 chat-length texts in node:22-bookworm: batch 8 peaks ~680 MB RSS, batch 32
 * ~1 GB, and is faster with 2 threads).
 */
export const EMBED_BATCH_SIZE = 8;
/**
 * MiniLM was trained on 128 tokens (~500 Vietnamese characters); longer text adds memory and time
 * but not meaning. The message itself comes first in the embedded text, so it is what survives.
 */
export const EMBED_MAX_CHARS = 500;
/**
 * ONNX runtime session: no memory arena or memory pattern (they keep the largest batch's buffers
 * for the life of the process: the API grew to 2.4 GB on prod after the first backfill), and two
 * threads (one query takes milliseconds; more threads only add per-thread allocations). The image
 * also sets `MALLOC_ARENA_MAX=2` so glibc does not keep one heap per ONNX thread.
 */
export const EMBEDDER_SESSION_OPTIONS = {
  enableCpuMemArena: false,
  enableMemPattern: false,
  intraOpNumThreads: 2,
  interOpNumThreads: 1,
} as const;
/** After a failed model load, the next try waits this long (a broken model is not reloaded per message). */
export const EMBEDDER_RETRY_MS = 10 * 60 * 1000;

export type EmbedderState = 'idle' | 'loading' | 'ready' | 'failed';

/** Turns texts into normalized vectors; `null` when the model is not available. */
export interface TextEmbedder {
  readonly model: string;
  state(): EmbedderState;
  embed(texts: readonly string[]): Promise<number[][] | null>;
}

interface EmbedderSettings {
  model: string;
  modelDir: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/** Rows of `tolist()` checked to be vectors of the expected size. */
export function readVectors(value: unknown, count: number): number[][] | null {
  if (!Array.isArray(value) || value.length !== count) return null;
  const vectors: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== EMBEDDING_DIMENSIONS) return null;
    const vector: number[] = [];
    for (const item of row) {
      if (typeof item !== 'number' || !Number.isFinite(item)) return null;
      vector.push(item);
    }
    vectors.push(vector);
  }
  return vectors;
}

/**
 * Sentence embeddings computed inside the API process with transformers.js (ONNX runtime): no LLM
 * and no remote call. The model files are read from `memory.embeddingModelDir` (baked into the
 * Docker image; in dev they are downloaded there once). Loaded lazily on first use; a failed load
 * is retried after `EMBEDDER_RETRY_MS`. Never throws.
 */
@Injectable()
export class LocalEmbedder implements TextEmbedder {
  private readonly logger = new Logger(LocalEmbedder.name);
  private loading: Promise<FeatureExtractionPipeline | null> | null = null;
  private current: EmbedderState = 'idle';
  private failedAt = 0;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  public get model(): string {
    return this.settings().model;
  }

  public state(): EmbedderState {
    return this.current;
  }

  public async embed(texts: readonly string[]): Promise<number[][] | null> {
    if (texts.length === 0) return [];
    const extractor = await this.extractor();
    if (!extractor) return null;
    try {
      const vectors: number[][] = [];
      for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
        const batch = texts
          .slice(start, start + EMBED_BATCH_SIZE)
          .map((text) => text.slice(0, EMBED_MAX_CHARS));
        const output = await extractor(batch, { pooling: 'mean', normalize: true });
        const rows = readVectors(output.tolist(), batch.length);
        if (!rows) {
          this.logger.warn('[Embedder] The model returned vectors of an unexpected shape');
          return null;
        }
        vectors.push(...rows);
      }
      return vectors;
    } catch (err: unknown) {
      this.logger.warn(`[Embedder] Embedding failed: ${errorMessage(err)}`);
      return null;
    }
  }

  private async extractor(): Promise<FeatureExtractionPipeline | null> {
    if (this.loading === null) {
      if (this.current === 'failed' && Date.now() - this.failedAt < EMBEDDER_RETRY_MS) {
        return null;
      }
      this.loading = this.load();
    }
    const extractor = await this.loading;
    if (!extractor) this.loading = null;
    return extractor;
  }

  private async load(): Promise<FeatureExtractionPipeline | null> {
    const { model, modelDir } = this.settings();
    this.current = 'loading';
    const startedAt = Date.now();
    try {
      // Imported on first use: the ONNX runtime is large and tests never load it.
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = modelDir;
      const extractor = await pipeline('feature-extraction', model, {
        dtype: 'q8',
        session_options: { ...EMBEDDER_SESSION_OPTIONS },
      });
      this.current = 'ready';
      this.logger.log(`[Embedder] Loaded ${model} in ${Date.now() - startedAt}ms`);
      return extractor;
    } catch (err: unknown) {
      this.current = 'failed';
      this.failedAt = Date.now();
      this.logger.warn(
        `[Embedder] Could not load ${model} from ${modelDir}: ${errorMessage(err)}. ` +
          'Memory questions use the keyword search only until it loads.',
      );
      return null;
    }
  }

  private settings(): EmbedderSettings {
    const config = this.configService?.get<{ embeddingModel?: string; embeddingModelDir?: string }>(
      'memory',
    );
    return {
      model: config?.embeddingModel || DEFAULT_EMBEDDING_MODEL,
      modelDir: config?.embeddingModelDir || './data/models',
    };
  }
}
