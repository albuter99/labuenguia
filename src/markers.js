import L from "leaflet";
import { venueDetails, visitDate, visitRating, visitComment } from "./venueDetails.js";

export const TYPE_COLORS = Object.freeze({
  Restaurante: "#E63946", "Cafetería": "#8D5B4C", Bar: "#F4A261",
  Pub: "#253B73", Otros: "#6C757D",
});

const PIN_SYMBOLS = Object.freeze({ cubiertos:"🍴", cerveza:"🍺", helado:"🍦", cafe:"☕", coctel:"🍸", vino:"🍷" });
export function createVenueMarker(feature, latlng) {
  const choice = feature?.properties?.icono || "";
  const symbol = PIN_SYMBOLS[choice];
  if (symbol) {
    const color = TYPE_COLORS[feature?.properties?.tipo] ?? TYPE_COLORS.Otros;
    return L.marker(latlng, { icon: L.divIcon({
      className:"venue-symbol-pin",
      html:'<span class="venue-pin-bubble" style="background:'+color+'"><span>'+symbol+'</span></span>',
      iconSize:[40,44], iconAnchor:[20,22], popupAnchor:[0,-22]
    }) });
  }
  return L.circleMarker(latlng, {
    radius: 13, color: "#ffffff", weight: 3, className: "venue-map-marker",
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
    copy.className = "copy-address icon-copy-address";
    copy.title = "Copiar dirección";
    copy.setAttribute("aria-label", "Copiar dirección");
    copy.textContent = "⧉";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(d.address);
        copy.textContent = "✓";
        copy.title = "Dirección copiada";
        copy.setAttribute("aria-label", "Dirección copiada");
        setTimeout(() => { copy.textContent = "⧉"; copy.title = "Copiar dirección"; copy.setAttribute("aria-label", "Copiar dirección"); }, 1800);
      } catch {
        window.prompt("Copia la dirección:", d.address);
      }
    });
    line.append(label, address, copy);
    wrapper.append(line);
  }
  const rating = document.createElement("div");
  rating.className = "popup-sun-rating";
  const sun = document.createElement("span");
  sun.textContent = "☀";
  sun.className = "popup-sun-icon";
  rating.append(sun, document.createTextNode(d.rating == null ? " Sin valorar" : " " + d.rating.toFixed(1) + " / 5"));
  wrapper.append(rating);
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
