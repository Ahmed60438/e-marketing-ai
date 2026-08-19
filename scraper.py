from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
import time
import xml.etree.ElementTree as ET
from collections import deque
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE_URL = os.getenv("SITE_BASE_URL", "https://www.e-marketingreviews.com/").rstrip("/") + "/"
SITE_HOST = urlparse(BASE_URL).hostname
SITEMAP_URL = urljoin(BASE_URL, "sitemap.xml")
OUTPUT_FILE = Path(os.getenv("KNOWLEDGE_BASE_OUTPUT", "data/knowledge_base.json"))
MAX_PAGES = max(1, min(int(os.getenv("MAX_PAGES_TO_CRAWL", "300")), 2_000))
CRAWL_DELAY = max(0.0, min(float(os.getenv("CRAWL_DELAY_SECONDS", "0.25")), 5.0))
USER_AGENT = "eMarketingReviewsKnowledgeBot/3.0 (+https://www.e-marketingreviews.com/)"
IGNORED_EXTENSIONS = {
    ".7z", ".avi", ".css", ".doc", ".docx", ".gif", ".gz", ".ico",
    ".jpeg", ".jpg", ".js", ".json", ".m4a", ".mov", ".mp3", ".mp4",
    ".pdf", ".png", ".rar", ".svg", ".tar", ".webm", ".webp", ".xml", ".zip",
}
IGNORED_PATH_PARTS = ("/feeds/", "/search", "/label/", "/archive", "/cdn-cgi/")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("knowledge-scraper")


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def clean_url(url: str) -> str:
    try:
        parsed = urlparse(urljoin(BASE_URL, url))
    except ValueError:
        return ""
    if parsed.scheme not in {"http", "https"} or parsed.hostname != SITE_HOST:
        return ""
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urlunparse(("https", parsed.netloc.lower(), path, "", "", ""))


def is_valid_page(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    path = parsed.path.casefold()
    suffix = Path(path).suffix
    return (
        parsed.hostname == SITE_HOST
        and suffix not in IGNORED_EXTENSIONS
        and not any(part in path for part in IGNORED_PATH_PARTS)
    )


def load_robots(session: requests.Session) -> RobotFileParser:
    parser = RobotFileParser()
    robots_url = urljoin(BASE_URL, "robots.txt")
    parser.set_url(robots_url)
    try:
        response = session.get(robots_url, timeout=12)
        if response.ok:
            parser.parse(response.text.splitlines())
        else:
            parser.parse([])
    except requests.RequestException:
        parser.parse([])
    return parser


def sitemap_urls(
    session: requests.Session,
    sitemap_url: str,
    visited_sitemaps: Optional[Set[str]] = None,
) -> Set[str]:
    visited_sitemaps = visited_sitemaps or set()
    if sitemap_url in visited_sitemaps or len(visited_sitemaps) >= 50:
        return set()
    visited_sitemaps.add(sitemap_url)

    urls: Set[str] = set()
    try:
        response = session.get(sitemap_url, timeout=15)
        response.raise_for_status()
        root = ET.fromstring(response.content)
    except (requests.RequestException, ET.ParseError) as exc:
        logger.warning("Could not read sitemap %s: %s", sitemap_url, exc.__class__.__name__)
        return urls

    for element in root.iter():
        if not element.tag.endswith("loc") or not element.text:
            continue
        value = element.text.strip()
        if value.casefold().endswith(".xml"):
            urls.update(sitemap_urls(session, value, visited_sitemaps))
            continue
        cleaned = clean_url(value)
        if is_valid_page(cleaned):
            urls.add(cleaned)
    return urls


def blogger_feed_urls(session: requests.Session) -> Set[str]:
    urls: Set[str] = set()
    start_index = 1
    page_size = 150
    while start_index <= 1_000:
        feed_url = urljoin(
            BASE_URL,
            "feeds/posts/default?alt=json&start-index=%d&max-results=%d"
            % (start_index, page_size),
        )
        try:
            response = session.get(feed_url, timeout=15)
            response.raise_for_status()
            entries = response.json().get("feed", {}).get("entry", [])
        except (requests.RequestException, ValueError, AttributeError):
            break
        if not entries:
            break
        for entry in entries:
            for link in entry.get("link", []):
                if link.get("rel") == "alternate":
                    cleaned = clean_url(link.get("href", ""))
                    if is_valid_page(cleaned):
                        urls.add(cleaned)
        if len(entries) < page_size:
            break
        start_index += page_size
    return urls


def extract_document(html: str, fallback_url: str) -> Optional[Dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    canonical_tag = soup.find("link", rel=lambda value: value and "canonical" in value)
    canonical_url = clean_url(canonical_tag.get("href", "")) if canonical_tag else fallback_url
    canonical_url = canonical_url or fallback_url

    title_tag = soup.select_one("h1.post-title, h1.entry-title, article h1, main h1")
    if not title_tag:
        title_tag = soup.find("title")
    title = clean_text(title_tag.get_text(" ", strip=True)) if title_tag else ""

    body = soup.select_one(
        ".post-body, .entry-content, .post-content, article .article-content, article, main"
    )
    if not body:
        return None

    for selector in (
        "script", "style", "nav", "footer", "header", "iframe", "noscript",
        "form", "button", ".adsbygoogle", ".advertisement", ".share-buttons",
        ".post-footer", ".comments", ".related-posts",
    ):
        for element in body.select(selector):
            element.decompose()
    content = clean_text(body.get_text(" ", strip=True))
    if not title or len(content) < 180:
        return None
    return {"url": canonical_url, "title": title[:300], "content": content}


def discover_internal_links(soup: BeautifulSoup, current_url: str) -> Iterable[str]:
    for anchor in soup.find_all("a", href=True):
        cleaned = clean_url(urljoin(current_url, anchor.get("href", "")))
        if is_valid_page(cleaned):
            yield cleaned


def crawl(session: requests.Session) -> List[Dict[str, str]]:
    robots = load_robots(session)
    seeds = {clean_url(BASE_URL)}
    seeds.update(sitemap_urls(session, SITEMAP_URL))
    seeds.update(blogger_feed_urls(session))
    queue = deque(sorted(url for url in seeds if is_valid_page(url)))
    queued = set(queue)
    visited: Set[str] = set()
    content_hashes: Set[str] = set()
    documents: List[Dict[str, str]] = []

    logger.info("Starting crawl with %d seed URLs", len(queue))
    while queue and len(visited) < MAX_PAGES:
        url = queue.popleft()
        if url in visited or not robots.can_fetch(USER_AGENT, url):
            continue
        visited.add(url)
        try:
            response = session.get(url, timeout=18)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").casefold()
            if "html" not in content_type:
                continue
            soup = BeautifulSoup(response.text, "lxml")
            for discovered in discover_internal_links(soup, url):
                if discovered not in visited and discovered not in queued:
                    queue.append(discovered)
                    queued.add(discovered)

            document = extract_document(response.text, url)
            if document:
                digest = hashlib.sha256(document["content"].encode("utf-8")).hexdigest()
                if digest not in content_hashes:
                    content_hashes.add(digest)
                    documents.append(document)
            logger.info("Crawled %d/%d: %s", len(visited), MAX_PAGES, url)
        except requests.RequestException as exc:
            logger.warning("Skipped %s: %s", url, exc.__class__.__name__)
        if CRAWL_DELAY:
            time.sleep(CRAWL_DELAY)

    documents.sort(key=lambda item: item["url"])
    logger.info("Crawl complete: %d unique documents", len(documents))
    return documents


def save_atomically(documents: List[Dict[str, str]]) -> None:
    if not documents:
        raise RuntimeError("Crawler returned no documents; existing knowledge base was preserved")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=OUTPUT_FILE.parent, delete=False, suffix=".tmp"
    ) as handle:
        json.dump(documents, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary_path = Path(handle.name)
    os.replace(temporary_path, OUTPUT_FILE)


def main() -> None:
    started = time.monotonic()
    with build_session() as session:
        documents = crawl(session)
    save_atomically(documents)
    logger.info(
        "Saved %d documents to %s in %.1f seconds",
        len(documents),
        OUTPUT_FILE,
        time.monotonic() - started,
    )


if __name__ == "__main__":
    main()
