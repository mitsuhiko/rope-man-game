# Rope Man

A tiny browser game about flinging a stickman as far as possible with a
grappling rope, dodging spikes, and trying one more run because *this* seed is
definitely the one.

<p align="center">
  <a href="https://mitsuhiko.github.io/rope-man-game/">Play online</a>
</p>

<p align="center">
  <a href="https://mitsuhiko.github.io/rope-man-game/">
    <img src="./demo.apng" alt="Rope Man gameplay demo" width="720">
  </a>
</p>

## About

Rope Man was built as a little game-jam project with my kids with
[pi](https://pi.dev) and Codex.  It is intentionally hand-drawn, silly, and
tuned around the kind of chaotic physics that makes everyone shout advice at the
screen.

Pick a map seed, customize Rope Man with a hat, then swing, release, hook again,
and see how many meters you can survive.

## Controls

### Keyboard / mouse

| Action | Control |
| --- | --- |
| Hook / release rope | `Space` or click / tap the game |
| Swing left / right | `A` / `D` or `←` / `→` |
| Reel rope in / out | `W` / `S` or `↑` / `↓` |
| Retry current seed | `R` |
| Pause | `Esc` |
| Main menu after a crash | `H` |

### Touch

- Tap the big action button to hook or release.
- Use the joystick to swing left/right and reel the rope in/out.

## Local development

This is a static web game. Serve the repository root with any local web server,
for example for the sounds to work:

```bash
python3 -m http.server
```
