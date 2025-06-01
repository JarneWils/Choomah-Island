import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { RNG } from './rng';
import { blocks, resources } from './blocks';

const geometry = new THREE.BoxGeometry(1, 1, 1);

export class World extends THREE.Group {
  /**
   * @type {{
   * id: number,
   * instanceId: number
   * }[][][]}
   */
  data = [];

  params = {
    seed: 8,
    terrain: {
      scale: 30,
      magnitude: 0.4,
      offset: 0.1,
    },
  };

  constructor(size = { width: 80, height: 40 }) {
    super();
    this.size = size;
  }

  /**
   * generate alles
   */
  generate() {
    const rng = new RNG(this.params.seed);
    this.initializeTerrain();
    this.generateResources(rng);
    this.generateTerrain(rng);
    this.generateMeshes();
  }

  /**
   * initialize terrain data
   */
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

  /**
   * Genereer de materialen
   */
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

  /**
   * generate terrain data for the world
   */
  generateTerrain(rng) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        // bereken de hoeveelheid noise voor x en z
        const value = simplex.noise(x / this.params.terrain.scale, z / this.params.terrain.scale);

        // scale de noise op basis van offset en magnitude
        const scaledNoise = this.params.terrain.offset + this.params.terrain.magnitude * value;

        // bereken de hoogte van de wereld voor x en z
        let height = Math.floor(this.size.height * scaledNoise);

        // hou de hoogte tussen 0 en de maximum hoogte
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

  /**
   * generate 3D meshes
   */
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
      for (let y = 0; y < this.size.height; y++)
        for (let z = 0; z < this.size.width; z++) {
          const blockId = this.getBlock(x, y, z).id;

          if (blockId === blocks.empty.id) continue;

          const mesh = meshes[blockId];
          const instanceId = mesh.count;

          if (!this.isBlockObscured(x, y, z)) {
            matrix.setPosition(x + 0.5, y + 0.5, z + 0.5);
            mesh.setMatrixAt(instanceId, matrix);
            this.setBlockInstanceId(x, y, z, instanceId);
            mesh.count++;
          }
        }
    }

    this.add(...Object.values(meshes));
  }

  //--------------------------------------------------------------------------------
  //------------------------------------ Helper Functions --------------------------
  //--------------------------------------------------------------------------------

  /**
   * verkrijg de data van elke blok per positie
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {{id: number, instanceId: number}} instanceId
   */
  getBlock(x, y, z) {
    if (this.inBounds(x, y, z) === true) {
      return this.data[x][y][z];
    } else {
      return null;
    }
  }

  /**
   * geef elke blok een id die het typen bepaalt
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} id
   */
  setBlockId(x, y, z, id) {
    if (this.inBounds(x, y, z) === true) {
      this.data[x][y][z].id = id;
    }
  }

  /**
   * geef de blok een instance id afhankelijk van zijn positie
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} instanceId
   */
  setBlockInstanceId(x, y, z, instanceId) {
    if (this.inBounds(x, y, z) === true) {
      this.data[x][y][z].instanceId = instanceId;
    }
  }

  /**
   * kijk of de mesh in de wereld staat
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  inBounds(x, y, z) {
    if (
      x >= 0 &&
      x < this.size.width &&
      y >= 0 &&
      y < this.size.height &&
      z >= 0 &&
      z < this.size.width
    ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Geeft true als de blok niet volledig omsingeld is door andere blokken
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  isBlockObscured(x, y, z) {
    const up = this.getBlock(x, y + 1, z)?.id ?? blocks.empty.id;
    const down = this.getBlock(x, y - 1, z)?.id ?? blocks.empty.id;
    const left = this.getBlock(x + 1, y, z)?.id ?? blocks.empty.id;
    const right = this.getBlock(x - 1, y, z)?.id ?? blocks.empty.id;
    const forward = this.getBlock(x, y, z + 1)?.id ?? blocks.empty.id;
    const back = this.getBlock(x, y, z - 1)?.id ?? blocks.empty.id;
    if (
      up === blocks.empty.id ||
      down === blocks.empty.id ||
      left === blocks.empty.id ||
      right === blocks.empty.id ||
      forward === blocks.empty.id ||
      back === blocks.empty.id
    ) {
      return false;
    } else {
      return true;
    }
  }
}
