// Costa Verde Heat — audio.js
// All sound is synthesized live with WebAudio: engine hum, sirens, gunshots,
// pickups, UI clicks and a looping bass-driven street groove. No audio files.
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var musicTimer = null;
  var engineOsc = null;
  var engineGain = null;
  var sirenOsc = null;
  var sirenGain = null;
  var musicOn = false;
  var beat = 0;

  // Bassline groove in A minor, one bar of 8th notes, looped by a timer.
  var BASS = [55, 0, 55, 65.41, 0, 55, 49, 55, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
  var HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];

  function ensureContext() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo, when) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function startMusic() {
    if (musicOn || !ctx) return;
    musicOn = true;
    beat = 0;
    musicTimer = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      var b = BASS[beat % BASS.length];
      if (b) tone(b, 0.22, 'sawtooth', 0.10);
      tone(220, 0.05, 'square', 0.015);
      if (HAT[beat % HAT.length]) noiseBurst(0.03, 0.05, 6000);
      if (beat % 16 === 0) tone(110, 0.5, 'triangle', 0.06, 55);
      beat++;
    }, 190);
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(rpm01, on) {
    if (!engineOsc || !ctx) return;
    var target = on ? 0.05 + rpm01 * 0.09 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(50 + rpm01 * 130, ctx.currentTime, 0.08);
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); lfo.start();
    sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.3);
  }

  function stopSiren() {
    if (!sirenOsc) return;
    try { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch (e) {}
    var o = sirenOsc; sirenOsc = null;
    setTimeout(function () { try { o.stop(); } catch (e) {} }, 400);
  }

  window.CVH_Audio = {
    unlock: function () { if (ensureContext()) { startMusic(); startEngine(); } },
    click: function () { if (ensureContext()) tone(660, 0.08, 'square', 0.12); },
    shoot: function () { if (ctx) { noiseBurst(0.12, 0.4, 2500); tone(180, 0.1, 'square', 0.18, 60); } },
    crash: function () { if (ctx) { noiseBurst(0.3, 0.5, 700); tone(90, 0.25, 'sine', 0.3, 40); } },
    pickup: function () { if (ctx) { tone(523, 0.1, 'sine', 0.2); tone(784, 0.16, 'sine', 0.2, 0, 0.09); } },
    missionOk: function () { if (ctx) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.2, 0, i * 0.11); }); } },
    missionFail: function () { if (ctx) { tone(220, 0.4, 'sawtooth', 0.15, 110); } },
    horn: function () { if (ctx) { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); } },
    door: function () { if (ctx) { noiseBurst(0.08, 0.2, 900); tone(140, 0.08, 'sine', 0.15, 90); } },
    wantedUp: function () { if (ctx) { tone(880, 0.12, 'square', 0.12); tone(880, 0.12, 'square', 0.12, 0, 0.15); } },
    setEngine: setEngine,
    startSiren: startSiren,
    stopSiren: stopSiren,
    stopMusic: stopMusic
  };
})();
