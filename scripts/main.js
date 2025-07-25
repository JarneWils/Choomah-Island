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
const playerWait = document.querySelector('.player-wait');
const playerFull = document.querySelector('.player-full');
const amoPopUp = document.querySelector('.amo-pop-up');
const healPopUp = document.querySelector('.heal-pop-up');

const backgroundAudio = document.querySelector('#background-audio');
const hitAudios = [
  document.querySelector('#hit1-audio'),
  document.querySelector('#hit2-audio'),
  document.querySelector('#hit3-audio'),
  document.querySelector('#hit4-audio'),
];
const dieAudio = document.querySelector('#die-audio');
const scoreAudio = document.querySelector('#score-audio');

const removeAudio = document.querySelector('#block-remove-audio');

const params = new URLSearchParams(window.location.search);

let lives = 5;
let playerCounter = 0;
// let manuallyUnlocked = false;
let playerCount = parseInt(params.get('players')) || 1;
let selectedMap = params.get('map') || 'map2';
let isStart = true;

if (isStart) {
  startScreen.style.display = 'block';
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
  socket.emit('game-bezig');

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

socket.on('updatePlayerCounter', counter => {
  playerCounter = counter;
  console.log(`🔔 updatePlayerCounter event ontvangen: ${playerCounter}/${playerCount}`);

  if (playerCounter === playerCount) {
    console.log(`🎮 Alle spelers verbonden (${playerCounter}/${playerCount}), start het spel!`);

    startButton.style.cursor = 'none';
    isStart = false;
    startScreen.style.display = 'none';
    backgroundAudio.play();

    usingFirstPerson = true;
    controls.enabled = true;

    if (player) {
      player.enable();
    }

    currentCamera = playerCamera;
  }
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
        // parseInt(hpContainer.style.marginLeft || '0') + 20 + 'px';
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
      socket.disconnect();
      setTimeout(() => {
        dieScreen.style.display = 'none';
        window.location.reload(true);
        // window.location.href = `index.html`;
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

// controls
const controls = new OrbitControls(orbitCamera, renderer.domElement);
controls.target.set(50, 0, 50);
controls.rotateSpeed = 0.6;
controls.update();

let usingFirstPerson = false;

hpContainer.style.display = 'none';
startButton.addEventListener('click', () => {
  startButton.style.display = 'none';
  hpContainer.style.display = 'flex';
  socket.emit('startRequest');
  // if (playerCounter === playerCount) {
  //   startButton.style.cursor = 'none';
  //   isStart = false;
  //   startScreen.style.display = 'none';
  //   backgroundAudio.play();
  //   usingFirstPerson = true;
  //   controls.enabled = true;
  //   if (player) {
  //     player.enable();
  //   }
  //   currentCamera = playerCamera;
  // } else if (playerCounter < playerCount) {
  //   playerWait.style.display = 'block';
  // } else if (playerCounter > playerCount) {
  //   playerFull.style.display = 'block';
  // }
});
// document.addEventListener('pointerlockchange', () => {
//   const isLocked = document.pointerLockElement === renderer.domElement;
//   if (!isLocked && !manuallyUnlocked) {
//     // Probeer terug te locken tenzij het bewust werd gedaan (via ESC)
//     player.controls.lock();
//   }
// });

// // Detecteer wanneer ESC gebruikt wordt
// document.addEventListener('keydown', e => {
//   if (e.key === 'Escape') {
//     manuallyUnlocked = true;
//     player.disable(); // optioneel
//   }
// });

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
        const block = world.getBlock(x, y, z);

        if (block && block.id === 4) {
          world.increaseAmmo(1);
          amoPopUp.style.display = 'block';
          const audioClone = scoreAudio.cloneNode();
          audioClone.play();
          setTimeout(() => {
            amoPopUp.style.display = 'none';
          }, 500);
        }

        if (block && block.id === 3) {
          if (lives < 10) {
            healPopUp.style.display = 'block';
            const audioClone = scoreAudio.cloneNode();
            audioClone.play();
            lives++;
            const div = document.createElement('div');
            div.classList.add('hartje');
            const img = document.createElement('img');
            img.src = 'images/hartje.png';
            div.appendChild(img);
            hpContainer.appendChild(div);
            hpContainer.style.marginLeft =
              // parseInt(hpContainer.style.marginLeft || '0') - 20 + 'px';
              setTimeout(() => {
                healPopUp.style.display = 'none';
              }, 500);
          }
        }

        world.removeBlock(x, y, z); // verwijder het blok NA het checken

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
