# AI Scraping Pipeline — Critical Analysis & Improvement Plan

> ## IMPLEMENTATION PLAN

  ### Phase 1: Critical Bug Fixes (Immediate)                                                                              now implment the above section in the C:\Users\Daniel\Documents\UaiAgent\Latest_UI\PIPELINE_IMPROVEMENT_PLAN.md


## Current Architecture Overview

```
User query (WebSocket)
  → Query refinement (Gemini 2.0 Flash)
  → Search (Jina Search API → Google fallback → DuckDuckGo fallback)
  → URL filtering (currently DISABLED — all URLs accepted)
  → For each URL (priority queue, 1 worker):
      → Check existing entity in DB (skip if fresh)
      → PDF? → pdfplumber (5 pages max) → Jina fallback
      → Webpage? → is_static() check → BS4 or Jina Reader
      → LLM extraction (Groq llama-3.1-8b → Gemini 2.0 Flash fallback)
      → Enrichment: EduRank, publications (CrossRef/SemanticScholar), geocoding, contacts
      → Embedding generation (all-MiniLM-L6-v2)
      → Save to DB → stream to client via WebSocket
  → Suggest related queries
```

**Key files:**
| File | Role |
|------|------|
| `websockets/handlers/websocket_manager.py` | WS lifecycle, auth, entity serialization |
| `websockets/handlers/query_processor.py` | Query orchestration |
| `utils/workflow.py` | Core scraping pipeline, worker pool |
| `utils/scrapers.py` | BS4 + Jina Reader scraping |
| `utils/extractors.py` | Groq/Gemini LLM structured extraction |
| `utils/pdf_extractor.py` | PDF download + pdfplumber |
| `utils/google_search.py` | Jina Search + Google metadata enrichment |
| `utils/query_refiner.py` | Gemini query refinement |
| `utils/external_extractors.py` | EduRank, publications, geocoding |
| `utils/helpers.py` | URL validation, link extraction, semantic categorization |
| `utils/embeddings.py` | SentenceTransformer embeddings |
| `utils/database.py` | Entity save/upsert, session management |

---

## BUGS (Must Fix)

### B1. `retry_async_call` is undefined ✅ FIXED
**File:** `utils/workflow.py:351`
**Impact:** `NameError` on every publications enrichment — silently swallowed, publications always empty.
**Fix applied:** Replaced with direct `await get_publications(...)` call.

### B2. `run_until_complete` inside running async loop
**File:** `utils/scrapers.py:282-283`
```python
loop = asyncio.get_event_loop()
if loop.run_until_complete(is_lab_related(node, src)):
```
**Impact:** `RuntimeError: This event loop is already running` — image lab-relevance filtering is completely broken. No images are ever filtered or stored via this path.
**Fix:** Replace with synchronous heuristic or remove the async call. Since `render_node` is sync and called from sync `extract_raw_content`, the async categorization cannot work here.

### B3. Double query save
**File:** `websocket_manager.py:107` saves the query, then `query_processor.py:268` saves it again.
**Impact:** Duplicate rows in queries table.
**Fix:** Remove the save in `query_processor.py:266-268`.

### B4. Double `status: 'complete'` message
**File:** `workflow.py:556` sends complete, then `query_processor.py:390` sends complete again.
**Impact:** Frontend may react to "complete" twice, causing UI flicker or premature state changes.
**Fix:** Remove the one in `workflow.py:556` — let `query_processor.py` own the complete lifecycle.

### B5. `scrape_with_bs` returns `None` on error, but caller expects dict
**File:** `utils/scrapers.py:349-351` returns `None` on exception.
**Impact:** `workflow.py:327` checks `if not data` but `data.get('html_content', '')` would fail if other code paths don't check.
**Fix:** Return `{'raw_content': '', 'error': str(e)}` instead of `None`.

### B6. Entity data dict uses `publications_meta` in workflow but `publications` in websocket_manager
**Files:** `workflow.py` uses `publications_meta`, `websocket_manager.py:128` uses `entity.get_json_field('publications')`.
**Impact:** The entity model has `publications_meta` column. `websocket_manager.py` calls `get_json_field('publications')` which doesn't exist — always returns `{}`.
**Fix:** Align to `publications_meta` everywhere.

---

## ERROR LEAKAGE ✅ FIXED

All `str(e)` error messages that were sent directly to the frontend have been replaced with sanitized messages via `websockets/handlers/error_sanitizer.py`. The following were patched:
- `websocket_manager.py`: 4 locations
- `query_processor.py`: 3 locations
- `workflow.py`: 4 locations
- `user_entity_search.py`: 1 location

---

## PERFORMANCE BOTTLENECKS

### P1. Single worker (MAX_WORKERS=1)
**Impact:** URLs are processed sequentially. With enrichment (EduRank, publications, geocoding, contacts, embeddings) taking 5-15s per URL, processing 15 URLs takes 75-225 seconds.
**Recommendation:** Increase to 3-5 workers. Each worker is I/O-bound (network calls), so concurrency helps significantly.

### P2. `is_static()` makes 2 HTTP requests per URL (HEAD + GET)
**File:** `utils/scrapers.py:165-206`
**Impact:** Doubles initial page fetch time. The GET response is thrown away — then `scrape_with_bs` makes another GET.
**Recommendation:** Fetch once, decide static/dynamic from that single response, then reuse the HTML.

### P3. `search_with_meta` double-fetches (Jina Search + Google metadata enrichment)
**File:** `utils/google_search.py:118-134`
**Impact:** For every search, it does a Jina API call AND a Google search AND individual page fetches for metadata. This triples the initial search latency.
**Recommendation:** Use Jina results directly — title/description from Jina are sufficient. Drop Google metadata enrichment.

### P4. `scrape_with_jina` is synchronous + `@lru_cache`
**File:** `utils/scrapers.py:398-449`
**Impact:** Uses `requests.get` (blocking) in an executor. `@lru_cache` caches errors forever and prevents re-scraping failed URLs within the process lifetime.
**Recommendation:** Convert to async `httpx`, remove `@lru_cache` (use TTL cache or no cache).

### P5. Enrichment is sequential per URL
Each URL goes through: EduRank scrape → publications API → geocoding → contact extraction → embeddings. All sequential.
**Recommendation:** Run enrichments concurrently with `asyncio.gather()`.

### P6. `semantic_categorization` for link filtering is expensive
**File:** `utils/helpers.py` — loads SentenceTransformer model and computes embeddings for every link.
**Impact:** With 50+ links per page and up to 5 links sampled, this adds significant compute overhead.
**Recommendation:** Use fast heuristic (URL patterns, domain checks) first, only use semantic check for ambiguous cases.

### P7. Embedding generation blocks the pipeline
**File:** `utils/embeddings.py` — SentenceTransformer model inference for every entity.
**Recommendation:** Defer embeddings to a background task. Return entity to user immediately, compute embeddings async.

### P8. No connection pooling for aiohttp
Multiple `aiohttp.ClientSession()` contexts are created per URL in `workflow.py:315` and `scrapers.py:326`.
**Recommendation:** Create one session at workflow start and reuse it.

---

## QUALITY ISSUES

### Q1. URL filtering is completely disabled
**File:** `query_processor.py:129-131` — all URLs are accepted without filtering.
**Impact:** Non-research URLs (news articles, social media, generic pages) pollute results. The LLM extraction tries to make sense of irrelevant content, producing garbage entities.
**Recommendation:** Re-enable filtering with a fast, pragmatic approach (domain + keyword checks). Drop the over-engineered semantic categorization for initial results.

### Q2. LLM extraction quality is poor with llama-3.1-8b-instant
**File:** `utils/extractors.py` — uses a small, fast model as primary.
**Impact:** The 8B model frequently returns malformed JSON, hallucinates fields, and misses data that's clearly in the content. The prompt is very long (~90 lines) which further degrades 8B model performance.
**Recommendation:** Use Gemini 2.0 Flash as primary (better JSON adherence, larger context). Use Groq as fallback. Shorten the prompt significantly.

### Q3. `is_meaningful_entity` threshold may be too permissive/restrictive
**File:** `utils/helpers.py` (referenced) and `utils/database.py` — requires 2 of 6 fields.
**Impact:** Entities with only "university" + empty location pass, producing low-value results.
**Recommendation:** Require at minimum: non-empty `university` + non-empty `research_abstract` OR `scopes`.

### Q4. Query refinement is overly narrow
**File:** `utils/query_refiner.py` — hardcoded to target "Sub-Saharan African R&D labs."
**Impact:** If a user searches for "MIT robotics lab", the refinement rewrites it to focus on Africa, returning irrelevant results.
**Recommendation:** Make refinement context-aware. If the query already specifies a region/institution, don't override it.

### Q5. No deduplication of yielded entities
The same entity can be yielded multiple times — once from `retrieve_relevant_user_entities` and again from the scraper workflow if the same URL is processed.
**Recommendation:** Track yielded entity IDs in a set and skip duplicates.

### Q6. No quality scoring or ranking of results
Entities are returned in processing order (URL queue priority), not quality order.
**Recommendation:** Compute a quality score based on field completeness, research_abstract length, and relevance to query. Sort before streaming or add score to entity data.

---

## IMPLEMENTATION PLAN

### Phase 1: Critical Bug Fixes (Immediate)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Fix `run_until_complete` in image filtering — replace with sync heuristic | `scrapers.py` | Critical |
| 1.2 | Remove double query save | `query_processor.py` | High |
| 1.3 | Remove double complete message (remove from `workflow.py`) | `workflow.py` | High |
| 1.4 | Fix `scrape_with_bs` to return error dict instead of `None` | `scrapers.py` | High |
| 1.5 | Fix `publications` vs `publications_meta` field name mismatch | `websocket_manager.py` | High |
| 1.6 | Remove `print()` statements from `extractors.py` | `extractors.py` | Medium |

### Phase 2: Performance — Quick Wins ✅ DONE

| # | Task | File(s) | Expected Impact |
|---|------|---------|-----------------|
| 2.1 | ✅ Increase MAX_WORKERS to 3 | config | 3x throughput |
| 2.2 | ✅ Merge `is_static` + `scrape_with_bs` into single fetch (`scrape_static_url`) | `scrapers.py` | -2-3 HTTP requests/URL |
| 2.3 | ✅ Drop Google metadata enrichment from `search_with_meta` | `google_search.py` | -2-5s on search |
| 2.4 | ✅ Run enrichments concurrently (`asyncio.gather`) | `workflow.py` | -5-10s per URL |
| 2.5 | ✅ Reuse single `aiohttp.ClientSession` per workflow | `workflow.py` | Fewer connections |
| 2.6 | ✅ Remove `@lru_cache` from `scrape_with_jina`, convert to async (`scrape_with_jina_async`) | `scrapers.py` | Fix stale cache bug |

### Phase 3: Quality Improvements ✅ DONE

| # | Task | File(s) | Expected Impact |
|---|------|---------|-----------------|
| 3.1 | ✅ Re-enable URL filtering (fast domain + keyword check with fallback) | `query_processor.py` | Fewer garbage entities |
| 3.2 | ✅ Switch primary LLM to Gemini 2.0 Flash, Groq as fallback | `extractors.py` | Better JSON, fewer hallucinations |
| 3.3 | ✅ Shorten LLM prompt (~60% smaller, clearer instructions) | `extractors.py` | Faster + more reliable extraction |
| 3.4 | ✅ Make query refinement context-aware (preserve region/institution) | `query_refiner.py` | Correct results for non-African queries |
| 3.5 | ✅ Add entity deduplication (`yielded_urls` set) | `workflow.py` | No duplicate entities |
| 3.6 | ✅ Tighten `is_meaningful_entity` (require university + abstract/scopes/dept) | `helpers.py` | Higher quality threshold |

### Phase 4: Architecture Improvements ✅ DONE

| # | Task | File(s) | Expected Impact |
|---|------|---------|-----------------|
| 4.1 | ✅ Defer embedding generation to background task | `workflow.py`, `embeddings.py` | -1-2s per URL |
| 4.2 | ✅ Replace sync `requests` with async `httpx` in PDF extractor | `pdf_extractor.py` | Non-blocking PDF downloads |
| 4.3 | ✅ Replace sync `requests` in `jina_fallback` with async | `pdf_extractor.py` | Non-blocking fallback |
| 4.4 | ✅ Add entity quality score (field completeness + relevance) | New: `utils/quality_scorer.py` | Ranked results |
| 4.5 | ✅ Add rate limiting for external API calls | New: `utils/rate_limiter.py` | Prevent 429 errors |
| 4.6 | ✅ Remove file I/O (universities.txt, potential_directories.txt) | `query_processor.py` | Remove unnecessary disk writes |

### Phase 5: Reliability & Observability ✅ DONE

| # | Task | File(s) | Expected Impact |
|---|------|---------|-----------------|
| 5.1 | ✅ Add per-URL timeout wrapper (60s max) | `workflow.py` | Prevent single URL blocking pipeline |
| 5.2 | ✅ Add structured logging with session_id context | New: `utils/log_context.py` | Debuggable logs |
| 5.3 | ✅ Add pipeline metrics (time per stage, success/fail counts) | New: `utils/pipeline_metrics.py`, `workflow.py` | Performance visibility |
| 5.4 | ✅ Remove hardcoded DB credentials from defaults | `database.py` | Security |
| 5.5 | ✅ Replace bare `except:` with `except Exception:` everywhere | 7 files | Don't swallow SystemExit/KeyboardInterrupt |

---

## EXPECTED OUTCOMES

| Metric | Current | After Phase 2 | After Phase 4 |
|--------|---------|---------------|---------------|
| Time to first result | 15-30s | 8-15s | 5-10s |
| Total processing time (15 URLs) | 75-225s | 25-75s | 15-45s |
| Entity quality (% with research_abstract) | ~40% | ~40% | ~70% |
| Garbage entities returned | ~30% | ~10% | ~5% |
| Error leakage to frontend | Common | None | None |

---

## RECOMMENDED EXECUTION ORDER

1. **Phase 1** — Fix critical bugs (prevents crashes, data corruption, duplicate sends)
2. **Phase 2.1-2.4** — Performance quick wins (biggest user-visible improvement)
3. **Phase 3.1-3.3** — Quality improvements (better results)
4. **Phase 2.5-2.6, Phase 4** — Architecture improvements (sustained performance)
5. **Phase 5** — Reliability (production hardening)

Each phase is independently deployable and testable.
