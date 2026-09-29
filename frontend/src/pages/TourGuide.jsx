import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, fetchCurrentUser } from "../api/auth";
import { getAttractions, getCategories, getNearbyAttractions } from "../api/attractions";
import { requestTour, estimateFare, getMyTrips } from "../api/trips";
import MapPicker from "../components/MapPicker";
import Navbar from "../components/Navbar";
import { motion, AnimatePresence } from "motion/react";
import { Page, Card, Button } from "../components/motion";
import TourChatbot from "../components/TourChatbot";

const CAT_ICON = { 
  Nature: "🌿", 
  Historical: "🏛️", 
  Adventure: "🧗", 
  Shopping: "🛍️", 
  Culture: "🎭", 
  Food: "🍛",
  "Scenic Viewpoint": "🌄",
  Spiritual: "🛕",
  "Tourist Attraction": "📍"
};

export default function TourGuide() {
  const navigate = useNavigate();
  const session = getSession();
  const [profile, setProfile] = useState(null);
  const [attractions, setAttractions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [nearMe, setNearMe] = useState(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [pickupLocation, setPickupLocation] = useState("");
  const [preferredType, setPreferredType] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [hasActive, setHasActive] = useState(false);

  const handleSelectDestination = (stop) => {
    const lat = Number(stop.latitude || stop.lat);
    const lng = Number(stop.longitude || stop.lng);

    const destinationObj = {
      id: stop.id || Date.now(),
      name: stop.name,
      category: stop.category || "Tourist Attraction",
      latitude: lat,
      longitude: lng,
      description: stop.why_visit || stop.description || "",
      attraction_id: stop.attraction_id || null,
    };

    setSelected(destinationObj);

    // If pickup isn't set yet, seed it near the destination or with current coords
    if (!pickup) {
      setPickup({ lat, lng });
      setPickupLocation(stop.name);
    }

    // Scroll smoothly to the booking section
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
      });
    }, 150);
  };

  useEffect(() => {
    fetchCurrentUser(session.token).then(setProfile).catch(() => navigate("/login"));
    getCategories().then(setCategories).catch(() => {});
    getMyTrips(session.token)
      .then((t) => setHasActive(t.some((x) => ["REQUESTED", "ACCEPTED", "ONGOING"].includes(x.trip_status))))
      .catch(() => {});
  }, [session.token, navigate]);

  // Load default/filtered attractions when dynamic "Near me" is inactive
  useEffect(() => {
    if (nearMe) return;
    const params = {};
    if (category) params.category = category;
    getAttractions(params)
      .then((data) => {
        setAttractions(
          data.map((item) => ({
            ...item,
            id: item.attraction_id || item.id,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
          }))
        );
      })
      .catch(() => {});
  }, [category, nearMe]);

  // Re-estimate fare when selected attraction or pickup changes
  useEffect(() => {
    if (!selected || !pickup) {
      setEstimate(null);
      return;
    }
    estimateFare(session.token, {
      service_type: "TOUR",
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      drop_lat: selected.latitude,
      drop_lng: selected.longitude,
      preferred_vehicle_type: preferredType || null,
    })
      .then(setEstimate)
      .catch(() => setEstimate(null));
  }, [selected, pickup, preferredType, session.token]);

  // Dynamic Geolocation Trigger
  async function useMyLocation() {
    if (nearMe) {
      setNearMe(null);
      return;
    }

    setCategory("");
    setLoadingNearby(true);

    let resolved = false;

    const loadSpotsForCoords = async (coords, isFallback = false) => {
      if (resolved) return;
      resolved = true;

      setNearMe(coords);
      if (!pickup) {
        setPickup(coords);
        setPickupLocation(
          `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} ${isFallback ? "(Default)" : "(My Location)"}`
        );
      }

      try {
        const res = await getNearbyAttractions(coords.lat, coords.lng, 40);
        const dynamicSpots = (res?.attractions || []).map((spot) => ({
          ...spot,
          id: spot.id || spot.osm_id || spot.attraction_id,
          attraction_id: spot.attraction_id || null,
          city: spot.city || "Nearby",
          latitude: Number(spot.latitude),
          longitude: Number(spot.longitude),
        }));

        if (dynamicSpots.length > 0) {
          setAttractions(dynamicSpots);
        } else {
          throw new Error("No spots returned from nearby endpoint");
        }
      } catch (err) {
        console.warn("Falling back to local database attractions:", err);
        try {
          const fallbackData = await getAttractions({
            near_lat: coords.lat,
            near_lng: coords.lng,
            radius_km: 60,
          });
          setAttractions(
            fallbackData.map((item) => ({
              ...item,
              id: item.attraction_id || item.id,
              latitude: Number(item.latitude),
              longitude: Number(item.longitude),
            }))
          );
        } catch (dbErr) {
          console.error("Failed to load fallback attractions:", dbErr);
        }
      } finally {
        setLoadingNearby(false);
      }
    };

    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        console.warn("Geolocation API did not respond within 2.5s. Using default coordinates.");
        loadSpotsForCoords({ lat: 9.6700, lng: 76.6300 }, true);
      }
    }, 2500);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          loadSpotsForCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          clearTimeout(fallbackTimer);
          console.warn("Geolocation permission error or timeout:", err.message);
          loadSpotsForCoords({ lat: 9.6700, lng: 76.6300 }, true);
        },
        { enableHighAccuracy: false, timeout: 2000 }
      );
    } else {
      clearTimeout(fallbackTimer);
      loadSpotsForCoords({ lat: 9.6700, lng: 76.6300 }, true);
    }
  }

  async function book() {
    setError("");
    if (!pickup) return setError("Set your pickup point on the map.");
    setBooking(true);

    try {
      const payload = {
        pickup_location: pickupLocation,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        drop_lat: selected.latitude,
        drop_lng: selected.longitude,
        drop_location: selected.name,
        preferred_vehicle_type: preferredType || null,
      };

      if (selected.attraction_id) {
        payload.attraction_id = selected.attraction_id;
      }

      const t = await requestTour(session.token, payload);
      setDone(t);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not book the tour.");
    } finally {
      setBooking(false);
    }
  }

  const displayedAttractions = category
    ? attractions.filter((a) => a.category && a.category.toLowerCase().includes(category.toLowerCase()))
    : attractions;

  if (done) {
    return (
      <div className="dashboard-shell">
        <Navbar role="user" name={profile?.name} />
        <Page className="dashboard-content">
          <Card className="success-panel">
            <div className="success-icon">&#10003;</div>
            <h2 className="card-title" style={{ marginBottom: 6 }}>Tour booked!</h2>
            <p className="muted">
              {done.pickup_location?.split(",")[0]} → {done.attraction_name || selected?.name}, ₹{done.fare}
              {done.driver_name && `, with ${done.driver_name}`}
            </p>
            <Button className="btn-block" style={{ marginTop: 20 }} onClick={() => navigate("/dashboard")}>
              Track on dashboard
            </Button>
          </Card>
        </Page>
      </div>
    );
  }

  return (
    <div className="dashboard-shell relative">
      <Navbar role="user" name={profile?.name} />
      <Page className="dashboard-content wide">
        <Card>
          <div className="card-head">
            <div>
              <h1 style={{ fontSize: 24, marginBottom: 2 }}>
                {nearMe ? "Attractions Near You" : "Explore Kottayam"}
              </h1>
              <p className="muted">
                {nearMe 
                  ? "Showing spots dynamically discovered near your location."
                  : "Pick a place and we'll get you there. Guide fee included."}
              </p>
            </div>
            <button 
              className={`rate-btn ${nearMe ? "active" : ""}`} 
              onClick={useMyLocation}
              disabled={loadingNearby}
            >
              {loadingNearby ? "Locating..." : nearMe ? "Near me ✓" : "Near me"}
            </button>
          </div>

          {hasActive && (
            <div className="error-msg" style={{ marginTop: 12 }}>
              You already have an active trip — finish or cancel it before booking a tour.
            </div>
          )}

          <div className="chip-row">
            <button className={`chip ${!category ? "active" : ""}`} onClick={() => setCategory("")}>
              All
            </button>
            {categories.map((c) => (
              <button 
                key={c} 
                className={`chip ${category === c ? "active" : ""}`} 
                onClick={() => setCategory(c)}
              >
                {CAT_ICON[c] || "📌"} {c}
              </button>
            ))}
          </div>

          <div className="attraction-grid">
            {displayedAttractions.map((a) => {
              const isSelected = (selected?.id && selected.id === a.id) || 
                                 (selected?.attraction_id && selected.attraction_id === a.attraction_id);
              return (
                <motion.button
                  layout
                  whileTap={{ scale: 0.97 }}
                  key={a.id || a.attraction_id || `${a.latitude}-${a.longitude}`}
                  className={`attraction-card ${isSelected ? "active" : ""}`}
                  onClick={() => setSelected(a)}
                  disabled={hasActive}
                >
                  <div className="attraction-icon">{CAT_ICON[a.category] || "📌"}</div>
                  <div className="attraction-name">{a.name}</div>
                  <div className="attraction-meta">
                    {a.distance_km != null ? `${a.distance_km} km away • ` : ""}
                    {a.city ? `${a.city}, ` : ""}{a.category}
                  </div>
                  <div className="attraction-desc">{a.description}</div>
                </motion.button>
              );
            })}
            {displayedAttractions.length === 0 && !loadingNearby && (
              <p className="empty-state">No attractions match this filter.</p>
            )}
            {loadingNearby && (
              <p className="empty-state">Discovering attractions near your location...</p>
            )}
          </div>
        </Card>

        <AnimatePresence>
          {selected && !hasActive && (
            <Card key="book">
              <h2 className="card-title">Book a tour to {selected.name}</h2>
              {error && <div className="error-msg">{error}</div>}
              <p className="field-hint">Tap the map to set your pickup point.</p>
              
              <MapPicker
                activePoint="pickup"
                pickup={pickup}
                drop={{ lat: selected.latitude, lng: selected.longitude }}
                onPointSelected={(_, { lat, lng, address }) => {
                  setPickup({ lat, lng });
                  setPickupLocation(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                }}
              />

              <div className="form-grid">
                <div className="field">
                  <label>Pickup location</label>
                  <input
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Enter pickup address or select on map"
                  />
                </div>
                <div className="field">
                  <label>Preferred vehicle</label>
                  <select
                    value={preferredType}
                    onChange={(e) => setPreferredType(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option>Hatchback</option>
                    <option>Sedan</option>
                    <option>SUV</option>
                  </select>
                </div>
              </div>

              {estimate && (
                <div className="estimate-box">
                  <div className="estimate-main">
                    <span>Estimated fare, includes ₹{Number(estimate.tour_guide_fee || 100).toFixed(0)} guide fee</span>
                    <strong>₹{Number(estimate.fare).toFixed(0)}</strong>
                  </div>
                  <div className="estimate-detail">
                    <span>{estimate.distance_km} km</span>
                    {estimate.night_surcharge && <span className="tag-warn">night rate</span>}
                    {Number(estimate.surge_multiplier) > 1 && (
                      <span className="tag-warn">surge ×{Number(estimate.surge_multiplier).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}

              <Button
                className="btn-block"
                onClick={book}
                disabled={booking || !pickup}
              >
                {booking ? "Booking…" : `Book tour to ${selected.name}`}
              </Button>
            </Card>
          )}
        </AnimatePresence>
      </Page>

      {/* Floating AI Tour Assistant */}
      <TourChatbot
        userCoords={nearMe || pickup || { lat: 9.6700, lng: 76.6300 }}
        onSelectDestination={handleSelectDestination}
      />
    </div>
  );
}