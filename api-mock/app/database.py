import psycopg
from psycopg.rows import dict_row

# PostgreSQL Configuration setting
DATABASE_URL = "postgresql://postgres:hellodamn@localhost:5432/schema_matcher_sandbox"


def get_db_connection():
    """
    Opens and return connection to PostgreSQL.
    Using row_factory=dict_row ensures query results are returned
    as standard python dictionaries instead of tuple
    """
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)
