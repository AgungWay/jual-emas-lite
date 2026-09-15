-- ANTI N+1: 1 JOIN + CREATE INDEX composite agar EXPLAIN <100ms (psql native)
-- Tanpa index composite, query WHERE status/type + ORDER BY created_at akan Seq Scan

CREATE INDEX IF NOT EXISTS "transactions_status_created_at_idx" ON "transactions"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "transactions_type_created_at_idx" ON "transactions"("type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "transactions_type_status_idx" ON "transactions"("type", "status");
CREATE INDEX IF NOT EXISTS "transactions_employee_id_created_at_idx" ON "transactions"("employee_id", "created_at" DESC);
