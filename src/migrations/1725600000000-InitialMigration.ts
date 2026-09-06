import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1725600000000 implements MigrationInterface {
  name = 'InitialMigration1725600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Indexes to optimize high traffic lookup queries (ISSUE-006)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User" (LOWER("email"));`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User" ("role");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_enrollment_user_id" ON "Enrollment" ("userId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_document_user_id" ON "Document" ("userId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_commission_agent_id" ON "commissions" ("agent_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_referral_leads_agent_id" ON "referral_leads" ("agent_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "audit_logs" ("actor_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_actor";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_referral_leads_agent_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_commission_agent_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_document_user_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_enrollment_user_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_role";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email";`);
  }
}
