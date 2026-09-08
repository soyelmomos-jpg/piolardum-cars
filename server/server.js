const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Servir los archivos estáticos del juego (raíz del proyecto)
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Estado del juego en el servidor
const players = new Map(); // id -> {id, name, x, y, z, rot, color}

// Colores disponibles para los jugadores
const COLORS = [0xff3333, 0x33ff33, 0x3333ff, 0xffcc00, 0xff66ff, 0x00ffff];

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 8);
  const color = COLORS[players.size % COLORS.length];

  players.set(id, {
    id,
    color,
    name: 'Auto ' + id.toUpperCase(),
    x: Math.random() * 60 - 30,
    y: 0,
    z: Math.random() * 60 - 30,
    rot: 0,
    hp: 100,
  });

  ws.id = id;

  // Enviar al nuevo jugador su id
  ws.send(JSON.stringify({ type: 'welcome', id, color, players: [...players.values()] }));

  // Avisar a los demás que alguien se unió
  broadcast({
    type: 'join',
    player: players.get(id),
  }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.type) {
      case 'move':
        const p = players.get(id);
        if (!p) return;
        p.x = msg.x; p.y = msg.y; p.z = msg.z; p.rot = msg.rot;
        broadcast({ type: 'move', id, x: p.x, y: p.y, z: p.z, rot: p.rot }, ws);
        break;

      case 'shoot':
        broadcast({ type: 'shoot', id, sx: msg.sx, sy: msg.sy, sz: msg.sz,
          tx: msg.tx, ty: msg.ty, tz: msg.tz, weapon: msg.weapon }, ws);
        break;

      case 'explode':
        broadcast({ type: 'explode', id, ex: msg.ex, ey: msg.ey, ez: msg.ez,
          weapon: msg.weapon }, ws);
        break;

      case 'hit':
        // msg.targetId = quien recibe el daño
        const target = players.get(msg.targetId);
        if (!target) return;
        const dmg = msg.weapon === 'bazooka' ? 50 : 20;
        target.hp -= dmg;
        ws.send(JSON.stringify({ type: 'hitConfirmation', targetId: msg.targetId, dmg, hp: target.hp }));
        broadcast({ type: 'damage', id: msg.targetId, dmg, hp: target.hp, hpMax: 100 }, ws, ws);
        if (target.hp <= 0) {
          // respawn
          target.hp = 100;
          target.x = Math.random() * 60 - 30;
          target.z = Math.random() * 60 - 30;
          broadcast({ type: 'respawn', id: msg.targetId, x: target.x, z: target.z }, ws);
        }
        break;

      case 'name':
        const pl = players.get(id);
        if (pl && typeof msg.name === 'string') {
          pl.name = msg.name.slice(0, 20);
          broadcast({ type: 'name', id, name: pl.name }, ws);
        }
        break;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
  });
});

function broadcast(data, except) {
  const str = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client !== except) {
      client.send(str);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Piolardum Cars corriendo en el puerto ${PORT}`);
});
