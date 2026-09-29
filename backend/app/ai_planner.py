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

PREFERRED_MODELS = [
    "llama-3.3-70b-specdec",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
]

async def resolve_active_model(client: AsyncGroq) -> str:
    """Finds the first available supported model for the active API key."""
    try:
        model_list = await client.models.list()
        available_ids = {m.id for m in model_list.data}
        logger.info(f"Available Groq models: {available_ids}")
        for candidate in PREFERRED_MODELS:
            if candidate in available_ids:
                return candidate
        # If none of the preferred match, grab any chat-capable model
        if available_ids:
            return list(available_ids)[0]
    except Exception as e:
        logger.warning(f"Could not list Groq models: {e}")
    return "llama3-70b-8192"

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
You are an expert cab trip planner and tour concierge.
Create a customized cab tour based on the passenger's request.
Available time: {duration_hours} hours.
Reference coordinates: ({pickup_coords['lat']}, {pickup_coords['lng']}).

RULES:
1. Prioritize attractions from the candidate list that match the user's intent. If candidate attractions are provided, select 2 to 4 of them.
2. If the user explicitly asks for a city and the candidates do not match, suggest real, well-known attractions for that city with realistic latitudes and longitudes.
3. Respond ONLY with a valid JSON object matching this schema:
{{
  "title": "Short title",
  "summary": "1-2 sentence overview explaining how this matches their vibe",
  "total_estimated_time": "{duration_hours} hours",
  "stops": [
    {{
      "id": 1,
      "name": "Attraction Name",
      "category": "Category",
      "latitude": 24.8607,
      "longitude": 67.0011,
      "recommended_duration": "1 hour",
      "why_visit": "Short compelling reason"
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
        chosen_model = await resolve_active_model(client)
        logger.info(f"Using Groq model: {chosen_model}")

        completion = await client.chat.completions.create(
            model=chosen_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1024
        )
        content = completion.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        logger.error(f"Groq API call failed: {e}", exc_info=True)
        return {
            "title": "Nearby Discovery",
            "summary": f"Could not contact AI service: {str(e)[:80]}. Showing available local spots.",
            "total_estimated_time": f"{duration_hours} hours",
            "stops": available_attractions[:2],
            "tips": "Check backend logs for details."
        }