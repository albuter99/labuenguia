import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import establecimientos from "../data/establecimientos.geojson.json";
import { createVenueMarker, bindVenuePopup, TYPE_COLORS } from "./markers.js";

export default function App() {
  const hasVenues = establecimientos.features.length > 0;
  return (
    <main>
      <header>
        <h1>La BuenGuia</h1>
        <p>Tu mapa de restaurantes, bares y cafeterías</p>
      </header>
      <section className="map-wrap" aria-label="Mapa de establecimientos">
        <MapContainer center={[49.6116, 6.1319]} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeoJSON data={establecimientos} pointToLayer={createVenueMarker} onEachFeature={bindVenuePopup} />
        </MapContainer>
      </section>
      <div className="legend" aria-label="Leyenda de tipos">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span className="legend-item" key={type}><span className="legend-dot" style={{ backgroundColor: color }} />{type}</span>
        ))}
      </div>
      {!hasVenues && <p className="hint">Aún no hay establecimientos. Próximamente podrás añadirlos desde el editor local.</p>}
    </main>
  );
}
