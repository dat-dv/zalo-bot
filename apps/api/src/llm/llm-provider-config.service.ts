import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LLM_PROVIDER_DEFAULT_BASE_URLS,
  type ICreateLlmProviderRequest,
  type ILlmProviderStatus,
  type IUpdateLlmProviderRequest,
  type LlmProviderKind,
} from '@zalobot/contracts';
import { QueryFailedError, Repository } from 'typeorm';
import { decryptSecret, encryptSecret, parseEncryptionKey } from '../common/crypto/secret-cipher';
import { LlmProviderEntity } from '../database/entities/llm-provider.entity';
import type { LlmCallConfig } from './types/llm.types';

/** A provider row ready to call: defaults applied, API key decrypted. */
export interface ResolvedLlmProvider {
  id: string;
  name: string;
  kind: LlmProviderKind;
  enabled: boolean;
  call: LlmCallConfig;
  /** The stored base URL, null when the kind's default is used. */
  storedBaseUrl: string | null;
  hasApiKey: boolean;
  configured: boolean;
}

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === PG_UNIQUE_VIOLATION
  );
}

/** What a kind needs before a call is worth making. */
function isConfigured(kind: LlmProviderKind, call: LlmCallConfig): boolean {
  if (!call.model) return false;
  if (kind === 'gemini') return Boolean(call.apiKey);
  if (kind === 'openai') return Boolean(call.apiKey && call.baseUrl);
  return Boolean(call.baseUrl);
}

/** The read side `LlmService` needs; a script can serve it without a database. */
export type LlmChainSource = Pick<LlmProviderConfigService, 'getChain' | 'findResolved'>;

export interface LlmProviderFields {
  id: string;
  name: string;
  kind: LlmProviderKind;
  enabled: boolean;
  baseUrl: string | null;
  model: string;
}

/** Applies the kind's default base URL and works out whether a call can be made. */
export function resolveLlmProvider(
  fields: LlmProviderFields,
  apiKey: string,
  hasApiKey: boolean,
): ResolvedLlmProvider {
  const call: LlmCallConfig = {
    baseUrl: fields.baseUrl || LLM_PROVIDER_DEFAULT_BASE_URLS[fields.kind] || '',
    model: fields.model,
    apiKey,
  };
  return {
    id: fields.id,
    name: fields.name,
    kind: fields.kind,
    enabled: fields.enabled,
    call,
    storedBaseUrl: fields.baseUrl,
    hasApiKey,
    configured: isConfigured(fields.kind, call),
  };
}

/**
 * The bot's LLM chain, stored in `llm_providers` and edited by admins on the dashboard. Rows are
 * read once and kept in memory (one API instance) until the next write, so a change applies to
 * the very next message without a restart.
 */
@Injectable()
export class LlmProviderConfigService {
  private readonly logger = new Logger(LlmProviderConfigService.name);
  private readonly encryptionKey: Buffer | null;
  private cache: Promise<ResolvedLlmProvider[]> | null = null;
  private readonly warnedUndecryptable = new Set<string>();

  constructor(
    @InjectRepository(LlmProviderEntity)
    private readonly repository: Repository<LlmProviderEntity>,
    config: ConfigService,
  ) {
    this.encryptionKey = parseEncryptionKey(config.get<string>('security.encryptionKey'));
  }

  /** Every provider in call order, turned-off ones included. */
  public async listResolved(): Promise<ResolvedLlmProvider[]> {
    if (this.cache === null) {
      const pending = this.loadResolved();
      this.cache = pending;
      // A failed read must not stay cached: the next message retries the database.
      pending.catch(() => {
        if (this.cache === pending) this.cache = null;
      });
    }
    return this.cache;
  }

  /** The providers `LlmService` tries, in order. */
  public async getChain(): Promise<ResolvedLlmProvider[]> {
    return (await this.listResolved()).filter((provider) => provider.enabled);
  }

  public async findResolved(id: string): Promise<ResolvedLlmProvider | null> {
    return (await this.listResolved()).find((provider) => provider.id === id) ?? null;
  }

  public async listStatuses(): Promise<ILlmProviderStatus[]> {
    const providers = await this.listResolved();
    let chainIndex = 0;
    return providers.map((provider) => {
      let role: ILlmProviderStatus['role'] = null;
      if (provider.enabled) {
        role = chainIndex === 0 ? 'primary' : 'fallback';
        chainIndex += 1;
      }
      return {
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        baseUrl: provider.storedBaseUrl,
        model: provider.call.model,
        enabled: provider.enabled,
        role,
        configured: provider.configured,
        hasApiKey: provider.hasApiKey,
      };
    });
  }

  /** Added at the end of the chain. */
  public async create(input: ICreateLlmProviderRequest): Promise<ILlmProviderStatus> {
    const last = await this.repository
      .createQueryBuilder('provider')
      .select('MAX(provider.position)', 'max')
      .getRawOne<{ max: number | null }>();
    const entity = this.repository.create({
      name: input.name,
      kind: input.kind,
      baseUrl: input.baseUrl ?? null,
      model: input.model,
      apiKey: this.encrypt(input.apiKey ?? undefined),
      enabled: input.enabled ?? true,
      position: (last?.max ?? -1) + 1,
    });
    const saved = await this.saveUnique(entity);
    return this.statusOf(saved.id);
  }

  public async update(id: string, patch: IUpdateLlmProviderRequest): Promise<ILlmProviderStatus> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('LLM provider not found.');

    if (patch.name !== undefined) entity.name = patch.name;
    if (patch.kind !== undefined) entity.kind = patch.kind;
    if (patch.baseUrl !== undefined) entity.baseUrl = patch.baseUrl;
    if (patch.model !== undefined) entity.model = patch.model;
    if (patch.enabled !== undefined) entity.enabled = patch.enabled;
    if (patch.apiKey) entity.apiKey = this.encrypt(patch.apiKey);
    else if (patch.clearApiKey) entity.apiKey = null;

    await this.saveUnique(entity);
    return this.statusOf(id);
  }

  public async remove(id: string): Promise<void> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('LLM provider not found.');
    await this.repository.remove(entity);
    this.invalidate();
  }

  /** `ids` must name every provider exactly once; positions become their index. */
  public async reorder(ids: string[]): Promise<ILlmProviderStatus[]> {
    const rows = await this.repository.find();
    const known = new Set(rows.map((row) => row.id));
    if (ids.length !== rows.length || ids.some((id) => !known.has(id))) {
      throw new BadRequestException('ids must list every LLM provider exactly once.');
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const changed = ids.flatMap((id, position) => {
      const row = byId.get(id);
      if (!row || row.position === position) return [];
      row.position = position;
      return [row];
    });
    if (changed.length > 0) {
      await this.repository.manager.transaction((manager) => manager.save(changed));
    }
    this.invalidate();
    return this.listStatuses();
  }

  private async statusOf(id: string): Promise<ILlmProviderStatus> {
    const status = (await this.listStatuses()).find((provider) => provider.id === id);
    if (!status) throw new NotFoundException('LLM provider not found.');
    return status;
  }

  private async saveUnique(entity: LlmProviderEntity): Promise<LlmProviderEntity> {
    try {
      const saved = await this.repository.save(entity);
      return saved;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An LLM provider with this name already exists.');
      }
      throw error;
    } finally {
      this.invalidate();
    }
  }

  private invalidate(): void {
    this.cache = null;
  }

  private encrypt(value: string | undefined): string | null {
    if (!value) return null;
    if (!this.encryptionKey) {
      throw new BadRequestException(
        'DATA_ENCRYPTION_KEY is invalid, the API key cannot be stored.',
      );
    }
    return encryptSecret(value, this.encryptionKey) ?? null;
  }

  /** A key encrypted with another `DATA_ENCRYPTION_KEY` counts as missing instead of crashing. */
  private decrypt(row: LlmProviderEntity): string {
    if (!row.apiKey) return '';
    if (!this.encryptionKey) return '';
    try {
      return decryptSecret(row.apiKey, this.encryptionKey) ?? '';
    } catch {
      if (!this.warnedUndecryptable.has(row.id)) {
        this.warnedUndecryptable.add(row.id);
        this.logger.warn(
          `Cannot decrypt the API key of LLM provider "${row.name}"; enter it again on the dashboard.`,
        );
      }
      return '';
    }
  }

  private async loadResolved(): Promise<ResolvedLlmProvider[]> {
    const rows = await this.repository.find({ order: { position: 'ASC', createdAt: 'ASC' } });
    return rows.map((row) =>
      resolveLlmProvider(
        {
          id: row.id,
          name: row.name,
          kind: row.kind,
          enabled: row.enabled,
          baseUrl: row.baseUrl ?? null,
          model: row.model,
        },
        this.decrypt(row),
        Boolean(row.apiKey),
      ),
    );
  }
}
