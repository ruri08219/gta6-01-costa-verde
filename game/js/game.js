// Costa Verde Heat — game.js
// Main loop and glue: renderer + sun, input, wanted level, police response,
// car stealing, combat with thugs, mission flow, save/load, pause, and the
// deterministic ?shot= scenes used for screenshots.
(function () {
  'use strict';

  var SAVE_KEY = 'cvh-save-v1';
  var SHOT = new URLSearchParams(window.location.search).get('shot') || '';

  var renderer, scene, camera, clock;
  var city, player, raycaster;
  var parkedCars = [], trafficCars = [], policeCars = [], peds = [], thugs = [];
  var markerBeacon = null, markerRing = null;
  var state = 'title'; // title | playing | paused | wasted
  var missions, hudReady = false;
  var keys = {};
  var mouseDown = false;
  var wanted = 0, wantedHeat = 0, calmTimer = 0, bustedTimer = 0;
  var gameTime = 18.4; // hours, sunset start
  var lastShotAt = null;
  var tracers = [];
  var camShake = 0;
  var errors = [];
  var startedAt = performance.now();

  window.addEventListener('error', function (e) { errors.push(String(e.message)); });

  function $(id) { return document.getElementById(id); }

  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return s && typeof s === 'object' ? s : null;
    } catch (e) { return null; }
  }
  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: player.money, mission: missions.current, health: player.health
      }));
    } catch (e) {}
  }

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffb877);
    scene.fog = new THREE.Fog(0xf8b878, 220, 620);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.set(60, 40, 90);

    var hemi = new THREE.HemisphereLight(0xffe0b8, 0x3a5a3a, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffd9a0, 1.4);
    sun.position.set(-180, 120, 80);
    scene.add(sun);

    city = CVH_City.build(scene);
    var rng = CVH_City.mulberry32(777);
    player = CVH_Player.createPlayer(scene, -100, -100);
    player.money = 250;
    missions = CVH_Missions.createManager();

    // parked cars from spawn points
    var spawns = city.carSpawns.slice();
    for (var i = 0; i < 16 && spawns.length; i++) {
      var sp = spawns.splice(Math.floor(rng() * spawns.length), 1)[0];
      var col = [0xc23a3a, 0x3a6ac2, 0xd8d0b8, 0x2a2a2a, 0x3a9a5a, 0xd8a03a][i % 6];
      var car = CVH_Vehicles.createCar(scene, 'SEDAN', col, sp.x, sp.z,
        sp.alongZ ? 0 : Math.PI / 2, false);
      car.driver = null;
      car.mesh.userData.hitRef = { type: 'car', car: car };
      parkedCars.push(car);
    }
    // traffic
    for (var t = 0; t < 12; t++) {
      var tc = CVH_Vehicles.makeTrafficCar(scene, city.roadPoints, rng);
      tc.mesh.userData.hitRef = { type: 'car', car: tc };
      trafficCars.push(tc);
    }
    // pedestrians
    peds = CVH_Pedestrians.spawnPeds(scene, city.pedSpawns, 22, rng);
    peds.forEach(function (p) { p.mesh.userData.hitRef = { type: 'ped', ped: p }; });

    // mission marker beacon
    markerBeacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    markerBeacon.position.y = 30;
    markerBeacon.visible = false;
    scene.add(markerBeacon);
    markerRing = new THREE.Mesh(new THREE.RingGeometry(4, 5.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.2;
    markerRing.visible = false;
    scene.add(markerRing);

    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();
    CVH_HUD.init();
    hudReady = true;

    bindInput();
    wireButtons();
    window.addEventListener('resize', onResize);

    var save = loadSave();
    if (save) {
      player.money = save.money || 250;
      missions.current = Math.min(save.mission || 0, 5);
      $('btnContinue').classList.remove('hidden');
    }
    $('loading').classList.add('hidden');
    applyShotScene(save);
    renderer.setAnimationLoop(tick);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- input ----------
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (e.code === 'KeyE') tryEnterExitCar();
      if (e.code === 'KeyM') startCurrentMission();
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
      if (e.code === 'KeyR') spawnNearbyCar();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    var canvas = $('scene');
    canvas.addEventListener('mousedown', function (e) {
      mouseDown = true;
      if (state === 'playing') {
        if (player.inCar) CVH_Audio.horn();
        else firePistol();
        if (document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (err) {} }
      }
    });
    window.addEventListener('mouseup', function () { mouseDown = false; });
    window.addEventListener('mousemove', function (e) {
      if (state !== 'playing') return;
      var dx = e.movementX || 0, dy = e.movementY || 0;
      if (document.pointerLockElement === canvas || mouseDown) {
        player.camYaw -= dx * 0.0032;
        player.camPitch = Math.max(-0.2, Math.min(0.9, player.camPitch + dy * 0.002));
      }
    });
    canvas.addEventListener('click', function () { CVH_Audio.unlock(); });
  }

  function readInput() {
    return {
      forward: !!(keys.KeyW || keys.ArrowUp),
      back: !!(keys.KeyS || keys.ArrowDown),
      left: !!(keys.KeyA || keys.ArrowLeft),
      right: !!(keys.KeyD || keys.ArrowRight),
      sprint: !!keys.ShiftLeft || !!keys.ShiftRight,
      brake: !!keys.Space
    };
  }

  function wireButtons() {
    $('btnStart').addEventListener('click', function () { CVH_Audio.unlock(); CVH_Audio.click(); startGame(false); });
    $('btnContinue').addEventListener('click', function () { CVH_Audio.unlock(); CVH_Audio.click(); startGame(true); });
    $('btnResume').addEventListener('click', function () { togglePause(); });
    $('btnRestart').addEventListener('click', function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      location.reload();
    });
    $('btnQuit').addEventListener('click', function () { location.reload(); });
    $('btnRespawn').addEventListener('click', function () {
      player.health = 100; player.money = Math.max(0, player.money - 50);
      player.x = city.hospital.x + 16; player.z = city.hospital.z;
      player.mesh.position.set(player.x, 0, player.z);
      setWanted(0);
      $('wasted').classList.add('hidden');
      state = 'playing';
      CVH_HUD.showToast('BACK ON YOUR FEET', 'St. Lucia Hospital patched you up. -$50');
    });
  }

  // ---------- game flow ----------
  function startGame(continueSave) {
    $('startScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    state = 'playing';
    if (!continueSave) { player.money = 250; missions.current = 0; }
    CVH_HUD.setMissionList(missions.missions, missions.current, missions.done);
    startCurrentMission();
    CVH_HUD.showToast('COSTA VERDE HEAT', 'Marisol: steal a car, Rio. The garage is marked.');
  }

  function startCurrentMission() {
    if (state !== 'playing' || missions.active || missions.done) return;
    var m = CVH_Missions.startMission(missions);
    if (!m) return;
    CVH_HUD.setObjective('JOB ' + m.id + ' — ' + m.name.toUpperCase(), m.brief);
    CVH_HUD.showToast('NEW JOB: ' + m.name.toUpperCase(), m.giver + ' — $' + m.reward);
    CVH_Audio.pickup();
    updateMarker();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      $('pauseScreen').classList.remove('hidden');
      writeSave();
    } else if (state === 'paused') {
      state = 'playing';
      $('pauseScreen').classList.add('hidden');
    }
  }

  function setWanted(n) {
    n = Math.max(0, Math.min(5, n));
    if (n > wanted) { CVH_Audio.wantedUp(); calmTimer = 0; }
    wanted = n;
    if (wanted > 0) CVH_Audio.startSiren(); else CVH_Audio.stopSiren();
  }

  function nearestCar(maxDist) {
    var all = parkedCars.concat(trafficCars);
    var best = null, bd = maxDist;
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.driver === 'player') continue;
      var dx = c.x - player.x, dz = c.z - player.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function tryEnterExitCar() {
    if (state !== 'playing') return;
    if (player.inCar) {
      var car = player.inCar;
      car.driver = null;
      player.inCar = null;
      player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
      player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
      player.camYaw = car.heading;
      player.mesh.visible = true;
      CVH_Audio.door();
      CVH_Audio.setEngine(0, false);
      return;
    }
    var car2 = nearestCar(4.5);
    if (!car2) return;
    if (car2.driver === 'traffic') {
      setWanted(wanted + 1);
      CVH_HUD.showToast('CAR STOLEN!', 'The driver ran off screaming. The police noticed.');
      trafficCars.splice(trafficCars.indexOf(car2), 1);
      parkedCars.push(car2);
    }
    car2.driver = 'player';
    player.inCar = car2;
    player.mesh.visible = false;
    player.camYaw = car2.heading;
    CVH_Audio.door();
  }

  function spawnNearbyCar() {
    if (state !== 'playing' || player.inCar) return;
    var car = CVH_Vehicles.createCar(scene, 'SEDAN', 0xd8a03a,
      player.x + 6, player.z + 4, player.camYaw, false);
    car.driver = null;
    car.mesh.userData.hitRef = { type: 'car', car: car };
    parkedCars.push(car);
    CVH_HUD.showToast('A CAR PULLED UP', 'Marisol sent a ride. Press E to get in.');
  }

  // ---------- combat ----------
  function firePistol() {
    if (state !== 'playing' || player.inCar) return;
    CVH_Audio.shoot();
    camShake = 0.35;
    lastShotAt = { x: player.x, z: player.z };
    setWanted(wanted + 1);
    var targets = [];
    thugs.forEach(function (t) { targets.push(t.mesh); });
    peds.forEach(function (p) { targets.push(p.mesh); });
    trafficCars.concat(parkedCars, policeCars).forEach(function (c) { targets.push(c.mesh); });
    var hit = CVH_Player.shoot(camera, scene, targets, raycaster);
    var end = null;
    if (hit && hit.ref) {
      end = hit.point;
      if (hit.ref.type === 'thug') {
        hit.ref.thug.hp -= 34;
        spawnSpark(hit.point, 0xffd23d);
        if (hit.ref.thug.hp <= 0) killThug(hit.ref.thug);
      } else if (hit.ref.type === 'ped') {
        setWanted(wanted + 1);
        hit.ref.ped.state = 'flee'; hit.ref.ped.panic = 4;
        spawnSpark(hit.point, 0xff4444);
      } else if (hit.ref.type === 'car') {
        hit.ref.car.health -= 20;
        spawnSpark(hit.point, 0xffaa00);
      }
    } else {
      // tracer into the distance
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      end = camera.position.clone().add(dir.multiplyScalar(80));
    }
    if (end) addTracer(camera.position.clone(), end);
  }

  function addTracer(from, to) {
    var geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    line.position.y = 0;
    scene.add(line);
    tracers.push({ line: line, t: 0 });
  }

  function spawnSpark(pos, color) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: color }));
    s.position.copy(pos);
    scene.add(s);
    tracers.push({ line: s, t: 0, spark: true });
  }

  function makeThug(x, z) {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: 0x3a1a1a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), mat);
    body.position.y = 1.2; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
    head.position.y = 1.85; g.add(head);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.1, 0.3); g.add(gun);
    g.position.set(x, 0, z);
    scene.add(g);
    var thug = { mesh: g, x: x, z: z, hp: 100, shootT: 1 + Math.random() * 2 };
    g.userData.hitRef = { type: 'thug', thug: thug };
    thugs.push(thug);
    return thug;
  }

  function killThug(thug) {
    scene.remove(thug.mesh);
    thugs.splice(thugs.indexOf(thug), 1);
    missions.kills++;
    CVH_Audio.pickup();
    CVH_HUD.showToast('THUG DOWN', missions.kills + ' of 3 — keep going, Rio!');
    spawnSpark(thug.mesh.position, 0x7dff9a);
  }

  function updateThugs(dt) {
    for (var i = 0; i < thugs.length; i++) {
      var t = thugs[i];
      var dx = player.x - t.x, dz = player.z - t.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      t.mesh.rotation.y = Math.atan2(dx, dz);
      // shuffle closer, keep some distance
      if (d > 10) {
        t.x += (dx / d) * 2.2 * dt;
        t.z += (dz / d) * 2.2 * dt;
        t.mesh.position.set(t.x, 0, t.z);
      }
      t.shootT -= dt;
      if (t.shootT <= 0 && d < 45) {
        t.shootT = 1.6 + Math.random();
        if (Math.random() < 0.55) {
          player.health -= 6 + Math.random() * 6;
          player.lastDamageAt = performance.now();
          addTracer(t.mesh.position.clone().setY(1.4),
            new THREE.Vector3(player.x, 1.3, player.z));
          camShake = 0.4;
        }
      }
    }
  }

  // ---------- police / wanted ----------
  function updateWanted(dt) {
    var px = player.inCar ? player.inCar.x : player.x;
    var pz = player.inCar ? player.inCar.z : player.z;
    // spawn cruisers up to wanted level + 1
    var wantCount = wanted > 0 ? Math.min(wanted + 1, 4) : 0;
    while (policeCars.length < wantCount) {
      var ang = Math.random() * Math.PI * 2;
      var car = CVH_Vehicles.createCar(scene, 'SEDAN', 0x111111,
        px + Math.cos(ang) * 70, pz + Math.sin(ang) * 70, 0, true);
      car.driver = 'police';
      car.mesh.userData.hitRef = { type: 'car', car: car };
      policeCars.push(car);
    }
    while (policeCars.length > wantCount) {
      var gone = policeCars.pop();
      scene.remove(gone.mesh);
    }
    // chase + ramming
    var nearest = 999;
    for (var i = 0; i < policeCars.length; i++) {
      var d = CVH_Vehicles.updatePolice(policeCars[i], dt, { x: px, z: pz }, city.colliders);
      if (d < nearest) nearest = d;
      // ram damage
      if (d < 3.2) {
        if (player.inCar) {
          player.inCar.speed *= 0.4;
          player.inCar.health -= 4;
          if (Math.random() < 0.3) CVH_Audio.crash();
        } else {
          player.health -= 12 * dt * 3;
          bustedTimer += dt;
        }
        camShake = 0.3;
      }
    }
    // busted: cop on top of you on foot
    if (!player.inCar && wanted >= 2 && nearest < 2.6) {
      bustedTimer += dt;
      if (bustedTimer > 2.5) return wasted('BUSTED', 'The Costa Verde Police hauled you in, Rio.');
    } else if (nearest > 6) {
      bustedTimer = 0;
    }
    // wanted decays when no cop is near; hideout clears it fast
    var inHideout = Math.abs(px - city.hideout.x) < 16 && Math.abs(pz - city.hideout.z) < 16;
    if (wanted > 0 && nearest > 55) {
      calmTimer += dt * (inHideout ? 4 : 1);
      if (calmTimer > 18) { setWanted(wanted - 1); calmTimer = 0; }
    } else {
      calmTimer = 0;
    }
    return null;
  }

  function wasted(title, text) {
    state = 'wasted';
    $('wastedText').textContent = text;
    $('wasted').querySelector('h1').textContent = title;
    $('wasted').classList.remove('hidden');
    CVH_Audio.missionFail();
    CVH_Audio.stopSiren();
    return 'wasted';
  }

  // ---------- missions ----------
  function updateMarker() {
    var st = missions.active ? CVH_Missions.currentStage(missions) : null;
    var target = null;
    if (st && (st.type === 'goto' || st.type === 'grab' || st.type === 'onFootAt' || st.type === 'gotoClean')) {
      target = { x: st.x, z: st.z };
    }
    if (target) {
      markerBeacon.position.set(target.x, 30, target.z);
      markerRing.position.set(target.x, 0.2, target.z);
      markerBeacon.visible = true;
      markerRing.visible = true;
    } else {
      markerBeacon.visible = false;
      markerRing.visible = false;
    }
    return target;
  }

  function updateMissions(dt) {
    if (!missions.active) return;
    var px = player.inCar ? player.inCar.x : player.x;
    var pz = player.inCar ? player.inCar.z : player.z;
    var ev = CVH_Missions.update(missions, {
      playerX: px, playerZ: pz, wanted: wanted, inCar: !!player.inCar,
      onGrab: function () { setWanted(3); CVH_HUD.showToast('CASH GRABBED!', 'The alarm is screaming — run!'); }
    }, dt);
    if (ev === 'stageComplete') {
      var st = CVH_Missions.currentStage(missions);
      CVH_HUD.showToast('OBJECTIVE DONE', st ? st.text : '');
      CVH_Audio.pickup();
      updateMarker();
      var mis = CVH_Missions.currentMission(missions);
      CVH_HUD.setObjective('JOB ' + mis.id + ' — ' + mis.name.toUpperCase(), st ? st.text : mis.brief);
      // mission 4 spawns thugs when reaching the plaza
      if (mis.id === 4 && missions.stage === 1 && thugs.length === 0) {
        makeThug(6, 4); makeThug(-5, -6); makeThug(3, -9);
        CVH_HUD.showToast('AMBUSH!', 'Salazar\u2019s thugs opened fire — fight back!');
        setWanted(2);
      }
    } else if (ev === 'missionComplete') {
      var done = missions.missions[missions.current - 1];
      if (done) {
        player.money += done.reward;
        CVH_HUD.showToast('JOB COMPLETE: ' + done.name.toUpperCase(), '+$' + done.reward + ' — Marisol is impressed.');
        CVH_Audio.missionOk();
      }
      if (missions.done) {
        CVH_HUD.setObjective('KING OF COSTA VERDE', 'All six jobs done. The city is yours, Rio.');
        CVH_HUD.showToast('KING OF COSTA VERDE!', 'Every job complete. Don Salazar is finished.');
      } else {
        var next = CVH_Missions.currentMission(missions);
        CVH_HUD.setObjective('JOB ' + next.id + ' — ' + next.name.toUpperCase(), 'Press M to start the next job.');
      }
      CVH_HUD.setMissionList(missions.missions, missions.current, missions.done);
      updateMarker();
      writeSave();
    } else if (ev === 'timedOut') {
      missions.active = false;
      CVH_HUD.showToast('TOO SLOW', 'The pier crew left. Press M to retry the job.');
      CVH_Audio.missionFail();
      updateMarker();
    }
  }

  // ---------- per-frame ----------
  function tick() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = performance.now() / 1000;
    gameTime += dt / 240; // a full day in ~4 minutes of play
    if (gameTime >= 24) gameTime -= 24;

    if (state === 'title') {
      // slow cinematic orbit over the city for the start screen
      var a = t * 0.05;
      camera.position.set(Math.cos(a) * 150, 55, Math.sin(a) * 150);
      camera.lookAt(0, 8, 0);
      CVH_Vehicles.updateTraffic(trafficCars[0], dt, city.roadPoints, city.colliders);
      renderer.render(scene, camera);
      return;
    }
    if (state !== 'playing') { renderer.render(scene, camera); return; }

    var input = readInput();
    if (SHOT === 'chase' && player.inCar) input.forward = true; // keep the getaway rolling for the shot
    if (player.inCar) {
      var spd = CVH_Vehicles.drivePlayerCar(player.inCar, input, dt, city.colliders, city.bounds,
        function (v) { CVH_Audio.crash(); camShake = 0.5; player.health -= 2; });
      CVH_Audio.setEngine(Math.abs(spd) / 38, true);
      player.x = player.inCar.x; player.z = player.inCar.z;
      player.camYaw = player.inCar.heading + Math.PI;
    } else {
      CVH_Player.updateOnFoot(player, input, dt, city.colliders, city.bounds);
      CVH_Audio.setEngine(0, false);
    }
    // camera mouse-look yaw follows car heading when driving
    CVH_Player.updateCamera(player, camera, dt, player.inCar ? Math.abs(player.inCar.speed) : 0);
    if (camShake > 0) {
      camera.position.x += (Math.random() - 0.5) * camShake;
      camera.position.y += (Math.random() - 0.5) * camShake;
      camShake = Math.max(0, camShake - dt * 2);
    }

    for (var i = 0; i < trafficCars.length; i++) {
      CVH_Vehicles.updateTraffic(trafficCars[i], dt, city.roadPoints, city.colliders);
    }
    CVH_Pedestrians.updatePeds(peds, dt, { x: player.x, z: player.z }, lastShotAt, city.bounds);
    lastShotAt = null;
    updateThugs(dt);
    var bust = updateWanted(dt);
    if (bust === 'wasted') { renderer.render(scene, camera); return; }
    updateMissions(dt);

    // health regen + wasted check
    if (performance.now() - player.lastDamageAt > 8000 && player.health < 100) {
      player.health = Math.min(100, player.health + dt * 2);
    }
    if (player.health <= 0) {
      wasted('WASTED', 'Rio went down in the streets of Costa Verde.');
      renderer.render(scene, camera);
      return;
    }

    // marker pulse + tracers fade
    if (markerRing.visible) markerRing.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
    for (var j = tracers.length - 1; j >= 0; j--) {
      tracers[j].t += dt;
      if (tracers[j].t > 0.12) {
        scene.remove(tracers[j].line);
        tracers.splice(j, 1);
      }
    }

    // HUD
    if (hudReady) {
      var hh = Math.floor(gameTime), mm = Math.floor((gameTime - hh) * 60);
      var label = gameTime < 6 ? 'NIGHT' : gameTime < 11 ? 'MORNING' : gameTime < 17 ? 'AFTERNOON' : gameTime < 20 ? 'SUNSET' : 'NIGHT';
      CVH_HUD.update({
        money: player.money, health: Math.round(player.health), wanted: wanted,
        inCar: !!player.inCar, carName: player.inCar ? player.inCar.name : '',
        speed: player.inCar ? player.inCar.speed : 0,
        clock: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
        dayLabel: 'COSTA VERDE • ' + label
      });
      var st2 = missions.active ? CVH_Missions.currentStage(missions) : null;
      var marker = null;
      if (st2 && (st2.type === 'goto' || st2.type === 'grab' || st2.type === 'onFootAt' || st2.type === 'gotoClean')) {
        marker = { x: st2.x, z: st2.z };
      }
      CVH_HUD.drawMinimap({
        streets: city.roadPoints, hideout: city.hideout, bank: city.bank, hospital: city.hospital,
        marker: marker, peds: peds, cars: parkedCars.concat(trafficCars, policeCars),
        playerX: player.x, playerZ: player.z, heading: player.camYaw
      });
    }
    renderer.render(scene, camera);
  }

  // ---------- deterministic screenshot scenes (?shot=) ----------
  function applyShotScene(save) {
    if (!SHOT) return;
    // all shot scenes start the game immediately (no title screen)
    $('startScreen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    state = 'playing';
    CVH_HUD.setMissionList(missions.missions, missions.current, missions.done);
    if (SHOT === 'start') {
      state = 'title'; // keep the title screen over the city vista
      $('startScreen').classList.remove('hidden');
      $('hud').classList.add('hidden');
      return;
    }
    if (SHOT === 'play') {
      player.x = -12; player.z = 23; player.camYaw = Math.PI * 0.78;
      player.mesh.position.set(player.x, 0, player.z);
      // a parked car right beside Rio for the shot
      var near = CVH_Vehicles.createCar(scene, 'SEDAN', 0x3a6ac2, -8, 34, 0, false);
      near.driver = null;
      near.mesh.userData.hitRef = { type: 'car', car: near };
      parkedCars.push(near);
      startCurrentMission();
      return;
    }
    if (SHOT === 'chase') {
      // Rio in a sports car, wanted 3, cruisers closing in
      var car = CVH_Vehicles.createCar(scene, 'SPORTS', 0xc23a3a, -12, -46, Math.PI, false);
      car.driver = 'player';
      car.mesh.userData.hitRef = { type: 'car', car: car };
      parkedCars.push(car);
      player.inCar = car;
      player.mesh.visible = false;
      player.x = -12; player.z = -46; player.camYaw = 0;
      car.speed = 22;
      setWanted(3);
      // two cruisers ahead in Rio's path for the shot, lights flashing
      [[-12, -72, 0], [34, -58, Math.PI / 2]].forEach(function (p) {
        var pc = CVH_Vehicles.createCar(scene, 'SEDAN', 0x111111, p[0], p[1], p[2], true);
        pc.driver = 'police';
        pc.mesh.userData.hitRef = { type: 'car', car: pc };
        policeCars.push(pc);
      });
      CVH_HUD.setObjective('ON THE RUN', 'Wanted level 3 — lose the Costa Verde Police!');
      CVH_HUD.showToast('WANTED — LEVEL 3', 'Cruisers inbound. Lose them, Rio!');
      return;
    }
    if (SHOT === 'mission') {
      // Mission 5 in progress: at the bank doors, alarm tripped, cops coming
      missions.current = 4; missions.stage = 1;
      CVH_Missions.startMission(missions);
      missions.stage = 1; // grab stage
      CVH_HUD.setMissionList(missions.missions, missions.current, missions.done);
      player.x = 80; player.z = -34; player.camYaw = Math.PI;
      player.mesh.position.set(player.x, 0, player.z);
      // a cruiser rolling in down the bank street for the shot
      var mc = CVH_Vehicles.createCar(scene, 'SEDAN', 0x111111, 52, -58, Math.PI / 2, true);
      mc.driver = 'police';
      mc.mesh.userData.hitRef = { type: 'car', car: mc };
      policeCars.push(mc);
      var m5 = CVH_Missions.currentMission(missions);
      CVH_HUD.setObjective('JOB 5 — THE BIG SCORE', 'Grab the cash inside Verde Bank (yellow marker)');
      CVH_HUD.showToast('JOB 5: THE BIG SCORE', 'Verde Bank — grab the cash and run.');
      setWanted(2);
      updateMarker();
      return;
    }
  }

  window.__cvh = {
    get state() { return state; },
    get wanted() { return wanted; },
    get inCar() { return !!player.inCar; },
    get money() { return player.money; },
    get health() { return Math.round(player.health); },
    get mission() { return missions.current + 1; },
    get missionStage() { return missions.stage; },
    get missionActive() { return missions.active; },
    get playerPos() { return { x: Math.round(player.x), z: Math.round(player.z) }; },
    get counts() { return { parked: parkedCars.length, traffic: trafficCars.length, police: policeCars.length, peds: peds.length, thugs: thugs.length }; },
    get parked() { return parkedCars.length ? { x: Math.round(parkedCars[0].x), z: Math.round(parkedCars[0].z) } : null; },
    get errors() { return errors; },
    get uptimeMs() { return Math.round(performance.now() - startedAt); },
    pressKey: function (code, down) { keys[code] = down; },
    enterCar: tryEnterExitCar,
    setWanted: setWanted,
    startMission: startCurrentMission,
    fire: firePistol,
    teleport: function (x, z) { player.x = x; player.z = z; player.mesh.position.set(x, 0, z); }
  };

  window.addEventListener('DOMContentLoaded', init);
})();
