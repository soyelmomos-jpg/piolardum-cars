# 🚗 PIOLARDUM CARS

Un juego 3D de **autos, armas y explosiones** que se juega **desde el celular**. Es **online**: podés jugar con amigos. Cada uno maniobra su auto con un joystick táctil, dispara con pistola o bazuca, y hace explotar todo lo que se cruce.

## ✨ Features

- 🚗 **Autos low-poly** con nombre y color único por jugador
- 🔫 **Pistola** (disparo rápido) y 💣 **Bazuca** (explosiones grandes)
- 🧨 **Explosiones con partículas y luz** (espectacular)
- 📱 **Totalmente táctil**: joystick + botones, pensado para celular
- 🌐 **Online en tiempo real** vía WebSocket (hasta donde aguante el server)
- 🗺️ Arena con obstáculos y bordes

## 🎮 Cómo jugar

**En el celular** es donde brilla:

- **Joystick izquierdo**: movés el auto (arriba = acelerar, abajo = reversa, izquierda/derecha = girar)
- **Botón rojo (🔫)**: disparar
- **Botón naranja (💣)**: cambiar de arma

**En la PC** también funciona con el mouse (arrastrá el joystick, clickeá para disparar).

## 🛠️ Cómo correrlo

### 1. Levantar el servidor

```bash
npm install
npm start
# Piolardum Cars corriendo en el puerto 8080
```

### 2. Jugar online

- En la **misma red wifi**: entrá desde el celular a `http://IP-DE-TU-PC:8080`
- Los jugadores se pueden conectar a la misma IP y se ven en tiempo real
- Si el server está en un servicio cloud (Render, Railway, Fly.io), todos pueden jugar desde cualquier lado

## ☁️ Publicar el juego en GitHub

### Opción A: Juego en GitHub Pages + server gratis en la nube

1. Subí este repo a GitHub
2. Activá **GitHub Pages** (branch `master`, carpeta `/`) → así el juego queda accesible desde `https://TU-USUARIO.github.io/PIOLARDUM-CARS/`
3. Desplegá el servidor en un servicio gratis tipo Render/Railway:
   - Comando de inicio: `npm start`
   - Obtenés una URL tipo `https://piolardum-cars.onrender.com`
4. En el menú del juego, poné `wss://tu-server.onrender.com` como servidor → **todos online desde cualquier lado!**

> Importante: el server debe escuchar en el puerto que asigna la plataforma (usá la variable `PORT`). Ya está preparado.

### Opción B: Solo GitHub Pages (sin online)

Si querés probar el juego solo (sin multijugador), podés publicar todo en Pages y jugar localmente. El online necesita el server corriendo.

## 🧪 Testear el sistema online

```bash
node test-online.js  # con el server corriendo en otro terminal
```

## 🧩 Recursos

| Recurso | Detalle |
|---|---|
| Graphics 3D | Three.js (v0.160) desde CDN |
| Online | `ws` (WebSocket) |
| Server | Node.js + Express |

Hecho con ❤️ para que sea **bien piolardum** 🇦🇷