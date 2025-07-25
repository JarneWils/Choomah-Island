import * as THREE from 'three';

const gunAudio = document.querySelector('#gun-audio');
const scoreAudio = document.querySelector('#score-audio');
const hitNumber = document.querySelector('.hit-pop-up');

export class GunManager {
  constructor(camera, scene, controlPanel, socket, playerId, world, Player) {
    this.controlPanel = controlPanel;
    this.camera = camera;
    this.scene = scene;
    this.bullets = [];
    this.remoteBullets = [];
    this.raycaster = new THREE.Raycaster();
    this.active = false;

    this.world = world;
    this.Player = Player;
    this.players = Player.remotePlayers;

    this.socket = socket;
    this.playerId = playerId;

    this._boundShoot = this.shoot.bind(this);

    this.socket.on('bulletFired', data => {
      if (data.id === this.playerId) return;

      const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);

      this.spawnBullet(origin, direction, true, data.id);
    });
  }

  setActive(isActive) {
    if (this.active === isActive) return;
    this.active = isActive;

    if (isActive) {
      document.addEventListener('mousedown', this._boundShoot);
    } else {
      document.removeEventListener('mousedown', this._boundShoot);
    }
  }

  spawnBullet(origin, direction, isRemote = false, shooterId = this.playerId) {
    const geometry = new THREE.SphereGeometry(0.04, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: isRemote ? 0xffffff : 0xffffff });
    const bullet = new THREE.Mesh(geometry, material);

    bullet.position.copy(origin);
    bullet.userData.velocity = direction.clone().multiplyScalar(80);
    bullet.userData.shooterId = shooterId; // <-- belangrijk

    this.scene.add(bullet);

    if (isRemote) {
      this.remoteBullets.push(bullet);
    } else {
      this.bullets.push(bullet);
    }
  }

  shoot() {
    if (!this.active || !this.controlPanel?.gun) return;

    if (this.world.amoCounter > 0) {
      this.world.decreaseAmmo(1);

      const audioClone = gunAudio.cloneNode();
      audioClone.play();

      const center = new THREE.Vector2(0, 0);
      this.raycaster.setFromCamera(center, this.camera);

      const direction = this.raycaster.ray.direction.clone();
      const origin = this.raycaster.ray.origin.clone();

      this.socket.emit('shootBullet', {
        id: this.playerId,
        origin: origin,
        direction: direction,
      });

      this.spawnBullet(origin, direction, false, this.playerId);
    }
  }

  checkBlockCollision(bullet) {
    const pos = bullet.position.clone();
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const z = Math.floor(pos.z);

    const block = this.world.getBlock(x, y, z);
    if (!block) return false;

    // Alleen verwijderen als het GEEN empty block is
    return block.id !== 0; // assuming 0 is empty.id
  }

  checkPlayerCollision(bullet) {
    const pos = bullet.position;

    const allPlayers = {
      ...this.players,
      [this.playerId]: this.Player.localPlayer,
    };

    for (const id in allPlayers) {
      const player = allPlayers[id];

      if (!player) continue;

      if (id === bullet.userData.shooterId) continue;

      const playerPos = player.getWorldPosition ? player.getWorldPosition() : player.mesh.position;

      const halfW = player.playerWidth / 2 || 0.25; // fallback
      const playerHeight = player.playerHeight || 1.5;

      if (
        pos.x > playerPos.x - halfW - 0.3 &&
        pos.x < playerPos.x + halfW + 0.3 &&
        pos.y > playerPos.y - 1.7 &&
        pos.y < playerPos.y + 1.1 &&
        pos.z > playerPos.z - halfW - 0.3 &&
        pos.z < playerPos.z + halfW + 0.3
      ) {
        console.log(
          `[COLLISION DETECTED] bullet at ${pos.toArray()} hit player ${id} at ${playerPos.toArray()}`
        );
        return id;
      }
    }

    return null;
  }

  updateBulletList(list, delta) {
    for (let i = list.length - 1; i >= 0; i--) {
      const bullet = list[i];
      bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(delta));

      // VERANDER BLOCK BIJ HIT
      const pos = bullet.position.clone();
      const x = Math.floor(pos.x);
      const y = Math.floor(pos.y);
      const z = Math.floor(pos.z);
      if (bullet.position.length() > 100) {
        this.scene.remove(bullet);
        list.splice(i, 1);
        continue;
      }
      // if (this.checkBlockCollision(bullet)) {
      //   this.world.setBlockId(x, y, z, 4);
      //   this.world.generateMeshes();
      //   this.socket.emit('setBlock', { x, y, z, id: 4 });
      //   this.scene.remove(bullet);
      //   list.splice(i, 1);
      //   continue;
      // }

      // Check botsing met speler
      const hitPlayerId = this.checkPlayerCollision(bullet);
      if (hitPlayerId) {
        this.scene.remove(bullet);
        list.splice(i, 1);

        if (this.playerId === bullet.userData.shooterId && hitPlayerId !== this.playerId) {
          bullet.userData.hitReported = true;
          this.socket.emit('playerHit', { hitPlayerId, shooterId: bullet.userData.shooterId });
          console.log(`Player ${hitPlayerId} is geraakt door ${bullet.userData.shooterId}`);
          hitNumber.style.display = 'block';
          const audioClone = scoreAudio.cloneNode();
          audioClone.play();
          setTimeout(() => {
            hitNumber.style.display = 'none';
          }, 400);
          console.log('ik heb ene geraakt.');
        }
      }
    }
  }

  update(delta) {
    this.updateBulletList(this.remoteBullets, delta);

    if (!this.active || !this.controlPanel?.gun) return;

    this.updateBulletList(this.bullets, delta);
  }
}
