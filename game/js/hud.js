// Costa Verde Heat — hud.js
// The 2D overlay: money, health, wanted stars, mission list, objective bar,
// toast banners, speedometer and the circular minimap (player, cars, police,
// peds, mission marker, hideout).
(function () {
  'use strict';

  var els = {};
  var toastTimer = null;

  function init() {
    ['moneyVal', 'healthfill', 'armorVal', 'stars', 'objTitle', 'objText',
     'toast', 'crosshair', 'speedo', 'carName', 'speedVal', 'clockVal',
     'dayVal', 'missionList', 'hud', 'minimap'].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
    els.mmCtx = els.minimap.getContext('2d');
  }

  function showToast(title, sub, ms) {
    els.toast.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    els.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.add('hidden'); }, ms || 3200);
  }

  function setStars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      s += i < n ? '\u2605' : '<span class="off">\u2605</span>';
    }
    els.stars.innerHTML = s;
  }

  function setObjective(title, text) {
    els.objTitle.textContent = title;
    els.objText.textContent = text;
  }

  function setMissionList(missions, current, done) {
    var html = '<b style="color:#ffd23d">JOBS — MARISOL\u2019S PLAN</b><br>';
    missions.forEach(function (m, i) {
      var cls = done || i < current ? 'done' : (i === current ? 'cur' : 'todo');
      var mark = done || i < current ? '\u2713 ' : (i === current ? '\u25B6 ' : '\u25CB ');
      html += '<span class="' + cls + '">' + mark + m.id + '. ' + m.name +
        ' — $' + m.reward + '</span><br>';
    });
    els.missionList.innerHTML = html;
  }

  function update(state) {
    els.moneyVal.textContent = state.money;
    els.healthfill.style.width = Math.max(0, state.health) + '%';
    els.healthfill.style.background = state.health > 50 ?
      'linear-gradient(90deg,#3ddc5a,#7dff9a)' : 'linear-gradient(90deg,#ff5a4e,#ff9a3d)';
    els.armorVal.textContent = state.inCar ? state.carName + ' — CLICK TO HONK' : 'PISTOL READY';
    setStars(state.wanted);
    els.clockVal.textContent = state.clock;
    els.dayVal.textContent = state.dayLabel;
    if (state.inCar) {
      els.speedo.classList.remove('hidden');
      els.carName.textContent = state.carName;
      els.speedVal.textContent = Math.round(Math.abs(state.speed) * 3.2);
    } else {
      els.speedo.classList.add('hidden');
    }
    els.crosshair.classList.toggle('hidden', !!state.inCar);
  }

  // Minimap: world is -175..175 mapped onto a 220px circle.
  function drawMinimap(state) {
    var c = els.mmCtx;
    var W = 220, C = 110, S = W / 380;
    c.clearRect(0, 0, W, W);
    c.fillStyle = '#12324a'; c.fillRect(0, 0, W, W);
    // ocean + beach
    c.fillStyle = '#1e7fa8'; c.fillRect(0, 0, 26, W);
    c.fillStyle = '#e8d29a'; c.fillRect(26, 0, 8, W);
    // land + roads
    c.fillStyle = '#2e4a2e'; c.fillRect(34, 0, W - 34, W);
    c.strokeStyle = '#3a3f46'; c.lineWidth = 5;
    state.streets.forEach(function (s) {
      var p = (s + 190) * S;
      c.beginPath(); c.moveTo(0, p); c.lineTo(W, p); c.stroke();
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, W); c.stroke();
    });
    function dot(x, z, color, r) {
      c.fillStyle = color;
      c.beginPath(); c.arc((x + 190) * S, (z + 190) * S, r, 0, Math.PI * 2); c.fill();
    }
    dot(state.hideout.x, state.hideout.z, '#ffd23d', 5);   // garage
    dot(state.bank.x, state.bank.z, '#7dff9a', 4);          // bank
    dot(state.hospital.x, state.hospital.z, '#ff6a6a', 4); // hospital
    if (state.marker) {
      var mx = (state.marker.x + 190) * S, my = (state.marker.z + 190) * S;
      var pulse = 6 + Math.sin(performance.now() / 200) * 2;
      c.strokeStyle = '#ffd23d'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(mx, my, pulse, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffd23d';
      c.beginPath(); c.arc(mx, my, 3.5, 0, Math.PI * 2); c.fill();
    }
    state.peds.forEach(function (p) { dot(p.x, p.z, '#cfe6ff', 1.6); });
    state.cars.forEach(function (car) {
      dot(car.x, car.z, car.isPolice ? '#ff4444' : '#ffffff', 2.6);
    });
    // player arrow
    var px = (state.playerX + 190) * S, py = (state.playerZ + 190) * S;
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)));
    c.fillStyle = '#ffd23d';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    // view cone
    c.strokeStyle = 'rgba(255,210,61,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.arc(px, py, 26, 0, Math.PI * 2); c.stroke();
  }

  window.CVH_HUD = {
    init: init, showToast: showToast, setObjective: setObjective,
    setMissionList: setMissionList, update: update, drawMinimap: drawMinimap
  };
})();
