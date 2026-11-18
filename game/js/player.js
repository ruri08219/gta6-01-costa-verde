// Costa Verde Heat — player.js
// Rio Vega on foot: WASD movement relative to the camera, sprint, third-person
// camera that follows and orbits, and the pistol (raycast shooting).
(function () {
  'use strict';

  function makePlayerMesh() {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0x2a5a8a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    var pants = new THREE.MeshLambertMaterial({ color: 0x1e2a38 });
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), pants);
    legs.position.y = 0.42; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.8, 0.38), jacket);
    torso.position.y = 1.22; g.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.85; g.add(head);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48),
      new THREE.MeshLambertMaterial({ color: 0xffd23d }));
    cap.position.y = 2.1; g.add(cap);
    var armGeo = new THREE.BoxGeometry(0.17, 0.72, 0.17);
    var aL = new THREE.Mesh(armGeo, jacket); aL.position.set(-0.44, 1.22, 0); g.add(aL);
    var aR = new THREE.Mesh(armGeo, jacket); aR.position.set(0.44, 1.22, 0); g.add(aR);
    // pistol in right hand
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.44, 0.9, 0.25); g.add(gun);
    g.userData.arms = [aL, aR];
    g.userData.legs = legs;
    return g;
  }

  function createPlayer(scene, x, z) {
    var mesh = makePlayerMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return {
      mesh: mesh, x: x, z: z, heading: 0,
      health: 100, speed: 0, moving: false,
      camYaw: Math.PI, camPitch: 0.32, camDist: 8.5,
      inCar: null, wanted: 0, money: 250,
      lastDamageAt: 0
    };
  }

  function updateOnFoot(player, input, dt, colliders, bounds) {
    var run = input.sprint ? 9.5 : 5.2;
    var fx = 0, fz = 0;
    var sin = Math.sin(player.camYaw), cos = Math.cos(player.camYaw);
    if (input.forward) { fx += sin; fz += cos; }
    if (input.back) { fx -= sin; fz -= cos; }
    if (input.left) { fx += cos; fz -= sin; }
    if (input.right) { fx -= cos; fz += sin; }
    var len = Math.sqrt(fx * fx + fz * fz);
    player.moving = len > 0;
    if (len > 0) {
      fx /= len; fz /= len;
      player.speed += (run - player.speed) * Math.min(1, dt * 10);
      var nx = player.x + fx * player.speed * dt;
      var nz = player.z + fz * player.speed * dt;
      var blocked = false;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        if (Math.abs(nx - c.x) < c.hx + 0.5 && Math.abs(nz - c.z) < c.hz + 0.5) { blocked = true; break; }
      }
      if (!blocked && Math.abs(nx) < bounds && Math.abs(nz) < bounds) {
        player.x = nx; player.z = nz;
      }
      player.heading = Math.atan2(fx, fz);
    } else {
      player.speed += (0 - player.speed) * Math.min(1, dt * 10);
    }
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    // walk cycle
    var t = performance.now() / 1000;
    var swing = player.moving ? Math.sin(t * (input.sprint ? 11 : 8)) * 0.6 : 0;
    player.mesh.userData.arms[0].rotation.x = swing;
    player.mesh.userData.arms[1].rotation.x = -swing;
    player.mesh.position.y = player.moving ? Math.abs(Math.sin(t * 8)) * 0.07 : 0;
  }

  function updateCamera(player, camera, dt, inCarSpeed) {
    var target = player.inCar ? player.inCar : player;
    var dist = player.inCar ? 12 : player.camDist;
    var height = player.inCar ? 5.2 : 4.2;
    var tx = target.x, tz = target.z;
    var cx = tx - Math.sin(player.camYaw) * dist;
    var cz = tz - Math.cos(player.camYaw) * dist;
    var cy = height + player.camPitch * 4;
    var k = 1 - Math.pow(0.001, dt); // smooth follow
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (cy - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(tx, player.inCar ? 1.6 : 1.4, tz);
  }

  // Shoot from the camera centre; returns the first hit object (or null).
  function shoot(camera, scene, targets, raycaster) {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    var hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    var hit = hits[0];
    var obj = hit.object;
    while (obj && !obj.userData.hitRef && obj.parent) obj = obj.parent;
    return { ref: obj ? obj.userData.hitRef : null, point: hit.point, distance: hit.distance };
  }

  window.CVH_Player = {
    createPlayer: createPlayer, updateOnFoot: updateOnFoot,
    updateCamera: updateCamera, shoot: shoot
  };
})();
