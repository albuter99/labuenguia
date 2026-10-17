from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime, timezone
import json, os, shutil, tempfile, uuid, math

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "establecimientos.geojson.json"
BACKUPS = ROOT / "backups"
HOST, PORT = "127.0.0.1", 8765

class Handler(SimpleHTTPRequestHandler):
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
            if not isinstance(p["etiquetas"], list) or any(not isinstance(t, str) for t in p["etiquetas"]):
                raise ValueError("Etiquetas inválidas")
            collection = json.loads(DATA.read_text(encoding="utf-8"))
            if collection["type"] != "FeatureCollection" or not isinstance(collection["features"], list):
                raise ValueError("Archivo GeoJSON inválido")
            if any(str(v.get("id")) == str(feature["id"]) for v in collection["features"]):
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
