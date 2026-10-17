const TAGS = ["Michelin","Menu degustacion","Vino","Vegano","Irlandes","Copas","Vistas","Coffeeshop","Italiano","Carne","Español","Tipico","Pescado","Barato","Chino","Hamburguesa","Postre","Paella","Sushi","Kebab","Mexicano","Musica en directo","Reservado","Helados","Brunch","Desayuno","Cocteles","Pasteleria","Rooftop","Romantico","Buffet","Tapas"];
const form = document.querySelector("#venue-form");
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
form.addEventListener("submit", event => {
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
    id: crypto.randomUUID(),
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      nombre: String(data.get("nombre")).trim(),
      tipo: data.get("tipo"),
      estado: data.get("estado"),
      precio: data.get("precio") ? Number(data.get("precio")) : null,
      direccion: String(data.get("direccion") || "").trim(),
      etiquetas: data.getAll("etiquetas"),
      notas: String(data.get("notas") || "").trim(),
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    }
  };
  document.querySelector("#preview-json").textContent = JSON.stringify(venue, null, 2);
  document.querySelector("#preview").hidden = false;
});
form.addEventListener("reset", () => { document.querySelector("#preview").hidden = true; });