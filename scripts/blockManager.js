export class BlockManager {
  constructor(world) {
    this.world = world; // wereld waarin blocks staan (bijv. een InstancedMesh)
  }

  removeBlockAt(position) {
    if (!position) return;

    const key = `${position.x},${position.y},${position.z}`;
    this.world.removeBlock(position.x, position.y, position.z);

    console.log(`Block verwijderd op ${key}`);
  }
}
