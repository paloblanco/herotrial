# Hero Trial

A 5-minute roguelike for [BLOCKO3D](https://github.com/paloblanco/blocko3d). Collect stats for 5 minutes, then take on a 90-second challenge.

- **Play**: https://paloblanco.github.io/herotrial/ (GitHub Pages, from `docs/`)
- **Design**: [DESIGN.md](DESIGN.md) · **Accomplishments**: [ACCOMPLISHMENTS.md](ACCOMPLISHMENTS.md)
- **Open in the IDE**: load `herotrial.b3d.json` in https://paloblanco.github.io/blocko3d/

## Controls

Stick / arrows move · O (Z, space) = left hand · X (X key) = right hand · O + X together = jump ·
in the air, hold O to flap and press X to ground pound · mouse, finger drag or right stick turn the camera.

## Working on it

The game is a b3d project folder in `game/`:

```
b3d check game/                              # after every change
b3d run game/ --frames 300 --input "up:1-300" --watch "player.y"
b3d pack game/ --out herotrial.b3d.json      # the cart for the IDE
b3d export game/ --out docs/                 # the web build
```

The four quadrant maps are built by `game/maps/N-*.gen.js` (from `game/lib/world.mjs`). After hand-editing a
map in the IDE: save, `b3d unpack herotrial.b3d.json game/`, and delete that map's `.gen.js` so the edited
`.bin` becomes the source.
