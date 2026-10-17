import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import establecimientos from "../data/establecimientos.geojson.json";
import { ratingFor, venueDetails, visitDate, visitRating, visitComment } from "./venueDetails.js";
import { createVenueMarker, bindVenuePopup, TYPE_COLORS } from "./markers.js";
import { TYPES, STATUSES, PRICES, TAGS, initialFilters, filterVenues } from "./filters.js";

function FilterGroup({ title, options, selected, onToggle, format = String }) {
  return <fieldset className="filter-group"><legend>{title}</legend><div className="filter-options">{options.map(option =>
    <label key={option} className="filter-option"><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />{format(option)}</label>
  )}</div></fieldset>;
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
    <p>{d.type} · {d.status} · {d.price}</p>
    {d.address && <p><strong>Dirección:</strong> {d.address} <button type="button" className="copy-address" onClick={async () => { try { await navigator.clipboard.writeText(d.address); window.alert("Dirección copiada"); } catch { window.prompt("Copia la dirección:", d.address); } }}>Copiar dirección</button></p>}
    <p><strong>Soles:</strong> {d.rating == null ? "Sin valorar" : d.rating.toFixed(1) + " / 5"}</p>
    {d.tags.length > 0 && <p><strong>Etiquetas:</strong> {d.tags.join(" · ")}</p>}
    {d.notes && <p><strong>Notas:</strong> {d.notes}</p>}
    <details className="visit-history"><summary>Historial de visitas ({d.visits.length})</summary>
      {d.visits.length === 0 ? <p>No hay visitas registradas.</p> :
        <ul>{d.visits.map((v, i) => <li key={v.id ?? i}>
          <strong>{visitDate(v)}</strong> · {visitRating(v)}
          {visitComment(v) && <p>{visitComment(v)}</p>}
        </li>)}</ul>}
    </details>
  </div>;
}

export default function App() {
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState("map");
  const [sort, setSort] = useState("name");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState(null);
  const lastRemoteSearch = useRef(0);
  const visible = useMemo(() => filterVenues(establecimientos, filters), [filters]);

  function toggle(key, value) {
    setFilters(previous => ({ ...previous, [key]: previous[key].includes(value)
      ? previous[key].filter(item => item !== value) : [...previous[key], value] }));
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
    <form className="search-form" onSubmit={search} role="search">
      <label className="sr-only" htmlFor="place-search">Buscar establecimiento, ciudad o dirección</label>
      <input id="place-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar establecimiento, ciudad o dirección" />
      <button type="submit" disabled={searching}>{searching ? "Buscando…" : "Buscar"}</button>
    </form>
    {results.length > 0 && <ul className="search-results">{results.map((result, index) =>
      <li key={result.kind + index}><button type="button" onClick={() => selectResult(result)}>{result.label}</button></li>
    )}</ul>}
    {searchMessage && <p className="search-message" role="status">{searchMessage}</p>}
    <div className="toolbar">
      <button type="button" className="filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}>
        {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
      </button>
      <span aria-live="polite">{visible.features.length} de {establecimientos.features.length} establecimientos</span>
      <button type="button" className="reset-button" onClick={() => setFilters(initialFilters())}>Restablecer filtros</button>
    </div>
    {showFilters && <aside className="filters" aria-label="Filtros de establecimientos">
      <FilterGroup title="Tipo" options={TYPES} selected={filters.types} onToggle={value => toggle("types", value)} />
      <FilterGroup title="Estado" options={STATUSES} selected={filters.statuses} onToggle={value => toggle("statuses", value)} />
      <FilterGroup title="Precio" options={PRICES} selected={filters.prices} onToggle={value => toggle("prices", value)} format={value => "€".repeat(value)} />
      <FilterGroup title="Etiquetas (debe cumplir todas las seleccionadas)" options={TAGS} selected={filters.tags} onToggle={value => toggle("tags", value)} />
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
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <GeoJSON key={JSON.stringify(filters)} data={visible} pointToLayer={createVenueMarker} onEachFeature={bindVenuePopup} />
          <MapNavigator destination={destination} />
        </MapContainer>
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
