import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ControlPanel } from './controlPanel.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Player {
  constructor(
    camera,
    renderer,
    worldSize = 100,
    scene,
    world,
    playerId = null,
    socket,
    spawnPosition
  ) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, renderer.domElement);
    this.socket = socket;

    this.world = world;
    this.worldSize = worldSize;

    this.enabled = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.playerId = playerId;
    this.playerHeight = 1.5;
    this.playerWidth = 0.5;
    this.controls.object.position.copy(spawnPosition);
    this.jumpSpeed = 12;
    this.canJump = false;
    this.gravity = 40;
    this.speed = 8;
    this.wireframe = false;

    this.yaw = 0; // Zelf bijhouden voor speler mesh rotatie

    renderer.domElement.addEventListener('mousemove', event => {
      if (!this.enabled) return;
      const movementX = event.movementX || 0;
      const sensitivity = 0.002;
      this.yaw -= movementX * sensitivity;
      this.yaw = this.normalizeAngle(this.yaw);

      this.updateRotation(); // Draai enkel de player mesh
    });

    this.controlsPanel = new ControlPanel();
    this.controlsPanel.startListening();

    this.playerMesh = this.createPlayerMesh();
    if (scene) scene.add(this.playerMesh);
  }

  createPlayerMesh() {
    const geometry = new THREE.BoxGeometry(this.playerWidth, this.playerHeight, this.playerWidth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      wireframe: this.wireframe,
    });
    return new THREE.Mesh(geometry, material);
  }

  enable() {
    this.controls.lock();
    this.enabled = true;
  }

  disable() {
    this.controls.unlock();
    this.enabled = false;
  }

  sendPlayerData() {
    if (!this.socket || !this.enabled) return;

    const position = this.controls.object.position;

    this.socket.emit('playerMovement', {
      id: this.playerId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: 0, y: this.yaw, z: 0 },
    });
  }

  updateRotation() {
    // We passen alleen de speler mesh aan, niet de camera controls!
    if (this.playerMesh) {
      this.playerMesh.rotation.set(0, this.yaw, 0);
    }
  }

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  update(delta) {
    if (!this.enabled) return;

    this.velocity.x = 0;
    this.velocity.z = 0;
    this.direction.set(0, 0, 0);

    if (this.controlsPanel.moveForward) this.direction.z += 1;
    if (this.controlsPanel.moveBackward) this.direction.z -= 1;
    if (this.controlsPanel.moveLeft) this.direction.x -= 1;
    if (this.controlsPanel.moveRight) this.direction.x += 1;
    this.direction.normalize();

    this.velocity.x = this.direction.x * this.speed;
    this.velocity.z = this.direction.z * this.speed;

    const position = this.controls.object.position;

    this.controls.moveRight(this.velocity.x * delta);
    this.controls.moveForward(this.velocity.z * delta);

    if (this.controlsPanel.jump && this.canJump) {
      this.velocity.y = this.jumpSpeed;
      this.canJump = false;
    }

    this.velocity.y -= this.gravity * delta;
    position.y += this.velocity.y * delta;

    const halfW = this.playerWidth / 2;
    const minX = Math.floor(position.x - halfW);
    const maxX = Math.floor(position.x + halfW);
    const minY = Math.floor(position.y - this.playerHeight);
    const maxY = Math.floor(position.y);
    const minZ = Math.floor(position.z - halfW);
    const maxZ = Math.floor(position.z + halfW);

    let onGround = false;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlock(x, y, z);
          if (!block || block.id === 0) continue;

          const overlapX = position.x + halfW > x && position.x - halfW < x + 1;
          const overlapY = position.y > y && position.y - this.playerHeight < y + 1;
          const overlapZ = position.z + halfW > z && position.z - halfW < z + 1;

          if (overlapX && overlapY && overlapZ) {
            const overlaps = [
              { axis: 'x', amount: position.x + halfW - x, dir: -1 },
              { axis: 'x', amount: x + 1 - (position.x - halfW), dir: 1 },
              { axis: 'y', amount: position.y - y, dir: -1 },
              { axis: 'y', amount: y + 1 - (position.y - this.playerHeight), dir: 1 },
              { axis: 'z', amount: position.z + halfW - z, dir: -1 },
              { axis: 'z', amount: z + 1 - (position.z - halfW), dir: 1 },
            ].filter(o => o.amount > 0);

            overlaps.sort((a, b) => a.amount - b.amount);
            const smallest = overlaps[0];

            switch (smallest.axis) {
              case 'x':
                position.x += smallest.amount * smallest.dir;
                this.velocity.x = 0;
                break;
              case 'y':
                position.y += smallest.amount * smallest.dir;
                this.velocity.y = 0;
                if (smallest.dir === 1) onGround = true;
                break;
              case 'z':
                position.z += smallest.amount * smallest.dir;
                this.velocity.z = 0;
                break;
            }
          }
        }
      }
    }

    this.canJump = onGround;

    position.x = Math.max(0.5, Math.min(position.x, this.worldSize - 0.5));
    position.z = Math.max(0.5, Math.min(position.z, this.worldSize - 0.5));

    if (this.playerMesh) {
      this.playerMesh.position.set(
        position.x,
        position.y - this.playerHeight / 2 + 0.2,
        position.z
      );

      // Hier gebruik je alleen yaw (links/rechts) voor de mesh rotatie
      this.playerMesh.rotation.set(0, this.yaw, 0);
    }

    this.sendPlayerData();
  }

  getControls() {
    return this.controls;
  }

  static remotePlayers = {};

  static addRemotePlayer(id, scene) {
    if (Player.remotePlayers[id]) return;

    const loader = new GLTFLoader();

    loader.load(
      'models/choomah.glb',
      gltf => {
        const model = gltf.scene;
        model.scale.set(0.5, 0.5, 0.5);
        scene.add(model);
        Player.remotePlayers[id] = { mesh: model };
      },
      undefined,
      error => {
        console.error('Error loading GLB model:', error);
        const geometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        Player.remotePlayers[id] = { mesh };
      }
    );
  }

  static removeRemotePlayer(id, scene) {
    const remote = Player.remotePlayers[id];
    if (remote && remote.mesh) {
      scene.remove(remote.mesh);
      delete Player.remotePlayers[id];
    }
  }

  static updateRemotePlayer(id, data) {
    const remote = Player.remotePlayers[id];
    if (!remote) return;

    remote.mesh.position.set(data.position.x, data.position.y - 0.5, data.position.z);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(0, data.rotation.y, 0, 'YXZ'));
    remote.mesh.quaternion.copy(quaternion);
  }
}
