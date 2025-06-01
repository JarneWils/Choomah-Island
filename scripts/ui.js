import GUI from 'lil-gui';
import { resources } from './blocks';

export function createUI(world) {
  const gui = new GUI();

  const worldFolder = gui.addFolder('World');
  worldFolder.add(world.size, 'width', 8, 128, 1).name('Width');
  worldFolder.add(world.size, 'height', 8, 64, 1).name('Height');

  const terrain = gui.addFolder('Terrain');
  terrain.add(world.params, 'seed', 0, 10000).name('Seed');
  terrain.add(world.params.terrain, 'scale', 10, 100, 1).name('Scale');
  terrain.add(world.params.terrain, 'magnitude', 0, 1, 0.1).name('Magnitude');
  terrain.add(world.params.terrain, 'offset', 0, 1, 0.1).name('Offset');

  resources.forEach(resource => {
    const resourcesScarcity = gui.addFolder(resource.name);
    resourcesScarcity.add(resource, 'scarcity', 0, 1, 0.1).name('Scarcity');
    resourcesScarcity.add(resource.scale, 'x', 10, 100, 1).name('X scale');
    resourcesScarcity.add(resource.scale, 'y', 10, 100, 1).name('y scale');
    resourcesScarcity.add(resource.scale, 'z', 10, 100, 1).name('z scale');
  });

  gui.onChange(() => {
    world.generate();
  });
}
