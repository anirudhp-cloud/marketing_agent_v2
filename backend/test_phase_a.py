import httpx
import json

BASE = "http://localhost:8000"

# Test 1: Submit step 1 (creates session)
r = httpx.post(f"{BASE}/api/wizard/step", json={
    "session_id": "insta_smartwheels_test123",
    "step": 1,
    "data": {
        "storeName": "SmartWheels",
        "websiteUrl": "https://smartwheels.com",
        "productCategory": "Car Accessories",
        "businessSize": "Small",
        "targetMarketLocation": "Mumbai, Delhi",
        "instagramUrl": "https://instagram.com/smartwheels",
        "storeType": "ecommerce",
        "brandColors": ["#FF4D2E", "#1A1A2E"],
        "typographyStyle": "Modern Sans-Serif",
        "logoPlacement": "Bottom-right corner",
        "brandBookUploaded": False,
    },
})
print(f"Step 1: {r.status_code} {r.json()}")

# Test 2: Submit step 2
r = httpx.post(f"{BASE}/api/wizard/step", json={
    "session_id": "insta_smartwheels_test123",
    "step": 2,
    "data": {
        "segments": ["Young Professionals", "Car Enthusiasts"],
        "description": "Tech-savvy car owners in India",
        "geoTargeting": "Mumbai, Delhi, Bangalore",
        "ageRange": ["25-34", "35-44"],
        "genderFocus": "All",
        "activityLevel": "High",
        "primarySegment": "Young Professionals",
        "secondarySegment": "Car Enthusiasts",
    },
})
print(f"Step 2: {r.status_code} {r.json()}")

# Test 3: Submit step 3
r = httpx.post(f"{BASE}/api/wizard/step", json={
    "session_id": "insta_smartwheels_test123",
    "step": 3,
    "data": {
        "goalType": "brand_awareness",
        "budget": 15000,
        "durationDays": 30,
        "startDate": "2026-04-01",
        "formats": ["post", "reel"],
    },
})
print(f"Step 3: {r.status_code} {r.json()}")

# Test 4: Submit step 4
r = httpx.post(f"{BASE}/api/wizard/step", json={
    "session_id": "insta_smartwheels_test123",
    "step": 4,
    "data": {
        "imageStyle": "Lifestyle",
        "contentType": "both",
        "imageSizes": ["1080x1080"],
        "hashtagCount": "15",
        "hashtagMix": "mixed",
        "seedHashtags": "#caraccessories #smartwheels",
        "variantCount": 4,
        "toneOfVoice": "Friendly",
    },
})
print(f"Step 4: {r.status_code} {r.json()}")

# Test 5: Get full state
r = httpx.get(f"{BASE}/api/wizard/state/insta_smartwheels_test123")
state = r.json()
print(f"\nFull State: {r.status_code}")
print(f"  businessProfile.storeName = {state['businessProfile'].get('storeName')}")
print(f"  audience.primarySegment = {state['audience'].get('primarySegment')}")
print(f"  goals.goalType = {state['goals'].get('goalType')}")
print(f"  creative.variantCount = {state['creative'].get('variantCount')}")
print(f"  currentStep = {state['currentStep']}")
print(f"  humanApproved = {state['humanApproved']}")
print(f"  variants count = {len(state['variants'])}")
print(f"  calendarPosts count = {len(state['calendarPosts'])}")

# Test 6: Resume (approve)
r = httpx.post(f"{BASE}/api/wizard/resume", json={
    "session_id": "insta_smartwheels_test123",
    "human_approved": True,
})
print(f"\nResume: {r.status_code} {r.json()}")

# Test 7: State after approve
r = httpx.get(f"{BASE}/api/wizard/state/insta_smartwheels_test123")
print(f"After approve: humanApproved = {r.json()['humanApproved']}")

# Test 8: 404 for unknown session
r = httpx.get(f"{BASE}/api/wizard/state/nonexistent_session")
print(f"\nUnknown session: {r.status_code} {r.json()}")

# Test 9: Invalid step number
r = httpx.post(f"{BASE}/api/wizard/step", json={
    "session_id": "insta_smartwheels_test123",
    "step": 5,
    "data": {},
})
print(f"Invalid step 5: {r.status_code}")

print("\n--- ALL TESTS PASSED ---")
