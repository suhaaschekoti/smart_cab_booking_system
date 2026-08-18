"""
Seeds the local database with a handful of test users, drivers, and
attractions -- useful for testing the booking/auth flow and demos
without manually registering fresh accounts every time.

All seeded users/drivers share the password: "password123"
(hashed properly via app.auth.hash_password, so /auth/user/login
and /auth/driver/login actually work against these accounts).

Run with:
    python scripts/seed_db.py
"""
import os
import sys

import psycopg2
from dotenv import load_dotenv

# allow running this script directly (adds backend/ to path)
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.auth import hash_password  # noqa: E402

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SEED_PASSWORD_HASH = hash_password("password123")

SEED_USERS = [
    ("Suhaas", "suhaas@example.com", "9000000001"),
    ("Mounish", "mounish@example.com", "9000000002"),
]

SEED_DRIVERS = [
    ("Chanakya", "chanakya@example.com", "9111111111", "DL-0001"),
    ("Ramesh", "ramesh@example.com", "9111111112", "DL-0002"),
]

SEED_ATTRACTIONS = [
    ("Kottayam Backwaters", "Scenic backwater viewpoint", "Kottayam", "Nature", 9.5916, 76.5222),
    ("Thirunakkara Mahadevar Temple", "Historic temple", "Kottayam", "Historical", 9.5950, 76.5250),
]


def seed():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    for name, email, phone in SEED_USERS:
        cur.execute(
            """
            INSERT INTO users (name, email, phone, password_hash)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (name, email, phone, SEED_PASSWORD_HASH),
        )

    for name, email, phone, license_number in SEED_DRIVERS:
        cur.execute(
            """
            INSERT INTO drivers (name, email, phone, password_hash, license_number)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (name, email, phone, SEED_PASSWORD_HASH, license_number),
        )

    for name, description, city, category, lat, lng in SEED_ATTRACTIONS:
        cur.execute(
            """
            INSERT INTO attractions (name, description, city, category, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (name, description, city, category, lat, lng),
        )

    conn.commit()
    cur.close()
    conn.close()
    print("Seed data inserted. All seeded accounts use password: password123")


if __name__ == "__main__":
    seed()
