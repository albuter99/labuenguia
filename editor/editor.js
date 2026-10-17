const TAGS = ["Michelin","Menu degustacion","Vino","Vegano","Irlandes","Copas","Vistas","Coffeeshop","Italiano","Carne","Español","Tipico","Pescado","Barato","Chino","Hamburguesa","Postre","Paella","Sushi","Kebab","Mexicano","Musica en directo","Reservado","Helados","Brunch","Desayuno","Cocteles","Pasteleria","Rooftop","Romantico","Buffet","Tapas"];
const form = document.querySelector("#venue-form");
let venues = [];
let editingId = null;
const selector = document.querySelector("#venue-select");
async function loadVenues() {
  const response = await fetch("/api/establecimientos", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los establecimientos");
  venues = (await response.json()).features;
  selector.replaceChildren(new Option("Nuevo establecimiento", ""));
  for (const venue of venues) selector.add(new Option(venue.properties.nombre, venue.id));
}
document.querySelector("#new-venue").addEventListener("click", () => {
  editingId = null;
  form.reset();
  selector.value = "";
  document.querySelector("#form-heading").textContent = "Nuevo establecimiento";
});
document.querySelector("#edit-venue").addEventListener("click", () => {
  const venue = venues.find(v => String(v.id) === selector.value);
  if (!venue) return;
  editingId = venue.id;
  const p = venue.properties;
  for (const key of ["nombre", "tipo", "estado", "direccion", "notas"]) form.elements.namedItem(key).value = p[key] ?? "";
  form.elements.namedItem("precio").value = p.precio ?? "";
  form.elements.namedItem("lat").value = venue.geometry.coordinates[1];
  form.elements.namedItem("lon").value = venue.geometry.coordinates[0];
  for (const input of form.querySelectorAll('input[name="etiquetas"]')) input.checked = (p.etiquetas || []).includes(input.value);
  document.querySelector("#form-heading").textContent = "Modificar: " + p.nombre;
  form.scrollIntoView({ behavior: "smooth" });
});
loadVenues().catch(error => { document.querySelector("#save-message").textContent = error.message; });
const tagContainer = document.querySelector("#tag-options");
for (const tag of TAGS) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "etiquetas";
  input.value = tag;
  label.append(input, document.createTextNode(tag));
  tagContainer.append(label);
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const lat = Number(data.get("lat"));
  const lon = Number(data.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    alert("Las coordenadas no son válidas.");
    return;
  }
  const venue = {
    type: "Feature",
    id: editingId || crypto.randomUUID(),
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      nombre: String(data.get("nombre")).trim(),
      tipo: data.get("tipo"),
      estado: data.get("estado"),
      precio: data.get("precio") ? Number(data.get("precio")) : null,
      direccion: String(data.get("direccion") || "").trim(),
      etiquetas: data.getAll("etiquetas"),
      notas: String(data.get("notas") || "").trim(),
      fechaCreacion: editingId ? venues.find(v => v.id === editingId).properties.fechaCreacion : new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    }
  };
  const status = document.querySelector("#save-message");
  status.textContent = "Guardando…";
  try {
    const response = await fetch("/api/establecimientos", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(venue) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Error al guardar");
    document.querySelector("#preview-json").textContent = JSON.stringify(venue, null, 2);
    document.querySelector("#preview").hidden = false;
    form.reset();
    document.querySelector("#preview").hidden = false;
    status.textContent = "Guardado localmente. Pendiente de publicación.";
    editingId = null;
    document.querySelector("#form-heading").textContent = "Nuevo establecimiento";
    await loadVenues();
  } catch (error) { status.textContent = "No se ha guardado: " + error.message; }
});
form.addEventListener("reset", () => { document.querySelector("#preview").hidden = true; });