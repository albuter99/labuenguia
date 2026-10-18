from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timezone
import json, os, shutil, tempfile, uuid, math, subprocess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "establecimientos.geojson.json"
VISITS = ROOT / "data" / "visitas.json"
ROUTES = ROOT / "data" / "rutas.json"
BACKUPS = ROOT / "backups"
HOST, PORT = "127.0.0.1", 8765

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/establecimientos":
            try:
                self.reply(200, json.loads(DATA.read_text(encoding="utf-8")))
            except (OSError, ValueError) as error:
                self.reply(500, {"error": str(error)})
        elif self.path == "/api/rutas":
            self.reply(200, json.loads(ROUTES.read_text(encoding="utf-8")))
        elif self.path == "/api/visitas":
            try:
                self.reply(200, json.loads(VISITS.read_text(encoding="utf-8")))
            except (OSError, ValueError) as error:
                self.reply(500, {"error": str(error)})
        else:
            super().do_GET()

    def do_PUT(self):
        if self.path == "/api/rutas":
            self.save_route(True)
        elif self.path == "/api/visitas":
            self.save_visit(update=True)
        else:
            self.save_venue("PUT")

    def do_DELETE(self):
        if self.headers.get("Origin") not in (None, f"http://{HOST}:{PORT}"):
            self.reply(403, {"error": "Origen no permitido"})
            return
        try:
            if self.path.startswith("/api/rutas/"):
                item_id = self.path.split("/")[-1]
                uuid.UUID(item_id)
                items = json.loads(ROUTES.read_text(encoding="utf-8"))
                remaining = [v for v in items if v.get("id") != item_id]
                if len(remaining) == len(items):
                    raise ValueError("Ruta no encontrada")
                self.atomic_write(ROUTES, remaining)
            elif self.path.startswith("/api/visitas/"):
                item_id = self.path.split("/")[-1]
                uuid.UUID(item_id)
                items = json.loads(VISITS.read_text(encoding="utf-8"))
                remaining = [v for v in items if str(v.get("id")) != item_id]
                if len(items) == len(remaining):
                    raise ValueError("Visita no encontrada")
                self.atomic_write(VISITS, remaining)
            elif self.path.startswith("/api/establecimientos/"):
                item_id = self.path.split("/")[-1]
                uuid.UUID(item_id)
                collection = json.loads(DATA.read_text(encoding="utf-8"))
                remaining = [v for v in collection["features"] if str(v.get("id")) != item_id]
                if len(remaining) == len(collection["features"]):
                    raise ValueError("Establecimiento no encontrado")
                visits = json.loads(VISITS.read_text(encoding="utf-8"))
                remaining_visits = [v for v in visits if str(v.get("establecimientoId")) != item_id]
                if len(remaining_visits) != len(visits):
                    self.atomic_write(VISITS, remaining_visits)
                collection["features"] = remaining
                self.atomic_write(DATA, collection)
            else:
                self.reply(404, {"error": "Ruta desconocida"})
                return
            self.reply(200, {"ok": True})
        except (ValueError, OSError) as error:
            self.reply(400, {"error": str(error)})

    def atomic_write(self, path, data):
        BACKUPS.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        shutil.copy2(path, BACKUPS / (path.stem + "-" + stamp + ".json"))
        fd, temp = tempfile.mkstemp(prefix=".edit-", dir=path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as out:
                json.dump(data, out, ensure_ascii=False, indent=2)
                out.write("\n")
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)


    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "editor"), **kwargs)

    def reply(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if self.path == "/api/publicar":
            self.publish()
        elif self.path == "/api/rutas":
            self.save_route(False)
        elif self.path == "/api/visitas":
            self.save_visit()
        else:
            self.save_venue("POST")

    def publish(self):
        if self.headers.get("Origin") not in (None, f"http://{HOST}:{PORT}"):
            self.reply(403, {"error": "Origen no permitido"})
            return
        try:
            def git(*args):
                result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=45)
                if result.returncode:
                    raise ValueError((result.stderr or result.stdout).strip()[:350])
                return result.stdout.strip()
            if git("branch", "--show-current") != "main":
                raise ValueError("Debes estar en la rama main")
            if git("diff", "--cached", "--name-only"):
                raise ValueError("Hay cambios preparados para commit en GitHub Desktop")
            git("fetch", "origin", "main")
            if git("rev-parse", "HEAD") != git("rev-parse", "origin/main"):
                raise ValueError("Primero sincroniza tu repositorio con GitHub Desktop")
            changed = git("diff", "--name-only")
            allowed = {"data/establecimientos.geojson.json", "data/visitas.json", "data/rutas.json"}
            if any(path not in allowed for path in changed.splitlines()):
                raise ValueError("Hay otros archivos modificados. Revísalos en GitHub Desktop")
            if not changed:
                self.reply(200, {"message": "No hay cambios pendientes."})
                return
            git("add", "--", "data/establecimientos.geojson.json", "data/visitas.json", "data/rutas.json")
            git("commit", "-m", "Actualizar datos de La BuenGuia")
            try:
                git("push", "origin", "main")
            except ValueError:
                raise ValueError("Commit creado localmente. Usa Push origin en GitHub Desktop")
            self.reply(200, {"message": "Publicado en GitHub. Espera al despliegue."})
        except (ValueError, subprocess.TimeoutExpired, FileNotFoundError) as error:
            self.reply(409, {"error": str(error)})

    def save_route(self, update=False):
        if self.headers.get("Origin") not in (None, f"http://{HOST}:{PORT}"):
            self.reply(403, {"error": "Origen no permitido"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                raise ValueError("Solicitud inválida")
            route = json.loads(self.rfile.read(length))
            uuid.UUID(str(route["id"]))
            if not isinstance(route.get("nombre"), str) or not 0 < len(route["nombre"].strip()) <= 160:
                raise ValueError("Nombre inválido")
            if route.get("tipo") not in ("ruta", "coleccion"):
                raise ValueError("Tipo inválido")
            if not isinstance(route.get("ciudad"), str) or len(route["ciudad"]) > 160:
                raise ValueError("Ciudad inválida")
            if not isinstance(route.get("descripcion"), str) or len(route["descripcion"]) > 2000:
                raise ValueError("Descripción inválida")
            stops = route.get("paradas")
            if not isinstance(stops, list) or len(stops) > 100:
                raise ValueError("Paradas inválidas")
            valid = {str(v["id"]) for v in json.loads(DATA.read_text(encoding="utf-8"))["features"]}
            ids = []
            for stop in stops:
                venue_id = str(stop["establecimientoId"])
                if venue_id not in valid or not isinstance(stop.get("pedir"), str) or len(stop["pedir"]) > 1000:
                    raise ValueError("Parada inválida")
                ids.append(venue_id)
            if len(set(ids)) != len(ids):
                raise ValueError("Establecimiento repetido")
            items = json.loads(ROUTES.read_text(encoding="utf-8"))
            matches = [i for i, v in enumerate(items) if v["id"] == route["id"]]
            clean = {k: route[k] for k in ("id", "nombre", "tipo", "ciudad", "descripcion", "paradas")}
            if update:
                if len(matches) != 1:
                    raise ValueError("Ruta no encontrada")
                items[matches[0]] = clean
            else:
                if matches:
                    raise ValueError("Ruta duplicada")
                items.append(clean)
            self.atomic_write(ROUTES, items)
            self.reply(200, {"ok": True})
        except (ValueError, KeyError, TypeError, OSError) as error:
            self.reply(400, {"error": str(error)})

    def save_visit(self, update=False):
        if self.headers.get("Origin") not in (None, f"http://{HOST}:{PORT}"):
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536 or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("Solicitud inválida")
            visit = json.loads(self.rfile.read(length))
            uuid.UUID(str(visit["id"]))
            venue_id = str(visit["establecimientoId"])
            collection = json.loads(DATA.read_text(encoding="utf-8"))
            if not any(str(v["id"]) == venue_id for v in collection["features"]):
                raise ValueError("Establecimiento no encontrado")
            rating = visit.get("valoracion")
            if rating is not None and (type(rating) is not int or rating not in (1,2,3,4,5)):
                raise ValueError("Las sonrisas deben estar entre 1 y 5")
            if visit.get("fecha") is not None:
                from datetime import date
                date.fromisoformat(visit["fecha"])
            if not isinstance(visit.get("comentario"), str):
                raise ValueError("Comentario inválido")
            existing = json.loads(VISITS.read_text(encoding="utf-8"))
            matches = [i for i,v in enumerate(existing) if str(v.get("id")) == str(visit["id"])]
            if update:
                if len(matches) != 1:
                    raise ValueError("Visita no encontrada")
                existing[matches[0]] = visit
            else:
                if matches:
                    raise ValueError("Visita duplicada")
                existing.append(visit)
            BACKUPS.mkdir(exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            shutil.copy2(VISITS, BACKUPS / f"visitas-{stamp}.json")
            fd, temp = tempfile.mkstemp(prefix=".visits-", dir=VISITS.parent)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as out:
                    json.dump(existing, out, ensure_ascii=False, indent=2)
                    out.write("\n")
                os.replace(temp, VISITS)
            finally:
                if os.path.exists(temp):
                    os.unlink(temp)
            self.reply(201, {"ok": True})
        except (KeyError, ValueError, TypeError, IndexError, json.JSONDecodeError) as error:
            self.reply(400, {"error": str(error)})
        except OSError:
            self.reply(500, {"error": "No se pudo guardar la visita"})

    def save_venue(self, method):
        if self.path != "/api/establecimientos":
            self.send_error(404)
            return
        if self.headers.get("Origin") not in (None, f"http://{HOST}:{PORT}"):
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                raise ValueError("Tamaño de solicitud inválido")
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("Se requiere JSON")
            feature = json.loads(self.rfile.read(length))
            p = feature["properties"]
            lon, lat = feature["geometry"]["coordinates"]
            uuid.UUID(str(feature["id"]))
            if feature["type"] != "Feature" or feature["geometry"]["type"] != "Point":
                raise ValueError("GeoJSON inválido")
            if not all(type(n) in (int, float) and math.isfinite(n) for n in (lon, lat)) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError("Coordenadas inválidas")
            if not isinstance(p["nombre"], str) or not 0 < len(p["nombre"].strip()) <= 160:
                raise ValueError("Nombre inválido")
            if p["tipo"] not in ("Restaurante", "Cafetería", "Bar", "Pub", "Otros") or p["estado"] not in ("Quiero ir", "Visitado"):
                raise ValueError("Tipo o estado inválido")
            if p["precio"] is not None and (type(p["precio"]) is not int or p["precio"] not in (1, 2, 3, 4)):
                raise ValueError("Precio inválido")
            if "selloB" in p and type(p["selloB"]) is not bool:
                raise ValueError("Sello B inválido")
            if not isinstance(p["etiquetas"], list) or any(not isinstance(t, str) for t in p["etiquetas"]):
                raise ValueError("Etiquetas inválidas")
            collection = json.loads(DATA.read_text(encoding="utf-8"))
            if collection["type"] != "FeatureCollection" or not isinstance(collection["features"], list):
                raise ValueError("Archivo GeoJSON inválido")
            matches = [i for i, v in enumerate(collection["features"]) if str(v.get("id")) == str(feature["id"])]
            if method == "PUT":
                if len(matches) != 1:
                    raise ValueError("No se encuentra el establecimiento")
                previous = collection["features"][matches[0]]
                feature["properties"]["fechaCreacion"] = previous["properties"].get("fechaCreacion", feature["properties"]["fechaCreacion"])
                collection["features"][matches[0]] = feature
            else:
                if matches:
                    raise ValueError("Identificador duplicado")
                collection["features"].append(feature)
            BACKUPS.mkdir(exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            shutil.copy2(DATA, BACKUPS / f"establecimientos-{stamp}.json")
            fd, temp = tempfile.mkstemp(prefix=".venues-", dir=DATA.parent)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as out:
                    json.dump(collection, out, ensure_ascii=False, indent=2)
                    out.write("\n")
                os.replace(temp, DATA)
            finally:
                if os.path.exists(temp):
                    os.unlink(temp)
            self.reply(201, {"ok": True})
        except (KeyError, ValueError, TypeError, IndexError, json.JSONDecodeError) as error:
            self.reply(400, {"error": str(error)})
        except OSError:
            self.reply(500, {"error": "No se pudo escribir el archivo local"})

if __name__ == "__main__":
    print(f"Editor disponible en http://{HOST}:{PORT}/")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
