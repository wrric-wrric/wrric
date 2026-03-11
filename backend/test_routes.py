"""Quick script to check registered routes"""
import sys
from main import app

print("=" * 80)
print("CHECKING ROUTES FOR /api/admin/users/validate-csv")
print("=" * 80)

found = False
for route in app.routes:
    path = getattr(route, 'path', '')
    methods = getattr(route, 'methods', set())
    
    if '/admin/users' in path:
        print(f"\nPath: {path}")
        print(f"Methods: {methods}")
        print(f"Name: {getattr(route, 'name', 'N/A')}")
        
        if 'validate-csv' in path:
            found = True
            print(">>> FOUND THE validate-csv ROUTE! <<<")

if not found:
    print("\n" + "!" * 80)
    print("WARNING: /validate-csv route NOT found in registered routes!")
    print("!" * 80)
else:
    print("\n" + "=" * 80)
    print("SUCCESS: Route is registered!")
    print("=" * 80)
