# Sincronización con Google (Firebase)

Para que repaso, exámenes impresos y progreso se guarden en la **cuenta Google** y aparezcan en otros dispositivos:

## 1. Crear proyecto Firebase (gratis)

1. [Firebase Console](https://console.firebase.google.com) → Crear proyecto.
2. **Authentication** → Sign-in method → activar **Google**.
3. **Firestore Database** → Crear base de datos (modo producción).
4. **Reglas de Firestore** (pestaña Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/data/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. **Project settings** → Your apps → Web (`</>`) → copiar la config.
6. **Authentication** → Settings → **Authorized domains** → añadir `tu-usuario.github.io`.

## 2. Configurar la app

Edita `js/firebase-config.js`:

```javascript
window.FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "...",
  appId: "1:...",
};
```

Sube de nuevo a GitHub. Los usuarios pulsan **Iniciar sesión con Google** y sus datos se sincronizan.

## Qué se sincroniza

- Preguntas falladas (repaso)
- Exámenes impresos / archivados (PDF)

Los datos del banco de preguntas (993 preguntas RCF) **no** se sincronizan: vienen del PDF oficial embebido en la app.
