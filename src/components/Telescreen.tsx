"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * THE TELESCREEN.
 *
 * The front page used to put its subliminal frames on a news clip in the
 * corner. That was a television; this is the room it stood in. The whole first
 * screen is now one broadcast: a camera aperture at the end of a tunnel of
 * receipts, with the record's own fragments drifting past it and one line of
 * the transmission held at the bottom, long enough to read.
 *
 * The receipts are true and come from the page: the charge count, the names in
 * the line, the blades. The slogans are the site's own voice, not hidden
 * frames — the timing is random, the content is not. Nothing strobes: a line
 * arrives, is legible for seconds, and leaves. The screen can be switched off,
 * and it does not animate at all when the reader has asked for less motion.
 *
 * Three.js is loaded after the page is idle, and only when the stage is on
 * screen. It is decoration over a server-rendered page; if it never loads, the
 * hero is still a hero.
 */

export interface TelescreenReceipt {
  text: string;
  meta: string;
}

const OFF_KEY = "fye:telescreen:off:v1";
const SLATE_MS = 7600;

interface ScreenState {
  on: boolean;
  toggle: () => void;
  message: string;
  count: number;
}

const ScreenContext = createContext<ScreenState | null>(null);

function useScreen(): ScreenState {
  const value = useContext(ScreenContext);
  if (!value) {
    return { on: false, toggle: () => {}, message: "", count: 0 };
  }
  return value;
}

/** The broadcast, and the switch that turns it off. */
export function TelescreenProvider({
  messages,
  children,
}: {
  messages: string[];
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(true);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(OFF_KEY) === "1") setOn(false);
    } catch {
      /* a closed tab should not be able to break the page */
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!on || reduced || messages.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (messages.length < 2) return 0;
        const step = 1 + Math.floor(Math.random() * (messages.length - 1));
        return (current + step) % messages.length;
      });
    }, SLATE_MS);
    return () => window.clearInterval(timer);
  }, [on, reduced, messages.length]);

  const toggle = useCallback(() => {
    setOn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(OFF_KEY, next ? "0" : "1");
      } catch {
        /* the switch still works for this visit */
      }
      return next;
    });
  }, []);

  const message = messages.length ? messages[index % messages.length] : "";
  return (
    <ScreenContext.Provider
      value={{ on, toggle, message: reduced ? "" : message, count: index }}
    >
      {children}
    </ScreenContext.Provider>
  );
}

/**
 * The screen itself.
 *
 * One canvas, one scene: a tunnel of receipt planes, a mechanical aperture at
 * the end, and dust. The aperture follows the pointer, so the room notices
 * where you are. Everything is disposed when the stage is switched off or
 * unmounted; a page that keeps a GPU context alive after the visitor has left
 * the hero is a page that gets slower for no reason.
 */
export function TelescreenCanvas({
  messages,
  receipts,
}: {
  messages: string[];
  receipts: TelescreenReceipt[];
}) {
  const { on } = useScreen();
  const host = useRef<HTMLDivElement | null>(null);
  const content = useRef({ messages, receipts });
  content.current = { messages, receipts };
  const signature = `${messages.join("|")}::${receipts.map((r) => r.text).join("|")}`;

  useEffect(() => {
    const element = host.current;
    if (!element || !on) {
      if (element) element.replaceChildren();
      return;
    }

    let disposed = false;
    let teardown: (() => void) | null = null;
    let idle: { cancel: () => void } | null = null;

    const boot = async () => {
      if (disposed) return;
      try {
        await Promise.race([
          document.fonts?.ready ?? Promise.resolve(),
          new Promise((resolve) => window.setTimeout(resolve, 1500)),
        ]);
      } catch {
        /* the fallback face is fine */
      }
      if (disposed) return;
      const THREE = await import("three");
      if (disposed) return;
      teardown = mount(THREE, element, content.current, () => disposed);
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(boot, { timeout: 1400 });
      idle = { cancel: () => w.cancelIdleCallback?.(id) };
    } else {
      const id = window.setTimeout(boot, 700);
      idle = { cancel: () => window.clearTimeout(id) };
    }

    return () => {
      disposed = true;
      idle?.cancel();
      teardown?.();
      element.replaceChildren();
    };
  }, [on, signature]);

  return <div ref={host} aria-hidden className="tele-canvas" data-screen={on ? "on" : "off"} />;
}

/** The one switch, where a reader can always reach it: on the bar. */
function ScreenSwitch() {
  const { on, toggle } = useScreen();
  return (
    <button
      type="button"
      className="tele-switch"
      onClick={toggle}
      aria-pressed={!on}
      aria-label={on ? "turn the telescreen off" : "turn the telescreen on"}
    >
      {on ? "screen off" : "screen on"}
    </button>
  );
}

/** The line at the bottom of the screen, held long enough to be read. */
export function TelescreenSlate() {
  const { on, message, count } = useScreen();
  return (
    <div className="tele-slate">
      <div className="tele-slate-head">
        <span className="tele-slate-left">
          <span>
            TRANSMISSION {String(count + 1).padStart(2, "0")} · MINISTRY OF RECORD
          </span>
          <span className="tele-slate-live">
            <span className="tele-rec" /> {on ? "LIVE" : "OFF"}
          </span>
          <ScreenSwitch />
        </span>
      </div>
      <div className="tele-slate-window">
        {on && message ? (
          <p key={message} className="tele-slate-text">
            {message}
          </p>
        ) : (
          <p className="tele-slate-text tele-slate-idle">
            {on ? "SIGNAL HELD · THE RECORD IS STILL HERE" : "SCREEN OFF · THE RECORD IS STILL HERE"}
          </p>
        )}
      </div>
    </div>
  );
}

/** The operator's readout: real counts, and the switch. */
export function TelescreenConsole({
  waiting,
  charges,
  blades,
  names,
}: {
  waiting: number;
  charges: number;
  blades: number;
  names: number;
}) {
  const { on } = useScreen();
  return (
    <aside className="tele-console" aria-label="Telescreen status">
      <div className="tele-console-head">
        <span>TELESCREEN 01 · MINISTRY OF RECORD</span>
        <span className="tele-console-live">
          <span className="tele-rec" /> {on ? "LIVE" : "OFF"}
        </span>
      </div>

      <dl className="tele-console-stats">
        <div>
          <dt>subjects in the line</dt>
          <dd>{waiting.toLocaleString()}</dd>
        </div>
        <div>
          <dt>charges on record</dt>
          <dd>{charges.toLocaleString()}</dd>
        </div>
        <div>
          <dt>blades felled</dt>
          <dd>{blades.toLocaleString()}</dd>
        </div>
        <div>
          <dt>names crossed</dt>
          <dd>{names.toLocaleString()}</dd>
        </div>
      </dl>

      <p className="tele-console-note">
        The screen broadcasts. The record keeps the receipts. Every count here
        is the same count the archive uses.
      </p>

      <div className="tele-console-foot">
        <span className="tele-console-channel">CH 01 · {on ? "TRANSMITTING" : "DARK"}</span>
        <span className="tele-console-channel">CONTROL ON THE BAR</span>
      </div>
    </aside>
  );
}

/** A clock that only re-renders itself. The hero does not need a tick. */
export function TelescreenClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular-nums">{now || "--:--:--"}</span>;
}

/* ── the scene ─────────────────────────────────────────────────────────── */

type ThreeNS = typeof import("three");

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < text.length - 2) lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

function receiptTexture(
  THREE: ThreeNS,
  receipt: TelescreenReceipt,
  index: number,
): import("three").CanvasTexture {
  const width = 384;
  const height = 480;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Paper, not a screen: the record is printed.
  const paper = ctx.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#c6c2b4");
  paper.addColorStop(0.55, "#b2aea1");
  paper.addColorStop(1, "#9b988d");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  // The edge of a torn strip.
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, width, 3);
  ctx.fillRect(0, height - 3, width, 3);

  ctx.fillStyle = "#171715";
  ctx.font = "800 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(receipt.meta.toUpperCase().slice(0, 34), 22, 38);

  ctx.strokeStyle = "rgba(20,20,18,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(22, 54);
  ctx.lineTo(width - 22, 54);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "800 33px 'JetBrains Mono', ui-monospace, monospace";
  const lines = wrap(ctx, receipt.text, width - 44, 6);
  lines.forEach((line, i) => ctx.fillText(line, 22, 106 + i * 40));

  // The small print is the point of a receipt.
  ctx.font = "700 13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(20,20,18,0.72)";
  ctx.fillText("ALA GUILLOTINE // THE RECORD", 22, height - 74);
  ctx.fillText(`NO. ${String(4100 + index).padStart(5, "0")}`, 22, height - 54);

  // A barcode is a receipt's signature, not a claim.
  let x = 22;
  ctx.fillStyle = "rgba(20,20,18,0.82)";
  while (x < width - 26) {
    const w = 2 + Math.floor(seeded(index * 31 + x) * 5);
    ctx.fillRect(x, height - 40, w, 22);
    x += w + 3;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function glowTexture(THREE: ThreeNS): import("three").CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,240,240,0.95)");
    g.addColorStop(0.16, "rgba(255,255,255,0.55)");
    g.addColorStop(0.32, "rgba(225,29,72,0.35)");
    g.addColorStop(0.62, "rgba(225,29,72,0.10)");
    g.addColorStop(1, "rgba(225,29,72,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mount(
  THREE: ThreeNS,
  host: HTMLElement,
  data: { messages: string[]; receipts: TelescreenReceipt[] },
  isDisposed: () => boolean,
): () => void {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0b0c, 0.052);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 90);
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  const narrowQuery = window.matchMedia("(max-width: 767px)");
  const mobile = narrowQuery.matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.setClearColor(0x0b0b0c, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const textures: Array<import("three").Texture> = [];
  const geometries: Array<import("three").BufferGeometry> = [];
  const materials: Array<import("three").Material> = [];

  const track = <T extends import("three").Texture>(texture: T): T => {
    textures.push(texture);
    return texture;
  };

  // ── The receipts ────────────────────────────────────────────────────────
  const stripGeometry = new THREE.PlaneGeometry(1, 1.25);
  geometries.push(stripGeometry);

  const strips: Array<{ mesh: import("three").Mesh; spin: number; depth: number }> = [];
  const count = mobile ? 12 : 16;
  for (let i = 0; i < count; i += 1) {
    const receipt =
      data.receipts.length > 0
        ? data.receipts[i % data.receipts.length]
        : { text: "THE RECORD IS THE RECORD", meta: "ALA GUILLOTINE" };
    const texture = track(receiptTexture(THREE, receipt, i));
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(stripGeometry, material);
    // The middle stays clear: the tunnel has walls, and the lens is at the end
    // of it. A pile of paper over the aperture reads as clutter, not depth.
    const side = i % 2 === 0 ? -1 : 1;
    const depth = -4 - i * 2.15;
    mesh.position.set(
      side * (1.5 + seeded(i + 1) * 2.8),
      (seeded(i + 8) * 2 - 1) * 1.75,
      depth,
    );
    mesh.rotation.z = (seeded(i + 4) * 2 - 1) * 0.2;
    const scale = 0.8 + seeded(i + 12) * 0.45;
    mesh.scale.set(scale, scale, 1);
    scene.add(mesh);
    strips.push({ mesh, spin: (seeded(i + 20) * 2 - 1) * 0.03, depth });
  }

  // ── The aperture ────────────────────────────────────────────────────────
  const aperture = new THREE.Group();
  // On a phone the lens moves into the corner of the room: a camera watching
  // the page, not a spotlight burning through the copy.
  aperture.position.set(mobile ? 3.9 : 0.9, mobile ? 0.8 : 0.1, -16.5);
  let apertureScale = mobile ? 0.55 : 1;
  aperture.scale.setScalar(apertureScale);
  scene.add(aperture);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 64),
    new THREE.MeshBasicMaterial({
      map: track(glowTexture(THREE)),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      opacity: 1,
    }),
  );
  geometries.push(glow.geometry);
  materials.push(glow.material as import("three").Material);
  aperture.add(glow);

  const rings: Array<{ mesh: import("three").Mesh; speed: number }> = [];
  for (let i = 0; i < 5; i += 1) {
    const inner = 1.15 + i * 0.58;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, inner + 0.05, 96),
      new THREE.MeshBasicMaterial({
        color: 0xe11d48,
        transparent: true,
        opacity: 0.82 - i * 0.09,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    );
    geometries.push(ring.geometry);
    materials.push(ring.material as import("three").Material);
    ring.rotation.z = seeded(i + 30) * Math.PI;
    aperture.add(ring);
    rings.push({ mesh: ring, speed: (i % 2 === 0 ? 1 : -1) * (0.015 + i * 0.008) });
  }

  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(1.02, 64),
    new THREE.MeshBasicMaterial({ color: 0x050506, fog: false }),
  );
  pupil.position.z = 0.02;
  geometries.push(pupil.geometry);
  materials.push(pupil.material as import("three").Material);
  aperture.add(pupil);

  const iris = new THREE.Mesh(
    new THREE.RingGeometry(1.02, 1.12, 96),
    new THREE.MeshBasicMaterial({
      color: 0xff2a55,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );
  iris.position.z = 0.03;
  geometries.push(iris.geometry);
  materials.push(iris.material as import("three").Material);
  aperture.add(iris);

  // The camera's scan line: one thin crimson stroke crossing the lens.
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 0.012),
    new THREE.MeshBasicMaterial({
      color: 0xff2a55,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    }),
  );
  scan.position.z = 0.04;
  geometries.push(scan.geometry);
  materials.push(scan.material as import("three").Material);
  aperture.add(scan);

  // The aperture scale: a ring of ticks, turning slowly. It is a camera, not
  // an eye, and the difference matters: a camera is pointed at you.
  const tickPositions: number[] = [];
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    tickPositions.push(
      Math.cos(angle) * 2.62, Math.sin(angle) * 2.62, 0,
      Math.cos(angle) * (i % 7 === 0 ? 3.0 : 2.86), Math.sin(angle) * (i % 7 === 0 ? 3.0 : 2.86), 0,
    );
  }
  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tickPositions, 3));
  const tickMaterial = new THREE.LineBasicMaterial({
    color: 0xe11d48,
    transparent: true,
    opacity: 0.42,
    fog: false,
  });
  geometries.push(tickGeometry);
  materials.push(tickMaterial);
  const ticks = new THREE.LineSegments(tickGeometry, tickMaterial);
  aperture.add(ticks);

  const rimPoints: import("three").Vector3[] = [];
  for (let i = 0; i <= 180; i += 1) {
    const angle = (i / 180) * Math.PI * 2;
    rimPoints.push(new THREE.Vector3(Math.cos(angle) * 3.14, Math.sin(angle) * 3.14, 0));
  }
  const rimGeometry = new THREE.BufferGeometry().setFromPoints(rimPoints);
  const rimMaterial = new THREE.LineBasicMaterial({
    color: 0xf4f4f5,
    transparent: true,
    opacity: 0.12,
    fog: false,
  });
  geometries.push(rimGeometry);
  materials.push(rimMaterial);
  const rim = new THREE.Line(rimGeometry, rimMaterial);
  aperture.add(rim);

  // The reticle: two hairlines through the lens. It is a camera, not an eye.
  for (const vertical of [false, true]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(vertical ? 0.01 : 9.4, vertical ? 9.4 : 0.01),
      new THREE.MeshBasicMaterial({
        color: 0xe11d48,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        fog: false,
      }),
    );
    line.position.z = 0.03;
    geometries.push(line.geometry);
    materials.push(line.material as import("three").Material);
    aperture.add(line);
  }

  // ── Dust ────────────────────────────────────────────────────────────────
  const dustCount = mobile ? 140 : 240;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    positions[i * 3] = (seeded(i + 40) * 2 - 1) * 7;
    positions[i * 3 + 1] = (seeded(i + 70) * 2 - 1) * 4;
    positions[i * 3 + 2] = -1 - seeded(i + 100) * 34;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xb9b9ae,
    size: 0.028,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  });
  geometries.push(dustGeometry);
  materials.push(dustMaterial);
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // ── Size, visibility, pointer ───────────────────────────────────────────
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // A phone that rotates, or a window that is dragged narrow, gets the
    // corner camera rather than a lens the size of the paragraph.
    const narrow = narrowQuery.matches;
    aperture.position.set(narrow ? 3.9 : 0.9, narrow ? 0.8 : 0.1, -16.5);
    apertureScale = narrow ? 0.55 : 1;
    if (reduced) renderer.render(scene, camera);
  };
  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(host);

  let visible = true;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0.01 },
  );
  io.observe(host);

  const pointer = { x: 0, y: 0 };
  const onPointer = (event: PointerEvent) => {
    pointer.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointer.y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
  };
  if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

  // ── The loop ────────────────────────────────────────────────────────────
  let frame = 0;
  let last = 0;
  const clock = new THREE.Clock();

  const render = (time: number) => {
    frame = window.requestAnimationFrame(render);
    if (isDisposed() || document.hidden || !visible) {
      clock.getDelta();
      return;
    }
    if (time - last < 33) return;
    last = time;
    const delta = Math.min(0.06, clock.getDelta());
    const elapsed = clock.getElapsedTime();

    for (const strip of strips) {
      strip.mesh.position.z += 0.55 * delta;
      strip.mesh.rotation.z += strip.spin * delta;
      if (strip.mesh.position.z > 1.6) strip.mesh.position.z = -38;
    }

    for (const ring of rings) ring.mesh.rotation.z += ring.speed * delta;

    // The lens is not still. It is looking at where the pointer is.
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.035;
    camera.position.y += (pointer.y * 0.34 - camera.position.y) * 0.035;
    camera.lookAt(1.15 * 0.35, 0.3 * 0.35, -12);

    const narrow = narrowQuery.matches;
    aperture.position.x += ((narrow ? 3.9 : 0.9) - aperture.position.x) * 0.06;
    aperture.position.y += ((narrow ? 0.8 : 0.1) - aperture.position.y) * 0.06;
    apertureScale += ((narrow ? 0.55 : 1) - apertureScale) * 0.06;
    aperture.scale.setScalar(apertureScale * (1 + Math.sin(elapsed * 0.34) * 0.018));
    ticks.rotation.z += 0.035 * delta;
    scan.position.y = Math.sin(elapsed * 0.5) * 1.5;
    dust.rotation.z = Math.sin(elapsed * 0.04) * 0.02;

    renderer.render(scene, camera);
  };

  if (reduced) {
    // One frame: the room exists, it just does not move.
    camera.lookAt(0.4, 0.1, -12);
    renderer.render(scene, camera);
  } else {
    frame = window.requestAnimationFrame(render);
  }

  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onPointer);
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
