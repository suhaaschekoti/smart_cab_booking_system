-- 0005: pricing rework persistence (peak multiplier + rental surge).
-- Estimate and booking share one pricing path; these columns persist the
-- exact multipliers used so receipts match the quote.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS peak_multiplier DECIMAL(3, 2) DEFAULT 1.00;
UPDATE trips SET peak_multiplier = 1.00 WHERE peak_multiplier IS NULL;
