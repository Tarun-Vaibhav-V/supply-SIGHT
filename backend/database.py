"""
SupplySight — Database Configuration & Initialization (PostgreSQL)
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# ─── PostgreSQL Connection ──────────────────────────────────────────
# Change these to match YOUR PostgreSQL credentials:
DB_USER = os.getenv("SUPPLYSIGHT_DB_USER", "postgres")
DB_PASS = os.getenv("SUPPLYSIGHT_DB_PASS", "Tarun_2006")
DB_HOST = os.getenv("SUPPLYSIGHT_DB_HOST", "localhost")
DB_PORT = os.getenv("SUPPLYSIGHT_DB_PORT", "5432")
DB_NAME = os.getenv("SUPPLYSIGHT_DB_NAME", "supplysight")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _read_sql_file(filename: str) -> str:
    """Read a .sql file relative to the project root."""
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "database", filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def init_db():
    """
    Create all tables from schema.sql, load advanced features
    (views, triggers, stored functions), and seed with sample data.
    Only seeds if the 'company' table is empty (first run).
    """
    schema_sql = _read_sql_file("schema.sql")
    seed_sql = _read_sql_file("seed_data.sql")
    advanced_sql = _read_sql_file("advanced_features.sql")

    with engine.begin() as conn:
        # Step 1: Create tables
        for statement in schema_sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))

        # Step 2: Seed data (only on first run)
        result = conn.execute(text("SELECT COUNT(*) FROM company"))
        count = result.scalar()
        if count == 0:
            for statement in seed_sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    conn.execute(text(stmt))
            print("✅ Database seeded with sample data.")
        else:
            print("ℹ️  Database already has data — skipping seed.")

        # Step 3: Load advanced features (views, triggers, functions, indexes)
        # Split on double-newline boundaries between top-level statements,
        # but handle $$ PL/pgSQL blocks by splitting on the $$ delimiter pattern.
        _exec_advanced_sql(conn, advanced_sql)
        print("✅ Views, triggers, and stored functions loaded.")

    print("✅ Database initialized successfully.")


def _exec_advanced_sql(conn, sql_text: str):
    """
    Execute advanced SQL that contains PL/pgSQL $$ blocks.
    Splits into executable chunks by detecting CREATE, DROP, and bare statements.
    """
    import re
    # Split the SQL into individual statements aware of $$ blocks
    # Strategy: find all top-level statements separated by ; outside $$ blocks
    chunks = []
    current = []
    in_dollar = False
    for line in sql_text.split('\n'):
        stripped = line.strip()
        if stripped.startswith('--') or stripped == '':
            current.append(line)
            continue
        # Toggle $$ state
        count = line.count('$$')
        if count % 2 == 1:
            in_dollar = not in_dollar
        current.append(line)
        if not in_dollar and stripped.endswith(';'):
            chunk = '\n'.join(current).strip()
            if chunk and not all(l.strip().startswith('--') or l.strip() == '' for l in current):
                chunks.append(chunk)
            current = []
    # Execute each chunk
    for chunk in chunks:
        if chunk.strip():
            conn.execute(text(chunk))
