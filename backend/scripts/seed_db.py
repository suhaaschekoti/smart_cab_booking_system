"""
Seeds the local database with test users, drivers (with vehicles, set
available and located in Kottayam), an admin account, and a catalogue
of tourist attractions for the tour-guide feature.

All seeded users/drivers share the password: "password123".
Admin: username "admin", password "admin123".
Seeded accounts are pre-verified so they work without Gmail configured.

Run with:
    python scripts/seed_db.py
"""
import os
import sys

import psycopg2
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.auth import hash_password  # noqa: E402

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
PW = hash_password("password123")
ADMIN_PW = hash_password("admin123")

SEED_USERS = [
    ("Suhaas", "suhaas@example.com", "9000000001"),
    ("Mounish", "mounish@example.com", "9000000002"),
]

# name, email, phone, license, lat, lng, vehicle_number, vehicle_type, fuel_type
SEED_DRIVERS = [
    ("Chanakya", "chanakya@example.com", "9111111111", "DL-0001", 9.5916, 76.5222, "KL-07-AB-1234", "Sedan", "Petrol"),
    ("Ramesh",   "ramesh@example.com",   "9111111112", "DL-0002", 9.5950, 76.5250, "KL-07-CD-5678", "Hatchback", "Petrol"),
    ("Priya",    "priya@example.com",    "9111111113", "DL-0003", 9.5880, 76.5300, "KL-07-EF-9012", "SUV", "Diesel"),
]

# name, description, city, category, lat, lng
SEED_ATTRACTIONS = [
    ("Kumarakom Bird Sanctuary", "14-acre bird sanctuary on the banks of Vembanad Lake; best at dawn.", "Kottayam", "Nature", 9.6167, 76.4300),
    ("Vembanad Lake", "Longest lake in India -- houseboat cruises and backwater views.", "Kottayam", "Nature", 9.6000, 76.4000),
    ("Thirunakkara Mahadeva Temple", "16th-century Shiva temple famous for its Kerala mural art.", "Kottayam", "Historical", 9.5950, 76.5250),
    ("Illikkal Kallu", "Twin rock peaks with panoramic views of the Western Ghats.", "Kottayam", "Adventure", 9.6667, 76.7500),
    ("Vaikom Mahadeva Temple", "One of the oldest Shiva temples in Kerala; site of the Vaikom Satyagraha.", "Vaikom", "Historical", 9.7500, 76.3900),
    ("St. Mary's Church, Kuravilangad", "Believed to be one of the oldest Christian churches in India (AD 105).", "Kuravilangad", "Historical", 9.7460, 76.5570),
    ("Ilaveezhapoonchira", "Rolling grassland valley -- sunrise/sunset viewpoint, trekking.", "Kottayam", "Adventure", 9.7833, 76.8167),
    ("Marmala Waterfalls", "Secluded 40m waterfall reached by a short forest trek.", "Erattupetta", "Nature", 9.6800, 76.7600),
    ("Wagamon", "Hill station with pine forests, meadows and paragliding.", "Idukki", "Adventure", 9.6870, 76.9070),
    ("Kottayam Bus Stand Market", "Local market for spices, rubber products and Kerala snacks.", "Kottayam", "Shopping", 9.5900, 76.5220),
    ("Aruvikkuzhi Waterfalls", "Scenic waterfall amid rubber plantations, 2 km walk from the road.", "Kottayam", "Nature", 9.5580, 76.5960),
    ("Bay Island Driftwood Museum", "Unique museum of driftwood sculptures in Kumarakom.", "Kumarakom", "Culture", 9.6180, 76.4290),
]


def seed():
    conn = psycopg2.connect(DATABASE_URL); cur = conn.cursor()

    for name, email, phone in SEED_USERS:
        cur.execute("""INSERT INTO users (name, email, phone, password_hash, is_verified, is_active)
                       VALUES (%s,%s,%s,%s,TRUE,TRUE) ON CONFLICT (email) DO NOTHING""", (name, email, phone, PW))

    for name, email, phone, lic, lat, lng, vnum, vtype, fuel in SEED_DRIVERS:
        cur.execute("""INSERT INTO drivers (name, email, phone, password_hash, license_number,
                          availability_status, current_lat, current_lng, is_verified, is_active)
                       VALUES (%s,%s,%s,%s,%s,TRUE,%s,%s,TRUE,TRUE)
                       ON CONFLICT (email) DO NOTHING RETURNING driver_id""",
                    (name, email, phone, PW, lic, lat, lng))
        row = cur.fetchone()
        if row:
            cur.execute("""INSERT INTO vehicles (driver_id, vehicle_number, vehicle_type, fuel_type)
                           VALUES (%s,%s,%s,%s) ON CONFLICT (vehicle_number) DO NOTHING""", (row[0], vnum, vtype, fuel))

    cur.execute("""INSERT INTO admins (username, password_hash, role) VALUES ('admin', %s, 'systemManager')
                   ON CONFLICT (username) DO NOTHING""", (ADMIN_PW,))

    for name, desc, city, cat, lat, lng in SEED_ATTRACTIONS:
        cur.execute("SELECT 1 FROM attractions WHERE name = %s", (name,))
        if not cur.fetchone():
            cur.execute("""INSERT INTO attractions (name, description, city, category, latitude, longitude)
                           VALUES (%s,%s,%s,%s,%s,%s)""", (name, desc, city, cat, lat, lng))

    conn.commit(); cur.close(); conn.close()
    print("Seed complete.")
    print("  Users/drivers password: password123   Admin: admin / admin123")
    print("  Drivers are verified, online, located near Kottayam, with vehicles.")
    print(f"  {len(SEED_ATTRACTIONS)} tourist attractions loaded for the tour guide.")


if __name__ == "__main__":
    seed()