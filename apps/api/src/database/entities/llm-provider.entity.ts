import type { LlmProviderKind } from '@zalobot/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** One LLM of the bot's provider chain, edited on the dashboard Settings page. */
@Entity('llm_providers')
@Unique('UQ_llm_providers_name', ['name'])
export class LlmProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  kind: LlmProviderKind;

  /** Null uses the kind's default URL. */
  @Column({ name: 'base_url', type: 'text', nullable: true })
  baseUrl?: string | null;

  @Column({ type: 'varchar', length: 200 })
  model: string;

  /** Encrypted with `DATA_ENCRYPTION_KEY` (`enc:v1:`); the audit log redacts it. */
  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey?: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** Call order, lowest first. */
  @Column({ type: 'int' })
  position: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
