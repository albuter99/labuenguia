import { useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import establecimientos from "../data/establecimientos.geojson.json";
import { createVenueMarker, bindVenuePopup, TYPE_COLORS } from "./markers.js";
import { TYPES, STATUSES, PRICES, TAGS, initialFilters, filterVenues } from "./filters.js";

function FilterGroup({ title, options, selected, onToggle, format = String }) {
  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      <div className="filter-options">
        {options.map(option => (
          <label key={option} className="filter-option">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            {format(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function App() {
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const visible = useMemo(() => filterVenues(establecimientos, filters), [filters]);

  function toggle(key, value) {
    setFilters(previous => ({
      ...previous,
      [key]: previous[key].includes(value)
        ? previous[key].filter(item => item !== value)
        : [...previous[key], value],
    }));
  }

  return (
    <main>
      <header><h1>La BuenGuia</h1><p>Tu mapa de restaurantes, bares y cafeterías</p></header>
      <div className="toolbar">
        <button type="button" className="filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}>
          {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        <span aria-live="polite">{visible.features.length} de {establecimientos.features.length} establecimientos</span>
        <button type="button" className="reset-button" onClick={() => setFilters(initialFilters())}>Restablecer filtros</button>
      </div>
      {showFilters && (
        <aside className="filters" aria-label="Filtros de establecimientos">
          <FilterGroup title="Tipo" options={TYPES} selected={filters.types} onToggle={value => toggle("types", value)} />
          <FilterGroup title="Estado" options={STATUSES} selected={filters.statuses} onToggle={value => toggle("statuses", value)} />
          <FilterGroup title="Precio" options={PRICES} selected={filters.prices} onToggle={value => toggle("prices", value)} format={value => "€".repeat(value)} />
          <FilterGroup title="Etiquetas (debe cumplir todas las seleccionadas)" options={TAGS} selected={filters.tags} onToggle={value => toggle("tags", value)} />
        </aside>
      )}
      <section className="map-wrap" aria-label="Mapa de establecimientos">
        <MapContainer center={[49.6116, 6.1319]} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeoJSON key={JSON.stringify(filters)} data={visible} pointToLayer={createVenueMarker} onEachFeature={bindVenuePopup} />
        </MapContainer>
      </section>
      <div className="legend" aria-label="Leyenda de tipos">
        {Object.entries(TYPE_COLORS).map(([type, color]) => <span className="legend-item" key={type}><span className="legend-dot" style={{ backgroundColor: color }} />{type}</span>)}
      </div>
      {establecimientos.features.length === 0 && <p className="hint">Aún no hay establecimientos. Próximamente podrás añadirlos desde el editor local.</p>}
      {establecimientos.features.length > 0 && visible.features.length === 0 && <p className="hint">Ningún establecimiento coincide con los filtros seleccionados.</p>}
    </main>
  );
}
