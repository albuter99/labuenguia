const TAGS = ["Michelin","Menu degustacion","Vino","Vegano","Irlandes","Copas","Vistas","Coffeeshop","Italiano","Carne","Español","Tipico","Pescado","Barato","Chino","Hamburguesa","Postre","Paella","Sushi","Kebab","Mexicano","Musica en directo","Reservado","Helados","Brunch","Desayuno","Cocteles","Pasteleria","Rooftop","Romantico","Buffet","Tapas"];
const form = document.querySelector("#venue-form");
let venues = [];
let editingId = null;
let visits = [];
let editingVisitId = null;
const visitForm = document.querySelector("#visit-form");
const visitSelect = document.querySelector("#visit-venue");
function average(id) {
  const ratings = visits.filter(v => String(v.establecimientoId) === String(id) && Number.isInteger(v.valoracion) && v.valoracion >= 1 && v.valoracion <= 5).map(v => v.valoracion);
  return ratings.length ? (ratings.reduce((a,b) => a+b, 0)/ratings.length).toFixed(1) + " ☺" : "Sin valorar";
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
    const remove = document.createElement("button"); remove.type="button"; remove.textContent="Eliminar"; remove.className="danger"; remove.addEventListener("click",()=>deleteVenue(venue));
    actions.append(edit,rate,remove); tr.append(actions); tbody.append(tr);
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
  renderVisits();
}
function editVenue(venue) {
  editingId=venue.id; const p=venue.properties;
  for(const key of ["nombre","tipo","estado","direccion","notas"])form.elements.namedItem(key).value=p[key]??"";
  form.elements.namedItem("precio").value=p.precio??"";
  form.elements.namedItem("selloB").checked=p.selloB===true;
  form.elements.namedItem("icono").value=p.icono??"";
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
  const payload={id:editingVisitId || crypto.randomUUID(),establecimientoId:visitSelect.value,fecha:data.get("fecha")||null,valoracion:data.get("valoracion")?Number(data.get("valoracion")):null,comentario:String(data.get("comentario")||"").trim()};
  const status=document.querySelector("#visit-message");
  if(!payload.establecimientoId){status.textContent="Selecciona un establecimiento";return;}
  try{
    const response=await fetch("/api/visitas",{method:editingVisitId ? "PUT" : "POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Error");
    status.textContent="Visita guardada localmente. Pendiente de publicación.";
    resetVisit();await loadVenues();
  }catch(error){status.textContent="No se guardó: "+error.message;}
});
function resetVisit() {
  editingVisitId=null;
  visitForm.reset();
  document.querySelector("#visit-save").textContent="Guardar visita";
  document.querySelector("#visit-cancel").hidden=true;
}
document.querySelector("#visit-cancel").addEventListener("click",resetVisit);
function renderVisits() {
  const body=document.querySelector("#visit-rows");
  body.replaceChildren();
  for(const v of [...visits].reverse()) {
    const tr=document.createElement("tr");
    const venue=venues.find(x=>String(x.id)===String(v.establecimientoId));
    for(const value of [venue?.properties.nombre || "Desconocido",v.fecha||"Sin fecha",v.valoracion==null?"Sin valorar":v.valoracion+" ☺",v.comentario||""]) {
      const td=document.createElement("td");td.textContent=value;tr.append(td);
    }
    const td=document.createElement("td");
    const edit=document.createElement("button");edit.type="button";edit.textContent="Editar";
    edit.addEventListener("click",()=>{
      editingVisitId=v.id;
      visitSelect.value=v.establecimientoId;
      visitForm.elements.namedItem("fecha").value=v.fecha||"";
      visitForm.elements.namedItem("valoracion").value=v.valoracion??"";
      visitForm.elements.namedItem("comentario").value=v.comentario||"";
      document.querySelector("#visit-save").textContent="Guardar cambios";
      document.querySelector("#visit-cancel").hidden=false;
      visitForm.scrollIntoView({behavior:"smooth"});
    });
    const del=document.createElement("button");del.type="button";del.textContent="Eliminar";del.className="danger";
    del.addEventListener("click",async()=>{
      if(!confirm("¿Eliminar esta visita?"))return;
      try {
        const response=await fetch("/api/visitas/"+encodeURIComponent(v.id),{method:"DELETE"});
        const result=await response.json();if(!response.ok)throw new Error(result.error);
        if(editingVisitId===v.id)resetVisit();
        await loadVenues();
        document.querySelector("#visit-message").textContent="Visita eliminada localmente. Pendiente de publicación.";
      }catch(error){alert(error.message);}
    });
    td.append(edit,del);tr.append(td);body.append(tr);
  }
}
async function deleteVenue(venue) {
  const count=visits.filter(v=>String(v.establecimientoId)===String(venue.id)).length;
  const message="¿Eliminar "+venue.properties.nombre+"?"+(count?" También se eliminarán sus "+count+" visitas.":"")+" Esta acción quedará pendiente de publicación.";
  if(!confirm(message))return;
  try {
    const response=await fetch("/api/establecimientos/"+encodeURIComponent(venue.id),{method:"DELETE"});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    if(editingId===venue.id){editingId=null;form.reset();document.querySelector("#form-heading").textContent="Nuevo establecimiento";}
    if(visitSelect.value===venue.id)resetVisit();
    await loadVenues();
    document.querySelector("#save-message").textContent="Establecimiento eliminado localmente. Pendiente de publicación.";
  }catch(error){alert(error.message);}
}
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
      icono: String(data.get("icono") || ""),
      selloB: data.get("selloB") === "on",
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


let routes = [];
let editingRoute = null;
const routeForm = document.querySelector("#route-form");
const stopsBox = document.querySelector("#route-stops");
const routeMessage = document.querySelector("#route-message");
function addRouteStop(id = "", pedir = "") {
  const row = document.createElement("div");
  row.className = "route-stop";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Establecimiento");
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Selecciona un establecimiento";
  select.append(empty);
  for (const v of [...venues].sort((a,b) => a.properties.nombre.localeCompare(b.properties.nombre, "es"))) {
    const option = document.createElement("option");
    option.value = v.id;
    option.textContent = v.properties.nombre;
    select.append(option);
  }
  select.value = id;
  const input = document.createElement("input");
  input.placeholder = "Qué pedir o recomendación";
  input.maxLength = 1000;
  input.value = pedir;
  const up = document.createElement("button");
  up.type = "button"; up.textContent = "↑"; up.title = "Subir";
  up.onclick = () => { if (row.previousElementSibling) stopsBox.insertBefore(row, row.previousElementSibling); };
  const down = document.createElement("button");
  down.type = "button"; down.textContent = "↓"; down.title = "Bajar";
  down.onclick = () => { if (row.nextElementSibling) stopsBox.insertBefore(row.nextElementSibling, row); };
  const remove = document.createElement("button");
  remove.type = "button"; remove.textContent = "✕"; remove.title = "Quitar parada";
  remove.onclick = () => row.remove();
  row.append(select, input, up, down, remove);
  stopsBox.append(row);
}
function clearRoute() {
  editingRoute = null;
  routeForm.reset();
  stopsBox.replaceChildren();
  document.querySelector("#route-heading").textContent = "Nueva ruta";
}
function renderRoutes() {
  const list = document.querySelector("#route-list");
  list.replaceChildren();
  for (const route of routes) {
    const row = document.createElement("div");
    row.className = "route-entry";
    const title = document.createElement("strong");
    title.textContent = route.nombre + " · " + route.paradas.length + " paradas";
    const edit = document.createElement("button");
    edit.type = "button"; edit.textContent = "Editar";
    edit.onclick = () => {
      editingRoute = route.id;
      document.querySelector("#route-name").value = route.nombre;
      document.querySelector("#route-city").value = route.ciudad;
      document.querySelector("#route-type").value = route.tipo;
      document.querySelector("#route-description").value = route.descripcion;
      stopsBox.replaceChildren();
      route.paradas.forEach(p => addRouteStop(p.establecimientoId, p.pedir));
      document.querySelector("#route-heading").textContent = "Editar ruta";
      routeForm.scrollIntoView({behavior:"smooth"});
    };
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "Eliminar";
    del.onclick = async () => {
      if (!confirm("¿Eliminar esta ruta? Los establecimientos no se eliminarán.")) return;
      const res = await fetch("/api/rutas/" + route.id, {method:"DELETE"});
      if (!res.ok) { alert("No se pudo eliminar la ruta"); return; }
      clearRoute(); await loadRoutes();
    };
    row.append(title, edit, del); list.append(row);
  }
}
async function loadRoutes() {
  const res = await fetch("/api/rutas");
  if (!res.ok) throw new Error("No se pudieron cargar las rutas");
  routes = await res.json();
  renderRoutes();
}
document.querySelector("#route-add").onclick = () => addRouteStop();
document.querySelector("#route-clear").onclick = clearRoute;
routeForm.addEventListener("submit", async event => {
  event.preventDefault();
  const paradas = [...stopsBox.children].map(row => ({
    establecimientoId: row.querySelector("select").value,
    pedir: row.querySelector("input").value.trim()
  }));
  if (!paradas.length || paradas.some(p => !p.establecimientoId) || new Set(paradas.map(p => p.establecimientoId)).size !== paradas.length) {
    routeMessage.textContent = "Añade paradas válidas sin establecimientos repetidos.";
    return;
  }
  const route = {
    id: editingRoute || crypto.randomUUID(),
    nombre: document.querySelector("#route-name").value.trim(),
    ciudad: document.querySelector("#route-city").value.trim(),
    tipo: document.querySelector("#route-type").value,
    descripcion: document.querySelector("#route-description").value.trim(),
    paradas
  };
  try {
    const res = await fetch("/api/rutas", {method: editingRoute ? "PUT" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(route)});
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Error al guardar");
    clearRoute(); await loadRoutes();
    routeMessage.textContent = "Ruta guardada localmente. Pulsa Publicar para compartirla.";
  } catch(error) { routeMessage.textContent = error.message; }
});
loadRoutes().catch(error => { routeMessage.textContent = error.message; });
