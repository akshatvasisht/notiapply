"""
Structured logging configuration for all Notiapply scrapers.

Usage:
    from scraper.log_config import configure_logging
    configure_logging()

    import structlog
    log = structlog.get_logger().bind(scraper_key='my-scraper')
    log.info("jobs_saved", count=42)

IMPORTANT: Output goes to stderr only. stdout is reserved for print(json.dumps(result))
which is consumed by n8n as the workflow result.
"""
import os
import sys
import structlog


def configure_logging() -> None:
    """Configure structlog for scraper pipeline use.

    - Production (default): JSON output to stderr, one line per event
    - Development (APP_ENV=development): colorized console output to stderr
    """
    is_dev = os.environ.get("APP_ENV", "").lower() == "development"

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
    ]

    if is_dev:
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            20  # logging.INFO
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=not is_dev,
    )
