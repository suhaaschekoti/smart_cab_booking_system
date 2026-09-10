-- ============================================================
-- Final feature set: surge pricing tracking, reward redemption
-- on payments, admin account controls, driver approval.
-- ============================================================

-- Track the surge multiplier that was applied at booking time,
-- so receipts/history can explain why a fare was what it was.
ALTER TABLE trips ADD COLUMN surge_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE trips ADD COLUMN vehicle_type_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE trips ADD COLUMN night_surcharge BOOLEAN DEFAULT FALSE;

-- Reward redemption: how much discount was applied and how many
-- points were spent on this payment.
ALTER TABLE payments ADD COLUMN discount_applied DECIMAL(8,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN points_redeemed INT DEFAULT 0;

-- Admin controls: suspend/unsuspend accounts without deleting them.
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE drivers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Cancellation reason for analytics
ALTER TABLE trips ADD COLUMN cancellation_reason VARCHAR(255);

-- Emergency contacts notified via email (Gmail SMTP, zero cost) --
-- SMS would need a paid gateway, so email is the free alternative.
ALTER TABLE emergency_contacts ADD COLUMN contact_email VARCHAR(150);