import { useState, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Kottayam, matches the seeded driver locations
const DEFAULT_CENTER = [9.5916, 76.5222];
const DEFAULT_ZOOM = 14;

// Biases search results toward this area without restricting to it
// (bounded=0), since the seeded data is all around Kottayam but a
// real user could search anywhere.
const SEARCH_VIEWBOX = "76.30,9.75,76.75,9.40"; // left,top,right,bottom

function pinIcon(color) {
  return L.divIcon({
    className: "map-pin",
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
      background: ${color}; transform: rotate(-45deg);
      border: 2px solid rgba(0,0,0,.55); box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

const PICKUP_ICON = pinIcon("#f5b400");
const DROP_ICON = pinIcon("#5da9ff");

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

async function searchPlaces(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&viewbox=${SEARCH_VIEWBOX}&bounded=0`
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Pans/zooms the map whenever `target` changes (e.g. a search result was picked). */
function FlyToOnChange({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 16, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

function SearchBox({ activePoint, onResultSelected }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchPlaces(query);
      setResults(data);
      setSearching(false);
      setOpen(true);
    }, 400); // debounced -- respects Nominatim's light rate limit
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result) {
    onResultSelected({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="map-search" ref={boxRef}>
      <input
        type="text"
        className="map-search-input"
        placeholder={`Search ${activePoint === "pickup" ? "pickup" : "drop"} location...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {searching && <div className="map-search-spinner" />}
      {open && results.length > 0 && (
        <ul className="map-search-results">
          {results.map((r) => (
            <li key={r.place_id} onClick={() => handleSelect(r)}>
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Controlled map picker for pickup/drop points -- click the map OR
 * search by name to set a point.
 *
 * Props:
 *   activePoint: "pickup" | "drop" -- which marker the next action sets
 *   pickup, drop: { lat, lng } | null
 *   onPointSelected(point, { lat, lng, address }) -- address may be null
 *     if reverse geocoding failed; caller should fall back gracefully
 */
export default function MapPicker({ activePoint, pickup, drop, onPointSelected }) {
  const [geocoding, setGeocoding] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);

  const handleMapClick = useCallback(
    async (lat, lng) => {
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);
      onPointSelected(activePoint, { lat, lng, address });
    },
    [activePoint, onPointSelected]
  );

  const handleSearchResult = useCallback(
    ({ lat, lng, address }) => {
      onPointSelected(activePoint, { lat, lng, address });
      setFlyTarget({ lat, lng, key: Date.now() }); // key forces effect to re-run even for same coords
    },
    [activePoint, onPointSelected]
  );

  return (
    <div className="map-picker">
      <SearchBox activePoint={activePoint} onResultSelected={handleSearchResult} />
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "440px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onMapClick={handleMapClick} />
        <FlyToOnChange target={flyTarget} />
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP_ICON} />}
        {drop && <Marker position={[drop.lat, drop.lng]} icon={DROP_ICON} />}
      </MapContainer>
      {geocoding && <p className="map-hint">Looking up address...</p>}
      
    </div>
  );
}