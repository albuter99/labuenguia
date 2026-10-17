import L from "leaflet";
import { venueDetails, visitDate, visitRating, visitComment } from "./venueDetails.js";

export const TYPE_COLORS = Object.freeze({
  Restaurante: "#E63946", "Cafetería": "#8D5B4C", Bar: "#F4A261",
  Pub: "#253B73", Otros: "#6C757D",
});

export function createVenueMarker(feature, latlng) {
  return L.circleMarker(latlng, {
    radius: 9, color: "#ffffff", weight: 2,
    fillColor: TYPE_COLORS[feature?.properties?.tipo] ?? TYPE_COLORS.Otros, fillOpacity: 1,
  });
}

function addLine(parent, label, value) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label;
  p.append(strong, document.createTextNode(value));
  parent.append(p);
}

export function bindVenuePopup(feature, layer) {
  const d = venueDetails(feature);
  const wrapper = document.createElement("div");
  wrapper.className = "venue-popup";
  const name = document.createElement("h3");
  name.textContent = d.name;
  wrapper.append(name);
  addLine(wrapper, "", `${d.type} · ${d.status} · ${d.price}`);
  if (d.address) {
    const line = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = "Dirección: ";
    const address = document.createTextNode(d.address + " ");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-address";
    copy.textContent = "Copiar dirección";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(d.address);
        copy.textContent = "¡Copiada!";
      } catch {
        window.prompt("Copia la dirección:", d.address);
      }
    });
    line.append(label, address, copy);
    wrapper.append(line);
  }
  addLine(wrapper, "Soles: ", d.rating == null ? "Sin valorar" : d.rating.toFixed(1) + " / 5");
  if (d.tags.length) addLine(wrapper, "Etiquetas: ", d.tags.join(" · "));
  if (d.notes) addLine(wrapper, "Notas: ", d.notes);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `Historial de visitas (${d.visits.length})`;
  details.append(summary);
  if (!d.visits.length) addLine(details, "", "No hay visitas registradas.");
  for (const visit of d.visits) {
    const item = document.createElement("div");
    item.className = "visit-entry";
    addLine(item, "", `${visitDate(visit)} · ${visitRating(visit)}`);
    if (visitComment(visit)) addLine(item, "", visitComment(visit));
    details.append(item);
  }
  wrapper.append(details);
  layer.bindPopup(wrapper, { maxWidth: 340, maxHeight: 380 });
}
