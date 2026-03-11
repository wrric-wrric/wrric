import httpx
import asyncio
import re

async def get_publications_semanticscholar(university: str, topic: str, limit: int = 5):
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    query = f"{university} {topic}"
    
    params = {
        "query": query,
        "limit": limit,
        "fields": "title,authors,year,url,abstract,citationCount,referenceCount,fieldsOfStudy,publicationTypes,publicationDate,openAccessPdf"
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        publications = []
        for paper in data.get("data", []):
            doi_link = None
            oapdf = paper.get("openAccessPdf", {})

            # 1️⃣ Check if openAccessPdf.url contains DOI
            if oapdf.get("url", "").startswith("https://doi.org/"):
                doi_link = oapdf["url"]

            # 2️⃣ If no DOI found, try to get from disclaimer
            elif "disclaimer" in oapdf and oapdf["disclaimer"]:
                match = re.search(r"https://doi\.org/[^\s,]+", oapdf["disclaimer"])
                if match:
                    doi_link = match.group(0)

            publications.append({
                "title": paper.get("title", ""),
                "doi": doi_link or "N/A",
                "url": paper.get("url", ""),  # Semantic Scholar page
                "year": paper.get("year", ""),
                "citations": paper.get("citationCount", 0),
                "references": paper.get("referenceCount", 0),
                "fields_of_study": paper.get("fieldsOfStudy", []),
                "publication_types": paper.get("publicationTypes", []),
                "publication_date": paper.get("publicationDate", ""),
                "abstract": paper.get("abstract", "") or ""
            })

        return {"count": len(publications), "list": publications}

async def test_get_publications():
    university = "Kwame Nkrumah University of Science and Technology"
    topic = "solar energy"
    result = await get_publications_semanticscholar(university, topic, limit=5)

    print(f"Found {result['count']} publications for '{university}' on topic '{topic}':\n")
    for i, pub in enumerate(result['list'], 1):
        print(f"{i}. Title: {pub['title']}")
        print(f"   DOI Link: {pub['doi']}")
        print(f"   Year: {pub['year']}")
        print(f"   Citations: {pub['citations']}")
        print(f"   Fields of Study: {', '.join(pub['fields_of_study']) if pub['fields_of_study'] else 'N/A'}")
        print(f"   Publication Types: {', '.join(pub['publication_types']) if pub['publication_types'] else 'N/A'}")
        print(f"   Publication Date: {pub['publication_date']}")
        print(f"   Semantic Scholar URL: {pub['url']}")
        print(f"   Abstract: {pub['abstract'][:200]}{'...' if len(pub['abstract']) > 200 else ''}")
        print()

if __name__ == "__main__":
    asyncio.run(test_get_publications())
