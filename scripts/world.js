import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { RNG } from './rng';
import { blocks, resources } from './blocks';

const geometry = new THREE.BoxGeometry(1, 1, 1);
const amoCount = document.querySelector('.amo-count');
const amoPopUp = document.querySelector('.amo-pop-up');
const scoreAudio = document.querySelector('#score-audio');

export class World extends THREE.Group {
  amoCounter = 10;

  /**
   * @type {{
   * id: number,
   * instanceId: number
   * }[][][]}
   */
  data = [];

  maps = {
    map1: {
      params: {
        seed: 850,
        terrain: {
          scale: 28,
          magnitude: 0.8,
          offset: 0.4,
        },
      },
      size: { width: 80, height: 15 },
    },
    map2: {
      params: {
        seed: 5,
        terrain: {
          scale: 28,
          magnitude: 0.8,
          offset: 0.2,
        },
      },
      size: { width: 80, height: 35 },
    },
    map3: {
      params: {
        seed: 525,
        terrain: {
          scale: 15,
          magnitude: 4,
          offset: 0.2,
        },
      },
      size: { width: 80, height: 15 },
    },
    map4: {
      params: {
        seed: 5,
        terrain: {
          scale: 50,
          magnitude: 8,
          offset: 0.2,
        },
      },
      size: { width: 80, height: 10 },
    },
  };

  constructor(mapName = 'map3', socket) {
    super();
    this.setMap(mapName);
    this.socket = socket;
  }

  /**
   * Kies en laad een map
   * @param {string} mapName
   */
  setMap(mapName) {
    const map = this.maps[mapName];
    if (!map) {
      console.warn(`Map "${mapName}" bestaat niet, fallback naar "map3"`);
      this.params = this.maps.map3.params;
      this.size = this.maps.map3.size;
    } else {
      this.params = map.params;
      this.size = map.size;
    }
  }

  /**
   * Genereer de volledige wereld
   */
  generate() {
    const rng = new RNG(this.params.seed);
    this.initializeTerrain();
    this.generateResources(rng);
    this.generateTerrain(rng);
    this.generateMeshes();
  }

  initializeTerrain() {
    this.data = [];
    for (let x = 0; x < this.size.width; x++) {
      const slice = [];
      for (let y = 0; y < this.size.height; y++) {
        const row = [];
        for (let z = 0; z < this.size.width; z++) {
          row.push({
            id: blocks.empty.id,
            instanceId: null,
          });
        }
        slice.push(row);
      }
      this.data.push(slice);
    }
  }

  generateResources(rng) {
    const simplex = new SimplexNoise(rng);
    resources.forEach(resource => {
      for (let x = 0; x < this.size.width; x++) {
        for (let y = 0; y < this.size.height; y++) {
          for (let z = 0; z < this.size.width; z++) {
            const value = simplex.noise3d(
              x / resource.scale.x,
              y / resource.scale.y,
              z / resource.scale.z
            );
            if (value > resource.scarcity) {
              this.setBlockId(x, y, z, resource.id);
            }
          }
        }
      }
    });
  }

  generateTerrain(rng) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        const value = simplex.noise(x / this.params.terrain.scale, z / this.params.terrain.scale);
        const scaledNoise = this.params.terrain.offset + this.params.terrain.magnitude * value;

        let height = Math.floor(this.size.height * scaledNoise);
        height = Math.max(1, Math.min(height, this.size.height - 1));

        for (let y = 0; y < this.size.height; y++) {
          if (y < height && this.getBlock(x, y, z).id === blocks.empty.id) {
            this.setBlockId(x, y, z, blocks.dirt.id);
          } else if (y === height) {
            this.setBlockId(x, y, z, blocks.grass.id);
          } else if (y > height) {
            this.setBlockId(x, y, z, blocks.empty.id);
          }
        }
      }
    }
  }

  generateMeshes() {
    this.clear();

    const maxCount = this.size.width * this.size.width * this.size.height;
    const meshes = {};

    Object.values(blocks)
      .filter(blockType => blockType.id !== blocks.empty.id)
      .forEach(blockType => {
        const mesh = new THREE.InstancedMesh(geometry, blockType.material, maxCount);
        mesh.name = blockType.name;
        mesh.count = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes[blockType.id] = mesh;
      });

    const matrix = new THREE.Matrix4();

    for (let x = 0; x < this.size.width; x++) {
      for (let y = 0; y < this.size.height; y++) {
        for (let z = 0; z < this.size.width; z++) {
          const blockId = this.getBlock(x, y, z).id;
          if (blockId === blocks.empty.id) continue;

          if (!this.isBlockObscured(x, y, z)) {
            const mesh = meshes[blockId];
            const instanceId = mesh.count;
            matrix.setPosition(x + 0.5, y + 0.5, z + 0.5);
            mesh.setMatrixAt(instanceId, matrix);
            this.setBlockInstanceId(x, y, z, instanceId);
            mesh.count++;
          }
        }
      }
    }

    this.add(...Object.values(meshes));
  }

  getBlock(x, y, z) {
    if (this.inBounds(x, y, z)) {
      return this.data[x][y][z];
    }
    return null;
  }

  setBlockId(x, y, z, id) {
    if (this.inBounds(x, y, z)) {
      this.data[x][y][z].id = id;
    }
  }

  setBlockInstanceId(x, y, z, instanceId) {
    if (this.inBounds(x, y, z)) {
      this.data[x][y][z].instanceId = instanceId;
    }
  }

  inBounds(x, y, z) {
    return (
      x >= 0 &&
      x < this.size.width &&
      y >= 0 &&
      y < this.size.height &&
      z >= 0 &&
      z < this.size.width
    );
  }

  isBlockObscured(x, y, z) {
    const up = this.getBlock(x, y + 1, z)?.id ?? blocks.empty.id;
    const down = this.getBlock(x, y - 1, z)?.id ?? blocks.empty.id;
    const left = this.getBlock(x + 1, y, z)?.id ?? blocks.empty.id;
    const right = this.getBlock(x - 1, y, z)?.id ?? blocks.empty.id;
    const forward = this.getBlock(x, y, z + 1)?.id ?? blocks.empty.id;
    const back = this.getBlock(x, y, z - 1)?.id ?? blocks.empty.id;

    return (
      up !== blocks.empty.id &&
      down !== blocks.empty.id &&
      left !== blocks.empty.id &&
      right !== blocks.empty.id &&
      forward !== blocks.empty.id &&
      back !== blocks.empty.id
    );
  }

  updateAmmoDisplay() {
    amoCount.innerHTML = `${this.amoCounter.toString()} x`;
  }

  increaseAmmo(amount = 1) {
    this.amoCounter += amount;
    this.updateAmmoDisplay();
  }

  decreaseAmmo(amount = 1) {
    this.amoCounter = Math.max(0, this.amoCounter - amount);
    this.updateAmmoDisplay();
  }

  applyBlockRemoval(x, y, z) {
    if (!this.inBounds(x, y, z)) return;

    const block = this.getBlock(x, y, z);
    if (block.id === blocks.empty.id) return;
    if (block.id === 4) {
      this.increaseAmmo(1);
      amoPopUp.style.display = 'block';
      const audioClone = scoreAudio.cloneNode();
      audioClone.play();
      setTimeout(() => {
        amoPopUp.style.display = 'none';
      }, 200);
    }
    this.setBlockId(x, y, z, blocks.empty.id);
    this.setBlockInstanceId(x, y, z, null);
    this.generateMeshes();
  }

  removeBlock(x, y, z) {
    this.applyBlockRemoval(x, y, z); // lokaal
    this.socket.emit('blockRemoved', { x, y, z }); // sync naar server
  }
}
