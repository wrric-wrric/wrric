import logging
import json
import os
import asyncio
import re
import httpx
from dotenv import load_dotenv
from groq import Groq
from google.generativeai import GenerativeModel
from urllib.parse import urlparse
from utils.rate_limiter import gemini_limiter, groq_limiter, cerebras_limiter, sambanova_limiter

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
CEREBRAS_API_KEY = os.getenv('CEREBRAS_API_KEY')
SAMBANOVA_API_KEY = os.getenv('SAMBANOVA_API_KEY')

# Concise prompt template (Phase 3.3)
_EXTRACTION_PROMPT = """Extract structured data from this webpage into a single JSON object.

Fields (use exact names, return empty values if not found):
- "university": string — institution name. If "{university}" is "Unknown Institution", infer from URL domain or page content.
- "location": {{"city":"","country":"","address":""}}
- "website": string — official URL
- "edurank": {{"url":"","score":""}}
- "department": {{"name":"","focus":""}}
- "publications_meta": {{"titles":[],"url":""}}
- "related": string — partner institutions
- "point_of_contact": {{"name":"","email":"","contact":""}}
- "scopes": ["research area 1","research area 2"]
- "research_abstract": string — 5+ lines summarizing the lab/department research
- "lab_equipment": {{"overview":"","list":[]}}

Rules:
1. Return ONLY valid JSON — no markdown, no code blocks, no explanation.
2. Fill fields only from evidence in the content. Use empty defaults otherwise.
3. "research_abstract" should be detailed (5+ lines) and suitable for academic evaluation.

University: {university}
URL: {url}
Content (truncated):
{content}
"""


def _parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from LLM response text."""
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)  # Remove control chars
    text = re.sub(r'```json\s*', '', text)  # Strip markdown code fences
    text = re.sub(r'```\s*$', '', text)
    text = re.sub(r'}\s*[^}]*$', '}', text)  # Strip trailing non-JSON
    start, end = text.find('{'), text.rfind('}')
    if start == -1 or end == -1:
        return None
    json_str = text[start:end + 1]
    return json.loads(json_str)


def _fallback_university(url: str) -> str:
    """Try to extract university name from URL domain."""
    domain = urlparse(url).netloc.lower().replace('www.', '')
    domain_map = {
        'udel.edu': 'University of Delaware',
        'ug.edu.gh': 'University of Ghana',
        'unn.edu.ng': 'University of Nigeria, Nsukka',
    }
    return domain_map.get(domain, "")


async def _call_openai_compatible(api_key: str, base_url: str, model: str, prompt: str, provider_name: str, limiter, timeout: float = 30.0) -> dict | None:
    """Call an OpenAI-compatible API (Cerebras, SambaNova, etc.)."""
    await limiter.acquire()
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1500,
            },
        )
        response.raise_for_status()
        data = response.json()
        completion_text = data["choices"][0]["message"]["content"]
        logger.debug(f"{provider_name} response: {completion_text[:200]}")

        extracted_data = _parse_json_response(completion_text)
        if extracted_data is None:
            logger.error(f"No JSON found in {provider_name} response: {completion_text[:300]}")
            raise ValueError(f"No JSON found in {provider_name} output")

        logger.info(f"Successfully extracted data with {provider_name}")
        return extracted_data


async def extract_structured_data(html_content: str, university: str, url: str = "") -> dict:
    """Extract structured data from HTML content using LLMs.
    Fallback chain: Gemini → Cerebras → SambaNova → Groq.
    """
    logger.info("Extracting information with LLM...")

    default_data = {
        "university": "",
        "location": {},
        "website": "",
        "edurank": {},
        "department": {},
        "publications_meta": {},
        "related": "",
        "point_of_contact": {},
        "scopes": [],
        "research_abstract": "",
        "lab_equipment": {}
    }

    prompt = _EXTRACTION_PROMPT.format(
        university=university,
        url=url,
        content=html_content[:12000]
    )

    def _apply_university_fallback(data: dict) -> dict:
        if not data.get("university") and university == "Unknown Institution":
            data["university"] = _fallback_university(url)
        return data

    # Step 1: Cerebras — Llama 3.3 70B (best quality, fast, generous free tier)
    if CEREBRAS_API_KEY:
        try:
            logger.info("Trying Cerebras llama-3.3-70b...")
            extracted_data = await _call_openai_compatible(
                api_key=CEREBRAS_API_KEY,
                base_url="https://api.cerebras.ai/v1",
                model="llama-3.3-70b",
                prompt=prompt,
                provider_name="Cerebras",
                limiter=cerebras_limiter,
            )
            if extracted_data:
                return _apply_university_fallback(extracted_data)
        except asyncio.TimeoutError:
            logger.error("Timeout with Cerebras API")
        except httpx.HTTPStatusError as e:
            logger.error(f"Cerebras API error: {e.response.status_code} {e.response.text[:200]}")
        except Exception as e:
            logger.error(f"Cerebras extraction failed: {e}", exc_info=True)
    else:
        logger.debug("CEREBRAS_API_KEY not set, skipping Cerebras")

    # Step 2: Gemini 2.0 Flash
    if GOOGLE_API_KEY:
        try:
            logger.info("Trying Gemini 2.0 Flash...")
            model = GenerativeModel('gemini-2.0-flash', generation_config={"temperature": 0.1})
            await gemini_limiter.acquire()
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: model.generate_content(prompt)
                ),
                timeout=30.0
            )
            completion_text = response.text
            logger.debug(f"Gemini response: {completion_text[:200]}")

            extracted_data = _parse_json_response(completion_text)
            if extracted_data is None:
                logger.error(f"No JSON found in Gemini response: {completion_text[:300]}")
                raise ValueError("No JSON found in Gemini output")

            logger.info("Successfully extracted data with Gemini")
            return _apply_university_fallback(extracted_data)

        except asyncio.TimeoutError:
            logger.error("Timeout with Gemini API")
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}", exc_info=True)
    else:
        logger.debug("GOOGLE_API_KEY not set, skipping Gemini")

    # Step 3: SambaNova — Llama 3.1 8B (free tier: 20 req/min)
    if SAMBANOVA_API_KEY:
        try:
            logger.info("Trying SambaNova Meta-Llama-3.1-8B-Instant...")
            extracted_data = await _call_openai_compatible(
                api_key=SAMBANOVA_API_KEY,
                base_url="https://api.sambanova.ai/v1",
                model="Meta-Llama-3.1-8B-Instant",
                prompt=prompt,
                provider_name="SambaNova",
                limiter=sambanova_limiter,
            )
            if extracted_data:
                return _apply_university_fallback(extracted_data)
        except asyncio.TimeoutError:
            logger.error("Timeout with SambaNova API")
        except httpx.HTTPStatusError as e:
            logger.error(f"SambaNova API error: {e.response.status_code} {e.response.text[:200]}")
        except Exception as e:
            logger.error(f"SambaNova extraction failed: {e}", exc_info=True)
    else:
        logger.debug("SAMBANOVA_API_KEY not set, skipping SambaNova")

    # Step 4: Groq — Llama 3.1 8B (last resort, strict rate limits)
    if GROQ_API_KEY:
        logger.info("Falling back to Groq llama-3.1-8b-instant...")
        try:
            client = Groq(api_key=GROQ_API_KEY)
            await groq_limiter.acquire()
            chat_completion = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: client.chat.completions.create(
                        messages=[{"role": "user", "content": prompt}],
                        model="llama-3.1-8b-instant",
                        temperature=0.1,
                        max_tokens=1500
                    )
                ),
                timeout=30.0
            )
            completion_text = chat_completion.choices[0].message.content
            logger.debug(f"Groq response: {completion_text[:200]}")

            extracted_data = _parse_json_response(completion_text)
            if extracted_data is None:
                logger.error(f"No JSON found in Groq response: {completion_text[:300]}")
                raise ValueError("No JSON found in Groq output")

            logger.info("Successfully extracted data with Groq")
            return _apply_university_fallback(extracted_data)

        except asyncio.TimeoutError:
            logger.error("Timeout with Groq API", exc_info=True)
        except Exception as e:
            logger.error(f"Groq extraction failed: {e}", exc_info=True)
    else:
        logger.warning("GROQ_API_KEY not set, skipping Groq fallback")

    logger.error("All LLM extraction attempts failed")
    return default_data
