import { Vector3 } from "three";

// Canvas-based label layer.
//
// Replaces CSS2DRenderer for station names: instead of one DOM node per
// station (~1,500 for the whole network), all labels are drawn onto a single
// 2D canvas each frame with screen-space decluttering. Labels are placed in
// priority order (major stations first, then nearest first); a label that
// would overlap an already-placed one is skipped. Distance fades labels out
// before the fog swallows their geometry.

const STATION_FONT = '10px "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
const MAJOR_FONT = '600 11px "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
const RULER_FONT = '9px "Helvetica Neue", Arial, sans-serif';

const LABEL_HEIGHT = 14; // collision box height, px
const FADE_NEAR = 45000; // full opacity below this camera distance, m
const FADE_FAR = 85000; // fully hidden beyond, m
const CELL = 32; // collision grid cell, px

export class LabelLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stations = []; // {x, y, z, name, isMajor, keys:Set}
    this.rulers = []; // {x, y, z, text}
    this.width = 0;
    this.height = 0;
    this._v = new Vector3();
    this._widths = new Map(); // font+text -> measured width
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _measure(text, font) {
    const key = font + text;
    let w = this._widths.get(key);
    if (w === undefined) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      this._widths.set(key, w);
    }
    return w;
  }

  // Project a world position; returns {sx, sy, dist} or null if off-screen.
  _project(camera, x, y, z) {
    const v = this._v.set(x, y, z);
    const dist = camera.position.distanceTo(v);
    v.project(camera);
    if (v.z > 1 || v.z < -1) return null;
    if (v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) return null;
    return {
      sx: (v.x + 1) * 0.5 * this.width,
      sy: (1 - v.y) * 0.5 * this.height,
      dist,
    };
  }

  draw(camera, { tier, exaggeration, visibleKeys }) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    ctx.lineJoin = "round";

    // Ruler labels: few, fixed, no collision handling.
    ctx.font = RULER_FONT;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(91, 118, 168, 0.9)";
    for (const r of this.rulers) {
      const p = this._project(camera, r.x, r.y * exaggeration, r.z);
      if (!p) continue;
      ctx.fillText(r.text, p.sx, p.sy + 3);
    }
    ctx.textAlign = "center";

    if (tier === "none") return;

    // Collect visible candidates.
    const candidates = [];
    for (const st of this.stations) {
      if (tier === "major" && !st.isMajor) continue;
      let anyLine = false;
      for (const key of st.keys) {
        if (visibleKeys.has(key)) {
          anyLine = true;
          break;
        }
      }
      if (!anyLine) continue;
      const p = this._project(camera, st.x, st.y * exaggeration, st.z);
      if (!p || p.dist > FADE_FAR) continue;
      candidates.push({ st, ...p });
    }

    // Majors first, then nearest first: when two labels collide, the more
    // important / closer one wins.
    candidates.sort(
      (a, b) => (b.st.isMajor - a.st.isMajor) || (a.dist - b.dist)
    );

    // Screen-space declutter via an occupancy grid.
    const occupied = new Set();
    const cols = Math.ceil(this.width / CELL) + 2;
    for (const c of candidates) {
      const font = c.st.isMajor ? MAJOR_FONT : STATION_FONT;
      const w = this._measure(c.st.name, font) + 6;
      const x0 = c.sx - w / 2;
      const y0 = c.sy - LABEL_HEIGHT - 4;
      const cx0 = Math.floor(x0 / CELL);
      const cx1 = Math.floor((x0 + w) / CELL);
      const cy0 = Math.floor(y0 / CELL);
      const cy1 = Math.floor((y0 + LABEL_HEIGHT) / CELL);
      let free = true;
      for (let cy = cy0; cy <= cy1 && free; cy++)
        for (let cx = cx0; cx <= cx1; cx++)
          if (occupied.has(cy * cols + cx)) {
            free = false;
            break;
          }
      if (!free) continue;
      for (let cy = cy0; cy <= cy1; cy++)
        for (let cx = cx0; cx <= cx1; cx++) occupied.add(cy * cols + cx);

      const alpha =
        c.dist < FADE_NEAR
          ? 1
          : 1 - (c.dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR);
      ctx.font = font;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.85 * alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeText(c.st.name, c.sx, c.sy - 4);
      ctx.fillStyle = c.st.isMajor
        ? `rgba(240, 246, 255, ${alpha})`
        : `rgba(200, 212, 235, ${0.9 * alpha})`;
      ctx.fillText(c.st.name, c.sx, c.sy - 4);
    }
  }
}
