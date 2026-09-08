// Piolardum Cars - Juego principal
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ---------- CONSTANTES ----------
const COLORS = [0xff3333, 0x33ff33, 0x3333ff, 0xffcc00, 0xff66ff, 0x00ffff];
const MAP_SIZE = 120; // arena cuadrada
const FIRE_RATE = { pistol: 250, bazooka: 900 }; // ms entre disparos
const DMG = { pistol: 15, bazooka: 50 };
const SPEED = 22;

// ---------- ESTADO DEL JUGADOR ----------
const myState = {
  id: null,
  color: 0xff7b00,
  name: '',
  hp: 100,
  hpMax: 100,
  weapon: 'pistol',
  lastShot: 0,
  alive: true,
  inputX: 0,
  inputY: 0,
  aiming: false,
};

// ---------- ELEMENTOS ----------
const canvas = document.getElementById('game-canvas');
let renderer, scene, camera;
let myCar, myGun;
const otherPlayers = new Map(); // id -> {car, gun, nameSprite}
const explosions = new Map(); // id -> explosion object
const bullets = []; // {mesh, velocity, from, weapon, life}
const particles = [];
const obstacles = [];

let ws = null;
let lastSentMove = 0;
let score = 0;

// ---------- SCENE SETUP ----------
function initScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0d12, 80, 220);

  // Fondo de skybox con la imagen del espacio
  new THREE.TextureLoader().load('textures/espacio.png', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
  });

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 22, 28);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff5e6, 1.6);
  dir.position.set(40, 60, 30);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  // Arena
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Bordes / paredes de la arena
  buildWalls();

  // Obstáculos: cajas destructibles
  for (let i = 0; i < 12; i++) {
    addBox(
      Math.random() * (MAP_SIZE - 20) - (MAP_SIZE - 20) / 2,
      Math.random() * (MAP_SIZE - 20) - (MAP_SIZE - 20) / 2
    );
  }

  // Grid sutil
  const grid = new THREE.GridHelper(MAP_SIZE, 24, 0x55555f, 0x2a2a30);
  grid.position.y = 0.02;
  scene.add(grid);

  // Crea mi auto y arma
  myCar = createCar(myState.color);
  scene.add(myCar.group);
  myGun = createGun();
  scene.add(myGun);

  resize();
  window.addEventListener('resize', resize);
}

function buildWalls() {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x11131a, emissive: 0x221100 });
  const half = MAP_SIZE / 2;
  const wallGeo = new THREE.BoxGeometry(MAP_SIZE, 4, 2);
  const wallGeo2 = new THREE.BoxGeometry(2, 4, MAP_SIZE);

  const positions = [
    [0, 0, half], [0, 0, -half],
    [half, 0, 0], [-half, 0, 0],
  ];
  for (const [x, y, z] of positions) {
    const wall = new THREE.Mesh(z === 0 ? wallGeo2 : wallGeo, wallMat);
    wall.position.set(x, 2, z);
    wall.castShadow = true;
    scene.add(wall);
  }
}

function addBox(x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a6d3b });
  const size = 3 + Math.random() * 4;
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
  box.position.set(x, size / 2, z);
  box.castShadow = true;
  box.receiveShadow = true;
  box.traverse((m) => { m.userData.isObstacle = true; });
  obstacles.push(box);
  scene.add(box);
}

// ---------- AUTO ----------
function createCar(color) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  // Chasis principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Cabina
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2), darkMat);
  cabin.position.set(0, 1.35, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Ruedas
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const wheelPositions = [[1.1, 0.45, 1.4], [-1.1, 0.45, 1.4], [1.1, 0.45, -1.4], [-1.1, 0.45, -1.4]];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    group.add(w);
  }

  // Faros
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffcc, emissive: 0xffdd66, emissiveIntensity: 0.8,
  });
  const lightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.15);
  for (const lx of [0.8, -0.8]) {
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(lx, 0.85, 2.2);
    group.add(light);
  }

  // Puntero de la mira (dirección)
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff6600 }));
  pointer.rotation.x = Math.PI / 2;
  pointer.position.set(0, 0.4, -2.2);
  group.add(pointer);

  group.userData.pointer = pointer;

  return { group };
}

// ---------- ARMAS ----------
function createGun() {
  const gun = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.3 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8),
    metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 1;
  gun.add(barrel);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), metalMat);
  handle.position.set(0, -0.55, 0.3);
  gun.add(handle);

  // Fogonazo (flash) - oculto por defecto
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffcc44, transparent: true, opacity: 0, depthWrite: false,
  });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), flashMat);
  flash.position.set(0, 0, 1.4);
  gun.add(flash);
  gun.userData.flash = flash;

  return gun;
}

// ---------- EXPLOSIONES ----------
function spawnExplosion(x, y, z, big) {
  const scale = big ? 3 : 1.2;
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffaa22, transparent: true, opacity: 1, depthWrite: false,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1 * scale, 10, 10), mat);
  ball.position.set(x, y + 0.5, z);
  scene.add(ball);

  const id = Math.random().toString(36);
  explosions.set(id, { mesh: ball, life: 1, maxLife: big ? 0.9 : 0.5, scale, big });

  // Partículas (chispas)
  for (let i = 0; i < (big ? 40 : 15); i++) {
    const pMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffaa22 : 0xff5500 });
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), pMat);
    p.position.set(x, y + 0.4, z);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * (big ? 18 : 8),
      Math.random() * (big ? 14 : 6),
      (Math.random() - 0.5) * (big ? 18 : 8)
    );
    scene.add(p);
    particles.push({ mesh: p, vel, life: big ? 1.2 : 0.7, maxLife: big ? 1.2 : 0.7 });
  }

  // Luz puntual para la explosión
  const light = new THREE.PointLight(0xff6600, big ? 4 : 1.5, big ? 40 : 20);
  light.position.set(x, y + 2, z);
  scene.add(light);
  // se agrega al objeto de explosión para quitar después
  const exp = explosions.get(id);
  exp.light = light;

  return id;
}

function removeExplosion(id) {
  const exp = explosions.get(id);
  if (!exp) return;
  scene.remove(exp.mesh);
  if (exp.light) scene.remove(exp.light);
  explosions.delete(id);
}

// ---------- BALAS ----------
function spawnBullet(from, target, weapon, owner = null) {
  const isBazooka = weapon === 'bazooka';
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(isBazooka ? 0.25 : 0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: isBazooka ? 0xff9900 : 0xffff66 })
  );
  mesh.position.copy(from);
  scene.add(mesh);

  const dir = new THREE.Vector3().subVectors(target, from).normalize();
  bullets.push({
    mesh, pos: from.clone(), vel: dir.multiplyScalar(isBazooka ? 60 : 90),
    weapon, life: 3, from, owner,
  });
}

// ---------- NOMBRES ----------
function makeNameSprite(name, color) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(name, 132, 36);
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fillText(name, 130, 34);

  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 1.25, 1);
  sprite.position.y = 2.6;
  return sprite;
}

// ---------- OTROS JUGADORES ----------
function addOtherPlayer(p) {
  const color = p.color !== undefined ? p.color : 0xff3333;
  const car = createCar(color);
  car.group.position.set(p.x, 0, p.z);
  car.group.rotation.y = p.rot || 0;
  const nameSprite = makeNameSprite(p.name, color);
  nameSprite.position.set(p.x, 2.6, p.z);
  scene.add(nameSprite);
  scene.add(car.group);

  otherPlayers.set(p.id, { car, nameSprite, lastSync: 0, hp: p.hp ?? 100 });
}

function removeOtherPlayer(id) {
  const p = otherPlayers.get(id);
  if (!p) return;
  scene.remove(p.car.group);
  scene.remove(p.nameSprite);
  otherPlayers.delete(id);
}

// ---------- JOYSTICK TÁCTIL ----------
const joystickArea = document.getElementById('joystick-area');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const shootBtn = document.getElementById('shoot-btn');
const weaponBtn = document.getElementById('weapon-btn');

let joyActive = false;
let joyCenter = { x: 0, y: 0 };
const JOY_RADIUS = 42;

function onJoystickStart(e) {
  joyActive = true;
  const rect = joystickArea.getBoundingClientRect();
  joyCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  updateJoystick(e);
}

function onJoystickMove(e) {
  if (!joyActive) return;
  updateJoystick(e);
}

function updateJoystick(e) {
  const t = e.touches ? e.touches[0] : e;
  let dx = (t.clientX - joyCenter.x);
  let dy = (t.clientY - joyCenter.y);
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) {
    dx = (dx / len) * JOY_RADIUS;
    dy = (dy / len) * JOY_RADIUS;
  }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

  // Normalizado 0..1
  myState.inputX = dx / JOY_RADIUS;
  myState.inputY = -(dy / JOY_RADIUS); // invertir Y para que "adelante" sea arriba
}

function onJoystickEnd() {
  joyActive = false;
  myState.inputX = 0;
  myState.inputY = 0;
  joystickKnob.style.transform = 'translate(0,0)';
}

joystickArea.addEventListener('touchstart', onJoystickStart, { passive: false });
joystickArea.addEventListener('touchmove', onJoystickMove, { passive: false });
joystickArea.addEventListener('touchend', onJoystickEnd);
joystickArea.addEventListener('touchcancel', onJoystickEnd);

// Disparo
shootBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
  fire();
}, { passive: false });

weaponBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
  switchWeapon();
}, { passive: false });

// También para mouse/desktop (testing)
joystickArea.addEventListener('mousedown', onJoystickStart);
window.addEventListener('mousemove', onJoystickMove);
window.addEventListener('mouseup', onJoystickEnd);
shootBtn.addEventListener('mousedown', fire);
weaponBtn.addEventListener('click', switchWeapon);

// ---------- TECLADO (PC) ----------
const keys = {};
const modeBtn = document.getElementById('mode-btn');

// Autodetección: pantalla táctil chica => celular, si no => PC
let inputMode = (navigator.maxTouchPoints > 0 && window.innerWidth < 840) ? 'mobile' : 'pc';
applyInputMode();

function applyInputMode() {
  const isPc = inputMode === 'pc';
  document.getElementById('controls').style.display = isPc ? 'none' : 'block';
  modeBtn.textContent = isPc ? '📱 MODO CELULAR' : '⌨️ MODO PC';
  myState.inputX = 0;
  myState.inputY = 0;
}

function toggleInputMode() {
  inputMode = inputMode === 'pc' ? 'mobile' : 'pc';
  applyInputMode();
}

modeBtn.addEventListener('click', toggleInputMode);

window.addEventListener('keydown', (e) => {
  if (inputMode !== 'pc') return;
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (!e.repeat) {
    if (e.code === 'KeyE') switchWeapon();
    if (e.code === 'Space') fire(); // el cooldown de fuego maneja el resto
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// Seguro: si la ventana pierde el foco (alt-tab, clic afuera), soltar todas las teclas
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});

// ---------- ARMAS: DISPARAR ----------
function fire() {
  if (!myState.alive) return;
  const now = performance.now();
  if (now - myState.lastShot < FIRE_RATE[myState.weapon]) return;
  myState.lastShot = now;

  const from = myCar.group.position.clone();
  from.y = 1.2;

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(myCar.group.quaternion);
  const target = from.clone().add(forward.multiplyScalar(80));
  target.y += 3;

  spawnBullet(from, target, myState.weapon, myState.id);
  muzzleFlash();

  // notificar a todos
  send({ type: 'shoot', sx: from.x, sy: from.y, sz: from.z,
    tx: target.x, ty: target.y, tz: target.z, weapon: myState.weapon });
}

function muzzleFlash() {
  const flash = myGun.userData.flash;
  flash.material.opacity = 1;
  setTimeout(() => {
    if (flash) flash.material.opacity = 0;
  }, 60);
}

function switchWeapon() {
  myState.weapon = myState.weapon === 'pistol' ? 'bazooka' : 'pistol';
  document.getElementById('weapon-indicator').textContent =
    myState.weapon === 'pistol' ? '🔫 PISTOLA' : '💣 BAZUCA';
}

// ---------- SOCKETS ----------
function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    const timer = setTimeout(() => {
      try { ws.close(); } catch (e) { /* noop */ }
      reject(new Error('Timeout de conexión'));
    }, 3000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('No se pudo conectar al servidor'));
    };
    ws.onmessage = (event) => handleServerMessage(event.data);
    ws.onclose = () => { console.log('Desconectado del servidor'); };
  });
}

function handleServerMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }

  switch (msg.type) {
    case 'welcome':
      myState.id = msg.id;
      myState.color = msg.color;
      myState.hpMax = 100;
      myState.hp = 100;
      // reconstruir auto con mi color
      scene.remove(myCar.group);
      scene.remove(myGun);
      myCar = createCar(myState.color);
      scene.add(myCar.group);
      myGun = createGun();
      scene.add(myGun);

      if (msg.players) {
        msg.players.forEach((p) => { if (p.id !== myState.id) addOtherPlayer(p); });
      }
      updateWeaponIndicator();
      break;

    case 'join':
      addOtherPlayer(msg.player);
      break;

    case 'leave':
      removeOtherPlayer(msg.id);
      break;

    case 'move':
      const p = otherPlayers.get(msg.id);
      if (p) {
        p.car.group.position.set(msg.x, 0, msg.z);
        p.car.group.rotation.y = msg.rot;
        p.nameSprite.position.set(msg.x, 2.6, msg.z);
        p.nameSprite.rotation.y = msg.rot;
      }
      break;

    case 'shoot':
      onOtherShoot(msg);
      break;

    case 'explode':
      spawnExplosion(msg.ex, msg.ey, msg.ez, msg.weapon === 'bazooka');
      break;

    case 'damage':
      if (msg.id === myState.id) {
        if (!myState.alive) return;
        myState.hp = Math.max(0, msg.hp);
        updateHpBar();
        if (myState.hp <= 0) die();
      } else {
        const player = otherPlayers.get(msg.id);
        if (player) player.hp = msg.hp;
      }
      break;

    case 'hitConfirmation':
      // feedback de que hiciste daño
      break;

    case 'respawn':
      if (msg.id === myState.id) respawn();
      break;
  }
}

function onOtherShoot(msg) {
  spawnBullet(new THREE.Vector3(msg.sx, msg.sy, msg.sz),
    new THREE.Vector3(msg.tx, msg.ty, msg.tz), msg.weapon);
}

// ---------- HUD ----------
function updateHpBar() {
  const fill = document.getElementById('hp-fill');
  fill.style.width = Math.max(0, (myState.hp / myState.hpMax) * 100) + '%';
}

function updateWeaponIndicator() {
  const el = document.getElementById('weapon-indicator');
  el.textContent = myState.weapon === 'pistol' ? '🔫 PISTOLA' : '💣 BAZUCA';
}

function die() {
  myState.alive = false;
  myCar.group.visible = false;
  myGun.visible = false;
  spawnExplosion(myCar.group.position.x, myCar.group.position.y + 1, myCar.group.position.z, true);
}

function respawn() {
  myState.alive = true;
  myState.hp = myState.hpMax;
  updateHpBar();
  myCar.group.visible = true;
  myGun.visible = true;
  myCar.group.position.set(Math.random() * (MAP_SIZE - 20) - (MAP_SIZE - 20) / 2, 0,
    Math.random() * (MAP_SIZE - 20) - (MAP_SIZE - 20) / 2);
}

// ---------- GAME LOOP ----------
function updateGun() {
  // el arma se coloca delante del auto, apuntando hacia adelante
  myGun.position.copy(myCar.group.position);
  myGun.position.y = 1.4;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(myCar.group.quaternion);
  myGun.position.add(forward.multiplyScalar(2.2));
  myGun.rotation.copy(myCar.group.rotation);
  myGun.rotation.y += Math.PI;
  // pequeña oscilación
  myGun.rotation.x = Math.sin(performance.now() / 400) * 0.05;

  // mira en tercera persona: cámara sigue al auto con rotación opuesta
  camera.position.x = myCar.group.position.x + Math.sin(myCar.group.rotation.y) * 12; // offset atrás
  camera.position.z = myCar.group.position.z + Math.cos(myCar.group.rotation.y) * 12;
  camera.position.y = 9;
  camera.lookAt(myCar.group.position.x, 1, myCar.group.position.z);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.pos.add(b.vel.clone().multiplyScalar(dt));
    b.mesh.position.copy(b.pos);
    b.life -= dt;

    let removed = false;

    // colisión con otros jugadores
    otherPlayers.forEach((p, pid) => {
      if (removed) return;
      if (pid !== b.owner && p.car.group.position.distanceTo(b.pos) < 2.2) {
        removed = true;
        if (b.weapon === 'bazooka') {
          spawnExplosion(b.pos.x, b.pos.y, b.pos.z, true);
          send({ type: 'explode', ex: b.pos.x, ey: b.pos.y, ez: b.pos.z, weapon: b.weapon });
        }
        if (b.owner && b.owner === myState.id) {
          send({ type: 'hit', targetId: pid, weapon: b.weapon, x: b.pos.x, z: b.pos.z });
        }
      }
    });

    if (removed) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    // colisión con obstáculos: la destruyo (las cajas no se destruyen, la bala sí)
    // verifica contra cajas almacenadas
    for (const obs of obstacles) {
      if (removed) break;
      const box = new THREE.Box3().setFromObject(obs);
      if (box.containsPoint(b.pos)) {
        removed = true;
        if (b.weapon === 'bazooka') {
          spawnExplosion(b.pos.x, b.pos.y, b.pos.z, true);
          send({ type: 'explode', ex: b.pos.x, ey: b.pos.y, ez: b.pos.z, weapon: b.weapon });
        }
      }
    }

    if (removed) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }
}

function updateExplosions(dt) {
  explosions.forEach((exp, id) => {
    exp.life -= dt;
    const t = 1 - exp.life / exp.maxLife;
    exp.mesh.scale.setScalar(1 + t * (exp.big ? 8 : 4));
    exp.mesh.material.opacity = Math.max(0, 1 - t);
    if (exp.big) exp.mesh.material.color.setHSL(0.08, 1, 0.5 * (1 - t));
    if (exp.life <= 0) removeExplosion(id);
  });

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.vel.y -= 13 * dt;
    p.life -= dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

function sendMove() {
  const now = performance.now();
  if (now - lastSentMove < 50) return; // 20 fps
  lastSentMove = now;
  send({
    type: 'move',
    x: myCar.group.position.x,
    y: 0,
    z: myCar.group.position.z,
    rot: myCar.group.rotation.y,
  });
}

// ---------- LOOP ----------
let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  // teclado (WASD) en modo PC: se calcula cada frame y se resetea a 0 al soltar
  if (inputMode === 'pc') {
    myState.inputX = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    myState.inputY = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  }

  // auto: input del joystick/teclado
  const dirY = myState.inputY; // -1 atrás, 1 adelante
  // giro
  if (myState.inputX !== 0) {
    const turn = 2.5 * myState.inputX;
    myCar.group.rotation.y -= turn * dt * (dirY === 0 ? 1 : dirY);
  }
  // avance
  myCar.group.position.add(
    new THREE.Vector3(0, 0, -1)
      .applyQuaternion(myCar.group.quaternion)
      .multiplyScalar(SPEED * dirY * dt)
  );

  // límites
  const half = MAP_SIZE / 2 - 3;
  myCar.group.position.x = THREE.MathUtils.clamp(myCar.group.position.x, -half, half);
  myCar.group.position.z = THREE.MathUtils.clamp(myCar.group.position.z, -half, half);

  updateGun();
  updateBullets(dt);
  updateExplosions(dt);

  // otros autos se colocan de forma suave desde su última posición
  otherPlayers.forEach((p) => {
    // (las posiciones vienen del server)
  });

  sendMove();

  renderer.render(scene, camera);
}

// ---------- RESIZE ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---------- INICIO ----------
let started = false;

async function startGame() {
  if (started) return;
  started = true;

  const name = document.getElementById('name-input').value || 'Piolardum';
  const serverInput = document.getElementById('server-input').value.trim();

  let serverUrl = serverInput;
  if (!serverUrl) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    serverUrl = `${proto}//${location.host}`;
  }

  document.getElementById('menu').style.display = 'none';
  document.getElementById('game').style.display = 'block';

  initScene();
  myState.name = name;

  // Solo/malo: si el server no responde, se juega igual en modo solitario
  try {
    await connect(serverUrl);
    send({ type: 'name', name });
  } catch (err) {
    console.warn('Sin servidor online, se juega en modo solitario');
    myState.id = 'local';
  }
  updateHpBar();
  animate(0);
}

document.getElementById('play-btn').addEventListener('click', startGame);

// Mostrar hint del server default
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
document.getElementById('server-input').placeholder = `${proto}//${location.host}`;