# La BuenGuia

Mapa público de restaurantes, bares, cafeterías, pubs y otros lugares.

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue

La web se construye con React, Vite y Leaflet. El workflow de GitHub Actions despliega `dist/` a GitHub Pages. En Settings > Pages, seleccionar **GitHub Actions** como origen.

## Datos

- `data/establecimientos.geojson.json`: GeoJSON válido con colección de establecimientos vacía inicialmente.
- `data/visitas.json`: historial de visitas, inicialmente vacío.

La extensión `.geojson.json` permite la importación JSON nativa en Vite; más adelante se puede migrar a un archivo `.geojson` cargado por `fetch`.

Las copias locales deben guardarse en `backups/`, excluido de Git. El editor local y la sincronización manual aún están pendientes de implementar.
