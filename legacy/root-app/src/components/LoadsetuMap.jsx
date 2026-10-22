
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pickupIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function FitRoute({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [35, 35] });
    }
  }, [map, points]);

  return null;
}

export default function LoadsetuMap({
  pickup,
  destination,
  currentLocation = null,
  showTruckLocation = false
}) {
  const points = [
    pickup?.lat != null && pickup?.lng != null
      ? [pickup.lat, pickup.lng]
      : null,
    destination?.lat != null && destination?.lng != null
      ? [destination.lat, destination.lng]
      : null
  ].filter(Boolean);

  if (showTruckLocation && currentLocation?.lat != null &&
      currentLocation?.lng != null) {
    points.push([currentLocation.lat, currentLocation.lng]);
  }

  if (points.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        Add pickup and destination coordinates to display the map.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 420, borderRadius: 12, overflow: "hidden" }}>
      <MapContainer
        center={points[0]}
        zoom={7}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitRoute points={points} />

        {pickup?.lat != null && pickup?.lng != null && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>Pickup location</Popup>
          </Marker>
        )}

        {destination?.lat != null && destination?.lng != null && (
          <Marker position={[destination.lat, destination.lng]} icon={pickupIcon}>
            <Popup>Destination</Popup>
          </Marker>
        )}

        {showTruckLocation && currentLocation?.lat != null &&
          currentLocation?.lng != null && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>Truck's latest reported location</Popup>
            </Marker>
        )}

        {points.length >= 2 && (
          <Polyline positions={points} />
        )}
      </MapContainer>
    </div>
  );
}
