import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBrainState, type BrainActivityItem, type BrainNodeState } from "@/lib/brain.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/cerveau")({ component: BrainPage });

/* ════════════════════════════════════════════════════════════════════════
   Le Cerveau — carte du code HoliSwiss en 3D, avec l'état réel de la
   production posé dessus.

   • Le fond (2 428 nœuds) est la STRUCTURE : fichiers, fonctions, imports.
     Elle ne bouge pas — c'est le code, il n'a pas d'état d'exécution.
   • Les 22 tâches de Gérald sont VIVANTES : compteur de file d'attente,
     couleur d'urgence, onde à chaque écriture en base.
   Positions calculées à l'avance (script d'extraction) : le navigateur ne
   fait plus tourner de force-directed — indispensable sur mobile.
   ════════════════════════════════════════════════════════════════════════ */

type ThreeNS = typeof import("three");
type TVec = InstanceType<ThreeNS["Vector3"]>;
type TMesh = InstanceType<ThreeNS["Mesh"]>;
type TSprite = InstanceType<ThreeNS["Sprite"]>;
type TLines = InstanceType<ThreeNS["LineSegments"]>;
type TBasicMat = InstanceType<ThreeNS["MeshBasicMaterial"]>;
type TTexture = InstanceType<ThreeNS["CanvasTexture"]>;
type TColorArg = InstanceType<ThreeNS["Color"]> | number | string;
type TaskMesh = TMesh & {
  userData: { id: string; r: number; admin: boolean; tone?: string; ring?: TMesh };
};

type GraphNode = {
  id: string;
  label: string;
  type: string;
  com: number | string;
  comLabel: string;
  color: string;
  deg: number;
  file?: string;
  admin?: boolean;
  task?: string;
  x: number;
  y: number;
  z: number;
};
type GraphEdge = {
  source: string;
  target: string;
  relation?: string;
  admin?: boolean;
  workflow?: boolean;
};
type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: Array<{ id: number | string; label: string; color: string; count: number }>;
};

const C = {
  gold: "#FFD54A",
  purple: "#b86ef9",
  cyan: "#5cc8fa",
  idle: "#6b6480",
  watch: "#f5a623",
  urgent: "#ef4444",
  bg: "#0f0a1e",
  card: "rgba(23,14,45,0.82)",
  border: "rgba(184,110,249,0.25)",
  text2: "rgba(255,255,255,0.62)",
};
const toneColor = (t: string) => (t === "urgent" ? C.urgent : t === "watch" ? C.watch : C.idle);

/* ── API impérative de la scène, pilotée par React ────────────────────── */
type SceneApi = {
  setLive: (nodes: Record<string, BrainNodeState>) => void;
  ripple: (nodeId: string) => void;
  focus: (nodeId: string) => void;
  reset: () => void;
  zoom: (factor: number) => void;
  toggleRotate: () => boolean;
  toggleLinks: () => boolean;
  toggleWorkflow: () => boolean;
  dispose: () => void;
};

function buildScene(
  THREE: ThreeNS,
  canvas: HTMLCanvasElement,
  graph: Graph,
  handlers: {
    onSelect: (id: string | null) => void;
    onHover: (id: string | null, x: number, y: number) => void;
  },
): SceneApi {
  const GID = "__gerald__";
  const host = canvas.parentElement as HTMLElement;
  const W = () => host.clientWidth || 1;
  const H = () => host.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H(), false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f0a1e, 0.0016);
  // Le champ de vision vertical est fixe : sur un écran étroit (téléphone en
  // portrait) le graphe déborde des deux côtés. On le REDUIT au lieu d'éloigner
  // la caméra — reculer le ferait disparaître dans le brouillard de profondeur.
  const fit = () => Math.min(1, W() / H() / 1.15);
  const camera = new THREE.PerspectiveCamera(55, W() / H(), 0.1, 3000);
  camera.position.set(0, 0, 520);
  scene.add(new THREE.AmbientLight(0x3d2460, 2.2));
  const key = new THREE.DirectionalLight(0xb86ef9, 2.4);
  key.position.set(120, 160, 120);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5cc8fa, 1.4);
  rim.position.set(-140, -90, -110);
  scene.add(rim);

  // poussière d'étoiles
  {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(1600 * 3);
    for (let i = 0; i < p.length; i++) p[i] = (Math.random() - 0.5) * 1600;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({ color: 0xb89fd4, size: 0.7, transparent: true, opacity: 0.35 }),
      ),
    );
  }

  const group = new THREE.Group();
  group.scale.setScalar(fit());
  scene.add(group);

  const byId: Record<string, GraphNode> = {};
  const pos: Record<string, InstanceType<ThreeNS["Vector3"]>> = {};
  graph.nodes.forEach((n) => {
    byId[n.id] = n;
    pos[n.id] = new THREE.Vector3(n.x, n.y, n.z);
  });
  const adj: Record<string, string[]> = {};
  graph.nodes.forEach((n) => (adj[n.id] = []));
  graph.edges.forEach((e) => {
    if (adj[e.source] && adj[e.target]) {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    }
  });

  // ── nœuds : géométrie ET matériaux partagés (1 matériau par couleur) ──
  const SPHERE = new THREE.SphereGeometry(1, 10, 10);
  const matCache = new Map<string, InstanceType<ThreeNS["MeshStandardMaterial"]>>();
  const materialFor = (hex: string) => {
    let m = matCache.get(hex);
    if (!m) {
      const col = new THREE.Color(hex);
      m = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.55,
        roughness: 0.4,
        metalness: 0.2,
      });
      matCache.set(hex, m);
    }
    return m;
  };
  const maxDeg = Math.max(...graph.nodes.map((n) => n.deg), 1);
  // Les 22 tâches de Gérald portent le tableau de bord : on les grossit pour
  // qu'elles se repèrent sans les chercher au milieu des 2 400 fichiers.
  const taskIds = new Set(graph.edges.filter((e) => e.admin).map((e) => e.target));
  const meshes: Record<string, TaskMesh> = {};
  const meshList: TaskMesh[] = [];

  graph.nodes.forEach((n) => {
    const isG = n.admin === true;
    const r = isG ? 15 : Math.max(taskIds.has(n.id) ? 5.5 : 0, 1.3 + 5 * Math.sqrt(n.deg / maxDeg));
    const mat = isG
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(C.gold),
          emissive: new THREE.Color(C.gold),
          emissiveIntensity: 1.15,
          roughness: 0.2,
          metalness: 0.6,
        })
      : materialFor(n.color);
    const m = new THREE.Mesh(SPHERE, mat) as unknown as TaskMesh;
    m.position.copy(pos[n.id]);
    m.scale.setScalar(r);
    m.userData = { id: n.id, r, admin: isG };
    group.add(m);
    meshes[n.id] = m;
    meshList.push(m);
    if (isG) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.8, 0.9, 14, 64),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(C.gold),
          transparent: true,
          opacity: 0.6,
        }),
      );
      ring.position.copy(pos[n.id]);
      m.userData.ring = ring;
      group.add(ring);
      group.add(labelSprite("★ GÉRALD · Administrateur", pos[n.id], r + 11));
    }
  });

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function labelSprite(text: string, at: TVec, dy: number): TSprite {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 42px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(15,10,30,.92)";
    roundRect(ctx, 16, 34, 480, 60, 22);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    roundRect(ctx, 16, 34, 480, 60, 22);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.fillText(text, 256, 66);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        depthTest: false,
      }),
    );
    sp.scale.set(66, 16.5, 1);
    sp.position.copy(at).add(new THREE.Vector3(0, dy, 0));
    return sp;
  }

  // ── arêtes de domaine (un seul draw call) ──
  const ep: number[] = [];
  graph.edges.forEach((e) => {
    if (e.admin) return;
    const a = pos[e.source],
      b = pos[e.target];
    if (a && b) ep.push(a.x, a.y, a.z, b.x, b.y, b.z);
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ep), 3));
  const edgeLines = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.14 }),
  );
  group.add(edgeLines);

  // ── tubes « mes relations » (Gérald → tâches) ──
  const UP = new THREE.Vector3(0, 1, 0);
  const tubeBetween = (
    a: TVec,
    b: TVec,
    radius: number,
    color: TColorArg,
    opacity = 0.75,
  ): TMesh => {
    const dir = b.clone().sub(a);
    const len = dir.length() || 1;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, len, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    return mesh;
  };
  const domainHex = (taskId: string) => {
    const n = byId[taskId];
    const h = (n && n.color) || C.gold;
    return h.toLowerCase() === "#6b6480" ? C.gold : h;
  };
  const goldTubes: TMesh[] = [];
  const taskTube: Record<string, TMesh> = {};
  graph.edges.forEach((e) => {
    if (!e.admin) return;
    const a = pos[e.source],
      b = pos[e.target];
    if (!a || !b) return;
    const tb = tubeBetween(a, b, 1.3, new THREE.Color(domainHex(e.target)));
    group.add(tb);
    goldTubes.push(tb);
    taskTube[e.target] = tb;
  });

  // ── flux animé : chaque tâche remonte vers Gérald ──
  const pulseGeo = new THREE.SphereGeometry(1, 8, 8);
  type Flux = {
    m: TMesh;
    from: TVec;
    to: TVec;
    t: number;
    speed: number;
    base: number;
    node?: string;
    wf?: boolean;
  };
  const flux: Flux[] = [];
  graph.edges.forEach((e) => {
    if (!e.admin) return;
    const from = pos[e.target],
      to = pos[e.source];
    if (!from || !to) return;
    const m = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(domainHex(e.target)),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    group.add(m);
    const speed = 0.004 + Math.random() * 0.005;
    flux.push({
      m,
      from: from.clone(),
      to: to.clone(),
      t: Math.random(),
      speed,
      base: speed,
      node: e.target,
    });
  });

  // ── workflows métier curatés ──
  const wfTubes: TMesh[] = [];
  graph.edges.forEach((e) => {
    if (!e.workflow) return;
    const a = pos[e.source],
      b = pos[e.target];
    if (!a || !b) return;
    const tb = tubeBetween(a, b, 0.55, 0xd8def5, 0.45);
    group.add(tb);
    wfTubes.push(tb);
    const m = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    group.add(m);
    const speed = 0.006 + Math.random() * 0.004;
    flux.push({
      m,
      from: a.clone(),
      to: b.clone(),
      t: Math.random(),
      speed,
      base: speed,
      wf: true,
    });
  });

  /* ── COUCHE LIVE : badges + anneaux d'urgence sur les tâches ────────── */
  const badges: Record<
    string,
    { sprite: TSprite; ring: TMesh; canvas: HTMLCanvasElement; tex: TTexture; shown: string }
  > = {};
  function badgeFor(nodeId: string) {
    let b = badges[nodeId];
    if (b) return b;
    const p = pos[nodeId];
    if (!p) return null;
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    sprite.scale.set(30, 15, 1);
    sprite.position.copy(p).add(new THREE.Vector3(0, 11, 0));
    sprite.visible = false;
    group.add(sprite);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9, 0.8, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    ring.position.copy(p);
    ring.visible = false;
    group.add(ring);
    b = { sprite, ring, canvas: cv, tex, shown: "" };
    badges[nodeId] = b;
    return b;
  }
  function paintBadge(nodeId: string, count: number, tone: string) {
    const b = badgeFor(nodeId);
    if (!b) return;
    const sig = `${count}|${tone}`;
    if (b.shown === sig) return;
    b.shown = sig;
    if (count <= 0) {
      b.sprite.visible = false;
      b.ring.visible = tone !== "idle";
      (b.ring.material as TBasicMat).color.set(toneColor(tone));
      return;
    }
    const ctx = b.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 128);
    const col = toneColor(tone);
    ctx.fillStyle = "rgba(15,10,30,.95)";
    roundRect(ctx, 78, 34, 100, 60, 30);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    roundRect(ctx, 78, 34, 100, 60, 30);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = "bold 46px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 99 ? "99+" : String(count), 128, 65);
    b.tex.needsUpdate = true;
    b.sprite.visible = true;
    b.ring.visible = true;
    (b.ring.material as TBasicMat).color.set(col);
  }

  let live: Record<string, BrainNodeState> = {};
  const setLive = (next: Record<string, BrainNodeState>) => {
    live = next;
    Object.entries(next).forEach(([id, st]) => {
      paintBadge(id, st.pending, st.tone);
      // plus la file est longue, plus le flux vers Gérald s'accélère
      flux.forEach((f) => {
        if (f.node === id) f.speed = f.base * (1 + Math.min(st.pending, 10) * 0.35);
      });
      const m = meshes[id];
      if (m) m.userData.tone = st.tone;
    });
  };

  // ondes déclenchées par le Realtime
  type Ripple = { m: TMesh; t: number; from: TVec };
  const ripples: Ripple[] = [];
  const rippleGeo = new THREE.SphereGeometry(1, 12, 12);
  const ripple = (nodeId: string) => {
    const from = pos[nodeId] || pos[GID];
    if (!from) return;
    const m = new THREE.Mesh(
      rippleGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    m.position.copy(from);
    group.add(m);
    ripples.push({ m, t: 0, from: from.clone() });
  };

  // ── interaction ──
  let rotX = 0,
    rotY = 0,
    tgtZ = 520,
    autoRotate = true;
  let isDragging = false,
    px = 0,
    py = 0,
    moved = false;
  let selectedId: string | null = null,
    hoverId: string | null = null;
  let camTarget: TVec | null = null,
    camAnim: { from: TVec; to: TVec; t0: number } | null = null;

  const onDown = (e: PointerEvent) => {
    isDragging = true;
    moved = false;
    px = e.clientX;
    py = e.clientY;
  };
  const onMove = (e: PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - px,
        dy = e.clientY - py;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1.3, Math.min(1.3, rotX));
      px = e.clientX;
      py = e.clientY;
      autoRotate = false;
    } else {
      hoverThrottled(e);
    }
  };
  const onUp = () => {
    isDragging = false;
  };
  const clampZ = (z: number) => Math.max(90, Math.min(680, z));
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    tgtZ = clampZ(tgtZ * (e.deltaY > 0 ? 1.1 : 0.9));
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let lastHover = 0;
  function pick(clientX: number, clientY: number): string | null {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshList, false)[0];
    return hit ? (hit.object.userData as TaskMesh["userData"]).id : null;
  }
  function hoverThrottled(e: PointerEvent) {
    const now = performance.now();
    if (now - lastHover < 70) return;
    lastHover = now;
    const id = pick(e.clientX, e.clientY);
    if (id !== hoverId) {
      hoverId = id;
      handlers.onHover(id, e.clientX, e.clientY);
    } else if (id) {
      handlers.onHover(id, e.clientX, e.clientY);
    }
  }
  const onClick = (e: MouseEvent) => {
    if (moved) return;
    const id = pick(e.clientX, e.clientY);
    selectedId = id;
    handlers.onSelect(id);
    if (id) flyTo(id);
    updateHighlight();
  };
  canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("click", onClick);

  function flyTo(id: string) {
    const p = pos[id];
    if (!p) return;
    camAnim = {
      from: (camTarget ?? new THREE.Vector3()).clone(),
      to: p.clone(),
      t0: performance.now(),
    };
  }

  // surbrillance des voisins du nœud sélectionné
  let hlLines: TLines | null = null;
  function updateHighlight() {
    if (hlLines) {
      group.remove(hlLines);
      hlLines.geometry.dispose();
      hlLines = null;
    }
    if (!selectedId) return;
    const a = pos[selectedId];
    if (!a) return;
    const pts: number[] = [];
    (adj[selectedId] || []).forEach((nid) => {
      const b = pos[nid];
      if (b) pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    if (!pts.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    hlLines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: 0x5cc8fa, transparent: true, opacity: 0.55 }),
    );
    group.add(hlLines);
  }

  const dynHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 }),
  );
  dynHalo.visible = false;
  group.add(dynHalo);

  // ── boucle de rendu ──
  let raf = 0,
    disposed = false;
  const tmp = new THREE.Vector3();
  function animate() {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    if (autoRotate) rotY += 0.0012;
    group.rotation.x += (rotX - group.rotation.x) * 0.08;
    group.rotation.y += (rotY - group.rotation.y) * 0.08;
    camera.position.z += (tgtZ - camera.position.z) * 0.08;

    if (camAnim) {
      const k = Math.min(1, (performance.now() - camAnim.t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      camTarget = camAnim.from.clone().lerp(camAnim.to, e);
      if (k >= 1) camAnim = null;
    }
    if (camTarget) {
      tmp.copy(camTarget).multiplyScalar(fit()).applyEuler(group.rotation).multiplyScalar(-1);
      camera.position.x += (tmp.x * 0.35 - camera.position.x) * 0.06;
      camera.position.y += (tmp.y * 0.35 - camera.position.y) * 0.06;
    }
    camera.lookAt(0, 0, 0);

    const t = performance.now() * 0.001;
    // flux
    flux.forEach((f) => {
      f.t += f.speed;
      if (f.t > 1) f.t -= 1;
      f.m.position.copy(f.from).lerp(f.to, f.t);
      const s = f.wf ? 1.3 : 1.2 + f.t * 2.6;
      f.m.scale.setScalar(s);
      (f.m.material as TBasicMat).opacity = f.wf ? 0.75 : 0.35 + f.t * 0.6;
    });
    // ondes Realtime
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += 0.02;
      const g = pos[GID];
      if (g) r.m.position.copy(r.from).lerp(g, Math.min(1, r.t));
      r.m.scale.setScalar(3 + Math.sin(Math.min(1, r.t) * Math.PI) * 7);
      (r.m.material as TBasicMat).opacity = 0.95 * (1 - r.t);
      if (r.t >= 1) {
        group.remove(r.m);
        (r.m.material as TBasicMat).dispose();
        ripples.splice(i, 1);
      }
    }
    // pulsation des tâches en attente + anneaux
    Object.entries(badges).forEach(([id, b]) => {
      if (!b.ring.visible) return;
      const st = live[id];
      const amp = st && st.tone === "urgent" ? 0.28 : 0.14;
      const k = 1 + Math.sin(t * (st && st.tone === "urgent" ? 4 : 2)) * amp;
      b.ring.scale.setScalar(k);
      b.ring.lookAt(camera.position);
      const m = meshes[id];
      if (m) m.scale.setScalar(m.userData.r * (1 + (k - 1) * 0.5));
    });
    // Gérald : anneau tournant
    const gm = meshes[GID];
    if (gm?.userData.ring) {
      gm.userData.ring.rotation.z += 0.01;
      gm.userData.ring.rotation.x = Math.sin(t * 0.4) * 0.5;
    }
    // halo dynamique
    const hid = hoverId || selectedId;
    if (hid && meshes[hid]) {
      dynHalo.visible = true;
      dynHalo.position.copy(meshes[hid].position);
      dynHalo.scale.setScalar(meshes[hid].userData.r * 2.4);
    } else dynHalo.visible = false;

    renderer.render(scene, camera);
  }
  animate();

  const onResize = () => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H(), false);
    group.scale.setScalar(fit()); // rotation du téléphone : on recadre
  };
  addEventListener("resize", onResize, { passive: true });

  return {
    setLive,
    ripple,
    focus: (id) => {
      selectedId = id;
      flyTo(id);
      updateHighlight();
    },
    reset: () => {
      rotX = 0;
      rotY = 0;
      tgtZ = 520;
      camTarget = null;
      camAnim = null;
      selectedId = null;
      updateHighlight();
    },
    zoom: (f) => {
      tgtZ = clampZ(tgtZ * f);
    },
    toggleRotate: () => {
      autoRotate = !autoRotate;
      return autoRotate;
    },
    toggleLinks: () => {
      edgeLines.visible = !edgeLines.visible;
      return edgeLines.visible;
    },
    toggleWorkflow: () => {
      const v = !wfTubes[0]?.visible;
      wfTubes.forEach((x) => (x.visible = v));
      flux.forEach((f) => {
        if (f.wf) f.m.visible = v;
      });
      return v;
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const disposable = o as Partial<TMesh>;
        disposable.geometry?.dispose?.();
        const m = disposable.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
        else m?.dispose?.();
      });
      renderer.dispose();
    },
  };
}

/* ════════════════════════════ COMPOSANT ════════════════════════════════ */

function BrainPage() {
  const navigate = useNavigate();
  const fetchState = useServerFn(getBrainState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const [ready, setReady] = useState(false);
  const [loadMsg, setLoadMsg] = useState("Chargement du graphe…");
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<{
    nodes: Record<string, BrainNodeState>;
    activity: BrainActivityItem[];
    totals: {
      therapistsTotal: number;
      therapistsActive: number;
      pendingAll: number;
      agentRuns24h: number;
    };
    ts: string;
  } | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [tip, setTip] = useState<{ label: string; sub: string; x: number; y: number } | null>(null);
  const [rtStatus, setRtStatus] = useState<"connecting" | "live" | "polling">("connecting");
  // Un canal ouvert ne prouve pas que les signaux arrivent : tant qu'aucun
  // `admin_pulse` n'a été reçu, on annonce « canal ouvert », pas « temps réel ».
  const [pulseSeen, setPulseSeen] = useState(false);
  const [flags, setFlags] = useState({ rotate: true, links: true, workflow: true });
  const [showFlux, setShowFlux] = useState(true);

  /* ── scène ── */
  useEffect(() => {
    let api: SceneApi | null = null;
    let cancelled = false;
    (async () => {
      try {
        setLoadMsg("Chargement de la carte du code…");
        const [{ default: graph }, THREE] = await Promise.all([
          import("@/data/brain-graph.json") as Promise<{ default: Graph }>,
          import("three"),
        ]);
        if (cancelled || !canvasRef.current) return;
        graphRef.current = graph;
        setLoadMsg("Construction de la scène…");
        api = buildScene(THREE, canvasRef.current, graph, {
          onSelect: (id) => setSelected(id ? (graph.nodes.find((n) => n.id === id) ?? null) : null),
          onHover: (id, x, y) => {
            if (!id) return setTip(null);
            const n = graph.nodes.find((v) => v.id === id);
            if (!n) return setTip(null);
            setTip({ label: n.label, sub: n.task ?? n.comLabel, x, y });
          },
        });
        sceneRef.current = api;
        setReady(true);
      } catch (e: unknown) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Impossible de charger le cerveau.");
      }
    })();
    return () => {
      cancelled = true;
      api?.dispose();
      sceneRef.current = null;
    };
  }, []);

  /* ── état live : chargement + rafraîchissement ── */
  const refresh = useCallback(async () => {
    try {
      const s = await fetchState();
      setLive(s);
      sceneRef.current?.setLive(s.nodes);
    } catch {
      /* la session peut expirer : le prochain tick réessaiera */
    }
  }, [fetchState]);

  useEffect(() => {
    refresh();
    // Filet de sécurité si le Realtime n'est pas (encore) disponible.
    const iv = window.setInterval(refresh, 20_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    let pending: number | null = null;
    const debounced = () => {
      if (pending) return;
      pending = window.setTimeout(() => {
        pending = null;
        refresh();
      }, 600);
    };
    const ch = supabase
      .channel("brain-pulse")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_pulse" },
        (payload: any) => {
          const nodeId = payload?.new?.node_id as string | undefined;
          if (nodeId) sceneRef.current?.ripple(nodeId);
          setPulseSeen(true);
          debounced();
        },
      )
      .subscribe((status) => {
        // `admin_pulse` absente (migration pas encore appliquée par Lovable)
        // → on reste en polling, et on le dit au lieu de faire semblant.
        setRtStatus(
          status === "SUBSCRIBED"
            ? "live"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "polling"
              : "connecting",
        );
      });
    return () => {
      if (pending) window.clearTimeout(pending);
      supabase.removeChannel(ch);
    };
  }, [ready, refresh]);

  const selectedState = selected ? live?.nodes[selected.id] : undefined;
  const topQueues = useMemo(() => {
    if (!live) return [];
    return Object.entries(live.nodes)
      .filter(([, s]) => s.pending > 0)
      .sort((a, b) => b[1].pending - a[1].pending);
  }, [live]);

  const nodeLabel = (id: string) => graphRef.current?.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        overflow: "hidden",
        background: C.bg,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />

      {/* ── chargement / erreur ── */}
      {(!ready || err) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at top,#2d1248,#0f0a1e)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Cerveau HoliSwiss
          </div>
          {err ? (
            <div style={{ color: C.urgent, fontSize: 14, maxWidth: 420, textAlign: "center" }}>
              {err}
            </div>
          ) : (
            <>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  border: "3px solid rgba(184,110,249,.2)",
                  borderTopColor: C.purple,
                  borderRightColor: C.cyan,
                  animation: "brainspin 1s linear infinite",
                }}
              />
              <div style={{ color: C.text2, fontSize: 13 }}>{loadMsg}</div>
              <style>{"@keyframes brainspin{to{transform:rotate(360deg)}}"}</style>
            </>
          )}
        </div>
      )}

      {/* ── bandeau haut : KPI live ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 12,
          padding: "14px 18px 14px 64px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>Le Cerveau</h1>
          <p style={{ fontSize: 12, color: C.text2, margin: 0 }}>
            structure du code · <b style={{ color: C.gold }}>état réel de la production</b>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            flexWrap: "wrap",
            pointerEvents: "auto",
          }}
        >
          <Kpi
            label="À valider"
            value={live?.totals.pendingAll ?? "—"}
            accent={(live?.totals.pendingAll ?? 0) > 0 ? C.watch : C.cyan}
          />
          <Kpi
            label="Thérapeutes actifs"
            value={live?.totals.therapistsActive ?? "—"}
            accent={C.cyan}
          />
          <Kpi label="Agents / 24 h" value={live?.totals.agentRuns24h ?? "—"} accent={C.purple} />
          <div
            title="Le cerveau se rafraîchit toutes les 20 s dans tous les cas ; le canal temps réel ne fait qu'accélérer la réaction."
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 12px",
              borderRadius: 10,
              background: C.card,
              border: `1px solid ${C.border}`,
              fontSize: 11,
              color: C.text2,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: pulseSeen
                  ? "#34d399"
                  : rtStatus === "live"
                    ? C.cyan
                    : rtStatus === "polling"
                      ? C.watch
                      : C.idle,
                boxShadow: pulseSeen ? "0 0 8px #34d399" : "none",
              }}
            />
            {pulseSeen
              ? "Temps réel"
              : rtStatus === "live"
                ? "Canal ouvert"
                : rtStatus === "polling"
                  ? "Rafraîchi / 20 s"
                  : "Connexion…"}
            {live && <span style={{ opacity: 0.6 }}>· maj {timeAgo(live.ts)}</span>}
          </div>
        </div>
      </div>

      {/* ── panneau flux live ── */}
      {showFlux && (
        <aside
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 12,
            width: "min(340px, calc(100vw - 24px))",
            maxHeight: "min(46dvh, 460px)",
            display: "flex",
            flexDirection: "column",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            backdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#fff" }}>Flux</h2>
            <span style={{ fontSize: 10, color: C.text2 }}>notifications · agents</span>
            <button
              onClick={() => setShowFlux(false)}
              style={btnGhost}
              aria-label="Masquer le flux"
            >
              ✕
            </button>
          </div>

          {topQueues.length > 0 && (
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {topQueues.map(([id, s]) => (
                <button
                  key={id}
                  onClick={() => {
                    sceneRef.current?.focus(id);
                    setSelected(graphRef.current?.nodes.find((n) => n.id === id) ?? null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 9px",
                    borderRadius: 999,
                    cursor: "pointer",
                    background: "rgba(255,255,255,.05)",
                    border: `1px solid ${toneColor(s.tone)}55`,
                    color: "#fff",
                    fontSize: 11,
                  }}
                >
                  <span style={{ fontWeight: 700, color: toneColor(s.tone) }}>{s.pending}</span>
                  {nodeLabel(id)
                    .replace(/^admin\./, "")
                    .replace(/\.tsx$/, "")}
                </button>
              ))}
            </div>
          )}

          <div style={{ overflowY: "auto", padding: 8 }}>
            {(live?.activity ?? []).length === 0 && (
              <div style={{ padding: 14, fontSize: 12, color: C.text2 }}>
                Rien à signaler pour l'instant.
              </div>
            )}
            {(live?.activity ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  if (a.nodeId) {
                    sceneRef.current?.focus(a.nodeId);
                    setSelected(graphRef.current?.nodes.find((n) => n.id === a.nodeId) ?? null);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  gap: 9,
                  padding: "8px 10px",
                  borderRadius: 9,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    marginTop: 5,
                    flexShrink: 0,
                    background: toneColor(a.tone),
                  }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.label}
                  </span>
                  {a.detail && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: C.text2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.detail}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 10, color: C.text2, flexShrink: 0 }}>{timeAgo(a.at)}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
      {!showFlux && (
        <button
          onClick={() => setShowFlux(true)}
          style={{
            ...btnCtl,
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 12,
            width: "auto",
            padding: "0 14px",
          }}
        >
          Flux
        </button>
      )}

      {/* ── panneau détail du nœud ── */}
      {selected && (
        <aside
          style={{
            position: "absolute",
            right: 12,
            top: 78,
            zIndex: 12,
            width: "min(320px, calc(100vw - 24px))",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            backdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selected.label}
            </h2>
            <button onClick={() => setSelected(null)} style={btnGhost} aria-label="Fermer">
              ✕
            </button>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <Row k="Domaine" v={selected.comLabel} color={selected.color} />
            {selected.task && <Row k="Rôle" v={selected.task} />}
            {selected.file && <Row k="Fichier" v={selected.file} mono />}
            <Row k="Connexions" v={String(selected.deg)} />
            {selectedState && (
              <div
                style={{
                  marginTop: 2,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: `${toneColor(selectedState.tone)}18`,
                  border: `1px solid ${toneColor(selectedState.tone)}55`,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: toneColor(selectedState.tone),
                    lineHeight: 1,
                  }}
                >
                  {selectedState.pending}
                </div>
                <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>
                  {selectedState.hint}
                </div>
              </div>
            )}
            {selectedState?.href && (
              <button
                onClick={() => navigate({ to: selectedState.href! })}
                style={{
                  marginTop: 2,
                  height: 38,
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "linear-gradient(135deg,#8b5cf6,#06b6d4)",
                }}
              >
                Ouvrir cette page →
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── contrôles ── */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 12,
          display: "flex",
          gap: 6,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 6,
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          style={{ ...btnCtl, ...(flags.rotate ? btnOn : null) }}
          title="Rotation auto"
          onClick={() =>
            setFlags((f) => ({ ...f, rotate: sceneRef.current?.toggleRotate() ?? f.rotate }))
          }
        >
          ⟳
        </button>
        <button style={btnCtl} title="Zoom avant" onClick={() => sceneRef.current?.zoom(0.82)}>
          ＋
        </button>
        <button style={btnCtl} title="Zoom arrière" onClick={() => sceneRef.current?.zoom(1.22)}>
          －
        </button>
        <button
          style={btnCtl}
          title="Recentrer"
          onClick={() => {
            sceneRef.current?.reset();
            setSelected(null);
          }}
        >
          ⊙
        </button>
        <button
          style={{ ...btnCtl, ...(flags.workflow ? btnOn : null) }}
          title="Workflows métier"
          onClick={() =>
            setFlags((f) => ({ ...f, workflow: sceneRef.current?.toggleWorkflow() ?? f.workflow }))
          }
        >
          ⇄
        </button>
        <button
          style={{ ...btnCtl, ...(flags.links ? btnOn : null) }}
          title="Liens de domaine"
          onClick={() =>
            setFlags((f) => ({ ...f, links: sceneRef.current?.toggleLinks() ?? f.links }))
          }
        >
          ◈
        </button>
      </div>

      {/* ── infobulle ── */}
      {tip && (
        <div
          style={{
            position: "fixed",
            left: tip.x + 14,
            top: tip.y + 14,
            zIndex: 20,
            pointerEvents: "none",
            background: "rgba(15,10,30,.94)",
            border: `1px solid ${C.border}`,
            borderRadius: 9,
            padding: "7px 10px",
            maxWidth: 260,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{tip.label}</div>
          <div style={{ fontSize: 10, color: C.text2 }}>{tip.sub}</div>
        </div>
      )}
    </div>
  );
}

/* ── petits composants ── */
const btnCtl: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  fontSize: 15,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const btnOn: React.CSSProperties = {
  background: "rgba(184,110,249,.28)",
  borderColor: "rgba(184,110,249,.6)",
};
const btnGhost: React.CSSProperties = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  color: C.text2,
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
};

function Kpi({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div
      style={{
        padding: "6px 14px",
        borderRadius: 10,
        background: C.card,
        border: `1px solid ${C.border}`,
        textAlign: "center",
        minWidth: 78,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.text2 }}>{label}</div>
    </div>
  );
}

function Row({ k, v, color, mono }: { k: string; v: string; color?: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{ fontSize: 10, color: C.text2, textTransform: "uppercase", letterSpacing: ".05em" }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: 12,
          color: color ?? "#fff",
          marginTop: 2,
          wordBreak: "break-word",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : undefined,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}
