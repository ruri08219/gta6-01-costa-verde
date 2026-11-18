# Costa Verde Heat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ruri08219/gta6-01-costa-verde/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ruri08219/gta6-01-costa-verde/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in **Costa Verde**, a sun-soaked coastal
city. You are **Rio Vega**, broke and back home — and Marisol Duarte has a plan
to take the city back from Don Salazar's crew, one job at a time.

## Play

Serve `game/` with any static server (or run `node serve.ts`) and open
`http://localhost:8080` in a desktop browser. No network needed: the only
library is three.js, vendored under `game/vendor/`, and all sound is
synthesized live with WebAudio.

- **On foot** — WASD to walk, Shift to sprint, mouse to look, click to shoot.
- **Driving** — walk up to any car and press **E** to steal it; WASD steers,
  Space brakes, E gets out again.
- **Wanted level** — stealing cars and firing your pistol raises your stars
  (0–5). Costa Verde Police cruisers chase and ram you; lose them or hide at
  the garage until the heat dies down.
- **Six story jobs** — steal your first wheels, run a sunset delivery to the
  pier, lose the heat, fight Salazar's thugs at the plaza, rob Verde Bank,
  and claim the boardwalk as King of Costa Verde. Press **M** to start a job.
- **Living city** — traffic cruising the street grid, pedestrians strolling
  the sidewalks (and fleeing gunfire), a beach, a pier, a plaza fountain,
  and a day cycle from morning to sunset.
- **HUD** — money, health, wanted stars, a circular minimap (player, cars,
  police, mission marker), objective bar and speedometer.
- **Save** — progress (money, job, health) saves to localStorage; continue
  from the title screen. **P** pauses.

## Tech

- three.js (r152, vendored minified build) for the 3D city, cars and camera.
- Plain ES modules split by job: `city.js`, `vehicles.js`, `pedestrians.js`,
  `player.js`, `missions.js`, `hud.js`, `audio.js`, `game.js`.
- Deterministic screenshot scenes via `?shot=start|play|chase|mission`.

## License

MIT — see [LICENSE](LICENSE).
