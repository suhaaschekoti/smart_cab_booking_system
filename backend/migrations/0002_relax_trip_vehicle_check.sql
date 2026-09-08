-- ============================================================
-- Relaxes the trips vehicle-consistency CHECK constraint.
--
-- Original rule (from 0001) required vehicle_id/user_vehicle_id to be
-- set correctly for RIDE/TOUR/DRIVER_RENTAL at all times -- but this
-- blocked perfectly valid states, like a trip that hasn't been matched
-- to a driver yet (driver_id IS NULL), where no vehicle exists to
-- reference at all.
--
-- New rule: the vehicle-type check only applies ONCE a driver has
-- actually been assigned (driver_id IS NOT NULL). An unmatched trip
-- can have both vehicle fields null regardless of service_type.
-- ============================================================

ALTER TABLE trips DROP CONSTRAINT trips_check;

ALTER TABLE trips ADD CONSTRAINT trips_check CHECK (
    (driver_id IS NULL) OR
    (service_type IN ('RIDE', 'TOUR') AND vehicle_id IS NOT NULL AND user_vehicle_id IS NULL) OR
    (service_type = 'DRIVER_RENTAL' AND user_vehicle_id IS NOT NULL AND vehicle_id IS NULL)
);