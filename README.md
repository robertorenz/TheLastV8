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

Pick a sector from the mission-select screen (each card shows a rendered preview of the map). Ten sectors, each with its own countdown:

1. **Riverlands** — modelled on the original's surface map: bright grass, winding grey roads, two dashed highways, a river with plank bridges, lakes, farmhouses and a crop field. The world wraps horizontally — keep driving east and you come back round from the west.
2. **Sci-Base** — modelled on the original's underground map: eleven stacked corridor zones (A at the bottom, K at the top) between bevelled machinery blocks, with zone names and arrows painted on the deck.
3. **The Wasteland** — surface run through the ruins. Background radiation climbs the whole time.
4. **The Base** — underground corridors sealed by blast doors on automatic cycles.
5. **Reactor Core** — passages barely wider than the car, faster doors, more leaks.
6.–10. **Ash Highway, Coolant Deck, Cinder Run, Vault Nine, Outpost Delta** — seeded random sectors in the authored styles: a winding main road, blind spurs, rubble, leaks, columns and (underground) doors. The same seed always produces the same map.

Reach the base marker before the clock hits zero. Along the way:

- **Checkpoints** (teal chevrons) save your respawn point and add 4 seconds.
- **Fuel cans** top the tank up by 40%. Run dry and the car is abandoned.
- **Dirt tracks** are looser and slower; **grass verges** are slow but survivable; **rubble** slows the car hard.
- **Water** sinks the car — bridges are the only way across.
- **Radiation pools** push the meter toward lethal.
- **Wrecks** and **closed blast doors** are as solid as rock.
- Not every road leads somewhere — some end in radiation, one ends in a lake.

You start with three cars and earn one back for each sector cleared. Clearing a sector continues to the next; finishing the last one loops the mission with a shorter countdown. Cleared sectors and the best score are remembered in the browser.

## Under the hood

```
index.html      page and dashboard markup
css/style.css   cockpit chrome (light and dark themes, responsive)
js/levels.js    level definitions, the Sci-Base zone generator, the seeded random generator, grid builder
js/vector.js    vector levels: spline roads, lakes, river, buildings, trees -> fine collision grid + cached map chunks
js/audio.js     Web Audio synth: engine, effects, four-chord chiptune
js/game.js      physics, collisions, rendering, HUD, modals, speech
```

- Tile levels are authored as axis-aligned road paths (tarmac or dirt) carved into rock, then decorated with grass verges, water, bridges, rough patches, radiation, fuel, checkpoints, wrecks and doors (`js/levels.js`).
- Vector levels (Riverlands) are authored as smooth Catmull-Rom road splines, lake polygons, a river, bridges, hedges and buildings. The same painting code rasterises an 8-px collision grid and paints the on-screen map in cached 384-px chunks, so what you see is exactly what kills you. Wrap-around levels draw three copies of the world around the seam.
- Sector previews on the select screen are rendered live from each level's own tile atlas, so they always match what you will drive through.
- The car is a momentum model: acceleration, braking, drag, speed-dependent steering with ramp-in. Eight body points are tested against the tile grid, door panels and wreck circles every frame.
- Voice lines ("Return to base immediately") use the Web Speech API when the browser has an English voice.
- The dashboard is DOM: an SVG speed gauge, fuel and radiation bars, the countdown, score, cars and a live sector map.

## Credits

Original game by David Darling and Rob Hubbard (Mastertronic, 1985). This remake is a fan project and is not affiliated with the original publishers.
