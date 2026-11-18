// Costa Verde Heat — pedestrians.js
// Walking NPCs on the sidewalks: procedural low-poly people with random
// shirts, who stroll, pause, and flee when a gun goes off nearby.
(function () {
  'use strict';

  var SHIRTS = [0xd84a4a, 0x4a7fd8, 0x4ad88a, 0xd8b84a, 0xb84ad8, 0xe8e8e8, 0x2a2a2a, 0xff8a3d];
  var SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

  function makePedMesh(rng) {
    var g = new THREE.Group();
    var skin = SKINS[Math.floor(rng() * SKINS.length)];
    var shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2a3542 }));
    legs.position.y = 0.4; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34),
      new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.15; g.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.75; g.add(head);
    var armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);
    var armMat = new THREE.MeshLambertMaterial({ color: shirt });
    var aL = new THREE.Mesh(armGeo, armMat); aL.position.set(-0.4, 1.15, 0); g.add(aL);
    var aR = new THREE.Mesh(armGeo, armMat); aR.position.set(0.4, 1.15, 0); g.add(aR);
    g.userData.arms = [aL, aR];
    return g;
  }

  function spawnPeds(scene, spawns, count, rng) {
    var peds = [];
    for (var i = 0; i < count; i++) {
      var s = spawns[Math.floor(rng() * spawns.length)];
      var mesh = makePedMesh(rng);
      mesh.position.set(s.x, 0, s.z);
      scene.add(mesh);
      peds.push({
        mesh: mesh, x: s.x, z: s.z,
        heading: rng() * Math.PI * 2,
        speed: 1.2 + rng() * 1.1,
        state: 'walk', panic: 0, pauseT: rng() * 4,
        phase: rng() * Math.PI * 2
      });
    }
    return peds;
  }

  function updatePeds(peds, dt, playerPos, gunshotAt, bounds) {
    var t = performance.now() / 1000;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (gunshotAt) {
        var gdx = p.x - gunshotAt.x, gdz = p.z - gunshotAt.z;
        if (gdx * gdx + gdz * gdz < 900) { p.state = 'flee'; p.panic = 3; }
      }
      if (p.state === 'flee') {
        p.panic -= dt;
        if (p.panic <= 0) p.state = 'walk';
        var pdx = p.x - playerPos.x, pdz = p.z - playerPos.z;
        var pd = Math.sqrt(pdx * pdx + pdz * pdz) || 1;
        p.heading = Math.atan2(pdx / pd, pdz / pd);
        p.speed = 4.2;
      } else {
        p.pauseT -= dt;
        if (p.pauseT <= 0) {
          p.heading += (Math.random() - 0.5) * 1.6;
          p.pauseT = 2 + Math.random() * 5;
          p.speed = 1.2 + Math.random() * 1.1;
        }
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > bounds || Math.abs(p.z) > bounds) p.heading += Math.PI;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // walk swing
      var swing = Math.sin(t * 6 + p.phase) * 0.5 * Math.min(1, p.speed / 2);
      p.mesh.userData.arms[0].rotation.x = swing;
      p.mesh.userData.arms[1].rotation.x = -swing;
      p.mesh.position.y = Math.abs(Math.sin(t * 6 + p.phase)) * 0.06;
    }
  }

  window.CVH_Pedestrians = { spawnPeds: spawnPeds, updatePeds: updatePeds };
})();
