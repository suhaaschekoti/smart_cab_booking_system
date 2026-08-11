import psycopg2
import psycopg2.extras
from psycopg2 import pool

from app.config import settings

# Connection pool -- shared across requests, avoids opening a new
# Postgres connection on every API call.
connection_pool = psycopg2.pool.SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=settings.database_url,
)


def get_db():
    """
    FastAPI dependency -- yields a psycopg2 cursor (dict-style rows)
    per request, and always returns the connection to the pool.

    Usage in a route:
        @app.get("/users/{user_id}")
        def get_user(user_id: int, db=Depends(get_db)):
            db.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
            return db.fetchone()
    """
    conn = connection_pool.getconn()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        connection_pool.putconn(conn)
