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

CHAT_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
]

async def resolve_active_model(client: AsyncGroq) -> str:
    """Finds an active chat model while strictly ignoring audio/whisper models."""
    try:
        model_list = await client.models.list()
        available_ids = {m.id for m in model_list.data}
        logger.info(f"Available Groq models: {available_ids}")

        # 1. Match our vetted chat model list first
        for candidate in CHAT_MODELS:
            if candidate in available_ids:
                return candidate

        # 2. Filter out non-chat models (whisper, embeddings, etc.)
        valid_chat_models = [
            m_id for m_id in available_ids 
            if not any(excluded in m_id.lower() for excluded in ["whisper", "embed", "tts", "guard"])
        ]
        
        if valid_chat_models:
            return valid_chat_models[0]
            
    except Exception as e:
        logger.warning(f"Could not query Groq models dynamically: {e}")

    # Fallback to standard chat endpoint
    return "llama-3.3-70b-versatile"

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