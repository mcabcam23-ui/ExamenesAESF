# RCF Maquinista — Práctica AESF

Aplicación web para practicar las preguntas del Reglamento de Circulación Ferroviaria (RCF), extraídas del test oficial de los 5 libros.

## Inicio rápido

1. Haz doble clic en **`iniciar.bat`** (o ejecuta `python -m http.server 8080` en esta carpeta).
2. Abre [http://localhost:8080](http://localhost:8080) en el navegador.

## Publicar en GitHub Pages

1. Sube **toda** la carpeta del proyecto, incluidos:
   - `index.html`
   - `css/`, `js/` (con `questions-data.js`)
   - `images/` (todas las figuras de las preguntas)
   - `.nojekyll` (evita que Jekyll oculte archivos)
2. En el repositorio: **Settings → Pages → Source: Deploy from branch** → rama `main`, carpeta `/ (root)`.
3. La URL será `https://TU-USUARIO.github.io/NOMBRE-REPO/` (con barra final).

Si faltan estilos o preguntas, comprueba en el navegador (F12 → Network) que no haya archivos en rojo (404). Lo más habitual es no haber subido `images/` o `js/questions-data.js`.

## Funciones

- **Modo Practicar**: corrección inmediata al responder cada pregunta.
- **Modo Examen**: sin feedback hasta el final.
- **Examen oficial AESF**: preset de 60 preguntas, 5 libros, distribución proporcional.
- **Personalización**: número de preguntas (5–100), libros, mezcla de preguntas/respuestas.
- **Criterio de aprobado**: en 60 preguntas puedes fallar hasta 12 (80 %). Para otros tamaños se aplica regla de tres.

## Banco de preguntas

| Libro | Preguntas |
|-------|-----------|
| 1 — Disposiciones generales | 254 |
| 2 — Señales ferroviarias | 246 |
| 3 — Circulación y maniobras | 224 |
| 4 — Bloqueos | 175 |
| 5 — Maquinista y sistemas | 97 |
| **Total** | **995** |

Todas las respuestas coinciden con las plantillas del PDF.

## Regenerar preguntas desde el PDF

```bash
python scripts/extract_questions.py
```

Requiere PyMuPDF (`pip install pymupdf`). El PDF debe estar en la ruta indicada en el script.
