"""
Create an initial admin account in either the local database or Supabase.

Run from the backend directory:
    python create_admin.py

The script uses app.database.engine for the local database. For Supabase, it
asks for a PostgreSQL connection URL. It never prints the password or stores
it in this script.
"""
import getpass
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.auth import hash_password
from app.database import engine as local_engine


def create_admin(db_engine, target_name: str) -> None:
    SessionLocal = sessionmaker(bind=db_engine)
    db = SessionLocal()

    try:
        username = input(f"Admin username for {target_name}: ").strip()
        if not username:
            print("Username cannot be empty.")
            return

        existing = (
            db.query(models.Admin)
            .filter(models.Admin.username == username)
            .first()
        )
        if existing:
            print(
                f"Admin '{username}' already exists in {target_name}; "
                "no changes made."
            )
            return

        password = getpass.getpass("Admin password: ")
        confirm = getpass.getpass("Confirm password: ")

        if not password:
            print("Password cannot be empty.")
            return
        if password != confirm:
            print("Passwords do not match. No account created.")
            return

        admin = models.Admin(
            username=username,
            password_hash=hash_password(password),
            role="systemManager",
        )
        db.add(admin)
        db.commit()
        print(f"Admin '{username}' created successfully in {target_name}.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    print("\nCreate an initial Smart Cab admin")
    print("1. Local database (uses your existing app.database configuration)")
    print("2. Supabase PostgreSQL")
    choice = input("Choose database [1/2]: ").strip()

    if choice == "1":
        create_admin(local_engine, "local database")
        return

    if choice == "2":
        from getpass import getpass as secure_input

        database_url = secure_input(
            "Paste Supabase PostgreSQL connection URL (input hidden): "
        ).strip()
        if not database_url:
            print("Database URL cannot be empty.")
            sys.exit(1)

        # SQLAlchemy's PostgreSQL driver must be installed (commonly psycopg2
        # or psycopg). Reuse the driver already configured by the project.
        db_engine = create_engine(database_url, pool_pre_ping=True)
        try:
            create_admin(db_engine, "Supabase")
        finally:
            db_engine.dispose()
        return

    print("Invalid choice. Run the script again and choose 1 or 2.")
    sys.exit(1)


if __name__ == "__main__":
    main()
