# 🐟 Atún Chat

Chat en tiempo real minimalista, privado y efímero. Rooms protegidos por código, mensajes que se autodestruyen y fotos que desaparecen sin dejar rastro. Nada de cuentas, nada de logs permanentes, nada de drama.

---

## Características

- **Rooms privados** — acceso mediante código de invitación
- **Mensajes autodestructivos** — se eliminan en todos los clientes tras N segundos
- **Fotos efímeras** — nunca se persisten en disco; solo llegan al momento
- **Historial limitado** — máximo 45 mensajes por room, guardados en `rooms.json`
- **Rate limiting** — 450ms mínimo entre mensajes por socket
- **Indicador de typing** en tiempo real
- **Modo pánico** — limpia el chat del lado cliente instantáneamente
- **Borrado de sala** — con código `DELETE_CODE` dedicado

---

## Stack

- **Backend:** Node.js + Express + Socket.IO
- **Frontend:** HTML/CSS/JS vanilla (un solo archivo `index.html`)
- **Persistencia:** archivo local `rooms.json`

---

## Instalación

```bash
npm install
```

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VALID_CODES` | Códigos de acceso separados por coma | `abc123,xyz789` |
| `DELETE_CODE` | Código para borrar el historial de una sala | `supersecret` |
| `PORT` | Puerto del servidor (default: 8080) | `3000` |

---

## Uso

```bash
# Desarrollo
VALID_CODES=demo123 DELETE_CODE=borrame node server.js

# Con PM2
pm2 start server.js --name atun-chat
```

Luego abre `http://localhost:8080` en el navegador.

---

## Estructura

```
.
├── index.html      # Frontend completo (un solo archivo)
├── server.js       # Backend con Socket.IO
├── rooms.json      # Historial persistido (se crea automáticamente)
└── favicon.ico
```

---

## Notas

- Las fotos **nunca** se guardan en historial. Solo se emite un ghost text `"envió una lata de atún."` como rastro.
- `rooms.json` se guarda cada 15 segundos automáticamente.
- No hay autenticación de usuarios, solo validación de código de sala.
