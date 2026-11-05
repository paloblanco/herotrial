# Hero Trial: a BLOCKO3D game

This folder is a BLOCKO3D game (a PICO-8-style 3D fantasy console) in the `b3d` project-folder form.
It was written by `b3d`; edit it freely.

- Code: `main.js`. The API is global (`map(0)`, `btn(4)`, `vox(n, x, y, z)`), angles are in turns, y is up.
- Assets: `tiles/`, `vox/`, `sfx/` (one text file each), `maps/`, `music.txt`, `scenes.json`, `cart.json`.
- Docs: `b3d docs` (the folder format, commands and testing), `b3d api <name>` (one function), `b3d api` (everything).

Work loop:

1. `b3d info .` for every asset by number and name.
2. Edit, then `b3d check .` (errors name the file and line).
3. Test headless: `b3d run . --frames 300 --input "o@30, up:40-120" --watch "score"`; `b3d shot . --out shot.png` to look.
   `--at 50:"x = 10"` sets game variables on a frame; `--eval` right after `_init`.
4. Placing things: `b3d map . --at x,z [--scene n]` shows a column and where a character can stand.
5. `b3d pack .` writes the `.b3d.json` cart the IDE opens; `b3d export . --zip` publishes.

The `.b3d.json` cart is made by `b3d pack`: don't edit it by hand. After someone edits the game in the IDE
and saves, `b3d unpack <cart> .` brings their changes back into this folder.
