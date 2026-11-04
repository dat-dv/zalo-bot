import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Composite indexes for two hot reads: the home page's activity of one actor, newest first
 * (`actor_id`, `created_at`), and the calendar's overlap query (`end_at > min AND start_at < max`),
 * which only had `start_at` to go on.
 */
export class AddAuditAndCalendarIndexes1725020000000 implements MigrationInterface {
  name = 'AddAuditAndCalendarIndexes1725020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_created" ON "audit_logs" ("actor_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_events_start_end" ON "calendar_events" ("start_at", "end_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_events_start_end"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor_created"`);
  }
}
