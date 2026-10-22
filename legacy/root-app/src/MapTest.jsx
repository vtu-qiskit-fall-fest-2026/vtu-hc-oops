
import LoadsetuMap from "./components/LoadsetuMap";

export default function MapTest() {
  return (
    <div style={{ padding: 20 }}>
      <h2>LOADSETU Map Test</h2>

      <LoadsetuMap
        pickup={{ lat: 16.705, lng: 74.243 }}
        destination={{ lat: 19.076, lng: 72.877 }}
      />
    </div>
  );
}
