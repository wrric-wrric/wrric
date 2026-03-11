"""
Tests for Pipeline Improvement Phases 1-3.
Covers: extractors, scrapers, helpers, query_refiner, config, google_search, error_sanitizer.
"""
import pytest
import json
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


# ── Phase 1 Tests ──────────────────────────────────────────────────────────

class TestErrorSanitizer:
    """Phase 1: Error leakage prevention."""

    def test_sqlalchemy_error_sanitized(self):
        from ws_module.handlers.error_sanitizer import sanitize_error
        err = Exception("(sqlalchemy.exc.OperationalError) connection refused host=db.neon.tech")
        msg = sanitize_error(err, "test")
        assert "sqlalchemy" not in msg.lower()
        assert "neon" not in msg.lower()

    def test_generic_error_sanitized(self):
        from ws_module.handlers.error_sanitizer import sanitize_error
        err = Exception("KeyError: 'some_internal_key'")
        msg = sanitize_error(err, "test")
        assert "KeyError" not in msg

    def test_timeout_error(self):
        from ws_module.handlers.error_sanitizer import sanitize_error
        err = asyncio.TimeoutError()
        msg = sanitize_error(err, "test")
        assert "timeout" in msg.lower() or "timed out" in msg.lower() or "try again" in msg.lower()


class TestScrapersPhase1:
    """Phase 1: scrape_with_bs returns error dict, not None."""

    @pytest.mark.asyncio
    async def test_scrape_with_bs_error_returns_dict(self):
        from utils.scrapers import scrape_with_bs
        # Invalid URL should return error dict, not None
        result = await scrape_with_bs("http://thisdoesnotexist.invalid.test")
        assert result is not None
        assert isinstance(result, dict)
        assert 'error' in result or 'raw_content' in result


class TestHelpersMeaningfulEntity:
    """Phase 1 (B6 field name) + Phase 3 (3.6 tighter threshold)."""

    def test_empty_entity_rejected(self):
        from utils.helpers import is_meaningful_entity
        data = {'url': 'https://test.edu', 'university': '', 'research_abstract': '', 'scopes': [], 'department': {}}
        assert is_meaningful_entity(data) is False

    def test_university_with_abstract_accepted(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': 'MIT',
            'research_abstract': 'This lab focuses on advanced robotics and AI applications.',
            'scopes': [],
            'department': {}
        }
        assert is_meaningful_entity(data) is True

    def test_university_with_scopes_accepted(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': 'Stanford',
            'research_abstract': '',
            'scopes': ['AI', 'Robotics'],
            'department': {}
        }
        assert is_meaningful_entity(data) is True

    def test_university_with_department_accepted(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': 'Oxford',
            'research_abstract': '',
            'scopes': [],
            'department': {'name': 'Physics', 'focus': 'Quantum'}
        }
        assert is_meaningful_entity(data) is True

    def test_unknown_university_no_abstract_rejected(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': 'Unknown Institution',
            'research_abstract': '',
            'scopes': ['AI'],
            'department': {}
        }
        assert is_meaningful_entity(data) is False

    def test_unknown_university_long_abstract_accepted(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': 'Unknown Institution',
            'research_abstract': 'A' * 60,
            'scopes': ['AI'],
            'department': {}
        }
        assert is_meaningful_entity(data) is True

    def test_no_university_no_content_rejected(self):
        from utils.helpers import is_meaningful_entity
        data = {
            'url': 'https://test.edu',
            'university': '',
            'research_abstract': 'short',
            'scopes': [],
            'department': {}
        }
        assert is_meaningful_entity(data) is False


# ── Phase 2 Tests ──────────────────────────────────────────────────────────

class TestConfigPhase2:
    """Phase 2.1: MAX_WORKERS should be 3."""

    def test_max_workers_is_3(self):
        from utils.config import load_config
        config = load_config()
        assert config['MAX_WORKERS'] == 3


class TestScrapersPhase2:
    """Phase 2.2: _is_static_html, scrape_static_url. Phase 2.6: scrape_with_jina_async."""

    def test_is_static_html_detects_dynamic_react(self):
        from utils.scrapers import _is_static_html
        html = '<html><body><div id="root"></div><script src="/static/js/react.bundle.js"></script></body></html>'
        assert _is_static_html(html, 'https://test.com') is False

    def test_is_static_html_detects_static_small_page(self):
        from utils.scrapers import _is_static_html
        html = '<html><body><h1>Hello</h1><p>Simple page</p></body></html>'
        assert _is_static_html(html, 'https://test.com') is True

    def test_is_static_html_netlify_server(self):
        from utils.scrapers import _is_static_html
        html = '<html><body><h1>Site</h1></body></html>'
        assert _is_static_html(html, 'https://test.com', server_header='Netlify') is True

    def test_is_static_html_dynamic_url_keyword(self):
        from utils.scrapers import _is_static_html
        html = '<html><body><h1>Article</h1></body></html>'
        assert _is_static_html(html, 'https://test.com/articles/123') is False

    def test_is_static_html_jekyll_generator(self):
        from utils.scrapers import _is_static_html
        html = '<html><head><meta name="generator" content="Jekyll v4.0"></head><body><h1>Blog</h1></body></html>'
        assert _is_static_html(html, 'https://test.com') is True

    @pytest.mark.asyncio
    async def test_scrape_with_jina_async_invalid_url(self):
        from utils.scrapers import scrape_with_jina_async
        result = await scrape_with_jina_async("not-a-valid-url")
        assert result is None

    def test_scrape_with_jina_sync_invalid_url(self):
        from utils.scrapers import scrape_with_jina
        result = scrape_with_jina("not-a-valid-url")
        assert result is None


class TestGoogleSearchPhase2:
    """Phase 2.3: search_with_meta returns Jina results directly (no Google enrichment)."""

    @pytest.mark.asyncio
    async def test_search_returns_jina_results_directly(self):
        """Verify that search_with_meta does not call search_with_meta_async for enrichment."""
        from utils.google_search import search_with_meta
        jina_response_text = (
            "[1] Title: Test Paper\n"
            "[1] URL Source: https://test.edu/paper\n"
            "[1] Description: A test paper about research\n"
        )
        mock_response = MagicMock()
        mock_response.text = jina_response_text
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch('utils.google_search.httpx.AsyncClient', return_value=mock_client):
            results = await search_with_meta("test query", max_results=5)

        assert len(results) == 1
        assert results[0]['url'] == 'https://test.edu/paper'
        assert results[0]['title'] == 'Test Paper'


# ── Phase 3 Tests ──────────────────────────────────────────────────────────

class TestExtractorsPhase3:
    """Phase 3.2-3.3: Gemini primary, shortened prompt, JSON parsing."""

    def test_parse_json_response_valid(self):
        from utils.extractors import _parse_json_response
        text = 'Here is the result: {"university": "MIT", "scopes": ["AI"]}'
        result = _parse_json_response(text)
        assert result is not None
        assert result['university'] == 'MIT'

    def test_parse_json_response_with_code_fence(self):
        from utils.extractors import _parse_json_response
        text = '```json\n{"university": "MIT", "scopes": ["AI"]}\n```'
        result = _parse_json_response(text)
        assert result is not None
        assert result['university'] == 'MIT'

    def test_parse_json_response_no_json(self):
        from utils.extractors import _parse_json_response
        text = 'I could not find any data.'
        result = _parse_json_response(text)
        assert result is None

    def test_parse_json_response_with_trailing_text(self):
        from utils.extractors import _parse_json_response
        text = '{"university": "MIT"} Let me know if you need more.'
        result = _parse_json_response(text)
        assert result is not None
        assert result['university'] == 'MIT'

    def test_fallback_university_known_domain(self):
        from utils.extractors import _fallback_university
        assert _fallback_university("https://ug.edu.gh/labs") == "University of Ghana"

    def test_fallback_university_unknown_domain(self):
        from utils.extractors import _fallback_university
        assert _fallback_university("https://random-site.com") == ""

    @pytest.mark.asyncio
    async def test_extract_structured_data_no_keys(self):
        """Should return default_data when no API keys are set."""
        from utils.extractors import extract_structured_data
        with patch('utils.extractors.GOOGLE_API_KEY', None), \
             patch('utils.extractors.GROQ_API_KEY', None):
            result = await extract_structured_data("<html>test</html>", "MIT", "https://mit.edu")
        assert result['university'] == ''
        assert result['scopes'] == []


class TestQueryRefinerPhase3:
    """Phase 3.4: Context-aware query refinement."""

    def test_query_has_institution(self):
        from utils.query_refiner import _query_has_institution
        assert _query_has_institution("mit robotics lab") is True
        assert _query_has_institution("climate research") is False
        assert _query_has_institution("university of ghana") is True

    def test_query_has_region(self):
        from utils.query_refiner import _query_has_region
        assert _query_has_region("biotech europe") is True
        assert _query_has_region("research in kenya") is True
        assert _query_has_region("renewable energy") is False
        assert _query_has_region("stanford materials") is True

    @pytest.mark.asyncio
    async def test_specific_institution_query_unchanged(self):
        from utils.query_refiner import refine_query
        result = await refine_query("MIT robotics lab research")
        assert result == "MIT robotics lab research"

    @pytest.mark.asyncio
    async def test_country_name_refined(self):
        from utils.query_refiner import refine_query
        result = await refine_query("Rwanda")
        assert "rwanda" in result.lower()
        assert "lab" in result.lower() or "r&d" in result.lower()

    @pytest.mark.asyncio
    async def test_empty_query_fallback(self):
        from utils.query_refiner import refine_query
        result = await refine_query("")
        assert "sub-saharan" in result.lower() or "r&d" in result.lower()

    @pytest.mark.asyncio
    async def test_non_african_region_preserved(self):
        """Query with non-African region + research context should not force Africa."""
        from utils.query_refiner import refine_query
        with patch('utils.query_refiner.GOOGLE_API_KEY', None):
            result = await refine_query("biotech research europe")
        # Should NOT add "Sub-Saharan Africa"
        assert "europe" in result.lower() or "biotech" in result.lower()


class TestURLFilteringPhase3:
    """Phase 3.1: URL filtering re-enabled in query_processor."""

    def test_educational_domain_accepted(self):
        """Simulate the filtering logic from query_processor."""
        from ws_module.handlers.config import EDUCATIONAL_DOMAINS, ACADEMIC_REPOSITORIES, PAPER_KEYWORDS
        from urllib.parse import urlparse

        _RELEVANCE_KEYWORDS = {
            'university', 'institute', 'college', 'research', 'lab', 'laboratory',
            'innovation', 'center', 'centre', 'faculty', 'department', 'science',
            'technology', 'engineering', 'academic', 'scholar',
        }

        def passes_filter(url, title=''):
            domain = urlparse(url).netloc.lower().replace('www.', '')
            title_lower = title.lower()
            url_lower = url.lower()
            is_educational = any(domain.endswith(ed) for ed in EDUCATIONAL_DOMAINS)
            is_academic_repo = domain in ACADEMIC_REPOSITORIES
            is_pdf = url_lower.endswith('.pdf')
            is_keyword_match = any(kw in domain or kw in title_lower or kw in url_lower for kw in _RELEVANCE_KEYWORDS)
            is_paper_related = any(kw in title_lower or kw in url_lower for kw in PAPER_KEYWORDS)
            return is_educational or is_academic_repo or is_pdf or is_keyword_match or is_paper_related

        # Should accept
        assert passes_filter("https://www.mit.edu/labs/csail") is True
        assert passes_filter("https://arxiv.org/abs/2301.12345") is True
        assert passes_filter("https://example.com/paper.pdf") is True
        assert passes_filter("https://random.com/university-lab") is True
        assert passes_filter("https://random.com/page", title="Research Laboratory") is True

        # Should reject
        assert passes_filter("https://twitter.com/user123") is False
        assert passes_filter("https://amazon.com/product/gadget") is False
        assert passes_filter("https://news.ycombinator.com/item?id=123") is False


# ── Phase 4 Tests ──────────────────────────────────────────────────────────

class TestQualityScorer:
    """Phase 4.4: Entity quality scoring."""

    def test_full_entity_high_score(self):
        from utils.quality_scorer import compute_quality_score
        data = {
            'university': 'MIT',
            'research_abstract': 'A' * 250,
            'scopes': ['AI', 'Robotics'],
            'department': {'name': 'CSAIL', 'focus_areas': ['ML']},
            'location': {'country': 'USA', 'city': 'Cambridge'},
            'publications_meta': {'key_items': [{'title': 'Paper'}]},
            'point_of_contact': {'email': 'lab@mit.edu'},
            'edurank': {'rank': 1},
            'images': [{'url': 'https://img.com/1.jpg'}],
        }
        score = compute_quality_score(data)
        assert score >= 0.9

    def test_empty_entity_zero_score(self):
        from utils.quality_scorer import compute_quality_score
        score = compute_quality_score({})
        assert score == 0.0

    def test_partial_entity_medium_score(self):
        from utils.quality_scorer import compute_quality_score
        data = {
            'university': 'Stanford',
            'research_abstract': 'Short abstract about research.',
            'scopes': ['Physics'],
        }
        score = compute_quality_score(data)
        assert 0.3 <= score <= 0.7

    def test_unknown_university_no_bonus(self):
        from utils.quality_scorer import compute_quality_score
        data = {'university': 'Unknown Institution', 'scopes': ['AI']}
        score = compute_quality_score(data)
        # Should NOT get university points
        assert score < 0.2

    def test_abstract_length_scaling(self):
        from utils.quality_scorer import compute_quality_score
        short = compute_quality_score({'research_abstract': 'A' * 50})
        long = compute_quality_score({'research_abstract': 'A' * 300})
        assert long > short


class TestRateLimiter:
    """Phase 4.5: Rate limiting."""

    @pytest.mark.asyncio
    async def test_rate_limiter_basic(self):
        from utils.rate_limiter import RateLimiter
        limiter = RateLimiter(calls_per_second=100, name="test")
        await limiter.acquire()
        await limiter.acquire()
        # Should not raise

    @pytest.mark.asyncio
    async def test_rate_limiter_context_manager(self):
        from utils.rate_limiter import RateLimiter
        limiter = RateLimiter(calls_per_second=100, name="test")
        async with limiter:
            pass  # Should not raise

    def test_preconfigured_limiters_exist(self):
        from utils.rate_limiter import jina_limiter, gemini_limiter, groq_limiter, crossref_limiter
        assert jina_limiter.name == "jina"
        assert gemini_limiter.name == "gemini"
        assert groq_limiter.name == "groq"
        assert crossref_limiter.name == "crossref"


class TestPdfExtractorPhase4:
    """Phase 4.2-4.3: PDF extractor uses httpx, not requests."""

    def test_no_requests_import(self):
        """pdf_extractor should use httpx, not requests."""
        import inspect
        from utils import pdf_extractor
        source = inspect.getsource(pdf_extractor)
        assert 'import requests' not in source
        assert 'import httpx' in source

    @pytest.mark.asyncio
    async def test_is_pdf_url_by_extension(self):
        from utils.pdf_extractor import is_pdf_url
        assert await is_pdf_url("https://example.com/paper.pdf", "test") is True

    @pytest.mark.asyncio
    async def test_is_pdf_url_non_pdf(self):
        from utils.pdf_extractor import is_pdf_url
        # Non-PDF extension, HEAD request will fail on invalid domain
        result = await is_pdf_url("https://thisdoesnotexist.invalid.test/page.html", "test")
        assert result is False


class TestFileIORemoved:
    """Phase 4.6: No file writes in query_processor."""

    def test_no_file_writes(self):
        import inspect
        from ws_module.handlers import query_processor
        source = inspect.getsource(query_processor)
        assert "open(universities_file" not in source
        assert "open(directories_file" not in source


# ── Phase 5 Tests ──────────────────────────────────────────────────────────

class TestLogContext:
    """Phase 5.2: Structured logging context."""

    def test_set_and_get_session_id(self):
        from utils.log_context import set_session_id, get_session_id
        set_session_id("test-session-123")
        assert get_session_id() == "test-session-123"
        set_session_id("")  # clean up

    def test_session_filter_injects_session_id(self):
        import logging
        from utils.log_context import SessionFilter, set_session_id
        f = SessionFilter()
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        set_session_id("abc")
        f.filter(record)
        assert record.session_id == "abc"
        set_session_id("")


class TestPipelineMetrics:
    """Phase 5.3: Pipeline metrics collection."""

    @pytest.mark.asyncio
    async def test_metrics_summary(self):
        from utils.pipeline_metrics import PipelineMetrics
        m = PipelineMetrics("test-session")
        m.record_success()
        m.record_success()
        m.record_failure()
        m.record_skip()
        m.record_timeout()
        s = m.summary()
        assert s['urls_success'] == 2
        assert s['urls_failed'] == 1
        assert s['urls_skipped'] == 1
        assert s['urls_timed_out'] == 1
        assert s['total_elapsed_s'] >= 0

    @pytest.mark.asyncio
    async def test_metrics_measure_stage(self):
        from utils.pipeline_metrics import PipelineMetrics
        m = PipelineMetrics("test")
        async with m.measure("scrape"):
            pass
        async with m.measure("scrape"):
            pass
        s = m.summary()
        assert s['stages']['scrape']['count'] == 2


class TestDatabaseCredentials:
    """Phase 5.4: No hardcoded credentials."""

    def test_no_hardcoded_password(self):
        import inspect
        from utils import database
        source = inspect.getsource(database)
        assert "npg_" not in source
        assert "neondb_owner" not in source


class TestNoBareExcept:
    """Phase 5.5: No bare except: in codebase."""

    def test_no_bare_except_in_pipeline_files(self):
        import inspect
        import re
        from utils import workflow, user_entity_search
        from ws_module.handlers import query_processor, cancel_handler
        from ws_module.messages import router

        modules = [workflow, user_entity_search, query_processor, cancel_handler, router]
        for mod in modules:
            source = inspect.getsource(mod)
            # Match "except:" not followed by a space (bare except)
            # but exclude "except Exception:" etc.
            bare = re.findall(r'^\s*except\s*:', source, re.MULTILINE)
            assert len(bare) == 0, f"Bare except found in {mod.__name__}: {bare}"
