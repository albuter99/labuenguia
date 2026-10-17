const TAGS = ["Michelin","Menu degustacion","Vino","Vegano","Irlandes","Copas","Vistas","Coffeeshop","Italiano","Carne","Español","Tipico","Pescado","Barato","Chino","Hamburguesa","Postre","Paella","Sushi","Kebab","Mexicano","Musica en directo","Reservado","Helados","Brunch","Desayuno","Cocteles","Pasteleria","Rooftop","Romantico","Buffet","Tapas"];
const form = document.querySelector("#venue-form");
let venues = [];
let editingId = null;
let visits = [];
const visitForm = document.querySelector("#visit-form");
const visitSelect = document.querySelector("#visit-venue");
function average(id) {
  const ratings = visits.filter(v => String(v.establecimientoId) === String(id) && Number.isInteger(v.valoracion) && v.valoracion >= 1 && v.valoracion <= 5).map(v => v.valoracion);
  return ratings.length ? (ratings.reduce((a,b) => a+b, 0)/ratings.length).toFixed(1) + " ☀️" : "Sin valorar";
}
function renderTable() {
  const term = document.querySelector("#venue-search").value.toLocaleLowerCase("es").trim();
  const tbody = document.querySelector("#venue-rows");
  tbody.replaceChildren();
  for (const venue of [...venues].sort((a,b) => a.properties.nombre.localeCompare(b.properties.nombre,"es"))) {
    const p = venue.properties;
    if (!p.nombre.toLocaleLowerCase("es").includes(term)) continue;
    const tr = document.createElement("tr");
    for (const value of [p.nombre,p.tipo,p.estado,p.precio ? "€".repeat(p.precio) : "Sin indicar",average(venue.id)]) {
      const td = document.createElement("td"); td.textContent = value; tr.append(td);
    }
    const actions = document.createElement("td");
    const edit = document.createElement("button"); edit.type="button"; edit.textContent="Editar"; edit.addEventListener("click",()=>editVenue(venue));
    const rate = document.createElement("button"); rate.type="button"; rate.textContent="Valorar"; rate.className="secondary"; rate.addEventListener("click",()=>{visitSelect.value=venue.id;visitForm.scrollIntoView({behavior:"smooth"});});
    actions.append(edit,rate); tr.append(actions); tbody.append(tr);
  }
}
async function loadVenues() {
  const [a,b] = await Promise.all([fetch("/api/establecimientos",{cache:"no-store"}),fetch("/api/visitas",{cache:"no-store"})]);
  if (!a.ok || !b.ok) throw new Error("No se pudieron cargar los datos");
  venues=(await a.json()).features; visits=await b.json();
  const selected=visitSelect.value;
  visitSelect.replaceChildren(new Option("Seleccionar establecimiento",""));
  for(const v of venues) visitSelect.add(new Option(v.properties.nombre,v.id));
  if(venues.some(v=>v.id===selected))visitSelect.value=selected;
  renderTable();
}
function editVenue(venue) {
  editingId=venue.id; const p=venue.properties;
  for(const key of ["nombre","tipo","estado","direccion","notas"])form.elements.namedItem(key).value=p[key]??"";
  form.elements.namedItem("precio").value=p.precio??"";
  form.elements.namedItem("lat").value=venue.geometry.coordinates[1];
  form.elements.namedItem("lon").value=venue.geometry.coordinates[0];
  for(const input of form.querySelectorAll('input[name="etiquetas"]'))input.checked=(p.etiquetas||[]).includes(input.value);
  document.querySelector("#form-heading").textContent="Modificar: "+p.nombre;
  visitSelect.value=venue.id;
  form.scrollIntoView({behavior:"smooth"});
}
document.querySelector("#new-venue").addEventListener("click",()=>{editingId=null;form.reset();document.querySelector("#form-heading").textContent="Nuevo establecimiento";form.scrollIntoView({behavior:"smooth"});});
document.querySelector("#venue-search").addEventListener("input",renderTable);
visitForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const data=new FormData(visitForm);
  const payload={id:crypto.randomUUID(),establecimientoId:visitSelect.value,fecha:data.get("fecha")||null,valoracion:data.get("valoracion")?Number(data.get("valoracion")):null,comentario:String(data.get("comentario")||"").trim()};
  const status=document.querySelector("#visit-message");
  if(!payload.establecimientoId){status.textContent="Selecciona un establecimiento";return;}
  try{
    const response=await fetch("/api/visitas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Error");
    status.textContent="Visita guardada localmente. Pendiente de publicación.";
    visitForm.reset();await loadVenues();
  }catch(error){status.textContent="No se guardó: "+error.message;}
});
loadVenues().catch(error=>{document.querySelector("#save-message").textContent=error.message;});
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
const publishButton = document.querySelector("#publish-button");
publishButton.addEventListener("click", async () => {
  if (!confirm("¿Publicar los cambios guardados en GitHub?")) return;
  publishButton.disabled = true;
  const status = document.querySelector("#publish-status");
  status.textContent = "Publicando…";
  try {
    const response = await fetch("/api/publicar", {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = result.message;
  } catch(error) { status.textContent = "No publicado: " + error.message; }
  finally { publishButton.disabled = false; }
});
