import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import establecimientos from "../data/establecimientos.geojson.json";

export default function App() {
  return <main><header><h1>La BuenGuia</h1><p>Tu mapa de restaurantes, bares y cafeterías</p></header><section className="map-wrap" aria-label="Mapa de establecimientos"><MapContainer center={[49.6116, 6.1319]} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><GeoJSON data={establecimientos} /></MapContainer></section><p className="hint">Aún no hay establecimientos. Próximamente podrás añadirlos desde el editor local.</p></main>;
}
