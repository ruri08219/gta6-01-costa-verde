// Costa Verde Heat — missions.js
// Six story jobs for Rio Vega, from Marisol Duarte's plan to take Costa Verde
// back from Don Salazar's crew. Each mission has stages with a target point,
// a radius, and a reward. The mission manager tracks progress and completion.
(function () {
  'use strict';

  var MISSIONS = [
    {
      id: 1, name: 'First Wheels', giver: 'Marisol Duarte',
      brief: 'You are broke, Rio. Steal any car on the street and bring it to my garage.',
      reward: 150,
      stages: [
        { text: 'Steal a car — walk up to one and press E', type: 'enterCar' },
        { text: 'Drive the car to Marisol\u2019s garage (yellow marker)', type: 'goto', x: -115, z: -115, r: 12 }
      ]
    },
    {
      id: 2, name: 'Sunset Delivery', giver: 'Marisol Duarte',
      brief: 'A package for the pier crew. Drive it to the end of the pier — fast, the sun is setting.',
      reward: 300,
      stages: [
        { text: 'Get in a car', type: 'enterCar' },
        { text: 'Deliver the package to the pier (yellow marker)', type: 'goto', x: 168, z: 188, r: 12, timed: 75 }
      ]
    },
    {
      id: 3, name: 'Lose the Heat', giver: 'Marisol Duarte',
      brief: 'Salazar\u2019s boys tipped off the police. Get a wanted level, then shake it — hide at the garage until the heat dies.',
      reward: 250,
      stages: [
        { text: 'Raise your wanted level — steal a car or fire your pistol', type: 'wantedAtLeast', level: 1 },
        { text: 'Now lose the cops: reach the garage with 0 stars', type: 'gotoClean', x: -115, z: -115, r: 14 }
      ]
    },
    {
      id: 4, name: 'Street Fight', giver: 'Marisol Duarte',
      brief: 'Three of Salazar\u2019s thugs are shaking down the plaza. Show them Costa Verde has a new owner. Click to shoot.',
      reward: 400,
      stages: [
        { text: 'Go to the central plaza', type: 'goto', x: 0, z: 0, r: 16 },
        { text: 'Take down all 3 thugs', type: 'kill', count: 3 }
      ]
    },
    {
      id: 5, name: 'The Big Score', giver: 'Marisol Duarte',
      brief: 'Verde Bank, noon rush. Grab the cash, then lose the police and bring it home. This is the one, Rio.',
      reward: 800,
      stages: [
        { text: 'Reach Verde Bank', type: 'goto', x: 69, z: -69, r: 14 },
        { text: 'Grab the cash inside (walk to the doors)', type: 'grab', x: 69, z: -52, r: 6 },
        { text: 'Escape to the garage — the whole city is after you', type: 'goto', x: -115, z: -115, r: 14 }
      ]
    },
    {
      id: 6, name: 'King of Costa Verde', giver: 'Marisol Duarte',
      brief: 'One last ride: take the sunset boulevard to the beach boardwalk and plant our flag. Don Salazar is finished.',
      reward: 1000,
      stages: [
        { text: 'Get in a car', type: 'enterCar' },
        { text: 'Drive to the beach boardwalk (yellow marker)', type: 'goto', x: -166, z: 0, r: 12 },
        { text: 'Stand on the boardwalk and claim the city', type: 'onFootAt', x: -166, z: 0, r: 8 }
      ]
    }
  ];

  function createManager() {
    return {
      missions: MISSIONS,
      current: 0,            // index into MISSIONS
      stage: 0,
      kills: 0,
      timer: 0,
      active: false,
      done: false,
      state: 'idle'          // idle | active | complete
    };
  }

  function currentMission(m) { return m.missions[m.current] || null; }
  function currentStage(m) {
    var mis = currentMission(m);
    return mis ? mis.stages[m.stage] : null;
  }

  function startMission(m) {
    var mis = currentMission(m);
    if (!mis) { m.state = 'complete'; m.done = true; return null; }
    m.active = true; m.state = 'active'; m.stage = 0; m.kills = 0; m.timer = 0;
    return mis;
  }

  function advanceStage(m) {
    m.stage++;
    var mis = currentMission(m);
    if (m.stage >= mis.stages.length) {
      m.active = false; m.state = 'idle';
      m.current++;
      if (m.current >= m.missions.length) { m.done = true; m.state = 'complete'; }
      return 'missionComplete';
    }
    return 'stageComplete';
  }

  // Called every frame; returns an event string or null.
  function update(m, ctx, dt) {
    if (!m.active) return null;
    var st = currentStage(m);
    if (!st) return null;
    if (st.timed) {
      m.timer += dt;
      if (m.timer > st.timed) return 'timedOut';
    }
    var px = ctx.playerX, pz = ctx.playerZ;
    switch (st.type) {
      case 'goto': case 'grab': case 'onFootAt': {
        var dx = px - st.x, dz = pz - st.z;
        if (dx * dx + dz * dz < st.r * st.r) {
          if (st.type === 'onFootAt' && ctx.inCar) return null;
          if (st.type === 'grab') ctx.onGrab && ctx.onGrab();
          return advanceStage(m);
        }
        break;
      }
      case 'gotoClean': {
        var gx = px - st.x, gz = pz - st.z;
        if (ctx.wanted === 0 && gx * gx + gz * gz < st.r * st.r) return advanceStage(m);
        break;
      }
      case 'enterCar':
        if (ctx.inCar) return advanceStage(m);
        break;
      case 'wantedAtLeast':
        if (ctx.wanted >= st.level) return advanceStage(m);
        break;
      case 'kill':
        if (m.kills >= st.count) return advanceStage(m);
        break;
    }
    return null;
  }

  window.CVH_Missions = {
    MISSIONS: MISSIONS, createManager: createManager,
    currentMission: currentMission, currentStage: currentStage,
    startMission: startMission, update: update
  };
})();
