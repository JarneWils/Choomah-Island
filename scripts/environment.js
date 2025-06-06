import * as THREE from 'three';

export const dayColors = {
  sky: new THREE.Color('rgb(166, 227, 255)'),
  fog: new THREE.Color('rgb(162, 224, 253)'),
  ambientLight: new THREE.Color('rgb(255, 255, 255,)'),
  directionalLight: new THREE.Color('rgb(255, 255, 255)'),
  ambientIntensity: 0.8,
  directionalIntensity: 2,
};

export const dawnColors = {
  sky: new THREE.Color('rgb(238, 167, 126)'),
  fog: new THREE.Color('rgb(150, 123, 147)'),
  ambientLight: new THREE.Color('#ffaaaa'),
  directionalLight: new THREE.Color('#ff00ff'),
  ambientIntensity: 1,
  directionalIntensity: 2,
};

export const nightColors = {
  sky: new THREE.Color('rgb(4, 29, 41)'),
  fog: new THREE.Color('rgb(0, 20, 24)'),
  ambientLight: new THREE.Color('#bbbbff'),
  directionalLight: new THREE.Color('#bbbbff'),
  ambientIntensity: 1.5,
  directionalIntensity: 1.5,
};

export function setupEnvironment(scene, world) {
  const ambient = new THREE.AmbientLight(dayColors.ambientLight, dayColors.ambientIntensity);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(
    dayColors.directionalLight,
    dayColors.directionalIntensity
  );
  directional.position.set(world.size.width - 20, 60, world.size.width);
  directional.castShadow = true;
  directional.shadow.camera.top = 30;
  directional.shadow.camera.bottom = -60;
  directional.shadow.camera.left = -50;
  directional.shadow.camera.right = 50;
  directional.shadow.camera.near = 0.1;
  directional.shadow.camera.far = 130;
  directional.shadow.bias = -0.001;
  directional.shadow.mapSize = new THREE.Vector2(512, 512);
  scene.add(directional);

  scene.fog = new THREE.Fog(dayColors.fog, 10, 60);

  return { ambient, directional };
}

export function updateEnvironment(scene, lights, world, fromColors, toColors, lerpFactor) {
  const skyColor = fromColors.sky.clone().lerp(toColors.sky, lerpFactor);
  const fogColor = fromColors.fog.clone().lerp(toColors.fog, lerpFactor);
  const ambientColor = fromColors.ambientLight.clone().lerp(toColors.ambientLight, lerpFactor);
  const directionalColor = fromColors.directionalLight
    .clone()
    .lerp(toColors.directionalLight, lerpFactor);

  scene.background = skyColor;
  scene.fog.color = fogColor;

  lights.ambient.color = ambientColor;
  lights.ambient.intensity = THREE.MathUtils.lerp(
    fromColors.ambientIntensity,
    toColors.ambientIntensity,
    lerpFactor
  );

  lights.directional.color = directionalColor;
  lights.directional.intensity = THREE.MathUtils.lerp(
    fromColors.directionalIntensity,
    toColors.directionalIntensity,
    lerpFactor
  );
}

export function updateDayNightCycle(delta, scene, lights, world, cycleParams) {
  if (!updateDayNightCycle.elapsedTime) {
    updateDayNightCycle.elapsedTime = 0;
  }

  updateDayNightCycle.elapsedTime += delta;

  const D = cycleParams.dayDuration;
  const N = cycleParams.nightDuration;
  const W = cycleParams.dawnDuration;
  const F = cycleParams.fadeDuration;

  const totalCycle = D + F + W + F + N + F + W + F;
  const t = updateDayNightCycle.elapsedTime % totalCycle;

  if (t < D) {
    // Dag
    updateEnvironment(scene, lights, world, dayColors, dayColors, 0);
  } else if (t < D + F) {
    // Dag → Dawn
    const f = (t - D) / F;
    updateEnvironment(scene, lights, world, dayColors, dawnColors, f);
  } else if (t < D + F + W) {
    // Dawn
    updateEnvironment(scene, lights, world, dawnColors, dawnColors, 0);
  } else if (t < D + F + W + F) {
    // Dawn → Nacht
    const f = (t - D - F - W) / F;
    updateEnvironment(scene, lights, world, dawnColors, nightColors, f);
  } else if (t < D + F + W + F + N) {
    // Nacht
    updateEnvironment(scene, lights, world, nightColors, nightColors, 0);
  } else if (t < D + F + W + F + N + F) {
    // Nacht → Dawn
    const f = (t - D - F - W - F - N) / F;
    updateEnvironment(scene, lights, world, nightColors, dawnColors, f);
  } else if (t < D + F + W + F + N + F + W) {
    // Dawn
    updateEnvironment(scene, lights, world, dawnColors, dawnColors, 0);
  } else {
    // Dawn → Dag
    const f = (t - D - F - W - F - N - F - W) / F;
    updateEnvironment(scene, lights, world, dawnColors, dayColors, f);
  }
}
