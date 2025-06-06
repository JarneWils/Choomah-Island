import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { World } from './world';
// import { createUI } from './ui';
import { Player } from './player';
import { io } from 'socket.io-client';
import { ControlPanel } from './controlPanel';
import { GunManager } from './gunManager.js';
import { setupEnvironment, updateDayNightCycle } from './environment.js';

const gunHand = document.querySelector('.gun-holder');
const startScreen = document.querySelector('.start-container');
const startButton = document.querySelector('.start-button');
const mapSelect = document.getElementById('map-select');
const hitScreen = document.querySelector('.hit');
const dieScreen = document.querySelector('.die');
const hpContainer = document.querySelector('.hp-container');

const backgroundAudio = document.querySelector('#background-audio');
const hitAudios = [
  document.querySelector('#hit1-audio'),
  document.querySelector('#hit2-audio'),
  document.querySelector('#hit3-audio'),
  document.querySelector('#hit4-audio'),
];
const dieAudio = document.querySelector('#die-audio');

const removeAudio = document.querySelector('#block-remove-audio');

let lives = 5;

let isStart = true;

if (isStart) {
  startScreen.style.display = 'none';
} else if (!isStart) {
  startScreen.style.display = 'none';
}

const controlPanel = new ControlPanel();
controlPanel.startListening();

//-------------------------------------------------------------------------------------------------
//-------------------------------------------------SERVER------------------------------------------
//-------------------------------------------------------------------------------------------------

const socket = io(import.meta.env.PROD ? undefined : 'http://localhost:3000');

let localPlayerId = null;
let lastGunActiveState = false;
let gunManager = null;

// players
let player = null;
socket.on('connect', () => {
  socket.on('currentPlayers', players => {
    for (const id in players) {
      if (id !== localPlayerId) {
        Player.addRemotePlayer(id, scene);
      }
    }
  });

  localPlayerId = socket.id;
  const x = Math.floor(Math.random() * 60) + 1;
  const y = Math.floor(Math.random() * 60) + 1;
  const spawnPosition = new THREE.Vector3(x, 42, y);

  player = new Player(
    playerCamera,
    renderer,
    world.size.width,
    scene,
    world,
    localPlayerId,
    socket,
    spawnPosition
  );

  scene.add(player.controls.object);
  gunManager = new GunManager(
    playerCamera,
    scene,
    controlPanel,
    socket,
    localPlayerId,
    world,
    Player
  );

  socket.on('bulletFired', data => {
    if (!gunManager || data.id === localPlayerId) return;

    gunManager.spawnBullet(
      new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z),
      new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z),
      true,
      data.id
    );
  });

  animate();
});

socket.on('newPlayer', playerData => {
  if (playerData.id !== localPlayerId) {
    Player.addRemotePlayer(playerData.id, scene);
  }
});

socket.on('playerMoved', data => {
  Player.updateRemotePlayer(data.id, data);
});

socket.on('playerDisconnected', id => {
  Player.removeRemotePlayer(id, scene);
});

let lastHitTime = 0; // Zorg dat dit ergens globaal staat

socket.on('playerHit', ({ hitPlayerId, shooterId }) => {
  const now = Date.now();

  if (now - lastHitTime < 200) {
    // Te snel achter elkaar? Ignore event
    return;
  }
  lastHitTime = now;

  // Jij bent geraakt door een ander
  if (hitPlayerId === localPlayerId && shooterId !== localPlayerId) {
    console.log(`Je bent geraakt door speler ${shooterId}`);

    if (lives > 0) {
      lives--;

      // Speel hit geluid
      const randomIndex = Math.floor(Math.random() * hitAudios.length);
      const audioClone = hitAudios[randomIndex].cloneNode();
      audioClone.play();

      // Verwijder een hartje uit de UI
      const hartjes = hpContainer.querySelectorAll('.hartje');
      if (hartjes.length > 0) {
        const lastHartje = hartjes[hartjes.length - 1];
        hpContainer.removeChild(lastHartje);
      }
    }

    // Toon hit scherm (rood flash)
    hitScreen.style.display = 'block';
    setTimeout(() => {
      hitScreen.style.display = 'none';
    }, 500);

    // Check of de speler dood is
    if (lives <= 0) {
      Player.removeRemotePlayer(hitPlayerId);
      dieAudio.play();
      backgroundAudio.pause();
      gunManager.setActive(false);
      dieScreen.style.display = 'block';
      setTimeout(() => {
        window.location.reload(true);
      }, 1500);
    }
  }
});

socket.on('removeBlock', ({ x, y, z }) => {
  world.applyBlockRemoval(x, y, z); // NIET .removeBlock gebruiken
});

socket.on('mapChanged', ({ map }) => {
  if (map !== selectedMap) {
    console.log(`🔄 Wereld verandert naar map: ${map}`);
    selectedMap = map;

    // Verwijder oude wereld
    scene.remove(world);

    // Genereer nieuwe wereld
    world = new World(selectedMap, socket);
    world.generate();
    scene.add(world);
  }
});

//-------------------------------------------------------------------------------------------------
//-------------------------------------------------Main Script-------------------------------------
//-------------------------------------------------------------------------------------------------

const stats = new Stats();
document.body.append(stats.dom);

// render
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// camera
const playerCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
playerCamera.position.set(25, 20, 20);

// Orbit camera
const orbitCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
orbitCamera.position.set(25, 20, 25);

// scene
const scene = new THREE.Scene();
let selectedMap = 'map4'; // standaardwaarde
let world = new World(selectedMap, socket);
world.generate();
scene.add(world);

mapSelect.addEventListener('change', () => {
  // Verwijder de oude wereld van de scene
  scene.remove(world);

  // Update de geselecteerde map
  selectedMap = mapSelect.value;

  // ✉️ Stuur de gekozen map naar de server
  socket.emit('mapChanged', { map: selectedMap });

  // Maak een nieuwe wereld aan
  world = new World(selectedMap, socket);
  world.generate();
  scene.add(world);
});

// environment
const lights = setupEnvironment(scene, world);
const cycleParams = {
  dayDuration: 20,
  dawnDuration: 1,
  nightDuration: 20,
  fadeDuration: 15,
};
let clock = new THREE.Clock();

// Fog
// let isFog = true;
// if (isFog === true) {
//   scene.fog = new THREE.Fog(fogColor, 5, 50);
// }

// controls
const controls = new OrbitControls(orbitCamera, renderer.domElement);
controls.target.set(50, 0, 50);
controls.rotateSpeed = 0.6;
controls.update();

let usingFirstPerson = false;

startButton.addEventListener('click', () => {
  isStart = false;
  startScreen.style.display = 'none';
  backgroundAudio.play();

  usingFirstPerson = true;
  controls.enabled = true; // orbit controls uit

  if (player) {
    player.enable(); // activeer movement
  }

  currentCamera = playerCamera;
});

// lights
// function setupLights() {
//   const ambient = new THREE.AmbientLight(lightsColor, 0.5);
//   scene.add(ambient);

//   const fakeSun = new THREE.DirectionalLight(lightsColor, 2);
//   fakeSun.position.set(0, 60, -(world.size.width * 2));
//   fakeSun.castShadow = false;
//   scene.add(fakeSun);

//   const sun = new THREE.DirectionalLight(lightsColor, 2.5);
//   sun.position.set(world.size.width - 20, 60, world.size.width);
//   sun.castShadow = true;
//   sun.shadow.camera.top = 30;
//   sun.shadow.camera.bottom = -60;
//   sun.shadow.camera.left = -50;
//   sun.shadow.camera.right = 50;
//   sun.shadow.camera.near = 0.1;
//   sun.shadow.camera.far = 130;
//   sun.shadow.bias = -0.001;
//   sun.shadow.mapSize = new THREE.Vector2(512, 512);
//   scene.add(sun);

//   const shadowHelper = new THREE.CameraHelper(sun.shadow.camera);
//   // scene.add(shadowHelper);
// }

// Item selector
const items = document.querySelectorAll('.item');

function updateUI() {
  items.forEach((item, index) => {
    item.classList.remove('active');

    if ((index === 0 && controlPanel.gun) || (index === 1 && controlPanel.block)) {
      item.classList.add('active');
    }
  });
}

// Health
for (let i = 0; i < 5; i++) {
  const div = document.createElement('div');
  div.classList.add('hartje'); // class toevoegen
  const img = document.createElement('img');
  img.src = 'images/hartje.png'; // pad naar de afbeelding
  div.appendChild(img);
  hpContainer.appendChild(div);
}

// Block functions
function onMouseDown(event) {
  if (event.button === 2) {
    if (controlPanel.block === true && controlPanel.gun === false && player.selectedCoords) {
      const x = Math.floor(player.selectedCoords.x);
      const y = Math.floor(player.selectedCoords.y);
      const z = Math.floor(player.selectedCoords.z);
      if (y > 1) {
        world.removeBlock(x, y, z);
        const removeAudioClone = removeAudio.cloneNode();
        removeAudioClone.play();
      }
    }
  }
}
document.addEventListener('mousedown', onMouseDown);

//Loop
let currentCamera = orbitCamera; // begin met orbit
const cameraHelper = new THREE.CameraHelper(playerCamera);
// scene.add(cameraHelper);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // update dag-nacht cyclus en omgeving
  updateDayNightCycle(delta, scene, lights, world, cycleParams);

  stats.update();

  if (usingFirstPerson) {
    player.update(delta, world);

    const shouldBeActive = controlPanel.gun;
    if (gunManager && shouldBeActive !== lastGunActiveState) {
      gunManager.setActive(shouldBeActive);
      lastGunActiveState = shouldBeActive;
    }
  } else {
    if (gunManager && lastGunActiveState) {
      gunManager.setActive(false);
      lastGunActiveState = false;
    }

    controls.update();
  }

  // 🚀 Altijd gunManager updaten
  if (gunManager) {
    gunManager.update(delta);
    gunHand.style.display = controlPanel.gun ? 'block' : 'none';
  }

  updateUI();
  cameraHelper.update();
  renderer.render(scene, currentCamera);
}

window.addEventListener('resize', () => {
  playerCamera.aspect = window.innerWidth / window.innerHeight;
  playerCamera.updateProjectionMatrix();

  orbitCamera.aspect = window.innerWidth / window.innerHeight;
  orbitCamera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// setupLights();
// createUI(world);
// animate();
