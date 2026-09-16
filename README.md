# The Last V8

A browser remake of Mastertronic's 1985 Commodore 64 classic **The Last V8**. Nuclear war has left the surface irradiated, you are driving the last V8 still running, and the base is about to seal itself. One road home, a countdown that never stops, and walls that end the run on contact.

Pure HTML, CSS and JavaScript. No build step, no dependencies, no images or audio files: the tiles, the car, the chiptune and every sound effect are generated in code.

## Play

Open `index.html` in a browser, or serve the folder with any static server.

| Key | Action |
| --- | --- |
| `↑` / `W` | Accelerate |
| `↓` / `S` | Brake, reverse |
| `←` `→` / `A` `D` | Steer |
| `P` / `Esc` | Pause |
| `M` | Sound on / off |
| `F` | Fullscreen |
| `Enter` | Confirm |

On desktop the game view fills every pixel between the top bar and the dashboard, rendered at native resolution; `F` or the Fullscreen button takes over the whole display. Touch devices get on-screen steering and pedal buttons.

## The mission

Three sectors, each with its own countdown:

1. **The Wasteland** — surface run through the ruins. Background radiation climbs the whole time.
2. **The Base** — underground corridors sealed by blast doors on automatic cycles.
3. **Reactor Core** — passages barely wider than the car, faster doors, more leaks.

Reach the base marker before the clock hits zero. Along the way:

- **Checkpoints** (teal chevrons) save your respawn point and add 4 seconds.
- **Fuel cans** top the tank up by 40%. Run dry and the car is abandoned.
- **Rubble** slows the car hard; **radiation pools** push the meter toward lethal.
- **Wrecks** and **closed blast doors** are as solid as rock.
- Not every road leads somewhere — some end in radiation.

You start with three cars and earn one back for each sector cleared. Finishing all three sectors loops the mission with a shorter countdown. Best score is remembered in the browser.

## Under the hood

```
index.html      page and dashboard markup
css/style.css   cockpit chrome (light and dark themes, responsive)
js/levels.js    level definitions and grid builder
js/audio.js     Web Audio synth: engine, effects, four-chord chiptune
js/game.js      physics, collisions, rendering, HUD, modals, speech
```

- Levels are authored as axis-aligned road paths carved into rock, then decorated with rough patches, radiation, fuel, checkpoints, wrecks and doors (`js/levels.js`).
- The car is a momentum model: acceleration, braking, drag, speed-dependent steering with ramp-in. Eight body points are tested against the tile grid, door panels and wreck circles every frame.
- Voice lines ("Return to base immediately") use the Web Speech API when the browser has an English voice.
- The dashboard is DOM: an SVG speed gauge, fuel and radiation bars, the countdown, score, cars and a live sector map.

## Credits

Original game by David Darling and Rob Hubbard (Mastertronic, 1985). This remake is a fan project and is not affiliated with the original publishers.
