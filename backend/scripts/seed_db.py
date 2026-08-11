"""
Seeds the local database with a handful of test users, drivers, vehicles,
and attractions -- useful for testing the booking flow and demos without
manually inserting rows every time.

Run with:
    python scripts/seed_db.py
"""
import os
import sys

import psycopg2
from dotenv import load_dotenv

# allow running this script directly (adds backend/ to path)
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

SEED_USERS = [
    ("Suhaas", "suhaas@example.com", "9000000001", "hashed_pw_placeholder"),
    ("Mounish", "mounish@example.com", "9000000002", "hashed_pw_placeholder"),
]

SEED_DRIVERS = [
    ("Chanakya", "chanakya@example.com", "9111111111", "hashed_pw_placeholder", "DL-0001"),
    ("Ramesh", "ramesh@example.com", "9111111112", "hashed_pw_placeholder", "DL-0002"),
]

SEED_ATTRACTIONS = [
    ("Kottayam Backwaters", "Scenic backwater viewpoint", "Kottayam", "Nature", 9.5916, 76.5222),
    ("Thirunakkara Mahadevar Temple", "Historic temple", "Kottayam", "Historical", 9.5950, 76.5250),
]


def seed():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    for name, email, phone, pw in SEED_USERS:
        cur.execute(
            """
            INSERT INTO users (name, email, phone, password_hash)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (name, email, phone, pw),
        )

    for name, email, phone, pw, license_number in SEED_DRIVERS:
        cur.execute(
            """
            INSERT INTO drivers (name, email, phone, password_hash, license_number)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (name, email, phone, pw, license_number),
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
    print("Seed data inserted.")


if __name__ == "__main__":
    seed()
