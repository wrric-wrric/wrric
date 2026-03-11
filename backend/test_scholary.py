from scholarly import scholarly, ProxyGenerator

# --- Setup proxy before any search ---
pg = ProxyGenerator()
pg.FreeProxies()  # Important: avoid TypeError
scholarly.use_proxy(pg)

# --- Search for author ---
search_query = scholarly.search_author("Steven A Cholewiak")
try:
    first_author_result = next(search_query)
except StopIteration:
    print("No author found. Try adjusting the search query.")
    exit()

print("\nAuthor snippet:")
scholarly.pprint(first_author_result)

# --- Fill in author details ---
author = scholarly.fill(first_author_result)
print("\nFull author data:")
scholarly.pprint(author)

# --- First publication details ---
if author.get("publications"):
    first_pub = author["publications"][0]
    first_pub_filled = scholarly.fill(first_pub)
    print("\nFirst publication full details:")
    scholarly.pprint(first_pub_filled)

    # --- Citations ---
    citations = [c["bib"]["title"] for c in scholarly.citedby(first_pub_filled)]
    print("\nCiting papers:")
    for title in citations:
        print("-", title)

# --- Example: Search by paper title ---
print("\nSearch for a paper by title:")
search_pub_query = scholarly.search_pubs(
    "Perception of physical stability and center of mass of 3D objects"
)
try:
    scholarly.pprint(next(search_pub_query))
except StopIteration:
    print("No publications found for that title.")
