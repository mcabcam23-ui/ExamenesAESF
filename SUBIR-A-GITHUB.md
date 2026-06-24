# Subir a GitHub Pages

Esta carpeta contiene **todo lo necesario** para publicar la app. Sube el contenido tal cual al repositorio (raíz del repo, no dentro de otra subcarpeta).

## Pasos

1. Crea un repositorio en GitHub (público).
2. Sube **todo** lo de esta carpeta:
   - `index.html`
   - `.nojekyll`
   - `css/`
   - `js/` (incluye `questions-data.js`, ~622 KB)
   - `images/` (64 imágenes de preguntas + logos)
3. GitHub → **Settings → Pages → Source**: rama `main`, carpeta **/ (root)**.
4. Espera 1–2 minutos y abre: `https://TU-USUARIO.github.io/NOMBRE-REPO/`

## Comprobar

Si algo no se ve, pulsa **F12 → Network** y busca archivos en rojo (404).

## No hace falta subir

Las carpetas `scripts/`, `data/` e `iniciar.bat` del proyecto original son solo para desarrollo local.
