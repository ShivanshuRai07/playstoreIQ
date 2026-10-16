"""
PlayStoreIQ — Database Connection Manager
Provides connection handling and query execution for PostgreSQL (production/cloud)
and SQLite (local zero-dependency development).
"""
import os
import sqlite3
import pandas as pd
from sqlalchemy import create_engine, text

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "playstore_dwh.db"))
DATABASE_URL = os.environ.get("DATABASE_URL")

_ENGINE = None

def get_engine():
    global _ENGINE
    if _ENGINE is not None:
        return _ENGINE

    if DATABASE_URL:
        # PostgreSQL (Supabase / Neon / AWS RDS)
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        try:
            _ENGINE = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)
            with _ENGINE.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[DB] Connected to PostgreSQL warehouse.")
            return _ENGINE
        except Exception as e:
            print(f"[DB Warning] Could not connect to PostgreSQL ({e}). Falling back to local SQLite.")

    # Fallback to SQLite
    sqlite_url = f"sqlite:///{DB_PATH}"
    _ENGINE = create_engine(sqlite_url)
    return _ENGINE

def get_raw_connection():
    if DATABASE_URL:
        try:
            import psycopg2
            url = DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return psycopg2.connect(url)
        except Exception:
            pass
    return sqlite3.connect(DB_PATH)

def execute_query(sql_query, params=None):
    """Executes a SQL query and returns the result as a pandas DataFrame."""
    engine = get_engine()
    with engine.connect() as conn:
        if params:
            return pd.read_sql_query(text(sql_query), conn, params=params)
        return pd.read_sql_query(text(sql_query), conn)

def execute_statement(sql_statement, params=None):
    """Executes a DDL or DML statement."""
    engine = get_engine()
    with engine.begin() as conn:
        if params:
            conn.execute(text(sql_statement), params)
        else:
            conn.execute(text(sql_statement))
