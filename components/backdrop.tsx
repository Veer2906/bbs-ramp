"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "/athens.webp";

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

/*
  Each screen cell samples the painting once and draws one dot: colour from the pigment,
  size from its brightness. The painting drifts slowly under the fixed grid, so dots swell
  and change hue in place like a lit sign.
*/
const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uPointer;
uniform float uTime;
uniform float uCell;
uniform float uReveal;
uniform float uDim;
uniform float uSweep;

vec2 cover(vec2 p) {
  vec2 uv = p / uRes;
  float zoom = 1.1 + 0.035 * sin(uTime * 0.045);
  vec2 drift = vec2(sin(uTime * 0.029), cos(uTime * 0.021)) * 0.022;
  uv = (uv - 0.5) / zoom + 0.5 + drift;
  float rs = uRes.x / uRes.y;
  float ri = uImg.x / uImg.y;
  if (rs > ri) uv.y = (uv.y - 0.5) * (ri / rs) + 0.5;
  else uv.x = (uv.x - 0.5) * (rs / ri) + 0.5;
  return uv;
}

vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.45);
  return clamp((c - 0.5) * 1.12 + 0.5, 0.0, 1.0);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = (floor(p / uCell) + 0.5) * uCell;
  vec3 c = grade(texture2D(uTex, cover(cell)).rgb);
  float l = dot(c, vec3(0.299, 0.587, 0.114));

  float diag = (cell.x + cell.y) / (uRes.x + uRes.y);

  // The picture develops from the top-left corner on load.
  float shown = smoothstep(0.0, 0.3, uReveal * 1.3 - diag);

  // A slow breath through the dot sizes, and a band of light on every page change.
  float breath = 0.5 + 0.5 * sin((cell.x + cell.y) * 0.011 / uCell * 5.0 - uTime * 0.55);
  float band = exp(-pow((diag - uSweep) / 0.07, 2.0)) * step(0.0, uSweep) * step(uSweep, 1.2);

  // The pointer works like a restorer's lens: dots swell until the image closes up.
  float lens = exp(-pow(distance(cell, uPointer) / (uCell * 34.0), 2.0));

  float r = uCell * 0.5 * mix(0.34, 0.98, smoothstep(0.03, 0.8, l));
  r *= 0.84 + 0.16 * breath;
  r *= 1.0 + 0.5 * lens + 0.45 * band;
  r *= shown;

  float d = distance(p, cell);
  float dot_ = 1.0 - smoothstep(r - 0.8, r + 0.8, d);

  vec3 under = grade(texture2D(uTex, cover(p)).rgb);
  vec3 col = c * dot_ * (1.08 + 0.5 * band + 0.25 * lens);
  col += under * (0.2 + 0.3 * lens) * shown;

  // Brightest in the top-right corner; the heading (left) and the cards (below) sit on quieter ground.
  vec2 q = p / uRes;
  float ground = mix(0.5, 1.0, smoothstep(0.05, 0.8, q.x)) * mix(1.0, 0.5, smoothstep(0.15, 1.0, q.y)) * 0.92;
  // Working pages get an even, softer light instead.
  col *= mix(ground, 0.8, uDim);

  gl_FragColor = vec4(col, 1.0);
}
`;

const onHome = () => location.pathname === "/" && !new URLSearchParams(location.search).has("run");

/** The painting behind every page. Vivid on the home screen, frosted and dim once you are working. */
export function Backdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const v = veil.current;
    if (!el || !v) return;
    const gl = el.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) {
      setFallback(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(
      ["uRes", "uImg", "uPointer", "uTime", "uCell", "uReveal", "uDim", "uSweep"].map((n) => [n, gl.getUniformLocation(prog, n)])
    );

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = 1;
    let ready = false;
    let dead = false;
    let raf = 0;
    let start = 0;
    let last = 0;
    let dim = onHome() ? 0 : 1;
    let sweep = 2;
    let route = location.pathname + location.search;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    v.style.opacity = String(dim);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(el.clientWidth * dpr));
      const h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!ready || document.hidden) return;
      if (!start) start = last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;

      const here = location.pathname + location.search;
      if (here !== route) {
        route = here;
        sweep = -0.15;
      }
      if (sweep < 1.3) sweep += dt * 1.5;
      const target = onHome() ? 0 : 1;
      dim += (target - dim) * Math.min(1, dt * 5);
      v.style.opacity = dim.toFixed(3);
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 9);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 9);

      resize();
      const ease = 1 - Math.pow(1 - Math.min(1, t / 2.2), 3);
      gl.uniform2f(u.uRes, el.width, el.height);
      gl.uniform2f(u.uPointer, pointer.x * dpr, pointer.y * dpr);
      gl.uniform1f(u.uTime, reduced ? 0 : t);
      gl.uniform1f(u.uCell, Math.round(4 * dpr));
      gl.uniform1f(u.uReveal, reduced ? 1 : ease);
      gl.uniform1f(u.uDim, dim);
      gl.uniform1f(u.uSweep, reduced ? 2 : sweep);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const img = new Image();
    img.onload = () => {
      if (dead) return;
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // Non-power-of-two textures must clamp in WebGL 1; the drift never leaves the image anyway.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(u.uImg, img.naturalWidth, img.naturalHeight);
      ready = true;
    };
    img.onerror = () => setFallback(true);
    img.src = SRC;

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
    };
    const leave = () => {
      pointer.tx = pointer.ty = -9999;
    };
    if (!reduced) {
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerleave", leave);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-ink" style={{ viewTransitionName: "app-backdrop" }}>
      {fallback ? (
        <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `radial-gradient(circle, transparent 1.3px, #070708 1.9px), url(${SRC})`, backgroundSize: "4px 4px, cover" }} />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 size-full" />
      )}
      <div ref={veil} className="absolute inset-0 bg-ink/40 backdrop-blur-3xl" style={{ opacity: fallback ? 0.85 : 0 }} />
    </div>
  );
}
