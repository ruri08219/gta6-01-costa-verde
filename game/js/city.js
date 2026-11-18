// Costa Verde Heat — city.js
// Builds the whole city of Costa Verde: ocean + beach on the west, a road grid,
// procedural buildings with lit windows, palms, streetlights and props.
// Exports CVH_City.build(scene) -> { colliders, roadPoints, carSpawns, pedSpawns,
// hideout, pier, bank, hospital, bounds }.
(function () {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeWindowTexture(rng, base, lit) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 64, 128);
    for (var y = 6; y < 120; y += 14) {
      for (var x = 6; x < 58; x += 12) {
        var on = rng() < lit;
        g.fillStyle = on ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : 'rgba(10,18,30,0.85)';
        g.fillRect(x, y, 8, 9);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function box(w, h, d, color, x, y, z, opts) {
    var mat;
    if (opts && opts.map) {
      mat = new THREE.MeshLambertMaterial({ map: opts.map });
    } else {
      mat = new THREE.MeshLambertMaterial({ color: color });
    }
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts && opts.ry) m.rotation.y = opts.ry;
    return m;
  }

  function build(scene) {
    var rng = mulberry32(20261118);
    var colliders = [];   // {x, z, hx, hz}
    var carSpawns = [];
    var pedSpawns = [];
    var G = new THREE.Group();
    scene.add(G);

    var CITY = 340;          // city half-size in world units (x: -170..170)
    var BEACH_X = -170;      // beach strip starts here, ocean further west
    var ROAD = 14;           // road width
    var BLOCK = 46;          // block pitch

    // --- ground, beach, ocean ---
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: 0x3d5a3a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(20, 0, 0);
    G.add(ground);

    var sand = new THREE.Mesh(new THREE.PlaneGeometry(46, 560),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-193, 0.05, 0);
    G.add(sand);

    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(220, 560),
      new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(-320, 0.02, 0);
    G.add(ocean);

    // boardwalk along the beach
    var walk = box(10, 0.4, 560, 0x8a6f4d, -166, 0.2, 0);
    G.add(walk);

    // --- roads: grid streets every BLOCK units ---
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    var lineMat = new THREE.MeshLambertMaterial({ color: 0xd8c25a });
    var streets = [];
    for (var s = -150; s <= 150; s += BLOCK) streets.push(s);
    streets.forEach(function (s) {
      var r1 = new THREE.Mesh(new THREE.PlaneGeometry(340, ROAD), roadMat);
      r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.1, s); G.add(r1);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, 340), roadMat);
      r2.rotation.x = -Math.PI / 2; r2.position.set(s, 0.1, 0); G.add(r2);
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(340, 0.6), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.12, s); G.add(dash);
      var dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 340), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(s, 0.12, 0); G.add(dash2);
    });

    // --- buildings: one or two per block, skip the plaza + pier blocks ---
    var palette = ['#c9a06a', '#7fa3b8', '#b87f6e', '#8fa98a', '#a8a08a', '#6e8fb8', '#d8b25a', '#9a7fb8'];
    var texA = makeWindowTexture(rng, '#5a6b7d', 0.45);
    var texB = makeWindowTexture(rng, '#7d6a4a', 0.4);
    var texC = makeWindowTexture(rng, '#4a5a6b', 0.5);
    var texs = [texA, texB, texC];
    var roofs = [0x8a4a3a, 0x3a4a5a, 0x5a5a4a, 0x6a3a4a];
    var plaza = { x: 0, z: 0 };   // central plaza stays open

    streets.forEach(function (sx) {
      streets.forEach(function (sz) {
        var cx = sx + BLOCK / 2, cz = sz + BLOCK / 2;
        if (Math.abs(cx - plaza.x) < 40 && Math.abs(cz - plaza.z) < 40) return; // plaza
        if (cx < -150) return; // beach side
        if (cx > 120 && cz > 120) return; // pier district kept open
        var n = rng() < 0.55 ? 1 : 2;
        for (var k = 0; k < n; k++) {
          var w = 14 + rng() * 12, d = 14 + rng() * 12;
          var h = 10 + rng() * rng() * 46;
          var ox = k === 0 ? -7 : 8, oz = k === 0 ? -6 : 7;
          var bx = cx + ox, bz = cz + oz;
          var tex = texs[Math.floor(rng() * texs.length)];
          var b = box(w, h, d, 0xffffff, bx, h / 2, bz, { map: tex });
          G.add(b);
          var roof = box(w + 1, 1.2, d + 1, roofs[Math.floor(rng() * roofs.length)], bx, h + 0.6, bz);
          G.add(roof);
          // rooftop box / antenna on tall towers
          if (h > 30 && rng() < 0.7) {
            var ant = box(0.8, 8 + rng() * 8, 0.8, 0x333333, bx, h + 5, bz);
            G.add(ant);
            var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6),
              new THREE.MeshBasicMaterial({ color: 0xff4444 }));
            beacon.position.set(bx, h + 9 + rng() * 4, bz);
            G.add(beacon);
          }
          colliders.push({ x: bx, z: bz, hx: w / 2 + 0.6, hz: d / 2 + 0.6 });
        }
      });
    });

    // --- central plaza: fountain + palms ---
    var plazaBase = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 1, 24),
      new THREE.MeshLambertMaterial({ color: 0x9a8a72 }));
    plazaBase.position.set(0, 0.5, 0); G.add(plazaBase);
    var fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 2.4, 20),
      new THREE.MeshLambertMaterial({ color: 0x4a90b8 }));
    fountain.position.set(0, 1.2, 0); G.add(fountain);
    colliders.push({ x: 0, z: 0, hx: 9, hz: 9 });

    // --- pier (east side) ---
    var pier = box(10, 1, 70, 0x7a5a3a, 168, 0.5, 150);
    G.add(pier);
    var pierEnd = box(26, 1, 20, 0x7a5a3a, 168, 0.5, 188);
    G.add(pierEnd);
    var shack = box(10, 5, 8, 0xb87f6e, 168, 3.5, 188);
    G.add(shack);
    colliders.push({ x: 168, z: 188, hx: 6, hz: 5 });

    // --- landmarks: bank, hospital, hideout ---
    function landmark(x, z, w, h, d, color, signColor) {
      var tex = texs[(x + z) % 3 < 0 ? 0 : (x + z) % 3] || texA;
      var b = box(w, h, d, 0xffffff, x, h / 2, z, { map: tex });
      G.add(b);
      var sign = box(w * 0.7, 3, 1, signColor, x, h + 1.5, z + d / 2 + 0.6);
      G.add(sign);
      colliders.push({ x: x, z: z, hx: w / 2 + 0.6, hz: d / 2 + 0.6 });
      return { x: x, z: z };
    }
    var bank = landmark(69, -69, 30, 18, 22, 0xd8d0b8, 0x2a6a3a);       // Verde Bank
    var hospital = landmark(-69, 69, 30, 16, 22, 0xe8e8e8, 0xc23a3a);   // St. Lucia Hospital
    var hideout = landmark(-115, -115, 22, 10, 18, 0x6a4a6a, 0xffd23d); // Rio's garage hideout

    // --- palms along beach + plaza ---
    function palm(x, z) {
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6),
        new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
      trunk.position.set(x, 4.5, z); G.add(trunk);
      var top = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 7),
        new THREE.MeshLambertMaterial({ color: 0x2e8a4a }));
      top.position.set(x, 10.5, z); G.add(top);
      colliders.push({ x: x, z: z, hx: 0.9, hz: 0.9 });
    }
    for (var px = -158; px <= 158; px += 28) { palm(-160, px); }
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      palm(Math.cos(a) * 26, Math.sin(a) * 26);
    }

    // --- streetlights on corners ---
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    streets.forEach(function (sx) {
      streets.forEach(function (sz) {
        if (Math.abs(sx) > 150 || Math.abs(sz) > 150) return;
        var pole = box(0.4, 7, 0.4, 0x333a44, sx + 8, 3.5, sz + 8);
        G.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lightMat);
        lamp.position.set(sx + 8, 7.2, sz + 8);
        G.add(lamp);
      });
    });

    // --- parked-car spawn points along streets ---
    streets.forEach(function (s) {
      for (var t = -138; t <= 138; t += 46) {
        if (rng() < 0.6) carSpawns.push({ x: s + 4.5, z: t, alongZ: true });
        if (rng() < 0.6) carSpawns.push({ x: t, z: s + 4.5, alongZ: false });
      }
    });
    // pedestrian spawn points on sidewalks
    for (var p = 0; p < 60; p++) {
      var sx2 = streets[Math.floor(rng() * streets.length)];
      var sz2 = -150 + rng() * 300;
      pedSpawns.push({ x: sx2 + (rng() < 0.5 ? 9 : -9), z: sz2 });
    }

    return {
      colliders: colliders, roadPoints: streets, carSpawns: carSpawns,
      pedSpawns: pedSpawns, bank: bank, hospital: hospital, hideout: hideout,
      pier: { x: 168, z: 188 }, plaza: plaza, bounds: 175
    };
  }

  window.CVH_City = { build: build, mulberry32: mulberry32 };
})();
