import requests
import uuid
import json

def test_create_event():
    # 1. Login to get token
    login_url = "http://127.0.0.1:8000/api/login"
    login_data = {
        "username": "admin", 
        "password": "password123",
        "recaptchaResponse": "bypassed"
    }
    
    print("Attempting login...")
    login_resp = requests.post(login_url, json=login_data)
    
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.status_code} - {login_resp.text}")
        return
    
    token = login_resp.json()["access_token"]
    print(f"Logged in successfully. Token: {token[:10]}...")

    # 2. Get category ID
    headers = {"Authorization": f"Bearer {token}"}
    cat_resp = requests.get("http://127.0.0.1:8000/api/admin/categories", headers=headers)
    category_id = None
    if cat_resp.status_code == 200:
        cats = cat_resp.json()
        if cats:
            category_id = cats[0]['id']
            print(f"Using category ID: {category_id}")

    # 3. Create event
    # Categories must be a JSON string of a list
    categories_json = json.dumps([category_id]) if category_id else "[]"
    
    form_data = {
        'title': 'Final Verification Event ' + str(uuid.uuid4())[:8],
        'description': 'Test Description for final verification.',
        'short_description': 'Short description for final verification.',
        'event_datetime': '2026-12-31T12:00:00Z',
        'timezone': 'UTC',
        'location_type': 'physical',
        'physical_location': 'Nairobi, Kenya',
        'is_published': 'true',
        'is_featured': 'false',
        'priority': '50',
        'categories': categories_json
    }
    
    print(f"Creating event with categories: {categories_json}")
    # HIT THE PROXY INSTEAD OF DIRECTLY HITTING BACKEND
    # Use files parameter to force multipart/form-data
    resp = requests.post(
        "http://localhost:3000/api/admin/events",
        headers=headers,
        data=form_data,
        files={'dummy': ('', '')} # Forces multipart/form-data
    )

    print(f"Response status: {resp.status_code}")
    print(f"Response body: {resp.text}")
    
    if resp.status_code in [200, 201]:
        print("SUCCESS: Event created successfully!")
    else:
        print("FAILURE: Could not create event.")

if __name__ == "__main__":
    test_create_event()
