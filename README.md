# 🎼 MusiTest

**Plataforma profesional de evaluaciones musicales online**

> Kabert Pro - LMKE

---

## 🚀 Despliegue en GitHub Pages

1. Sube `index.html` a tu repositorio: `https://github.com/kabertpro/musitest`
2. Ve a **Settings → Pages → Source: main branch / root**
3. ¡Listo! La plataforma estará disponible en `https://kabertpro.github.io/musitest`

---

## ⚙️ Configuración Firebase

La app ya usa tu proyecto Firebase configurado. Solo asegúrate de habilitar en Firebase Console:

- **Realtime Database** → Modo de prueba (o configura reglas)
- No se necesita Authentication

**Reglas recomendadas para Realtime Database:**
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
*(Para producción, endurece estas reglas según tus necesidades)*

---

## 🔑 Acceso Administrador

- El botón **⚙️** aparece en la esquina inferior derecha
- Contraseña por defecto: `admin123`
- Para cambiarla, edita la línea en `script.js`:
  ```js
  ADMIN_PASS: 'admin123',
  ```

---

## 👁️ Convertir a Versión Estudiante (sin acceso admin)

Para eliminar el acceso administrador y distribuir la app como versión estudiante:

**Opción A — Ocultar botón (más rápido):**
```html
<!-- Agregar clase "hidden" -->
<button id="admin-access-btn" class="hidden" ...>
```

**Opción B — Eliminar completamente:**
Elimina el bloque HTML con `id="admin-access-btn"` (línea ~178 aproximadamente).

La aplicación seguirá funcionando perfectamente para estudiantes sin ningún acceso admin visible.

---

## 📋 Formato de Importación TXT

```
1. ¿Cuál es la capital de Bolivia?
A. Santa Cruz
B. Cochabamba
C. Sucre R
D. La Paz

2. ¿Cuántas notas musicales existen?
A. 7 R
B. 5
C. 8
D. 12
```

La letra **R** al final de la opción indica la respuesta correcta. El sistema la detecta automáticamente y la elimina de la vista del estudiante.

---

## ✨ Funcionalidades

| Función | Estudiante | Admin |
|---------|-----------|-------|
| Registro con usuario/contraseña | ✅ | - |
| Login multidispositivo | ✅ | - |
| Evaluaciones con aleatorización | ✅ | - |
| Historial de evaluaciones | ✅ | - |
| Descarga PDF | ✅ | ✅ |
| Restauración automática | ✅ | - |
| Crear/importar tests TXT | - | ✅ |
| Biblioteca de tests | - | ✅ |
| Monitor en tiempo real | - | ✅ |
| Controlar evaluación | - | ✅ |
| Gestionar estudiantes | - | ✅ |
| Ver resultados completos | - | ✅ |

---

## 📱 Compatible con

- ✅ Celulares (Android / iOS)
- ✅ Tablets
- ✅ Computadoras (Windows / Mac / Linux)
- ✅ GitHub Pages
- ✅ Cualquier hosting estático

---

*Kabert Pro - LMKE*
