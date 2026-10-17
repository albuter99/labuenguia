import L from "leaflet";

export const TYPE_COLORS = Object.freeze({
  Restaurante: "#E63946",
  "Cafetería": "#8D5B4C",
  Bar: "#F4A261",
  Pub: "#253B73",
  Otros: "#6C757D",
});

export function createVenueMarker(feature, latlng) {
  const type = feature?.properties?.tipo;
  return L.circleMarker(latlng, {
    radius: 9,
    color: "#ffffff",
    weight: 2,
    fillColor: TYPE_COLORS[type] ?? TYPE_COLORS.Otros,
    fillOpacity: 1,
  });
}

export function bindVenuePopup(feature, layer) {
  const props = feature?.properties ?? {};
  const wrapper = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = props.nombre || "Sin nombre";
  const type = document.createElement("div");
  type.textContent = TYPE_COLORS[props.tipo] ? props.tipo : "Otros";
  wrapper.append(name, type);
  layer.bindPopup(wrapper);
}
