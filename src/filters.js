export const TYPES = ["Restaurante", "Cafetería", "Bar", "Pub", "Otros"];
export const STATUSES = ["Quiero ir", "Visitado"];
export const PRICES = [1, 2, 3, 4];
export const TAGS = ["Michelin", "Menu degustacion", "Vino", "Vegano", "Irlandes", "Copas", "Vistas", "Coffeeshop", "Italiano", "Carne", "Español", "Tipico", "Pescado", "Barato", "Chino", "Hamburguesa", "Postre", "Paella", "Sushi", "Kebab", "Mexicano", "Musica en directo", "Reservado", "Helados", "Brunch", "Desayuno", "Cocteles", "Pasteleria", "Rooftop", "Romantico", "Buffet", "Tapas"];

export const initialFilters = () => ({
  types: [...TYPES],
  statuses: [...STATUSES],
  prices: [...PRICES],
  tags: [],
});

export function matchesFilters(feature, filters) {
  const p = feature.properties ?? {};
  const price = p.precio == null || p.precio === "" ? null : Number(p.precio);
  const tags = Array.isArray(p.etiquetas) ? p.etiquetas : [];
  return filters.types.includes(p.tipo) &&
    filters.statuses.includes(p.estado) &&
    (price === null || filters.prices.includes(price)) &&
    filters.tags.every(tag => tags.includes(tag));
}

export function filterVenues(collection, filters) {
  return { ...collection, features: collection.features.filter(feature => matchesFilters(feature, filters)) };
}
