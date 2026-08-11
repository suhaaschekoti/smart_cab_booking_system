-- ============================================================
-- SMART CAB BOOKING SYSTEM — DATABASE SCHEMA
-- Team: 3-person, 2-month implementation scope
-- Engine assumed: PostgreSQL (works on MySQL with minor tweaks
-- noted in comments)
-- ============================================================

-- ------------------------------------------------------------
-- 1) USERS  (Passengers)
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    phone           VARCHAR(15) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    gender          VARCHAR(20),
    reward_points   INT DEFAULT 0,
    safety_mode_enabled BOOLEAN DEFAULT FALSE,
    is_flagged      BOOLEAN DEFAULT FALSE,       -- simple fraud-flag, no ML
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2) DRIVERS
-- ------------------------------------------------------------
CREATE TABLE drivers (
    driver_id           SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    phone               VARCHAR(15) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    license_number      VARCHAR(50) UNIQUE NOT NULL,
    rating              DECIMAL(2,1) DEFAULT 5.0,
    availability_status BOOLEAN DEFAULT FALSE,   -- online/offline toggle
    incentive_score     DECIMAL(6,2) DEFAULT 0,
    current_lat         DECIMAL(9,6),            -- simulated live location
    current_lng         DECIMAL(9,6),
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3) VEHICLES  (one driver -> one active vehicle, kept simple)
-- ------------------------------------------------------------
CREATE TABLE vehicles (
    vehicle_id      SERIAL PRIMARY KEY,
    driver_id       INT NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
    vehicle_number  VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type    VARCHAR(30),         -- e.g. Hatchback, Sedan, SUV
    fuel_type       VARCHAR(20)          -- Petrol, Diesel, EV, CNG
);

-- ------------------------------------------------------------
-- 4) ADMIN
-- ------------------------------------------------------------
CREATE TABLE admins (
    admin_id        SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) DEFAULT 'systemManager'
);

-- ------------------------------------------------------------
-- 5) TRIPS
-- ------------------------------------------------------------
CREATE TABLE trips (
    trip_id             SERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(user_id),
    driver_id           INT REFERENCES drivers(driver_id),   -- null until assigned
    vehicle_id          INT REFERENCES vehicles(vehicle_id),
    pickup_location     VARCHAR(255) NOT NULL,
    pickup_lat          DECIMAL(9,6),
    pickup_lng          DECIMAL(9,6),
    drop_location        VARCHAR(255) NOT NULL,
    drop_lat            DECIMAL(9,6),
    drop_lng            DECIMAL(9,6),
    distance_km         DECIMAL(6,2),
    fare                DECIMAL(8,2),
    trip_status         VARCHAR(20) DEFAULT 'REQUESTED',
                        -- REQUESTED / ACCEPTED / ONGOING / COMPLETED / CANCELLED
    start_time          TIMESTAMP,
    end_time            TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6) PAYMENTS  (one-to-one with trips)
-- ------------------------------------------------------------
CREATE TABLE payments (
    payment_id      SERIAL PRIMARY KEY,
    trip_id         INT UNIQUE NOT NULL REFERENCES trips(trip_id),
    amount          DECIMAL(8,2) NOT NULL,
    payment_mode    VARCHAR(20),           -- WALLET / CARD / UPI / CASH (mock/test mode)
    payment_status  VARCHAR(20) DEFAULT 'PENDING', -- PENDING / SUCCESS / FAILED
    payment_time    TIMESTAMP
);

-- ------------------------------------------------------------
-- 7) FEEDBACK  (passenger rates driver per trip)
-- ------------------------------------------------------------
CREATE TABLE feedback (
    feedback_id     SERIAL PRIMARY KEY,
    trip_id         INT UNIQUE NOT NULL REFERENCES trips(trip_id),
    rating          INT CHECK (rating BETWEEN 1 AND 5),
    comments        VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8) EMERGENCY CONTACTS  (each passenger can save one or more)
-- ------------------------------------------------------------
CREATE TABLE emergency_contacts (
    contact_id      SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    contact_name    VARCHAR(100) NOT NULL,
    contact_phone   VARCHAR(15) NOT NULL,
    relation        VARCHAR(50),          -- e.g. Parent, Sibling, Friend
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 9) SAFETY ALERTS  (emergency alert feature)
-- ------------------------------------------------------------
CREATE TABLE safety_alerts (
    alert_id        SERIAL PRIMARY KEY,
    trip_id         INT NOT NULL REFERENCES trips(trip_id),
    user_id         INT NOT NULL REFERENCES users(user_id),
    alert_type      VARCHAR(50) DEFAULT 'EmergencyContactShare',
    alert_lat       DECIMAL(9,6),
    alert_lng       DECIMAL(9,6),
    alert_status    VARCHAR(20) DEFAULT 'SENT',  -- SENT / ACKNOWLEDGED
    alert_time      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 10) ALERT NOTIFICATIONS  (which saved contacts were notified
--     for a given alert, and whether it went through)
-- ------------------------------------------------------------
CREATE TABLE alert_notifications (
    notification_id  SERIAL PRIMARY KEY,
    alert_id         INT NOT NULL REFERENCES safety_alerts(alert_id) ON DELETE CASCADE,
    contact_id       INT NOT NULL REFERENCES emergency_contacts(contact_id),
    notified_via     VARCHAR(20) DEFAULT 'SMS',   -- SMS / EMAIL
    delivery_status  VARCHAR(20) DEFAULT 'SENT',  -- SENT / FAILED
    sent_at          TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 11) REWARD LEDGER  (optional, only if Tier-2 rewards get built;
--     otherwise reward_points on users table alone is enough)
-- ------------------------------------------------------------
CREATE TABLE reward_transactions (
    reward_txn_id   SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id),
    trip_id         INT REFERENCES trips(trip_id),
    points_change   INT NOT NULL,          -- positive = earned, negative = redeemed
    reason          VARCHAR(100),          -- 'trip_completed' / 'redeemed_discount'
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INDEXES for common query patterns
-- ------------------------------------------------------------
CREATE INDEX idx_trips_user       ON trips(user_id);
CREATE INDEX idx_trips_driver     ON trips(driver_id);
CREATE INDEX idx_trips_status     ON trips(trip_status);
CREATE INDEX idx_drivers_avail    ON drivers(availability_status);
CREATE INDEX idx_alerts_trip      ON safety_alerts(trip_id);
CREATE INDEX idx_contacts_user    ON emergency_contacts(user_id);
CREATE INDEX idx_notif_alert      ON alert_notifications(alert_id);
