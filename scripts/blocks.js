import * as THREE from 'three';

const blockTypeNumber = '2';

const textureLoader = new THREE.TextureLoader();

function loadTexture(path) {
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

const textures = {
  grassTop: loadTexture(`textures/grass-top${blockTypeNumber}.jpg`),
  grassSide: loadTexture(`textures/grass-side${blockTypeNumber}.jpg`),
  dirt: loadTexture(`textures/dirt${blockTypeNumber}.jpg`),
  healingBlock: loadTexture(`textures/healingBlock${blockTypeNumber}.jpg`),
  amoBlock: loadTexture(`textures/amoBlock${blockTypeNumber}.jpg`),
};

export const blocks = {
  empty: {
    id: 0,
    name: 'empty',
  },
  grass: {
    id: 1,
    name: 'grass',
    color: 0x558015,
    material: [
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassTop }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
    ],
  },
  dirt: {
    id: 2,
    name: 'dirt',
    color: 0x807020,
    scale: 20,
    material: new THREE.MeshLambertMaterial({ map: textures.dirt }),
  },
  healingBlock: {
    id: 3,
    name: 'healingBlock',
    color: 0x999999,
    scale: { x: 30, y: 30, z: 30 },
    scarcity: 0.8,
    material: new THREE.MeshLambertMaterial({ map: textures.healingBlock }),
  },
  amoBlock: {
    id: 4,
    name: 'amoBlock',
    color: 0x666699,
    scale: { x: 20, y: 20, z: 20 },
    scarcity: 0.5,
    material: new THREE.MeshLambertMaterial({ map: textures.amoBlock }),
  },
};

export const resources = [blocks.healingBlock, blocks.amoBlock];
