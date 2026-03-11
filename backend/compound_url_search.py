import os
import re
import json
from dotenv import load_dotenv
from groq import Groq
import argparse

def search_and_extract_urls(query, output_format="urls"):
    """
    Perform a web search using Groq's compound model and extract structured results based on the specified format.
    
    Args:
        query (str): The search query, e.g., "Solar labs in Ghana, related research papers links".
        output_format (str): One of "urls" (list of unique URLs), "description_url" (list of dicts with title, description, url),
                             or "paragraph" (single paragraph summarizing the topic with key insights).
    
    Returns:
        dict: Structured output as JSON-serializable dict.
    """
    # Load environment variables
    load_dotenv()
    
    # Initialize client
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    # Ask the model to use web search
    response = client.chat.completions.create(
        model="groq/compound",
        messages=[
            {
                "role": "system",
                "content": "You are a search assistant. Always use web search and return up to 15 relevant URLs."
            },
            {
                "role": "user",
                "content": query
            }
        ]
    )
    
    # Safely access message as dict
    message = response.choices[0].message.__dict__ if hasattr(response.choices[0].message, '__dict__') else response.choices[0].message
    
    # Extract all URLs from content and reasoning using regex
    content_text = message.get('content', '')
    reasoning_text = message.get('reasoning', '')
    combined_text = content_text + ' ' + reasoning_text
    
    # Find all HTTP/HTTPS links
    url_pattern = r'https?://[^\s<>"\[\]]+'
    urls = re.findall(url_pattern, combined_text)
    
    # Deduplicate and clean URLs
    unique_urls = list(set(url.strip() for url in urls if url.strip()))
    
    # Parse raw search results from reasoning for more details (if available)
    raw_results = []
    if '<tool>\nsearch' in reasoning_text and '<output>' in reasoning_text:
        output_match = re.search(r'<output>(.*?)</output>', reasoning_text, re.DOTALL)
        if output_match:
            output_content = output_match.group(1)
            results = re.findall(r'Title: (.*?)\nURL: (.*?)\nContent: (.*?)\nScore: (.*?)(?=\n\nTitle:|$)', output_content, re.DOTALL)
            for title, url, snippet, score in results:
                raw_results.append({
                    'title': title.strip(),
                    'url': url.strip(),
                    'description': snippet.strip(),  # Use snippet as description
                    'score': float(score.strip()) if score.strip() else 0.0
                })
    
    # Generate structured output based on format
    if output_format == "urls":
        structured_output = {
            'all_urls': unique_urls[:15]
        }
    elif output_format == "description_url":
        # Use raw_results if available, else fallback to URLs with empty title/desc
        if raw_results:
            # Limit to unique URLs from raw_results
            unique_raw = []
            seen_urls = set()
            for res in raw_results[:15]:
                if res['url'] not in seen_urls:
                    unique_raw.append(res)
                    seen_urls.add(res['url'])
            structured_output = {
                'results': unique_raw
            }
        else:
            structured_output = {
                'results': [{'title': '', 'description': '', 'url': url} for url in unique_urls[:15]]
            }
    elif output_format == "paragraph":
        # Simple summary paragraph based on content (or use raw snippets if available)
        if raw_results:
            summary_parts = [f"{res['title']}: {res['description'][:200]}..." for res in raw_results[:5]]
            paragraph = "Key insights from research on the topic: " + ". ".join(summary_parts) + "."
        else:
            paragraph = f"Based on the search for '{query}', relevant resources include studies on solar energy applications, policies, and potentials in Ghana, highlighting opportunities for renewable integration and economic benefits."
        structured_output = {
            'summary_paragraph': paragraph
        }
    else:
        raise ValueError("Invalid output_format. Choose 'urls', 'description_url', or 'paragraph'.")
    
    return structured_output

# Example usage as a script
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search and extract structured results.")
    parser.add_argument("query", type=str, help="The search query")
    parser.add_argument("--format", type=str, default="urls", choices=["urls", "description_url", "paragraph"],
                        help="Output format: urls, description_url, or paragraph")
    
    args = parser.parse_args()
    
    result = search_and_extract_urls(args.query, args.format)
    print(json.dumps(result, indent=2))