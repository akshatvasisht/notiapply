"""Shared database URL resolution for all scrapers."""
import os


def get_db_url(config: dict) -> str:
    """Get database URL from config payload or DATABASE_URL environment variable."""
    url = config.get("db_url") or os.environ.get("DATABASE_URL")
    if not url:
        raise ValueError(
            "Database URL not provided. Set DATABASE_URL environment variable "
            "or include 'db_url' in the JSON payload."
        )
    return url
