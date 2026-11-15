import os
import urllib.parse
from typing import Any, Dict, List, Optional

# Check available drivers
HAS_PSYCOPG2 = False
HAS_PG8000 = False
HAS_MYSQL = False

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    pass

try:
    import pg8000.native
    HAS_PG8000 = True
except ImportError:
    pass

try:
    import mysql.connector
    HAS_MYSQL = True
except ImportError:
    pass


class PostgresDictCursorWrapper:
    """Wraps psycopg2 cursor to match MySQL dictionary cursor API."""
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query: str, params: Any = None):
        # Convert %s placeholders and any MySQL-specific syntax to standard Postgres
        sql = query.strip()
        # In Postgres, NOW() and CURRENT_TIMESTAMP both work
        if params is not None:
            return self._cursor.execute(sql, params)
        return self._cursor.execute(sql)

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self._cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self._cursor.fetchall()
        return [dict(r) for r in rows]

    def close(self):
        try:
            self._cursor.close()
        except Exception:
            pass

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return getattr(self._cursor, "lastrowid", None)


class PostgresConnectionWrapper:
    """Wraps psycopg2 connection to expose cursor(dictionary=True) and commit."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self, dictionary: bool = False):
        if HAS_PSYCOPG2:
            from psycopg2.extras import RealDictCursor
            cur = self._conn.cursor(cursor_factory=RealDictCursor if dictionary else None)
            return PostgresDictCursorWrapper(cur) if dictionary else cur
        return self._conn.cursor()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass


def get_db_connection():
    """
    Returns a database connection.
    Prioritizes Supabase / PostgreSQL cloud connection (via DATABASE_URL or SUPABASE_DB_URL).
    Falls back to MySQL on localhost if configured.
    """
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    
    if db_url:
        # PostgreSQL / Supabase connection
        if HAS_PSYCOPG2:
            conn = psycopg2.connect(db_url, sslmode="require")
            return PostgresConnectionWrapper(conn)
        else:
            raise ImportError(
                "psycopg2 is required for PostgreSQL/Supabase connections. "
                "Install with: pip install psycopg2-binary"
            )

    # Individual Supabase / Postgres environment variables
    pg_host = os.environ.get("SUPABASE_DB_HOST") or os.environ.get("PGHOST")
    if pg_host:
        pg_user = os.environ.get("SUPABASE_DB_USER") or os.environ.get("PGUSER", "postgres")
        pg_password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("PGPASSWORD", "")
        pg_database = os.environ.get("SUPABASE_DB_NAME") or os.environ.get("PGDATABASE", "postgres")
        pg_port = int(os.environ.get("SUPABASE_DB_PORT") or os.environ.get("PGPORT", "5432"))
        
        if HAS_PSYCOPG2:
            conn = psycopg2.connect(
                host=pg_host,
                user=pg_user,
                password=pg_password,
                database=pg_database,
                port=pg_port,
                sslmode="require"
            )
            return PostgresConnectionWrapper(conn)

    # Local MySQL fallback
    mysql_host = os.environ.get("MYSQL_HOST", "localhost")
    mysql_user = os.environ.get("MYSQL_USER", "root")
    mysql_password = os.environ.get("MYSQL_PASSWORD", "Cherry$2004")
    mysql_db = os.environ.get("MYSQL_DATABASE", "attendance_system")

    if HAS_MYSQL:
        return mysql.connector.connect(
            host=mysql_host,
            user=mysql_user,
            password=mysql_password,
            database=mysql_db
        )

    raise RuntimeError(
        "No database driver or connection configured. "
        "Please provide DATABASE_URL (for Supabase PostgreSQL) or install mysql-connector-python."
    )
