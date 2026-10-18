import visitas from "../data/visitas.json";

export function visitsFor(feature) {
  return visitas.filter(v => String(v.establecimientoId ?? v.establecimiento_id) === String(feature.id));
}

export function ratingFor(feature) {
  const ratings = visitsFor(feature).map(v => v.valoracion).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
  return ratings.length ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : null;
}

export function hasBuenSello(feature) {
  const history = visitsFor(feature);
  return feature.properties?.selloB === true || (history.length >= 4 && ratingFor(feature) !== null && ratingFor(feature) > 4.5);
}

export function priceLabel(price) {
  return Number.isInteger(price) && price >= 1 && price <= 4 ? "€".repeat(price) : "Sin precio";
}

export function venueDetails(feature) {
  const p = feature.properties ?? {};
  return {
    name: p.nombre || "Sin nombre",
    type: p.tipo || "Otros",
    address: p.direccion ?? p.dirección ?? "",
    status: p.estado || "Sin estado",
    price: priceLabel(p.precio),
    tags: Array.isArray(p.etiquetas) ? p.etiquetas : [],
    notes: p.notas ?? "",
    rating: ratingFor(feature),
    selloB: hasBuenSello(feature),
    visits: visitsFor(feature),
  };
}

export function visitDate(visit) {
  const raw = visit.fecha ?? visit.fechaVisita ?? visit.fecha_visita;
  if (!raw) return "Sin fecha";
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(raw);
}

export function visitRating(visit) {
  return Number.isInteger(visit.valoracion) && visit.valoracion >= 1 && visit.valoracion <= 5 ? `${visit.valoracion} sonrisas` : "Sin valorar";
}

export function visitComment(visit) {
  return visit.comentario ?? visit.notas ?? "";
}
