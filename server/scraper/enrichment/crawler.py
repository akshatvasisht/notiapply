import asyncio
from typing import Optional
from crawl4ai import AsyncWebCrawler

class EnrichmentProcessor:
    """
    Processor to enrich job/contact context by crawling external sources.
    Uses crawl4ai for token-efficient markdown extraction.
    """
    def __init__(self, verbose: bool = True):
        self.verbose = verbose

    async def enrich_url(self, url: str) -> str:
        """
        Crawls a URL and returns a clean markdown representation.
        Ideal for Personal Blogs, About Us pages, or LinkedIn profiles.
        """
        async with AsyncWebCrawler(verbose=self.verbose) as crawler:
            result = await crawler.arun(url=url)
            if not result.success:
                raise Exception(f"Failed to crawl {url}: {result.error_message}")
            
            # Return cleaned markdown for LLM consumption
            return result.markdown

    def run_sync(self, url: str) -> str:
        """Synchronous wrapper for async crawl."""
        return asyncio.run(self.enrich_url(url))

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        processor = EnrichmentProcessor()
        print(processor.run_sync(sys.argv[1]))
