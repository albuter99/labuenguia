import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Circle, CircleMarker, useMap } from "react-leaflet";
import establecimientos from "../data/establecimientos.geojson.json";
import rutas from "../data/rutas.json";
import { ratingFor, venueDetails, visitDate, visitRating, visitComment } from "./venueDetails.js";
import { createVenueMarker, bindVenuePopup, TYPE_COLORS } from "./markers.js";
import { TYPES, STATUSES, PRICES, TAGS, initialFilters, filterVenues } from "./filters.js";

function FilterGroup({ title, options, selected, onToggle, format = String }) {
  return <fieldset className="filter-group"><legend>{title}</legend><div className="filter-options">{options.map(option =>
    <label key={option} className="filter-option"><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />{format(option)}</label>
  )}</div></fieldset>;
}

function FitAllVenues({ features, fitted }) {
  const map = useMap();
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const coords = features.map(f => f.geometry?.coordinates).filter(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length > 1) map.fitBounds(coords.map(c => [c[1],c[0]]), { padding: [45,45], maxZoom: 14 });
    else if (coords.length === 1) map.setView([coords[0][1],coords[0][0]],14);
  }, [map,features,fitted]);
  return null;
}
function MapNavigator({ destination }) {
  const map = useMap();
  useEffect(() => {
    if (!destination) return;
    map.flyTo(destination.center, destination.zoom ?? 15);
    if (destination.venueId != null) {
      map.eachLayer(layer => {
        if (String(layer.feature?.id) === String(destination.venueId)) {
          map.once("moveend", () => layer.openPopup());
          if (!map._animatingZoom) layer.openPopup();
        }
      });
    }
  }, [map, destination]);
  return null;
}

function NearbyNavigator({ location }) {
  const map = useMap();
  useEffect(() => {
    if (!location) return;
    const [lat, lng] = location;
    const latRadius = 1000 / 111320;
    const lngRadius = 1000 / (111320 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
    map.fitBounds([[lat - latRadius, lng - lngRadius], [lat + latRadius, lng + lngRadius]], { padding: [24, 24] });
  }, [map, location]);
  return null;
}
function sortVenues(features, sort) {
  const collator = new Intl.Collator("es", { sensitivity: "base" });
  return [...features].sort((a, b) => {
    const pa = a.properties ?? {}, pb = b.properties ?? {};
    if (sort === "rating") return (ratingFor(b) ?? -1) - (ratingFor(a) ?? -1) || collator.compare(pa.nombre ?? "", pb.nombre ?? "");
    if (sort === "price") return (Number(pa.precio) || 99) - (Number(pb.precio) || 99) || collator.compare(pa.nombre ?? "", pb.nombre ?? "");
    if (sort === "newest") return (Date.parse(pb.fechaCreacion ?? pb.fecha_creacion) || 0) - (Date.parse(pa.fechaCreacion ?? pa.fecha_creacion) || 0) || collator.compare(pa.nombre ?? "", pb.nombre ?? "");
    return collator.compare(pa.nombre ?? "", pb.nombre ?? "");
  });
}

function VenueDetails({ feature }) {
  const d = venueDetails(feature);
  return <div className="venue-details">
    <div className="card-eyebrow">{d.type} · {d.status}</div>
    <div className="card-meta"><span className="card-price">{d.price}</span><span className="card-rating"><span className="card-sun">☀</span> {d.rating == null ? "Sin valorar" : d.rating.toFixed(1) + " / 5"}</span></div>
    {d.tags.length > 0 && <div className="card-tags">{d.tags.map(tag => <span className="card-tag" key={tag}>{tag}</span>)}</div>}
    {feature.geometry?.coordinates?.length >= 2 && <div className="card-section"><div className="card-label">DIRECCIÓN</div><span>{d.address || "Ubicación en el mapa"}</span> <details className="map-directions"><summary title="Cómo llegar" aria-label="Cómo llegar">➤</summary><div className="map-directions-options">{(() => { const destination = encodeURIComponent(d.address?.trim() || feature.geometry.coordinates[1] + "," + feature.geometry.coordinates[0]); return <><a href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`} target="_blank" rel="noopener noreferrer">Google Maps</a><a href={`https://maps.apple.com/?daddr=${destination}`} target="_blank" rel="noopener noreferrer">Mapas de Apple</a></>; })()}</div></details></div>}
    {d.notes && <div className="card-section"><div className="card-label">NOTAS</div>{d.notes}</div>}
    <details className="visit-history"><summary>Historial de visitas ({d.visits.length})</summary>
      {d.visits.length === 0 ? <p>No hay visitas registradas.</p> :
        <ul>{d.visits.map((v, i) => <li key={v.id ?? i}><strong>{visitDate(v)}</strong> · {visitRating(v)}{visitComment(v) && <p>{visitComment(v)}</p>}</li>)}</ul>}
    </details>
  </div>;
}

export default function App() {
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState("map");
  const [selectedRoute, setSelectedRoute] = useState("");
  const [sort, setSort] = useState("name");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const lastRemoteSearch = useRef(0);
  const firstFit = useRef(false);
  const visible = useMemo(() => filterVenues(establecimientos, filters), [filters]);

  function toggle(key, value) {
    setFilters(previous => ({ ...previous, [key]: previous[key].includes(value)
      ? previous[key].filter(item => item !== value) : [...previous[key], value] }));
  }

  function locateMe() {
    if (!navigator.geolocation) { setLocationError("Este dispositivo no permite obtener la ubicación."); return; }
    setLocationError("");
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setMyLocation([position.coords.latitude, position.coords.longitude]);
        setLocationLoading(false);
        setView("map");
      },
      error => {
        setLocationLoading(false);
        setLocationError(error.code === 1 ? "Permite el acceso a tu ubicación para usar esta función." : "No se pudo determinar tu ubicación. Inténtalo de nuevo.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }
  async function search(event) {
    event.preventDefault();
    const term = query.trim();
    setResults([]);
    setSearchMessage("");
    if (!term) return;
    const local = establecimientos.features.filter(feature =>
      (feature.properties?.nombre ?? "").toLocaleLowerCase("es").includes(term.toLocaleLowerCase("es"))
    );
    if (local.length) {
      setResults(local.map(feature => ({ kind: "venue", label: feature.properties.nombre, feature })));
      return;
    }
    // Nominatim public API: explicit user-triggered search only, never autocomplete.
    if (Date.now() - lastRemoteSearch.current < 1200) {
      setSearchMessage("Espera un segundo antes de buscar otra dirección.");
      return;
    }
    lastRemoteSearch.current = Date.now();
    setSearching(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", term);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("accept-language", "es");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("No se pudo consultar el servicio de direcciones.");
      const places = await response.json();
      setResults(places.map(place => ({
        kind: "place", label: place.display_name, lat: Number(place.lat), lng: Number(place.lon),
      })));
      if (!places.length) setSearchMessage("No se encontraron resultados.");
    } catch {
      setSearchMessage("La búsqueda de direcciones no está disponible ahora. Inténtalo más tarde.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result) {
    if (result.kind === "place") {
      setDestination({ center: [result.lat, result.lng], zoom: 14 });
      setSearchMessage("");
    } else {
      const coordinates = result.feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) return;
      if (!visible.features.some(feature => feature.id === result.feature.id)) {
        setSearchMessage("Este establecimiento está oculto por los filtros actuales. Restablécelos para verlo.");
        return;
      }
      setDestination({ center: [coordinates[1], coordinates[0]], zoom: 16, venueId: result.feature.id });
      setView("map");
      setSearchMessage("");
    }
    setResults([]);
  }

  return <main>
    <header><h1>La BuenGuia</h1><p>Tu mapa de restaurantes, bares y cafeterías</p></header>
    {showFilters && <form className="search-form" onSubmit={search} role="search">
      <label className="sr-only" htmlFor="place-search">Buscar establecimiento, ciudad o dirección</label>
      <input id="place-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar establecimiento, ciudad o dirección" />
      <button type="submit" disabled={searching}>{searching ? "Buscando…" : "Buscar"}</button>
    </form>}
    {showFilters && results.length > 0 && <ul className="search-results">{results.map((result, index) =>
      <li key={result.kind + index}><button type="button" onClick={() => selectResult(result)}>{result.label}</button></li>
    )}</ul>}
    {showFilters && searchMessage && <p className="search-message" role="status">{searchMessage}</p>}
    <div className="toolbar">
      <button type="button" className="filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}>
        {showFilters ? "Cerrar menú" : "Abrir menú"}
      </button>
      <span aria-live="polite">{visible.features.length} de {establecimientos.features.length} establecimientos</span>
    </div>
    {showFilters && <aside className="filters" aria-label="Filtros de establecimientos">
      <FilterGroup title="Tipo" options={TYPES} selected={filters.types} onToggle={value => toggle("types", value)} />
      <FilterGroup title="Estado" options={STATUSES} selected={filters.statuses} onToggle={value => toggle("statuses", value)} />
      <FilterGroup title="Precio" options={PRICES} selected={filters.prices} onToggle={value => toggle("prices", value)} format={value => "€".repeat(value)} />
      <FilterGroup title="Etiquetas (debe cumplir todas las seleccionadas)" options={TAGS} selected={filters.tags} onToggle={value => toggle("tags", value)} />
      <button type="button" className="reset-inside-filters" onClick={() => { setFilters(initialFilters()); setQuery(""); setResults([]); setSearchMessage(""); }}>↺ Restablecer filtros</button>
    </aside>}
    <div className="view-toolbar">
      <div className="view-switch" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Mapa</button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>Listado</button>
      </div>
      {view === "list" && <label className="sort-label">Ordenar por
        <select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="name">Nombre (A–Z)</option>
          <option value="rating">Soles (mayor primero)</option>
          <option value="price">Precio (menor primero)</option>
          <option value="newest">Más recientes</option>
        </select>
      </label>}
    </div>
    <div style={{ display: view === "map" ? "block" : "none" }}>
      <section className="map-wrap" aria-label="Mapa de establecimientos">
        <MapContainer center={[49.6116, 6.1319]} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeoJSON key={JSON.stringify(filters)} data={visible} pointToLayer={createVenueMarker} onEachFeature={bindVenuePopup} />
          <FitAllVenues features={establecimientos.features} fitted={firstFit} />
          <MapNavigator destination={destination} />
          <NearbyNavigator location={myLocation} />
          {myLocation && <><Circle center={myLocation} radius={1000} pathOptions={{ color: "#253B73", weight: 2, fillColor: "#628bd2", fillOpacity: 0.10, interactive: false }} /><CircleMarker center={myLocation} radius={7} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2769d6", fillOpacity: 1, interactive: false }} /></>}
        </MapContainer>
        <button type="button" className="locate-me-button" onClick={locateMe} disabled={locationLoading} title="Ver 1 km a mi alrededor" aria-label="Ver 1 km a mi alrededor">{locationLoading ? "…" : "⌖"}</button>
        {locationError && <div className="locate-error" role="alert">{locationError}<button type="button" aria-label="Cerrar aviso" onClick={() => setLocationError("")}>✕</button></div>}
      </section>
      <div className="legend" aria-label="Leyenda de tipos">
        {Object.entries(TYPE_COLORS).map(([type, color]) => <span className="legend-item" key={type}><span className="legend-dot" style={{ backgroundColor: color }} />{type}</span>)}
      </div>
    </div>
    {view === "list" && <section aria-label="Listado de establecimientos" className="venue-list">
      {sortVenues(visible.features, sort).map(feature => {
        const p = feature.properties ?? {};
        const rating = ratingFor(feature);
        const coords = feature.geometry?.coordinates;
        return <article className="venue-card" key={feature.id}>
          <h2>{p.nombre || "Sin nombre"}</h2>
          <VenueDetails feature={feature} />\n          {Array.isArray(coords) && coords.length >= 2 && <button type="button" onClick={() => {
            setDestination({ center: [coords[1], coords[0]], zoom: 16, venueId: feature.id });
            setView("map");
          }}>Ver en el mapa</button>}
        </article>;
      })}
      {visible.features.length === 0 && <p className="hint">No hay establecimientos para mostrar en el listado.</p>}
    </section>}
    {establecimientos.features.length === 0 && <p className="hint">Aún no hay establecimientos. Próximamente podrás añadirlos desde el editor local.</p>}
    {establecimientos.features.length > 0 && visible.features.length === 0 && <p className="hint">Ningún establecimiento coincide con los filtros seleccionados.</p>}
  </main>;
}
