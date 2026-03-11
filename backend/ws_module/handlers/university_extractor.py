import asyncio
import json
import logging
import re
from urllib.parse import urlparse
from .config import GROQ_API_KEY, EDUCATIONAL_DOMAINS, config, GLOBAL_EXECUTOR
from utils.config import save_config
from groq import Groq

logger = logging.getLogger(__name__)

async def extract_universities_from_urls(session_id: str, query: str, urls: list) -> list:
    """Use Groq to extract university names and URLs from a list of URLs with robust JSON validation."""
    if not GROQ_API_KEY:
        logger.error(f"GROQ_API_KEY not set for session {session_id}")
        return [{"university": None, "url": url} for url in urls]

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"""
        Given the following query and list of URLs, identify the universities or academic institutions associated with each URL.
        Return a JSON array of objects, each with 'university' (the institution name or null if not identified) and 'url' (the exact URL provided).
        Ensure the response is valid JSON with proper formatting: use null without quotes for non-identified institutions, and ensure each object has exactly 'university' and 'url' fields.
        Consider domains like .edu, .ac.*, .edu.*, .org, or those containing 'university', 'institute', or 'college' as potential academic institutions.
        Prioritize Sub-Saharan African institutions (e.g., domains like .ac.rw, .edu.ng) when relevant to the query.

        **STRICT COMPLIANCE REQUIRED**
        - You MUST return ONLY a valid JSON array of objects with 'university' and 'url' fields
        - You MUST NOT include any comments, explanations, or conversational text
        - You MUST NOT use markdown formatting or code blocks
        - You MUST use null (without quotes) for non-identified institutions
        - Failure to follow this format will break automated parsing systems

        Identify universities/academic institutions from these URLs for query: {query}
        URL List: {json.dumps(urls)}

        Required JSON format:
        [
            {{"university": "Institution Name", "url": "https://exact.provided.url"}},
            {{"university": null, "url": "https://another.url"}}
        ]

        **Critical Constraints**
        1. Output must be machine-readable JSON only
        2. No additional text before/after JSON array
        3. Strictly adhere to the example structure
        4. Never add fields beyond 'university' and 'url'

        Return valid JSON array now:
        """
        chat_completion = await asyncio.get_event_loop().run_in_executor(
            GLOBAL_EXECUTOR,
            lambda: client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama3-70b-8192"
            )
        )
        completion_text = chat_completion.choices[0].message.content.strip()
        logger.debug(f"Raw Groq response for {session_id}: {completion_text}")

        # Clean and normalize the response
        cleaned_text = re.sub(r'```(?:json)?\n?', '', completion_text).strip()
        cleaned_text = re.sub(r'"\bnull\b"', 'null', cleaned_text)

        # Robust JSON repair
        def repair_json(text):
            # Fix missing closing braces
            open_braces = text.count('{')
            close_braces = text.count('}')
            if open_braces > close_braces:
                text += '}' * (open_braces - close_braces)
            
            # Fix missing closing brackets
            open_brackets = text.count('[')
            close_brackets = text.count(']')
            if open_brackets > close_brackets:
                text += ']' * (open_brackets - close_brackets)
            
            # Fix missing commas between objects
            text = re.sub(r'}\s*{', '},{', text)
            
            # Fix URLs as keys or missing quotes
            lines = text.split('\n')
            fixed_lines = []
            for line in lines:
                # Match malformed objects like {"university": "Name", "https://url"}
                match = re.match(r'\s*\{"university":\s*"([^"]+)",\s*"(https?://[^"]+)"\}\s*(,)?\s*', line)
                if match:
                    university, url, comma = match.groups()
                    fixed_line = f'{{"university": "{university}", "url": "{url}"}}{comma if comma else ""}'
                    fixed_lines.append(fixed_line)
                else:
                    # Fix incomplete objects with missing quotes or braces
                    url_match = re.search(r'"\s*(https?://[^\s"}]+)(?:\s*|\})', line)
                    uni_match = re.search(r'"university":\s*"([^"]+)"', line)
                    if uni_match and url_match:
                        university = uni_match.group(1)
                        url = url_match.group(1)
                        fixed_line = f'{{"university": "{university}", "url": "{url}"}}'
                        fixed_lines.append(fixed_line)
                    else:
                        fixed_lines.append(line)
            text = '\n'.join(fixed_lines)

            # Ensure array structure
            if not text.startswith('['):
                text = '[' + text
            if not text.endswith(']'):
                text = text.rstrip(',') + ']'

            # Remove trailing commas before closing brackets/braces
            text = re.sub(r',\s*]', ']', text)
            text = re.sub(r',\s*}', '}', text)

            return text

        cleaned_text = repair_json(cleaned_text)
        logger.debug(f"Repaired JSON for {session_id}: {cleaned_text}")

        # Extract JSON array
        start = cleaned_text.find('[')
        end = cleaned_text.rfind(']')
        if start == -1 or end == -1 or end <= start:
            logger.error(f"No JSON array found in repaired response for {session_id}: {cleaned_text}")
            return [{"university": None, "url": url} for url in urls]

        json_text = cleaned_text[start:end + 1]
        logger.debug(f"Extracted JSON for {session_id}: {json_text}")

        try:
            universities = json.loads(json_text)
            validated = []
            for item in universities:
                if not isinstance(item, dict):
                    logger.warning(f"Invalid item in Groq response for {session_id}: {item}")
                    continue
                university = item.get('university')
                url = item.get('url')
                if not url or not isinstance(url, str) or not url.startswith(('http://', 'https://')):
                    logger.warning(f"Invalid URL in Groq response for {session_id}: {url}")
                    continue
                if url not in urls:
                    logger.warning(f"URL {url} not in provided list for {session_id}")
                    continue
                # Validate Sub-Saharan Africa relevance
                domain = urlparse(url).netloc.lower().replace('www.', '')
                is_sub_saharan = any(domain.endswith(ed) for ed in ['.ac.rw', '.edu.ng', '.ac.ke', '.ac.ug', '.ac.tz', '.edu.et', '.ac.zw', '.edu.zm', '.ac.mw'])
                if university and (is_sub_saharan or 'africa' in query.lower() or any(c in query.lower() for c in ['rwanda', 'nigeria', 'kenya', 'uganda', 'tanzania', 'burundi'])):
                    validated.append({"university": university, "url": url})
                    domain_parts = domain.split('.')
                    if len(domain_parts) >= 2:
                        new_domain = '.' + '.'.join(domain_parts[-2:])
                        if new_domain not in EDUCATIONAL_DOMAINS:
                            EDUCATIONAL_DOMAINS.append(new_domain)
                            config['EDUCATIONAL_DOMAINS'] = EDUCATIONAL_DOMAINS
                            try:
                                save_config(config)
                                logger.info(f"Added new domain {new_domain} to EDUCATIONAL_DOMAINS for {session_id}")
                            except Exception as e:
                                logger.error(f"Failed to save updated EDUCATIONAL_DOMAINS for {session_id}: {e}")
                else:
                    validated.append({"university": None, "url": url})
            logger.debug(f"Validated universities for {session_id}: {validated}")
            return validated if validated else [{"university": None, "url": url} for url in urls]
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse repaired Groq JSON for {session_id}: {e}, JSON: {json_text}")
            # Fallback to manual parsing
            validated = []
            for url in urls:
                url_match = re.search(rf'"url":\s*"{re.escape(url)}"|"university":\s*"([^"]+)"', cleaned_text)
                uni_match = re.search(rf'"university":\s*"([^"]+)"(?=.*"url":\s*"{re.escape(url)}")', cleaned_text)
                if uni_match:
                    validated.append({"university": uni_match.group(1), "url": url})
                else:
                    validated.append({"university": None, "url": url})
            logger.debug(f"Manually parsed universities for {session_id}: {validated}")
            return validated if validated else [{"university": None, "url": url} for url in urls]
    except Exception as e:
        logger.error(f"Groq API error for extracting universities in {session_id}: {e}")
        return [{"university": None, "url": url} for url in urls]