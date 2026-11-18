// Costa Verde Heat — vehicles.js
// Car factory (procedural box cars: sedan, taxi, pickup, sports, police, van),
// player driving physics, traffic AI that follows the street grid, and police
// cruisers that chase the player.
(function () {
  'use strict';

  var CAR_COLORS = [0xc23a3a, 0x3a6ac2, 0xd8d0b8, 0x2a2a2a, 0x3a9a5a, 0xd8a03a, 0x8a5ab8, 0xb8b8b8];
  var CAR_NAMES = ['SEDAN', 'COUPE', 'PICKUP', 'SPORTS', 'VAN', 'TAXI'];

  function makeCarMesh(kind, color, isPolice) {
    var g = new THREE.Group();
    var bodyColor = isPolice ? 0x1a1a2a : color;
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4),
      new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.65; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.1),
      new THREE.MeshLambertMaterial({ color: 0x18242e }));
    cabin.position.set(0, 1.3, kind === 'PICKUP' ? 0.7 : -0.2); g.add(cabin);
    if (kind === 'PICKUP') {
      var bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.6),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      bed.position.set(0, 1.05, -1.3); g.add(bed);
    }
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
    });
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
    [-0.7, 0.7].forEach(function (x) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
      l.position.set(x, 0.7, 2.21); g.add(l);
    });
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    [-0.7, 0.7].forEach(function (x) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
      l.position.set(x, 0.7, -2.21); g.add(l);
    });
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(-0.3, 1.75, -0.2); g.add(bar);
      var bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      bar2.position.set(0.45, 1.75, -0.2); g.add(bar2);
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.42),
        new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
      stripe.position.y = 0.62; g.add(stripe);
    }
    if (kind === 'TAXI') {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffd23d }));
      sign.position.set(0, 1.8, -0.2); g.add(sign);
    }
    return g;
  }

  function createCar(scene, kind, color, x, z, heading, isPolice) {
    var mesh = makeCarMesh(kind, color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading || 0;
    scene.add(mesh);
    return {
      kind: kind, mesh: mesh, isPolice: !!isPolice,
      x: x, z: z, heading: heading || 0,
      speed: 0, steer: 0, color: color,
      name: isPolice ? 'POLICE CRUISER' : (CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)]),
      driver: null, // 'player' | 'traffic' | 'police' | null (parked)
      health: 100, stuck: 0
    };
  }

  // --- player driving: arcade physics with collision vs buildings ---
  function drivePlayerCar(car, input, dt, colliders, bounds, onCrash) {
    var accel = input.forward ? 26 : (input.back ? -16 : 0);
    if (input.brake) accel = car.speed > 0.5 ? -34 : -16;
    car.speed += accel * dt;
    // drag + rolling resistance
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 0.08 && !input.forward && !input.back) car.speed = 0;
    car.speed = Math.max(-12, Math.min(38, car.speed));
    var steerTarget = 0;
    if (input.left) steerTarget = 1;
    if (input.right) steerTarget = -1;
    var dir = car.speed >= 0 ? 1 : -1;
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    car.heading += car.steer * 1.9 * dir * Math.min(1, Math.abs(car.speed) / 8) * dt;
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (hitsCollider(nx, nz, colliders) || Math.abs(nx) > bounds || Math.abs(nz) > bounds) {
      if (Math.abs(car.speed) > 8 && onCrash) onCrash(Math.abs(car.speed));
      car.speed *= -0.25; // bounce off
    } else {
      car.x = nx; car.z = nz;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -car.steer * 0.06 * Math.min(1, Math.abs(car.speed) / 15);
    return car.speed;
  }

  function hitsCollider(x, z, colliders) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (Math.abs(x - c.x) < c.hx + 1.1 && Math.abs(z - c.z) < c.hz + 1.1) return true;
    }
    return false;
  }

  // --- traffic AI: cruise along the street grid, turn at intersections ---
  function makeTrafficCar(scene, streets, rng) {
    var s = streets[Math.floor(rng() * streets.length)];
    var alongZ = rng() < 0.5;
    var dir = rng() < 0.5 ? 1 : -1;
    var lane = (rng() < 0.5 ? 3.5 : -3.5);
    var x = alongZ ? s + lane : -150 + rng() * 300;
    var z = alongZ ? -150 + rng() * 300 : s + lane;
    var heading = alongZ ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    var color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    var kind = rng() < 0.12 ? 'TAXI' : (rng() < 0.15 ? 'PICKUP' : 'SEDAN');
    var car = createCar(scene, kind, color, x, z, heading, false);
    car.driver = 'traffic';
    car.speed = 8 + rng() * 5;
    car.traffic = { alongZ: alongZ, dir: dir, lane: lane, street: s, cruise: car.speed };
    return car;
  }

  function updateTraffic(car, dt, streets, colliders) {
    var t = car.traffic;
    if (!t) return;
    // slow down if a collider is right ahead
    var aheadX = car.x + Math.sin(car.heading) * 6;
    var aheadZ = car.z + Math.cos(car.heading) * 6;
    var target = t.cruise;
    if (hitsCollider(aheadX, aheadZ, colliders)) target = 0;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // at an intersection, sometimes turn onto the cross street
    var nearStreet = null;
    for (var i = 0; i < streets.length; i++) {
      if (t.alongZ) { if (Math.abs(car.z - streets[i]) < 1.2) nearStreet = streets[i]; }
      else { if (Math.abs(car.x - streets[i]) < 1.2) nearStreet = streets[i]; }
    }
    if (nearStreet !== null && Math.random() < 0.012) {
      var turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.heading += turn;
      t.alongZ = !t.alongZ;
      t.dir = Math.cos(car.heading) >= 0 ? 1 : -1;
      if (t.alongZ) car.x = nearStreet + t.lane; else car.z = nearStreet + t.lane;
    }
    if (Math.abs(car.x) > 168 || Math.abs(car.z) > 168) {
      // wrap around to the opposite edge to keep traffic flowing
      car.x = -Math.sign(car.x) * 165; car.z = -Math.sign(car.z) * 165;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  // --- police AI: chase the player, ram, and try to box them in ---
  function updatePolice(car, dt, target, colliders) {
    var dx = target.x - car.x, dz = target.z - car.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var want = Math.atan2(dx, dz);
    var diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    var speedTarget = dist > 60 ? 34 : (dist > 8 ? 30 : 16);
    car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.5);
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!hitsCollider(nx, nz, colliders)) { car.x = nx; car.z = nz; }
    else { car.heading += 0.9 * dt * 10; car.speed *= 0.5; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // flashing light bar
    var bars = car.mesh.children;
    var on = Math.floor(performance.now() / 180) % 2 === 0;
    for (var i = 0; i < bars.length; i++) {
      var m = bars[i].material;
      if (m && m.color && (m.color.getHex() === 0xff2222 || m.color.getHex() === 0x2266ff)) {
        m.color.setHex(m.color.getHex() === 0xff2222 ? (on ? 0xff2222 : 0x551111) : (on ? 0x111155 : 0x2266ff));
      }
    }
    return dist;
  }

  window.CVH_Vehicles = {
    createCar: createCar, drivePlayerCar: drivePlayerCar,
    makeTrafficCar: makeTrafficCar, updateTraffic: updateTraffic,
    updatePolice: updatePolice, hitsCollider: hitsCollider
  };
})();
