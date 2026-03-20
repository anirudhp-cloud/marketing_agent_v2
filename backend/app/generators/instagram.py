"""Instagram-specific prompt templates for GPT-4o copy generation."""

from __future__ import annotations

import json

# ── Goal-specific angle guidance ──
GOAL_ANGLES: dict[str, str] = {
    "brand_awareness": "Focus on introducing the brand, its story, and what makes it unique. Prioritise memorability and shareability.",
    "follower_growth": "Focus on community building, FOMO, and reasons to follow. Include value propositions for new followers.",
    "engagement": "Optimise for comments, saves, and shares. Ask questions, use polls, and create debate-worthy angles.",
    "traffic": "Drive clicks to the link in bio. Use curiosity gaps, teasers, and clear value for visiting the website.",
    "conversion": "Focus on purchase intent. Highlight offers, urgency, social proof, and clear product benefits.",
    "promotional": "Highlight the specific offer, discount, or event. Create urgency and excitement.",
}


def build_system_prompt() -> str:
    """Return the system prompt for Instagram copy generation."""
    return (
        "You are an expert Instagram marketing copywriter and strategist. "
        "You generate campaign copy variants for Instagram posts and Reels. "
        "Each variant must have a distinct creative angle, a compelling headline, "
        "post copy (caption), a call-to-action, the target sub-segment it speaks to, "
        "an imagery style description (for later image generation), "
        "an image generation prompt suitable for FLUX 1.1 Pro, "
        "and a video generation prompt suitable for Sora 2 (short 5-second Reel). "
        "You also generate hashtags for each variant. "
        "Always output valid JSON matching the exact schema requested. "
        "Never include markdown fences or explanation — only raw JSON."
    )


def build_user_prompt(ctx: dict) -> str:
    """Build the user prompt from composed context."""
    import re as _re
    variant_count = ctx.get("variant_count", 4)
    # Parse numeric range from display string like "10–15 (Balanced) — Recommended"
    _raw_htc = str(ctx.get("hashtag_count", "10-15"))
    _m = _re.search(r'(\d+)\s*[–\-]\s*(\d+)', _raw_htc)
    hashtag_count = f"{_m.group(1)}-{_m.group(2)}" if _m else _re.search(r'\d+', _raw_htc).group(0) if _re.search(r'\d+', _raw_htc) else "10-15"
    hashtag_mix = ctx.get("hashtag_mix", "balanced")
    seed_hashtags = ctx.get("seed_hashtags", "")
    goal_type = ctx.get("goal_type", "brand_awareness")
    goal_guidance = GOAL_ANGLES.get(goal_type, GOAL_ANGLES["brand_awareness"])

    # Build audience description
    audience_parts = []
    if ctx.get("primary_segment"):
        audience_parts.append(f"Primary segment: {ctx['primary_segment']}")
    if ctx.get("secondary_segment"):
        audience_parts.append(f"Secondary segment: {ctx['secondary_segment']}")
    if ctx.get("age_range"):
        ages = ctx["age_range"] if isinstance(ctx["age_range"], list) else [ctx["age_range"]]
        audience_parts.append(f"Age range: {', '.join(ages)}")
    if ctx.get("gender_focus") and ctx["gender_focus"] != "all":
        audience_parts.append(f"Gender focus: {ctx['gender_focus']}")
    if ctx.get("geo_targeting"):
        audience_parts.append(f"Geography: {ctx['geo_targeting']}")
    if ctx.get("audience_description"):
        audience_parts.append(f"Description: {ctx['audience_description']}")
    audience_block = "\n".join(audience_parts) if audience_parts else "General audience"

    # Build brand context
    brand_parts = [f"Brand: {ctx.get('brand_name', 'Unknown')}"]
    if ctx.get("product_category"):
        brand_parts.append(f"Category: {ctx['product_category']}")
    if ctx.get("website_url"):
        brand_parts.append(f"Website: {ctx['website_url']}")
    if ctx.get("brand_insights"):
        brand_parts.append(f"Brand insights: {ctx['brand_insights']}")
    if ctx.get("brand_colours"):
        colours = ctx["brand_colours"] if isinstance(ctx["brand_colours"], list) else [ctx["brand_colours"]]
        brand_parts.append(f"Brand colours: {', '.join(colours)}")
    if ctx.get("store_type"):
        brand_parts.append(f"Store type: {ctx['store_type'].replace('_', ' ')}")
    brand_block = "\n".join(brand_parts)

    # Formats
    formats = ctx.get("formats", ["Instagram Post"])
    formats_str = ", ".join(formats) if isinstance(formats, list) else str(formats)

    # Hashtag instructions
    hashtag_instruction = f"Generate exactly {hashtag_count} hashtags per variant using a {hashtag_mix} mix strategy."
    if seed_hashtags:
        hashtag_instruction += f" Incorporate these seed hashtags where relevant: {seed_hashtags}"
    hashtag_instruction += (
        " The hashtag mix should include a combination of: "
        "high-volume trending hashtags (100K+ posts), "
        "mid-volume niche hashtags (10K-100K posts), "
        "and low-volume micro-niche hashtags (<10K posts) appropriate for the brand."
    )

    # Schema for GPT output
    output_schema = json.dumps({
        "variants": [
            {
                "angle": "string — the creative angle name (e.g. 'Lifestyle Aspiration', 'Social Proof')",
                "headline": "string — a punchy headline (max 15 words)",
                "copy_text": "string — full Instagram caption (150-300 words), with line breaks as \\n",
                "cta": "string — call to action text (e.g. 'Shop Now →')",
                "target_segment": "string — which audience sub-segment this speaks to",
                "imagery_style": "string — description of the visual style for this variant",
                "image_prompt": "string — detailed FLUX 1.1 Pro prompt for generating the image",
                "video_prompt": "string — detailed Sora 2 prompt for a 5-second Instagram Reel video. Describe dynamic motion, camera movement, and visual storytelling for a short cinematic vertical video.",
                "hashtags": ["string — each hashtag including the # symbol"],
                "score": "number 0-100 — your confidence score for this variant",
                "is_recommended": "boolean — true for the single best variant",
            }
        ]
    }, indent=2)

    return f"""Generate {variant_count} Instagram campaign copy variants for this brand.

=== BRAND ===
{brand_block}

=== AUDIENCE ===
{audience_block}

=== CAMPAIGN GOAL ===
Goal: {goal_type.replace('_', ' ').title()}
{goal_guidance}
Budget: ₹{ctx.get('budget', 0):,}
Duration: {ctx.get('duration_days', 30)} days
Formats: {formats_str}

=== CREATIVE DIRECTION ===
Image style: {ctx.get('image_style', 'modern')}
Content type: {', '.join(ctx.get('content_type', ['post'])) if isinstance(ctx.get('content_type'), list) else ctx.get('content_type', 'post')}
Tone of voice: {ctx.get('tone_of_voice', 'professional')}

=== HASHTAG REQUIREMENTS ===
{hashtag_instruction}

=== RULES ===
1. Each variant MUST have a different creative angle (don't repeat angles).
2. Mark exactly ONE variant as is_recommended=true (the best fit for the goal).
3. Copy must be Instagram-ready — use emojis sparingly, include line breaks.
4. Image prompts must be detailed enough for FLUX 1.1 Pro to generate high-quality visuals.
5. Include brand colours ({', '.join(ctx.get('brand_colours', []))}) in image prompt guidance.
6. Scores should reflect how well each variant fits the stated goal.
7. IMPORTANT: Every variant MUST include a "hashtags" array with real hashtags (including the # symbol). NEVER leave the hashtags array empty.
8. Every variant MUST include a "video_prompt" — a Sora 2 prompt for a 5-second vertical Instagram Reel. Describe dynamic motion, camera angles, and visual storytelling. Keep it cinematic and fast-paced.

=== OUTPUT FORMAT ===
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{output_schema}"""
