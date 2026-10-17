# Editor local · fase 1

Este directorio NO se incluye en la compilación de Vite ni se despliega en GitHub Pages. No contiene autenticación ni debe publicarse como sitio web.

Para ver el prototipo del formulario en Windows, descarga/clona el repositorio y abre `editor/index.html` en el navegador. Para la generación de UUID, algunos navegadores requieren un contexto seguro; en ese caso inicia un servidor local en la carpeta `editor` con `python -m http.server 8765 --bind 127.0.0.1` y abre http://127.0.0.1:8765/.

Por ahora el formulario solo valida y muestra una vista previa GeoJSON. **No guarda datos ni sincroniza con GitHub.** El guardado local, las copias de seguridad y la publicación manual serán fases posteriores. Nunca incluyas tokens de GitHub en el frontend público.
