(() => {
  "use strict";

  // ---------------------------------------------------------------- constants
  const TRENCH = 10935; // Challenger Deep, metres
  const TIERS = [
    { name: "PLANKTON", pts: 10, color: "#cfd8e3", emoji: "⬜",
      flav: ["The answer everyone blurts out.", "Half the reef said that too.", "Solid, but it floats.", "The current carried that one in."] },
    { name: "SCHOOLER", pts: 30, color: "#5ce1ff", emoji: "🟦",
      flav: ["Swimming with the school.", "A decent catch. Plenty found it too.", "Respectable. Not rare.", "Good pull, but you had company."] },
    { name: "RARE", pts: 60, color: "#ff4f7b", emoji: "🟥",
      flav: ["Genuinely uncommon. Nice pull.", "Few divers reach that one.", "Now we're sinking.", "That one scattered the school."] },
    { name: "ONE IN A KRILLION", pts: 100, color: "#ffc94d", emoji: "🟨",
      flav: ["The abyss salutes you.", "Almost nobody goes there.", "Bioluminescent brilliance.", "The anglerfish are impressed."] },
  ];
  const MISS = { name: "NOTHING LANDED", pts: 0, color: "#5d6c84", emoji: "⬛", flav: ["The clock beat you to it."] };

  const ZONES = [
    [0, "THE SUNLIGHT ZONE"], [200, "THE TWILIGHT ZONE"], [1000, "THE MIDNIGHT ZONE"],
    [4000, "THE ABYSSAL ZONE"], [6000, "THE HADAL ZONE"], [TRENCH, "THE TRENCH FLOOR"], [12000, "UNCHARTED DEPTHS"],
  ];
  const FACTS = [
    [60, "── light begins to fade"],
    [200, "most sunlight stops here ──"],
    [200, "── THE TWILIGHT ZONE", 1],
    [332, "deepest scuba dive ever — 332m ──"],
    [480, "── sperm whales hunt below here"],
    [565, "emperor penguins dive this deep ──"],
    [700, "── pressure: 70× the surface"],
    [850, "siphonophore drift zone ──"],
    [1000, "── THE MIDNIGHT ZONE", 1],
    [1000, "no sunlight reaches past here ──"],
    [1400, "── anglerfish territory"],
    [2000, "sperm whales duel giant squid here ──"],
    [2400, "── colossal squid eyes: football-sized"],
    [2990, "cuvier's beaked whales dive to 2,992m ──"],
    [3200, "── the water is 2°C and utterly black"],
    [3800, "the Titanic rests here — 3,800m ──"],
    [4000, "── THE ABYSSAL ZONE", 1],
    [4600, "the abyssal plain stretches out ──"],
    [5200, "── cusk eels patrol the plain"],
    [6000, "THE HADAL ZONE ──", 1],
    [6000, "── named for Hades. fitting."],
    [7000, "deeper than most submarines survive ──"],
    [8336, "── deepest fish ever filmed: a snailfish"],
    [8849, "Everest would fit up to here ──"],
    [9800, "── amphipods the size of your hand"],
    [TRENCH, "the trench floor — a perfect dive ends here ──", 1],
    [12262, "── deepest hole ever dug (Kola) — 12,262m"],
    [15000, "the krill union has lost contact ──"],
    [20000, "── uncharted. nothing is written here."],
    [30000, "you are, frankly, inside the planet ──"],
    [50000, "── still sinking. still krill."],
  ];

  const WATER = [
    [0, [42, 112, 160]], [150, [27, 79, 124]], [400, [18, 58, 96]], [1000, [11, 34, 64]],
    [2500, [8, 22, 43]], [4000, [6, 15, 31]], [6000, [4, 10, 21]], [11000, [2, 5, 12]],
  ];

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem("krU_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("krU_" + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------------------------------------------------------------- answer matching
  function norm(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/['’`´]/g, "")
      .replace(/[^a-z0-9+#]+/g, " ").trim()
      .replace(/^(the|a|an) /, "");
  }
  const squash = (s) => norm(s).replace(/ /g, "");
  function variants(k) {
    const v = [k];
    if (k.length > 4 && k.endsWith("ies")) v.push(k.slice(0, -3) + "y");
    if (k.length > 4 && k.endsWith("es")) v.push(k.slice(0, -2));
    if (k.length > 3 && k.endsWith("s")) v.push(k.slice(0, -1));
    return v;
  }

  function compilePrompt(raw, id) {
    const [text, body] = raw;
    let tiers = body.split("|").map((t) => t.split(",").map((a) => a.trim()).filter(Boolean));
    if (tiers.length < 4) { // split the deepest list so every prompt has a krillion tier
      const last = tiers.pop(); const mid = Math.ceil(last.length / 2);
      tiers.push(last.slice(0, mid), last.slice(mid));
    }
    const map = new Map();
    tiers.forEach((list, ti) => list.forEach((entry) => {
      const forms = entry.split("/").map((f) => f.trim()).filter(Boolean);
      const display = forms[0];
      forms.forEach((f) => {
        const k = squash(f);
        if (k && !map.has(k)) map.set(k, { display, tier: ti });
      });
    }));
    // plural / singular forms, added only where they don't collide
    [...map.entries()].forEach(([k, v]) => {
      variants(k).slice(1).forEach((alt) => { if (!map.has(alt)) map.set(alt, v); });
      if (!map.has(k + "s")) map.set(k + "s", v);
    });
    return { id, text, tiers, map, keys: [...map.keys()] };
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function judge(p, input) {
    const q = squash(input);
    if (!q) return null;
    for (const v of variants(q)) if (p.map.has(v)) return p.map.get(v);
    // typo tolerance
    const tol = q.length >= 9 ? 2 : q.length >= 5 ? 1 : 0;
    if (tol) {
      let best = null, bd = tol + 1;
      for (const k of p.keys) {
        if (k.length < 4) continue;
        const d = lev(q, k, tol);
        if (d < bd) { bd = d; best = k; if (d === 1 && tol === 1) break; }
      }
      if (best) return p.map.get(best);
    }
    // phrase containing a known answer, e.g. "a big red apple"
    const words = norm(input).split(" ");
    if (words.length > 1 && words.length <= 5) {
      let hit = null, hitLen = 0;
      for (let i = 0; i < words.length; i++) for (let j = i + 1; j <= words.length; j++) {
        const k = words.slice(i, j).join("");
        if (k.length >= 4 && k.length > hitLen && p.map.has(k)) { hit = p.map.get(k); hitLen = k.length; }
      }
      if (hit && hitLen >= q.length * 0.45) return hit;
    }
    return null;
  }

  const PROMPTS = PROMPT_BANK.map(compilePrompt);

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const el = {
    title: $("title"), play: $("play"), end: $("end"), hud: $("hud"),
    hudDepth: $("hudDepth"), hudScore: $("hudScore"), squares: $("squares"), progLbl: $("progLbl"),
    card: $("card"), cardK: $("cardK"), cardQ: $("cardQ"), banner: $("banner"),
    countdown: $("countdown"), cdNum: $("cdNum"),
    bar: $("answerBar"), ans: $("ans"), clockNum: $("clockNum"), ring: $("ring"), timebar: $("timebar"), toast: $("toast"),
    result: $("result"), tierIcon: $("tierIcon"), tName: $("tName"), tAns: $("tAns"), tPts: $("tPts"), tSink: $("tSink"),
    tFlav: $("tFlav"), descend: $("descend"),
    menu: $("menu"), menuBtn: $("menuBtn"), soundBtn: $("soundBtn"),
  };

  // ---------------------------------------------------------------- audio
  let actx = null, muted = store.get("muted", false);
  function beep(freq, dur = 0.08, type = "square", vol = 0.05, slide = 0, delay = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    click: () => beep(660, 0.05),
    tick: () => beep(1200, 0.04, "square", 0.03),
    bad: () => { beep(160, 0.12, "sawtooth", 0.05); beep(120, 0.14, "sawtooth", 0.05, 0, 0.1); },
    dive: () => beep(520, 0.5, "triangle", 0.07, -380),
    tier: (t) => [523, 659, 784, 1047, 1319].slice(0, t + 2).forEach((f, i) => beep(f, 0.12, "square", 0.045, 0, i * 0.09)),
    miss: () => beep(220, 0.4, "triangle", 0.06, -120),
    blub: () => beep(300 + Math.random() * 300, 0.06, "sine", 0.04, 300),
  };
  function applyMuted() { document.body.classList.toggle("muted", muted); }
  applyMuted();

  // ---------------------------------------------------------------- sprites
  function sprite(rows, pal) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
  }
  const SPR = {
    krill: sprite([
      "..........##....",
      "............#...",
      "....#######..#..",
      "..###hh#####....",
      ".####hh#####o#..",
      "##.##########...",
      "#..#.#.#.#.#....",
      "...#.#.#.#......",
    ], { "#": "#ff4f7b", h: "#ff9ab3", o: "#2a0712" }),
    boat: sprite([
      ".........FFF........",
      ".........FF.........",
      ".........#..........",
      ".........#..........",
      ".......#####........",
      ".......#w#w#........",
      "..#################.",
      "...###############..",
      "....#############...",
    ], { "#": "#14233b", F: "#ff4f7b", w: "#3d5a80" }),
    fish: sprite([
      "......###.....",
      "...#######...#",
      ".##########.##",
      "##o#########..",
      ".##########.##",
      "...#######...#",
      "......###.....",
    ], { "#": "#5ce1ff", o: "#07202b" }),
    squid: sprite([
      "....#....",
      "...###...",
      "..#####..",
      "..##h##..",
      "..#####..",
      ".#######.",
      "##.###.##",
      "..#o#o#..",
      "..#####..",
      ".#.#.#.#.",
      ".#.#.#.#.",
      "#..#.#..#",
      "#.#...#.#",
      "..#...#..",
    ], { "#": "#ff4f7b", h: "#ff9ab3", o: "#2a0712" }),
    angler: sprite([
      "....L.........",
      ".....#........",
      "......#.......",
      "...######....#",
      ".##########.##",
      "#o##########.#",
      "##########..##",
      "#V#V#V####...#",
      ".#########....",
      "..######......",
    ], { "#": "#ffc94d", L: "#fffbe0", o: "#2b1d00", V: "#fff6d8" }),
  };

  // ---------------------------------------------------------------- canvas world
  const cv = $("sea"), ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1, ppm = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ppm = H / 340;
  }
  window.addEventListener("resize", resize); resize();

  const cam = { y: -40, from: -40, to: -40, t0: 0, dur: 1 };
  function camTo(y, dur) { cam.from = cam.y; cam.to = y; cam.t0 = performance.now(); cam.dur = dur; }
  const krillY = () => H * 0.47;
  const toScreen = (m) => krillY() + (m - cam.y) * ppm;

  const snow = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 4000, z: 0.3 + Math.random() * 0.7, r: Math.random() < 0.15 ? 2 : 1 }));
  const fish = [];
  const bubbles = [];
  const clouds = [
    { x: 0.12, m: -230, w: 9 }, { x: 0.62, m: -260, w: 7 }, { x: 0.86, m: -150, w: 10 }, { x: 0.35, m: -140, w: 6 },
  ];

  function waterColor(m) {
    if (m <= WATER[0][0]) return WATER[0][1];
    for (let i = 1; i < WATER.length; i++) {
      if (m <= WATER[i][0]) {
        const [m0, c0] = WATER[i - 1], [m1, c1] = WATER[i];
        const t = (m - m0) / (m1 - m0);
        return c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
      }
    }
    return WATER[WATER.length - 1][1];
  }
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function spawnFish(initial) {
    const deep = cam.y > 1100;
    const dir = Math.random() < 0.5 ? 1 : -1;
    fish.push({
      x: initial ? Math.random() * W : dir > 0 ? -40 : W + 40,
      m: cam.y + (Math.random() * 2 - 0.6) * (H / ppm) * 0.6,
      v: (12 + Math.random() * 28) * dir,
      s: 1 + Math.floor(Math.random() * 3),
      glow: deep, hue: Math.random() < 0.3 ? "#ff4f7b" : "#5ce1ff", ph: Math.random() * 6,
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // camera tween
    const k = Math.min(1, (now - cam.t0) / cam.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const prevY = cam.y;
    cam.y = cam.from + (cam.to - cam.from) * e;
    const moving = Math.abs(cam.y - prevY) > 0.05;

    ctx.clearRect(0, 0, W, H);
    // background bands
    const band = 6;
    for (let y = 0; y < H; y += band) {
      const m = cam.y + (y - krillY()) / ppm;
      if (m < 0) {
        const t = Math.min(1, -m / 340);
        ctx.fillStyle = `rgb(${Math.round(214 - 70 * t)},${Math.round(236 - 40 * t)},${Math.round(246 - 12 * t)})`;
      } else ctx.fillStyle = rgb(waterColor(m));
      ctx.fillRect(0, y, W, band + 1);
    }

    const surf = toScreen(0);
    // sky things
    if (surf > 0) {
      // sun
      const sunY = toScreen(-290), sx = W * 0.84;
      if (sunY > -80) {
        ctx.fillStyle = "rgba(255,235,150,0.25)"; ctx.fillRect(sx - 56, sunY - 56, 112, 112);
        ctx.fillStyle = "#ffd86b"; ctx.fillRect(sx - 38, sunY - 38, 76, 76);
        ctx.fillStyle = "#ffe89a"; ctx.fillRect(sx - 30, sunY - 30, 52, 52);
      }
      clouds.forEach((c, i) => {
        const cy = toScreen(c.m), p = 8;
        let cx = ((c.x * W + now * 0.006 * (i % 2 ? 1 : 0.6)) % (W + 200)) - 100;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(cx, cy, c.w * p * 2, p * 2);
        ctx.fillRect(cx + p * 2, cy - p * 2, c.w * p * 1.2, p * 2);
        ctx.fillRect(cx + p * 5, cy - p * 3.5, c.w * p * 0.6, p * 2);
        ctx.fillStyle = "rgba(200,224,240,0.9)"; ctx.fillRect(cx, cy + p * 2, c.w * p * 2, p);
      });
      // boat
      const bs = 4, bx = W * 0.3;
      ctx.drawImage(SPR.boat, bx, surf - SPR.boat.height * bs + 6 + Math.sin(now / 700) * 2, SPR.boat.width * bs, SPR.boat.height * bs);
      // waves
      ctx.fillStyle = "#1f5f8f";
      for (let x = 0; x < W; x += 4) {
        const wy = surf + Math.round(Math.sin(x / 40 + now / 600) * 3 + Math.sin(x / 13 + now / 900) * 1.5);
        ctx.fillRect(x, wy, 4, surf - wy + 8);
      }
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0, surf + 6, W, 2);
    }

    // light rays near the surface
    if (cam.y < 500) {
      const a = Math.max(0, 0.07 * (1 - Math.max(0, cam.y) / 500));
      ctx.fillStyle = `rgba(190,230,255,${a})`;
      for (let i = 0; i < 5; i++) {
        const x = W * (0.15 + i * 0.19) + Math.sin(now / 3000 + i) * 20, top = Math.max(0, surf);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 40, top); ctx.lineTo(x + 160, H); ctx.lineTo(x + 70, H); ctx.fill();
      }
    }

    // marine snow
    snow.forEach((p) => {
      let y = ((p.y - cam.y * ppm * p.z) % H + H) % H;
      if (toScreen(0) > y) return;
      p.x += (dt * 0.004) * (p.z - 0.5);
      const x = ((p.x % 1) + 1) % 1 * W;
      ctx.fillStyle = `rgba(200,225,255,${0.12 + p.z * 0.25})`;
      ctx.fillRect(Math.round(x), Math.round(y), p.r, p.r);
    });

    // fish
    if (fish.length < 9 && Math.random() < 0.03) spawnFish(false);
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      f.x += f.v * dt;
      const y = toScreen(f.m);
      if (f.x < -80 || f.x > W + 80 || y < -H || y > 2 * H) { fish.splice(i, 1); continue; }
      if (f.m < 5) continue;
      if (f.glow) {
        const a = 0.5 + 0.5 * Math.sin(now / 400 + f.ph);
        ctx.fillStyle = f.hue; ctx.globalAlpha = 0.25 * a; ctx.fillRect(f.x - 5, y - 5, 10, 10);
        ctx.globalAlpha = 0.8 * a; ctx.fillRect(f.x - 1, y - 1, 3, 3); ctx.globalAlpha = 1;
      } else {
        const s = f.s * 2, d = Math.sign(f.v);
        ctx.fillStyle = rgb(waterColor(f.m).map((c) => c * 0.35));
        ctx.fillRect(f.x - 4 * s, y - s, 8 * s, 2 * s);
        ctx.fillRect(f.x - 3 * s, y - 1.5 * s, 6 * s, 3 * s);
        ctx.fillRect(f.x - d * 5 * s - s / 2, y - 1.5 * s, s, 3 * s);
      }
    }

    // fact labels
    ctx.font = "11px 'Space Mono', monospace";
    ctx.textBaseline = "middle";
    if (state.phase !== "title") FACTS.forEach(([m, txt, big]) => {
      if (m >= TRENCH && state.mode && m > TRENCH) return;
      const y = toScreen(m);
      if (y < -20 || y > H + 20) return;
      const left = txt.startsWith("──");
      ctx.font = big ? "bold 12px 'Silkscreen', monospace" : "11px 'Space Mono', monospace";
      const dim = state.phase === "result" ? 0.35 : 1;
      ctx.fillStyle = big ? `rgba(160,200,235,${0.55 * dim})` : `rgba(150,180,210,${0.38 * dim})`;
      ctx.textAlign = left ? "left" : "right";
      ctx.fillText(txt, left ? Math.max(12, W * 0.05) : Math.min(W - 60, W * 0.9), y);
    });

    // trench floor
    if (state.mode) {
      const fy = toScreen(TRENCH);
      if (fy < H + 10) {
        ctx.fillStyle = "#0b0d14";
        for (let x = 0; x < W; x += 8) {
          const h = 10 + Math.abs(Math.sin(x * 0.037) * 22 + Math.sin(x * 0.11) * 8);
          ctx.fillRect(x, fy - h + 14, 8, H);
        }
        ctx.fillStyle = "#151a26"; ctx.fillRect(0, fy + 14, W, H);
      }
    }

    // bubbles
    if (moving && cam.to > cam.from && Math.random() < 0.6) {
      bubbles.push({ x: W * 0.15 + (Math.random() - 0.5) * 30, y: krillY(), r: 1 + Math.random() * 3, v: 40 + Math.random() * 60 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.v * dt + (cam.y - prevY) * ppm; b.x += Math.sin(b.y / 12) * 0.4;
      if (b.y < -10 || b.y < toScreen(0)) { bubbles.splice(i, 1); continue; }
      ctx.strokeStyle = "rgba(210,235,255,0.55)"; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(b.x), Math.round(b.y), b.r * 2, b.r * 2);
    }

    // depth ruler
    const rx = W - 6;
    ctx.fillStyle = "rgba(170,200,230,0.35)"; ctx.fillRect(rx, 0, 1, H);
    const top = cam.y - krillY() / ppm, bot = cam.y + (H - krillY()) / ppm;
    ctx.textAlign = "right"; ctx.font = "9px 'Space Mono', monospace";
    for (let m = Math.ceil(Math.max(0, top) / 25) * 25; m <= bot; m += 25) {
      const y = toScreen(m), major = m % 100 === 0;
      ctx.fillRect(rx - (major ? 10 : 5), Math.round(y), major ? 10 : 5, 1);
      if (major) ctx.fillText(`${m.toLocaleString()}m`, rx - 13, y);
    }
    if (state.phase !== "title") {
      const y = krillY();
      ctx.fillStyle = "#ff4f7b"; ctx.fillRect(rx - 26, y, 20, 1);
      ctx.beginPath(); ctx.moveTo(rx - 6, y); ctx.lineTo(rx, y - 4); ctx.lineTo(rx, y + 4); ctx.fill();
      ctx.fillText("YOU", rx - 30, y);
    }

    // krill
    const kx = W * 0.15, ky = krillY() + Math.sin(now / 500) * 6, ks = Math.max(3, Math.round(H / 220));
    ctx.save();
    ctx.shadowColor = "#ff4f7b"; ctx.shadowBlur = 14;
    ctx.translate(kx, ky); ctx.rotate(moving && cam.to > cam.from ? 0.5 : Math.sin(now / 900) * 0.08);
    ctx.drawImage(SPR.krill, -SPR.krill.width * ks / 2, -SPR.krill.height * ks / 2, SPR.krill.width * ks, SPR.krill.height * ks);
    ctx.restore();

    // HUD depth readout follows the camera during a sink
    if (state.phase === "sinking") el.hudDepth.textContent = fmtM(Math.max(0, cam.y));
    requestAnimationFrame(frame);
  }
  for (let i = 0; i < 6; i++) spawnFish(true);

  // ---------------------------------------------------------------- game state
  const state = {
    phase: "title", mode: store.get("mode", 20), secs: store.get("secs", 25),
    queue: [], round: 0, score: 0, depth: 0, mpp: 1, results: [], tanks: 3,
    prompt: null, timer: null, deadline: 0, lastTick: 0,
  };
  const fmtM = (m) => `${Math.round(m).toLocaleString()}m`;
  const zoneOf = (m) => ZONES.reduce((z, [d, n]) => (m >= d ? n : z), ZONES[0][1]);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function buildQueue(n) {
    const recent = new Set(store.get("recent", []));
    const fresh = shuffle(PROMPTS.filter((p) => !recent.has(p.id)));
    const stale = shuffle(PROMPTS.filter((p) => recent.has(p.id)));
    const q = fresh.concat(stale);
    return n ? q.slice(0, n) : q;
  }
  function rememberPrompt(id) {
    const r = store.get("recent", []).filter((x) => x !== id);
    r.push(id);
    store.set("recent", r.slice(-Math.floor(PROMPTS.length * 0.7)));
  }

  function show(screen) {
    ["title", "play", "end"].forEach((s) => (el[s].hidden = s !== screen));
    el.hud.hidden = screen === "title";
    el.menuBtn.hidden = screen !== "play";
    el.menu.hidden = true;
  }

  // ---------------------------------------------------------------- title
  function segInit(id, key, onChange) {
    const seg = $(id);
    const paint = () => seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.v === state[key]));
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state[key] = +b.dataset.v; store.set(key, state[key]); paint(); sfx.click(); onChange && onChange();
    });
    paint();
  }
  function refreshTitle() {
    const stats = store.get("stats", { dives: 0, best: {} });
    const best = stats.best[state.mode || "endless"];
    $("diveNo").textContent = `DIVE #${stats.dives + 1}`;
    $("bestLbl").textContent = best ? `BEST ${state.mode ? state.mode : "∞"}: ${fmtM(best.depth)} · ${best.score} PTS` : `BEST ${state.mode ? state.mode : "∞"}: —`;
  }
  segInit("modeSeg", "mode", refreshTitle);
  segInit("timeSeg", "secs");

  function toTitle() {
    clearInterval(state.timer);
    state.phase = "title";
    show("title");
    refreshTitle();
    camTo(-40, 1400);
  }

  // ---------------------------------------------------------------- dive flow
  function startDive() {
    sfx.click();
    const n = state.mode;
    state.queue = buildQueue(n);
    state.round = 0; state.score = 0; state.depth = 0; state.results = []; state.tanks = 3;
    state.mpp = n ? TRENCH / (100 * n) : 4;
    el.hudScore.textContent = "0"; el.hudDepth.textContent = "0m";
    show("play");
    camTo(0, 900);
    setTimeout(nextPrompt, 400);
  }

  function renderProgress() {
    const sq = el.squares; sq.innerHTML = "";
    if (state.mode) {
      sq.classList.toggle("tiny", state.mode > 20);
      sq.style.maxWidth = state.mode > 30 ? "230px" : "";
      for (let i = 0; i < state.mode; i++) {
        const r = state.results[i], d = document.createElement("i");
        if (r) d.className = r.tier < 0 ? "miss" : "t" + r.tier;
        else if (i === state.round) d.className = "cur";
        sq.appendChild(d);
      }
      el.progLbl.textContent = `PROMPT ${Math.min(state.round + 1, state.mode)} OF ${state.mode}`;
    } else {
      sq.classList.remove("tiny"); sq.style.maxWidth = "";
      for (let i = 0; i < 3; i++) {
        const d = document.createElement("i"); d.className = "tank" + (i < state.tanks ? "" : " empty"); sq.appendChild(d);
      }
      el.progLbl.textContent = `PROMPT ${state.round + 1} · ENDLESS`;
    }
  }

  function nextPrompt() {
    if (state.mode && state.round >= state.mode) return endDive();
    if (!state.mode && state.tanks <= 0) return endDive();
    if (!state.queue.length) state.queue = buildQueue(0);
    const p = state.queue.shift();
    state.prompt = p; rememberPrompt(p.id);
    state.phase = "countdown";
    el.result.hidden = true; el.banner.hidden = true;
    el.cardK.textContent = state.mode ? `PROMPT ${state.round + 1} OF ${state.mode}` : `PROMPT ${state.round + 1}`;
    el.cardQ.textContent = p.text;
    el.card.classList.remove("gone"); el.card.hidden = false;
    renderProgress();
    el.bar.hidden = true;
    el.countdown.hidden = false;
    let n = 2; el.cdNum.textContent = n;
    const cd = setInterval(() => {
      n--; if (n > 0) { el.cdNum.textContent = n; return; }
      clearInterval(cd); if (state.phase === "countdown") openAnswer();
    }, 800);
  }

  function openAnswer() {
    state.phase = "answering";
    el.countdown.hidden = true;
    el.bar.hidden = false; el.ans.value = ""; el.toast.classList.remove("on");
    setTimeout(() => el.ans.focus(), 30);
    state.deadline = performance.now() + state.secs * 1000;
    state.lastTick = state.secs + 1;
    updateClock();
    clearInterval(state.timer);
    state.timer = setInterval(updateClock, 50);
  }

  function updateClock() {
    const left = Math.max(0, state.deadline - performance.now()) / 1000;
    const frac = left / state.secs;
    const s = Math.ceil(left);
    el.clockNum.textContent = s;
    el.ring.style.strokeDashoffset = (119.4 * (1 - frac)).toFixed(1);
    el.timebar.style.transform = `scaleX(${frac})`;
    el.clockNum.parentElement.classList.toggle("hurry", left <= 5);
    if (left <= 5 && s < state.lastTick && s > 0) { sfx.tick(); }
    state.lastTick = s;
    if (left <= 0) { clearInterval(state.timer); resolve(null, ""); }
  }

  let toastT = 0;
  function reject(msg) {
    sfx.bad();
    el.ans.classList.remove("shake"); void el.ans.offsetWidth; el.ans.classList.add("shake");
    el.toast.textContent = msg; el.toast.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove("on"), 1600);
    el.ans.select();
  }

  el.bar.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.phase !== "answering") return;
    const raw = el.ans.value.trim();
    if (!raw) return;
    const hit = judge(state.prompt, raw);
    if (!hit) return reject(pick(["not on the charts — try another", "the krill don't recognise that", "hmm, no. try again", "that one sank without a trace"]));
    clearInterval(state.timer);
    resolve(hit, raw);
  });

  function resolve(hit, raw) {
    state.phase = "sinking";
    el.bar.hidden = true; el.ans.blur();
    el.card.classList.add("gone");
    const tier = hit ? hit.tier : -1;
    const T = hit ? TIERS[tier] : MISS;
    const pts = T.pts, sink = pts * state.mpp;
    const res = { prompt: state.prompt.text, answer: hit ? hit.display : "", typed: raw, tier, pts };
    state.results.push(res);
    if (!hit && !state.mode) state.tanks--;
    state.score += pts; state.depth += sink;

    if (hit) {
      el.banner.textContent = `“${hit.display.toUpperCase()}” ▼`;
      el.banner.hidden = false;
      sfx.dive();
      const dur = Math.min(2600, 1100 + sink * 6);
      camTo(state.depth, dur);
      let blubs = 0; const bt = setInterval(() => { sfx.blub(); if (++blubs > 3) clearInterval(bt); }, 280);
      setTimeout(() => showResult(res, T, sink), dur + 150);
    } else {
      sfx.miss();
      setTimeout(() => showResult(res, T, 0), 500);
    }
  }

  function drawTierIcon(tier) {
    const c = el.tierIcon, g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    const put = (s, scale) => {
      const w = s.width * scale, h = s.height * scale;
      g.save(); g.shadowColor = tier >= 0 ? TIERS[tier].color : "#000"; g.shadowBlur = 16;
      g.drawImage(s, (c.width - w) / 2, (c.height - h) / 2, w, h); g.restore();
    };
    if (tier === 0 || tier < 0) {
      g.strokeStyle = tier < 0 ? "#44536b" : "#cfe6f5"; g.lineWidth = 3;
      [[48, 44, 16], [70, 58, 8], [60, 74, 6], [30, 66, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); });
      if (tier === 0) { g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(40, 36, 5, 5); }
    } else if (tier === 1) put(SPR.fish, 5);
    else if (tier === 2) put(SPR.squid, 5);
    else put(SPR.angler, 6);
  }

  function showResult(res, T, sink) {
    state.phase = "result";
    el.banner.hidden = true;
    el.hudDepth.textContent = fmtM(state.depth);
    el.hudScore.textContent = state.score.toLocaleString();
    state.round++;
    renderProgress();
    drawTierIcon(res.tier);
    el.tName.textContent = T.name;
    el.tName.style.color = T.color;
    el.tName.style.textShadow = `0 0 16px ${T.color}88`;
    el.tAns.textContent = res.answer ? `“${res.answer.charAt(0).toUpperCase() + res.answer.slice(1)}”` : "—";
    el.tPts.textContent = `+${res.pts} PTS`;
    el.tPts.style.color = res.pts ? T.color : "";
    el.tSink.textContent = sink ? `sink ${fmtM(sink)}` : state.mode ? "no sink" : `oxygen: ${state.tanks} tank${state.tanks === 1 ? "" : "s"} left`;
    el.tFlav.textContent = pick(T.flav);
    const last = state.mode ? state.round >= state.mode : state.tanks <= 0;
    el.descend.textContent = last ? "SURFACE THE LOG ▲" : "DESCEND ▼";
    el.result.hidden = false;
    if (res.tier >= 0) sfx.tier(res.tier);
    setTimeout(() => el.descend.focus(), 50);
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  el.descend.addEventListener("click", () => {
    if (state.phase !== "result") return;
    sfx.click();
    el.result.hidden = true;
    nextPrompt();
  });

  // ---------------------------------------------------------------- end
  function endDive() {
    clearInterval(state.timer);
    state.phase = "end";
    const n = state.results.length;
    const key = state.mode || "endless";
    const stats = store.get("stats", { dives: 0, best: {} });
    if (n > 0) {
      stats.dives++;
      const prev = stats.best[key];
      if (!prev || state.score > prev.score) stats.best[key] = { score: state.score, depth: Math.round(state.depth) };
      store.set("stats", stats);
    }
    const best = stats.best[key];

    show("end");
    $("endK").textContent = state.mode ? (n < state.mode ? `DIVE LOG · ${n} OF ${state.mode} PROMPTS` : `DIVE LOG · ${state.mode} PROMPTS`) : `DIVE LOG · ENDLESS · ${n} PROMPTS`;
    $("endDepth").textContent = fmtM(state.depth);
    $("endZone").textContent = zoneOf(state.depth);
    $("endScore").textContent = state.score.toLocaleString();
    $("endAvg").textContent = n ? Math.round(state.score / n) : 0;
    $("endBest").textContent = best ? best.score.toLocaleString() : "—";

    const counts = [0, 0, 0, 0], miss = state.results.filter((r) => r.tier < 0).length;
    state.results.forEach((r) => r.tier >= 0 && counts[r.tier]++);
    $("tally").innerHTML = TIERS.map((t, i) => `<span class="c-t${i}"><i class="b-t${i}"></i>${t.name} ×${counts[i]}</span>`).join("") +
      (miss ? `<span class="c-miss"><i class="b-miss"></i>MISSED ×${miss}</span>` : "");
    $("grid").innerHTML = state.results.map((r) => `<i class="${r.tier < 0 ? "b-miss" : "b-t" + r.tier}" title="${esc(r.prompt)}"></i>`).join("");
    $("ansList").innerHTML = state.results.map((r) =>
      `<li>${esc(r.prompt)} — <b class="${r.tier < 0 ? "c-miss" : "c-t" + r.tier}">${r.answer ? esc(r.answer) : "nothing"}</b> <span>+${r.pts}</span></li>`).join("");
  }

  function shareText() {
    const head = state.mode ? `KRILLION UNLIMITED · ${state.mode}-prompt dive` : `KRILLION UNLIMITED · endless dive (${state.results.length})`;
    const rows = [];
    for (let i = 0; i < state.results.length; i += 10) {
      rows.push(state.results.slice(i, i + 10).map((r) => (r.tier < 0 ? MISS.emoji : TIERS[r.tier].emoji)).join(""));
    }
    return `${head}\n🦐 ${fmtM(state.depth)} · ${state.score} pts · ${zoneOf(state.depth).toLowerCase()}\n${rows.join("\n")}`;
  }
  $("shareBtn").addEventListener("click", async () => {
    const txt = shareText(), b = $("shareBtn");
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text: txt });
      else { await navigator.clipboard.writeText(txt); b.textContent = "COPIED ✓"; setTimeout(() => (b.textContent = "SHARE"), 1600); }
    } catch (e) { b.textContent = "COPY FAILED"; setTimeout(() => (b.textContent = "SHARE"), 1600); }
  });
  $("againBtn").addEventListener("click", () => { camTo(-40, 800); startDive(); });
  $("homeBtn").addEventListener("click", () => { sfx.click(); toTitle(); });

  // ---------------------------------------------------------------- controls
  $("begin").addEventListener("click", startDive);
  el.soundBtn.addEventListener("click", () => { muted = !muted; store.set("muted", muted); applyMuted(); sfx.click(); });
  el.menuBtn.addEventListener("click", () => { el.menu.hidden = !el.menu.hidden; });
  el.menu.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    el.menu.hidden = true;
    if (b.dataset.act === "surface") endDive();
    if (b.dataset.act === "quit") toTitle();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { el.menu.hidden = true; return; }
    if (state.phase === "title" && e.key === "Enter" && !e.target.closest("button, summary")) startDive();
  });

  toTitle();
  cam.y = cam.from = cam.to = -40;
  requestAnimationFrame(frame);
})();
