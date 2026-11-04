-- Ledger, audit trail and attribution events are append-only.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: write a compensating entry instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_amount_nonzero CHECK (amount_minor <> 0);
--> statement-breakpoint
ALTER TABLE campaigns ADD CONSTRAINT campaign_budget_positive CHECK (budget_minor > 0);
--> statement-breakpoint
ALTER TABLE campaigns ADD CONSTRAINT campaign_dates_ordered CHECK (end_at >= start_at);
