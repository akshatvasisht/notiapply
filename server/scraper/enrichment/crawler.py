"""Fetch a URL and return clean markdown for LLM consumption.

Standalone utility. Not yet wired into any pipeline — see
agentcontext/OPEN_ISSUES.md (C-01) for the integration plan.
"""

import sys

import trafilatura
from scrapling import Fetcher


class EnrichmentProcessor:
    def __init__(self, stealth: bool = True):
        self.fetcher = Fetcher(stealth=stealth, auto_match=False)

    def enrich_url(self, url: str) -> str:
        """Fetch URL, strip boilerplate, return markdown. Raises on failure."""
        resp = self.fetcher.get(url)
        status = getattr(resp, "status_code", None)
        if status is not None and status >= 400:
            raise RuntimeError(f"fetch failed: {url} -> HTTP {status}")
        markdown = trafilatura.extract(
            resp.body,
            output_format="markdown",
            include_links=True,
            include_tables=True,
        )
        if not markdown:
            raise RuntimeError(f"extraction failed for {url}")
        return markdown


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python crawler.py <url>")
    print(EnrichmentProcessor().enrich_url(sys.argv[1]))
