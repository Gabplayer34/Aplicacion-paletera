# 💶 Presupuesto Palets

Aplicación web (PWA) para controlar el dinero disponible para comprar palets. Muestra el saldo actual, cuántos billetes tienes de cada tipo (50€, 20€, 10€, 5€), y permite **ingresar** o **retirar** dinero. Se sincroniza en tiempo real entre varios móviles (por ejemplo el tuyo y el de tu padre) usando [Firebase Firestore](https://firebase.google.com/products/firestore) (plan gratuito).

## ¿Cómo funciona la sincronización?

No hace falta programar ni pagar un servidor propio. Los dos móviles se conectan directamente a una base de datos gratuita de Google (Firestore) usando el mismo "código de sala". Todo lo que uno registre lo verá el otro al instante.

## Paso 1 — Crear un proyecto Firebase gratuito (solo una vez)

1. Entra en <https://console.firebase.google.com/> con una cuenta de Google y pulsa **"Crear un proyecto"**.
2. Ponle un nombre, por ejemplo `presupuesto-palets`. Puedes desactivar Google Analytics (no hace falta).
3. Cuando el proyecto esté creado, en el menú lateral entra en **Compilación → Firestore Database** y pulsa **"Crear base de datos"**.
   - Elige el modo **producción**.
   - Elige la región más cercana (por ejemplo `eur3 (europe-west)`).
4. Ve a la pestaña **Reglas** de Firestore y pega esto (sustituye las reglas por defecto):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /budgetRooms/{roomId} {
         allow read, write: if true;
         match /movements/{movementId} {
           allow read, write: if true;
         }
       }
     }
   }
   ```

   > ⚠️ Estas reglas son abiertas (sin usuario/contraseña) para que sea fácil de usar entre dos móviles. Cualquiera que conozca tu `projectId` y el código de sala podría en teoría leer o escribir los datos. Para un uso familiar es razonable, pero no compartas la configuración de Firebase ni el código de sala públicamente.

5. Vuelve a la vista general del proyecto (icono de engranaje → **Configuración del proyecto**), baja hasta **"Tus apps"** y pulsa el icono **`</>`** (Web) para registrar una app web. Ponle el nombre que quieras y pulsa **Registrar app**.
6. Firebase te mostrará un bloque `firebaseConfig` parecido a esto:

   ```json
   {
     "apiKey": "AIza...",
     "authDomain": "presupuesto-palets.firebaseapp.com",
     "projectId": "presupuesto-palets",
     "storageBucket": "presupuesto-palets.appspot.com",
     "messagingSenderId": "123456789",
     "appId": "1:123456789:web:abcdef"
   }
   ```

   Copia ese bloque completo, lo necesitarás en el Paso 3.

## Paso 2 — Publicar la app (para poder abrirla desde el móvil)

La forma más sencilla y gratuita es con **GitHub Pages**:

1. Sube este repositorio a GitHub (si no lo está ya).
2. En el repositorio, ve a **Settings → Pages**.
3. En **Source**, elige la rama `main` (o la rama donde esté este código) y la carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL tipo `https://tuusuario.github.io/Aplicacion-paletera/`.
5. Espera 1-2 minutos y abre esa URL desde el móvil.

## Paso 3 — Configurar cada móvil (tuyo y el de tu padre)

1. Abre la URL de la app en el navegador del móvil.
2. Escribe tu nombre (para que el historial diga quién hizo cada movimiento).
3. Escribe un **código de sala** — puede ser cualquier palabra, por ejemplo `familia-perez-palets`. **Debes escribir el mismo código exacto en los dos móviles.**
4. Despliega "Configuración de Firebase" y pega el bloque `firebaseConfig` que copiaste en el Paso 1 (en los dos móviles, es el mismo).
5. Pulsa **Empezar**.
6. Repite en el otro móvil con el mismo código de sala y el mismo `firebaseConfig` (solo cambia el nombre de cada persona).

### Añadir la app a la pantalla de inicio (recomendado)

- **Android (Chrome)**: menú (⋮) → "Añadir a pantalla de inicio".
- **iPhone (Safari)**: botón compartir → "Añadir a pantalla de inicio".

Así se abre como una app normal, con icono propio.

## Uso de la app

- **Dinero disponible**: saldo total y cuántos billetes de 50€, 20€, 10€ y 5€ hay actualmente.
- **➕ Ingresar dinero**: indica cuántos billetes de cada tipo añades (y opcionalmente una cantidad en "sueltos/otros" para monedas o importes que no sean billetes exactos). Puedes añadir una nota, por ejemplo "Venta de palets".
- **➖ Retirar dinero**: igual, pero resta billetes. La app no deja retirar más billetes de los que hay registrados.
- **Historial**: lista de todos los ingresos y retiradas, con quién los hizo y cuándo.
- Todo se sincroniza automáticamente entre los móviles que usen el mismo código de sala.

## Estructura del proyecto

```
index.html      Pantallas (configuración inicial + app principal + modales)
styles.css      Estilos (mobile-first)
app.js          Lógica de la app y sincronización con Firestore
manifest.json   Configuración de la PWA (instalable en el móvil)
sw.js           Service worker (funciona parcialmente offline)
icons/          Iconos de la app
```

No requiere `npm install` ni proceso de compilación: son archivos estáticos que se pueden abrir directamente o publicar en cualquier hosting estático (GitHub Pages, Netlify, Vercel, Firebase Hosting, etc.).
