"""Quick integration test for campaign generation."""
import httpx
import json

base = "http://localhost:8000"

# First ensure steps 1-4 exist
steps = [
    (1, {
        "company_name": "FreshBrew Coffee",
        "website_url": "https://freshbrew.in",
        "product_category": "Coffee & Beverages",
        "store_type": "ecommerce",
        "brand_insights": "Premium artisanal coffee brand. Focus on sustainability and farm-to-cup.",
        "brand_colours": ["#4A2C2A", "#D4A574", "#F5F0E8"],
        "target_market_location": "Mumbai|Delhi|Bangalore",
    }),
    (2, {
        "primary_segment": "Urban Millennials",
        "secondary_segment": "Health-Conscious Professionals",
        "audience_description": "Coffee lovers aged 25-35 in metros",
        "geo_targeting": "Mumbai|Delhi|Bangalore",
        "age_range": ["25-34"],
        "gender_focus": "all",
        "activity_level": "highly_active",
    }),
    (3, {
        "goal_type": "brand_awareness",
        "budget": 50000,
        "duration_days": 30,
        "start_date": "2026-04-01T10:00",
        "formats": ["Instagram Post", "Instagram Reel"],
    }),
    (4, {
        "image_style": "warm-minimal",
        "content_type": "both",
        "image_sizes": ["1080x1080", "1080x1350"],
        "variant_count": 4,
        "tone_of_voice": "warm, conversational, premium feel",
        "hashtag_count": "15",
        "hashtag_mix": "balanced",
        "seed_hashtags": "#coffee #freshbrew #coffeelover",
    }),
]

sid = "test-gen-002"

for step_num, data in steps:
    r = httpx.post(f"{base}/api/wizard/step", json={
        "session_id": sid, "step": step_num, "data": data
    })
    print(f"Step {step_num}: {r.status_code}")

# Preflight
r = httpx.post(f"{base}/api/campaign/preflight", json={"session_id": sid})
print(f"Preflight: {r.json()}")

# Generate (SSE)
print("\n--- Starting generation (SSE) ---")
with httpx.stream("GET", f"{base}/api/campaign/generate?session_id={sid}", timeout=120) as response:
    for line in response.iter_lines():
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            print(f"  SSE: {payload}")

# Fetch variants
print("\n--- Fetching variants ---")
r = httpx.get(f"{base}/api/variants/{sid}")
data = r.json()
print(f"Count: {len(data['variants'])}")
for v in data["variants"]:
    print(f"  [{v['id']}] {v['angle']} — {v['headline'][:60]}...")
    print(f"       CTA: {v['cta']}")
    print(f"       Score: {v['score']} | Recommended: {v['recommended']}")
    print(f"       Hashtags: {len(v['hashtags'])} tags")
    if v["hashtags"]:
        print(f"       Sample: {' '.join(v['hashtags'][:5])}")
    print()
