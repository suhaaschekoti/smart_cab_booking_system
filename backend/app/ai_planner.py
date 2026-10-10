import os
import json
import logging
from typing import List, Dict, Any
from groq import AsyncGroq
from app.config import settings

logger = logging.getLogger(__name__)

def get_groq_client():
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return AsyncGroq(api_key=api_key)

PRODUCTION_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]

async def call_groq_completion(client: AsyncGroq, system_prompt: str, user_message: str):
    """Invokes active text models with automatic fallback."""
    last_error = None
    for model_name in PRODUCTION_MODELS:
        try:
            logger.info(f"Calling Groq with model: {model_name}")
            completion = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=1024
            )
            return completion.choices[0].message.content
        except Exception as e:
            logger.warning(f"Model {model_name} failed: {e}. Trying fallback...")
            last_error = e
            continue

    raise last_error

async def generate_tour_itinerary(
    user_prompt: str,
    pickup_coords: Dict[str, float],
    available_attractions: List[Dict[str, Any]],
    duration_hours: float = 4.0
) -> Dict[str, Any]:
    client = get_groq_client()
    
    if not client:
        return {
            "title": "Local Discovery Tour",
            "summary": "AI Planner is in offline mode. Set GROQ_API_KEY in your .env.",
            "total_estimated_time": f"{duration_hours} hours",
            "stops": available_attractions[:2],
            "tips": "Carry water and check local visiting hours."
        }

    formatted_spots = [
        {
            "id": a.get("id"),
            "name": a.get("name"),
            "category": a.get("category"),
            "distance_km": a.get("distance_km"),
            "latitude": a.get("latitude"),
            "longitude": a.get("longitude")
        }
        for a in available_attractions[:25]
    ]

    system_prompt = f"""
You are an expert cab trip planner and local tour guide.
Create an authentic, structured sightseeing cab itinerary based on the passenger's request.
Available time: {duration_hours} hours.
Reference coordinates: ({pickup_coords['lat']}, {pickup_coords['lng']}).

STRICT RULES:
1. Every stop MUST have a unique, descriptive landmark or attraction name (e.g., "Thirunakkara Mahadeva Temple", "Thazhathangady Juma Masjid", "Poonjar Palace", "Kumarakom Bird Sanctuary").
2. NEVER use just the name of a city, state, or region (like "Kottayam" or "Kerala") as a stop name.
3. Every stop in the itinerary must have a distinct, non-duplicate name.
4. If candidate attractions are available, choose the best matches. If the candidate list is sparse or contains generic names, suggest genuine, real-world heritage and sightseeing landmarks for the region with accurate coordinates.
5. Respond ONLY with a valid JSON object matching this schema:
{{
  "title": "Short descriptive title (e.g. Heritage Trail of Kottayam)",
  "summary": "1-2 sentence overview explaining the experience",
  "total_estimated_time": "{duration_hours} hours",
  "stops": [
    {{
      "id": 1,
      "name": "Specific Landmark Name",
      "category": "Historical / Culture / Nature",
      "latitude": 9.5916,
      "longitude": 76.5222,
      "recommended_duration": "45 mins",
      "why_visit": "Compelling historic or visual highlight"
    }}
  ],
  "tips": "One practical travel tip"
}}
"""

    user_message = f"""
User Request: "{user_prompt}"

Candidate Attractions:
{json.dumps(formatted_spots, indent=2)}
"""

    try:
        content = await call_groq_completion(client, system_prompt, user_message)
        return json.loads(content)
    except Exception as e:
        logger.error(f"All Groq models failed: {e}", exc_info=True)
        return {
            "title": "Nearby Discovery",
            "summary": "Could not contact AI service. Showing available local spots.",
            "total_estimated_time": f"{duration_hours} hours",
            "stops": available_attractions[:2],
            "tips": "Check backend logs for details."
        }