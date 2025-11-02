# backend/app/db/postgres_db.py
#
# DEPRECATED: PostgreSQL ETL has been replaced by BigQuery.
# This file contains legacy ETL code for migrating data from Cosmos DB to PostgreSQL.
# PostgreSQL dependencies (psycopg2, asyncpg) have been removed from requirements.txt
# This code is kept for reference only and will not function in production.
#

import psycopg2  # DEPRECATED: No longer in requirements.txt
import psycopg2.extras
from typing import Dict, Any
from ..core.config import settings

class PostgresDBService:
    def __init__(self):
        self.connection_params = {
            "host": settings.PG_HOST,
            "database": settings.PG_DATABASE,
            "user": settings.PG_USER,
            "password": settings.PG_PASSWORD,
            "port": settings.PG_PORT
        }
    
    def get_connection(self, readonly=False):
        """Get a PostgreSQL connection"""
        conn = psycopg2.connect(**self.connection_params)
        if readonly:
            conn.set_session(readonly=True)
        return conn
    
    def dict_fetchall(self, cursor):
        """Return all rows from a cursor as a list of dictionaries"""
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    def dict_fetchone(self, cursor):
        """Return one row from a cursor as a dictionary"""
        if cursor.rowcount == 0:
            return None
        columns = [col[0] for col in cursor.description]
        row = cursor.fetchone()
        return dict(zip(columns, row)) if row else None