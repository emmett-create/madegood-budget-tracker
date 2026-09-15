-- Run this in Supabase → SQL Editor

CREATE TABLE madegood_budget_entries (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date          date NOT NULL,
  category      text NOT NULL CHECK (category IN ('a8_paid', 'madegood_paid', 'shipping')),
  entry_type    text NOT NULL CHECK (entry_type IN ('actual', 'planned')),
  creator_handle text,
  description   text,
  amount        numeric(12, 2) NOT NULL,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- Allow public read/write (no login required — internal tool)
ALTER TABLE madegood_budget_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"  ON madegood_budget_entries FOR SELECT USING (true);
CREATE POLICY "Public insert" ON madegood_budget_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete" ON madegood_budget_entries FOR DELETE USING (true);

-- ── DocuSign inbox (2026-08-26) ────────────────────────────────────────────────
-- Mirrors the Stardust/EvolveTogether pattern: an executed DocuSign contract lands
-- here via Zapier with status='pending' and no category yet (the zap doesn't know
-- which budget bucket it belongs to). It shows up in a "Needs Review" inbox on the
-- dashboard; a human clicks "Assign + add" to set category + amount, which saves
-- with status='confirmed' and moves it into the normal budget totals/table.
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE madegood_budget_entries ALTER COLUMN category DROP NOT NULL;

-- ── Lumanu integration (2026-09-09) ────────────────────────────────────────────
-- Invoices now come in the same way DocuSign contracts do: a shared inbox
-- (invoicing@) gets Zapier'd straight into this table as a pending inbox row
-- (source='invoice_email'), an AM clicks "Assign + add" to confirm it and fill
-- in the Lumanu-specific fields, then entries get checked off and bulk-exported
-- as a Lumanu-format CSV. lumanu_status is set manually for now — it becomes a
-- real Lumanu API sync once Lumanu is actually funded/active for our workspace.
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS billing_id text;
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS lumanu_status text NOT NULL DEFAULT 'not_sent'
  CHECK (lumanu_status IN ('not_sent','needs_approval','approved','pending','issued','canceled'));
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- ── Direct Lumanu API send (2026-09-15) ─────────────────────────────────────
-- Replaces the CSV export for invoice-sourced entries: a standalone backend
-- (budget-tracker-lumanu-bridge, separate repo/service) creates the payable
-- via Lumanu's API directly and stores the id it comes back with, both to
-- stop double-sends and so Lumanu's status webhook can find the right row
-- to update later. Only source='invoice_email' entries are ever eligible —
-- manually-entered historical rows never go through this, to avoid
-- accidentally re-paying something that was already handled another way.
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS lumanu_payable_id text;

-- ── Retroactive invoice attachment (2026-09-15) ─────────────────────────────
-- Lets someone attach a real invoice PDF to an old, manually-entered row
-- (uploaded to a private Supabase Storage bucket via the bridge backend,
-- never a public URL) so that row becomes eligible to send to Lumanu too —
-- same safety logic as source='invoice_email', just triggered by hand
-- instead of the Zap.
ALTER TABLE madegood_budget_entries ADD COLUMN IF NOT EXISTS invoice_path text;
