// Cendrawasih Airlift — render.js
// One job: everything the player sees. A 2D canvas pseudo-3D chase view:
// sky and sea split at a projected horizon, islands drawn far-to-near as
// projected polygons, runways and rings as projected ground features, the
// twin-prop drawn as a 2D sprite that banks with the plane, and a lit HUD.
// Screens (title, job board, delivered, shift end, crash) are drawn here too.

const TAU = Math.PI * 2;

// The camera: position, basis and horizon for one frame.
function makeCamera(state, time) {
  const p = state.plane;
  const cam = CONFIG.camera;
  const fx = Math.sin(p.heading);
  const fy = Math.cos(p.heading);
  // Chase position: behind the tail, above it, smoothed by the caller.
  const cx = p.x - fx * cam.behind;
  const cy = p.y - fy * cam.behind;
  const cz = p.alt + cam.above;
  // Look point: ahead of the nose, a little below the plane.
  const lx = p.x + fx * cam.lookAhead;
  const ly = p.y + fy * cam.lookAhead;
  const lz = p.alt - 6;
  let fwdx = lx - cx;
  let fwdy = ly - cy;
  let fwdz = lz - cz;
  const fl = Math.hypot(fwdx, fwdy, fwdz) || 1;
  fwdx /= fl; fwdy /= fl; fwdz /= fl;
  // Right = forward x world-up, up = right x forward.
  let rx = fwdy;
  let ry = -fwdx;
  let rz = 0;
  const rl = Math.hypot(rx, ry) || 1;
  rx /= rl; ry /= rl;
  const ux = ry * fwdz - rz * fwdy;
  const uy = rz * fwdx - rx * fwdz;
  const uz = rx * fwdy - ry * fwdx;
  return { x: cx, y: cy, z: cz, fwdx, fwdy, fwdz, rx, ry, rz, ux, uy, uz };
}

// Project a world point to screen space. Null when behind the camera.
function project(cam, W, H, horizonY, x, y, z) {
  const vx = x - cam.x;
  const vy = y - cam.y;
  const vz = z - cam.z;
  const d = vx * cam.fwdx + vy * cam.fwdy + vz * cam.fwdz;
  if (d < 3) return null;
  const f = CONFIG.camera.focal;
  const sx = W / 2 + ((vx * cam.rx + vy * cam.ry + vz * cam.rz) / d) * f;
  const sy = horizonY - ((vx * cam.ux + vy * cam.uy + vz * cam.uz) / d) * f;
  return { x: sx, y: sy, d };
}

// The screen y of the horizon: a point far ahead at sea level.
function horizonYOf(cam, W, H) {
  const far = projectRaw(cam, W, H, cam.x + cam.fwdx * 20000, cam.y + cam.fwdy * 20000, 0);
  return far ? far.y : H * 0.42;
}

function projectRaw(cam, W, H, x, y, z) {
  const vx = x - cam.x;
  const vy = y - cam.y;
  const vz = z - cam.z;
  const d = vx * cam.fwdx + vy * cam.fwdy + vz * cam.fwdz;
  if (d < 3) return null;
  const f = CONFIG.camera.focal;
  return {
    x: W / 2 + ((vx * cam.rx + vy * cam.ry + vz * cam.rz) / d) * f,
    y: H * 0.42 - ((vx * cam.ux + vy * cam.uy + vz * cam.uz) / d) * f,
    d,
  };
}

// Project a 3D polygon, clipping it against the camera's near plane first
// so a runway whose near end sits behind the camera still draws.
function projectPoly(cam, W, H, horizonY, points) {
  const NEAR = 3;
  // Camera-space coords: right, up, depth.
  let poly = points.map(([x, y, z]) => {
    const vx = x - cam.x;
    const vy = y - cam.y;
    const vz = z - cam.z;
    return {
      r: vx * cam.rx + vy * cam.ry + vz * cam.rz,
      u: vx * cam.ux + vy * cam.uy + vz * cam.uz,
      d: vx * cam.fwdx + vy * cam.fwdy + vz * cam.fwdz,
    };
  });
  // Sutherland–Hodgman clip against d >= NEAR.
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const aIn = a.d >= NEAR;
    const bIn = b.d >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a.d) / (b.d - a.d);
      out.push({
        r: a.r + (b.r - a.r) * t,
        u: a.u + (b.u - a.u) * t,
        d: NEAR,
      });
    }
  }
  if (out.length < 3) return null;
  const f = CONFIG.camera.focal;
  return out.map((p) => ({
    x: W / 2 + (p.r / p.d) * f,
    y: horizonY - (p.u / p.d) * f,
    d: p.d,
  }));
}

// ---------------------------------------------------------------- sky & sea

function drawSky(ctx, W, H, horizonY, time) {
  const pal = CONFIG.palette;
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(0.65, pal.skyMid);
  g.addColorStop(1, pal.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Math.max(0, horizonY) + 1);
  // Late-afternoon sun, upper left, with a soft glow.
  const sunX = W * 0.2;
  const sunY = Math.max(60, horizonY * 0.45);
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, pal.sunGlow);
  glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = pal.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, TAU);
  ctx.fill();
}

function drawSea(ctx, W, H, horizonY, time) {
  const pal = CONFIG.palette;
  const g = ctx.createLinearGradient(0, horizonY, 0, H);
  g.addColorStop(0, pal.seaShallow);
  g.addColorStop(0.25, pal.seaDeep);
  g.addColorStop(1, '#083a52');
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, horizonY), W, H - Math.max(0, horizonY));
  // A few drifting sparkle strokes near the horizon.
  ctx.strokeStyle = pal.seaSparkle;
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = ((i * 173 + time * 12) % (W + 80)) - 40;
    const y = horizonY + 24 + ((i * 53) % 120);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26 + (i % 3) * 10, y);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- islands

function drawIslands(ctx, cam, W, H, horizonY, world, plane, time) {
  const pal = CONFIG.palette;
  const list = world.islands
    .map((isl) => ({ isl, d: Math.hypot(isl.x - plane.x, isl.y - plane.y) }))
    .sort((a, b) => b.d - a.d); // far to near
  for (const { isl } of list) {
    const peak = project(cam, W, H, horizonY, isl.x, isl.y, isl.peak);
    if (!peak && Math.hypot(isl.x - plane.x, isl.y - plane.y) > 9000) continue;
    // Coastline ring: 12 wobbled points at sea level.
    const ringPts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rr = isl.r * isl.wobble[i];
      const pt = project(cam, W, H, horizonY, isl.x + Math.cos(a) * rr, isl.y + Math.sin(a) * rr, 0);
      if (pt) ringPts.push(pt);
    }
    if (ringPts.length < 3) continue;
    // Sand beach: the coastline ring, slightly pale.
    ctx.fillStyle = pal.sand;
    ctx.beginPath();
    ctx.moveTo(ringPts[0].x, ringPts[0].y);
    for (const pt of ringPts) ctx.lineTo(pt.x, pt.y);
    ctx.closePath();
    ctx.fill();
    // Green body: the same ring pulled toward the peak, leaving a thin beach.
    ctx.fillStyle = isl.kind === 'terraces' ? pal.terraces : pal.grass;
    ctx.beginPath();
    const cx = peak ? peak.x : W / 2;
    const cy = peak ? peak.y : horizonY;
    ctx.moveTo(ringPts[0].x, ringPts[0].y);
    for (const pt of ringPts) {
      ctx.lineTo(pt.x + (cx - pt.x) * 0.42, pt.y + (cy - pt.y) * 0.42);
    }
    ctx.closePath();
    ctx.fill();
    // A darker inner slope for depth.
    ctx.fillStyle = 'rgba(30, 90, 50, 0.35)';
    ctx.beginPath();
    ctx.moveTo(ringPts[0].x, ringPts[0].y);
    for (const pt of ringPts) {
      ctx.lineTo(pt.x + (cx - pt.x) * 0.62, pt.y + (cy - pt.y) * 0.62);
    }
    ctx.closePath();
    ctx.fill();
    // Forest cap and volcano cone.
    if (peak) {
      if (isl.kind === 'volcano') {
        ctx.fillStyle = pal.volcanoRock;
        ctx.beginPath();
        ctx.moveTo(cx - 26, cy + 40);
        ctx.lineTo(cx, cy - 18);
        ctx.lineTo(cx + 26, cy + 40);
        ctx.closePath();
        ctx.fill();
        // Smoke plume drifting off the crater.
        ctx.fillStyle = pal.volcanoSmoke;
        const drift = Math.sin(time * 0.6 + isl.x) * 8;
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.arc(cx + drift + s * 7, cy - 26 - s * 14, 10 + s * 5, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = pal.forest;
        ctx.beginPath();
        ctx.arc(cx, cy + 6, 16, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - 14, cy + 12, 11, 0, TAU);
        ctx.arc(cx + 14, cy + 12, 11, 0, TAU);
        ctx.fill();
      }
      // A stilt village: tiny roofs near the shore.
      if (isl.kind === 'village') {
        ctx.fillStyle = pal.villageRoof;
        for (let v = 0; v < 5; v++) {
          const a = (v / 5) * TAU + 0.6;
          const vx = isl.x + Math.cos(a) * isl.r * 0.72;
          const vy = isl.y + Math.sin(a) * isl.r * 0.72;
          const pt = project(cam, W, H, horizonY, vx, vy, 8);
          if (!pt) continue;
          ctx.fillRect(pt.x - 5, pt.y - 5, 10, 7);
          ctx.beginPath();
          ctx.moveTo(pt.x - 6, pt.y - 5);
          ctx.lineTo(pt.x, pt.y - 11);
          ctx.lineTo(pt.x + 6, pt.y - 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

function drawClouds(ctx, cam, W, H, horizonY, world, plane, time) {
  const list = world.clouds
    .map((c) => ({ c, d: Math.hypot(c.x - plane.x, c.y - plane.y) }))
    .sort((a, b) => b.d - a.d);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const { c } of list) {
    const pt = project(cam, W, H, horizonY, c.x + time * c.speed, c.y, c.z);
    if (!pt || pt.y > H * 0.75) continue;
    const s = c.scale * (900 / Math.max(300, pt.d));
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, 46 * s, 13 * s, 0, 0, TAU);
    ctx.ellipse(pt.x - 26 * s, pt.y + 4 * s, 26 * s, 10 * s, 0, 0, TAU);
    ctx.ellipse(pt.x + 28 * s, pt.y + 5 * s, 28 * s, 10 * s, 0, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- runway & rings

function drawRunway(ctx, cam, W, H, horizonY, strip) {
  const pal = CONFIG.palette;
  const h = strip.headingDeg * (Math.PI / 180);
  const fx = Math.sin(h);
  const fy = Math.cos(h);
  const px = Math.cos(h);
  const py = -Math.sin(h);
  const L = CONFIG.runway.length / 2;
  const Wd = CONFIG.runway.width / 2;
  const corners = [
    [strip.x + fx * L + px * Wd, strip.y + fy * L + py * Wd, 1],
    [strip.x + fx * L - px * Wd, strip.y + fy * L - py * Wd, 1],
    [strip.x - fx * L - px * Wd, strip.y - fy * L - py * Wd, 1],
    [strip.x - fx * L + px * Wd, strip.y - fy * L + py * Wd, 1],
  ];
  const pts = projectPoly(cam, W, H, horizonY, corners);
  if (!pts) return;
  ctx.fillStyle = pal.runway;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const pt of pts) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.runwayEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Centreline dashes.
  ctx.strokeStyle = 'rgba(245, 240, 220, 0.9)';
  ctx.lineWidth = 2;
  for (let d = -L + 30; d < L - 10; d += 60) {
    const a = project(cam, W, H, horizonY, strip.x + fx * d, strip.y + fy * d, 1.5);
    const b = project(cam, W, H, horizonY, strip.x + fx * (d + 28), strip.y + fy * (d + 28), 1.5);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    const a = project(cam, W, H, horizonY, strip.x + fx * end * (L - 12) + px * Wd * 0.7, strip.y + fy * end * (L - 12) + py * Wd * 0.7, 1.5);
    const b = project(cam, W, H, horizonY, strip.x + fx * end * (L - 12) - px * Wd * 0.7, strip.y + fy * end * (L - 12) - py * Wd * 0.7, 1.5);
    if (!a || !b) continue;
    ctx.strokeStyle = pal.runwayEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Approach lights: a row of amber dots before the near threshold.
  const near = project(cam, W, H, horizonY, strip.x - fx * (L + 40), strip.y - fy * (L + 40), 2);
  if (near) {
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 4; i++) {
      const pt = project(cam, W, H, horizonY, strip.x - fx * (L + 20 + i * 26), strip.y - fy * (L + 20 + i * 26), 2);
      if (pt) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, TAU);
        ctx.fill();
      }
    }
  }
  // Strip name, floating over the runway when close.
  const label = project(cam, W, H, horizonY, strip.x, strip.y, 26);
  if (label && label.d < 2600) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(234, 246, 255, 0.95)';
    ctx.fillText(strip.name, label.x, label.y);
  }
}

function drawRings(ctx, cam, W, H, horizonY, rings, time) {
  const pal = CONFIG.palette;
  for (const ring of rings) {
    if (ring.hit) continue;
    const pulse = 1 + Math.sin(time * 3) * 0.05;
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      // The ring faces the plane: its plane is perpendicular to the
      // line from the ring to the plane, so it always reads as a hoop.
      const pt = project(cam, W, H, horizonY,
        ring.x + Math.cos(a) * ring.radius * pulse,
        ring.y,
        ring.z + Math.sin(a) * ring.radius * pulse);
      if (pt) pts.push(pt);
    }
    if (pts.length < 8) continue;
    ctx.strokeStyle = pal.ringGlow;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const pt of pts) ctx.lineTo(pt.x, pt.y);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = pal.ring;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- the plane

function drawPlane(ctx, W, H, plane, time) {
  const cx = W / 2;
  const cy = H * 0.60;
  const bank = plane.bank;
  const pitchLift = -plane.pitch * 60; // nose up lifts the sprite
  ctx.save();
  ctx.translate(cx, cy + pitchLift);
  ctx.rotate(bank);
  if (plane.shake > 0) {
    ctx.translate((Math.random() - 0.5) * plane.shake * 14, (Math.random() - 0.5) * plane.shake * 14);
  }
  const scale = 1.12 + Math.min(0.08, plane.speed / 900);
  ctx.scale(scale, scale);
  drawPlaneSprite(ctx, plane, time);
  ctx.restore();
}

// The twin-prop cargo plane, rear view: fuselage, wings, tail, props.
function drawPlaneSprite(ctx, plane, time) {
  // Wingtip vortices on a hard bank.
  if (Math.abs(plane.bank) > 0.6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 150, -6);
      ctx.quadraticCurveTo(side * 190, 10, side * 230, 26);
      ctx.stroke();
    }
  }
  // Wings: long tapered trapezoids with a slight dihedral.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(-168, 6);
  ctx.lineTo(-168, 16);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -8);
  ctx.lineTo(168, 6);
  ctx.lineTo(168, 16);
  ctx.lineTo(10, 10);
  ctx.closePath();
  ctx.fill();
  // Wing tips: red left, green right (navigation lights).
  const blink = Math.sin(time * 4) > 0 ? 1 : 0.35;
  ctx.fillStyle = `rgba(255, 70, 60, ${blink})`;
  ctx.beginPath(); ctx.arc(-170, 11, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(80, 255, 140, ${blink})`;
  ctx.beginPath(); ctx.arc(170, 11, 4, 0, TAU); ctx.fill();
  // Engine nacelles under the wings.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#c9c2ae';
    ctx.beginPath();
    ctx.ellipse(side * 78, 2, 20, 13, 0, 0, TAU);
    ctx.fill();
    // Spinning prop: a blurred disc plus two blades at the current angle.
    const px = side * 78;
    const py = 2;
    ctx.fillStyle = 'rgba(40, 40, 40, 0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py, 30, 30, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.85)';
    ctx.lineWidth = 3;
    const a = plane.propAngle + (side < 0 ? Math.PI / 2 : 0);
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(a) * 26, py - Math.sin(a) * 26);
    ctx.lineTo(px + Math.cos(a) * 26, py + Math.sin(a) * 26);
    ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, TAU);
    ctx.fill();
  }
  // Fuselage: a chunky cargo body, nose away from the viewer.
  ctx.fillStyle = '#f4efe0';
  ctx.beginPath();
  ctx.moveTo(-26, -34);
  ctx.quadraticCurveTo(-34, 10, -22, 44);
  ctx.lineTo(22, 44);
  ctx.quadraticCurveTo(34, 10, 26, -34);
  ctx.quadraticCurveTo(0, -44, -26, -34);
  ctx.closePath();
  ctx.fill();
  // Belly stripe and cargo door lines.
  ctx.fillStyle = '#2f7d5b';
  ctx.fillRect(-26, 18, 52, 7);
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-20, -30); ctx.lineTo(-20, 40);
  ctx.moveTo(20, -30); ctx.lineTo(20, 40);
  ctx.stroke();
  // Tail: vertical fin with the cendrawasih (bird-of-paradise) flash.
  ctx.fillStyle = '#2f7d5b';
  ctx.beginPath();
  ctx.moveTo(-16, -32);
  ctx.lineTo(0, -72);
  ctx.lineTo(16, -32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(-8, -40);
  ctx.lineTo(0, -64);
  ctx.lineTo(8, -40);
  ctx.closePath();
  ctx.fill();
  // Horizontal stabilizer.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-10, -30);
  ctx.lineTo(-52, -18);
  ctx.lineTo(-52, -12);
  ctx.lineTo(-8, -20);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -30);
  ctx.lineTo(52, -18);
  ctx.lineTo(52, -12);
  ctx.lineTo(8, -20);
  ctx.closePath();
  ctx.fill();
  // Tail light.
  ctx.fillStyle = `rgba(255, 255, 255, ${blink})`;
  ctx.beginPath(); ctx.arc(0, -70, 3, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- HUD

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = CONFIG.palette.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawHud(ctx, state, W, H, time) {
  const pal = CONFIG.palette;
  const p = state.plane;
  const job = state.job;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: altitude, airspeed and vertical speed, one row each.
  panel(ctx, 16, 14, 220, 106);
  ctx.fillStyle = pal.hudText;
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.fillText(`${Math.round(p.alt)} m`, 30, 43);
  ctx.fillText(`${Math.round(p.speed * 3.6)} km/h`, 30, 74);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`VS ${p.verticalSpeed >= 0 ? '+' : ''}${p.verticalSpeed.toFixed(1)} m/s`, 30, 101);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('ALTITUDE', 150, 43);
  ctx.fillText('AIRSPEED', 176, 74);
  ctx.fillText('VERT SPEED', 150, 101);

  // Top-centre: heading compass strip.
  const headingDeg = ((p.heading / (Math.PI / 180)) % 360 + 360) % 360;
  panel(ctx, W / 2 - 190, 14, 380, 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2 - 190, 14, 380, 46);
  ctx.clip();
  ctx.fillStyle = 'rgba(234, 246, 255, 0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const deg = Math.round((headingDeg + d) / 15) * 15;
    const x = W / 2 + (deg - headingDeg) * 3.2;
    const label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][((deg / 90) % 4 + 4) % 4] : String(((deg % 360) + 360) % 360);
    ctx.fillText(label, x, d % 45 === 0 ? 34 : 44);
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, 26);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = pal.hudAccent;
  ctx.beginPath();
  ctx.moveTo(W / 2, 16);
  ctx.lineTo(W / 2 - 6, 26);
  ctx.lineTo(W / 2 + 6, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, W / 2, 52);

  // Top-right: coins, timer, shift clock.
  panel(ctx, W - 226, 14, 210, 86);
  ctx.textAlign = 'left';
  ctx.fillStyle = pal.hudAccent;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`◉ ${state.coins}`, W - 212, 42);
  ctx.fillStyle = pal.hudText;
  ctx.font = '15px system-ui, sans-serif';
  const shiftMin = Math.floor(Math.max(0, state.shiftTimeLeft) / 60);
  const shiftSec = Math.floor(Math.max(0, state.shiftTimeLeft) % 60);
  ctx.fillText(`Shift ${shiftMin}:${String(shiftSec).padStart(2, '0')}`, W - 212, 66);
  ctx.fillText(`Jobs ${state.jobsDone}/${CONFIG.shift.jobsPerShift}`, W - 212, 88);

  // Mission banner under the compass.
  if (job) {
    const dest = job.to.name;
    const mm = Math.floor(Math.max(0, job.timeLeft) / 60);
    const ss = Math.floor(Math.max(0, job.timeLeft) % 60);
    panel(ctx, W / 2 - 230, 68, 460, 34);
    ctx.fillStyle = job.timeLeft < 30 ? pal.hudWarn : pal.hudText;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${job.label} → ${dest}  •  ${mm}:${String(ss).padStart(2, '0')}  •  ${job.payout} coins`, W / 2, 90);
    ctx.textAlign = 'left';
  }

  // Right side: throttle and fuel gauges.
  panel(ctx, W - 66, 130, 50, 210);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', W - 41, 146);
  ctx.fillStyle = '#1d2f42';
  ctx.fillRect(W - 56, 154, 30, 130);
  ctx.fillStyle = pal.hudAccent;
  ctx.fillRect(W - 56, 154 + 130 * (1 - p.throttle), 30, 130 * p.throttle);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.fillText('FUEL', W - 41, 302);
  ctx.fillStyle = '#1d2f42';
  ctx.fillRect(W - 56, 308, 30, 130);
  ctx.fillStyle = p.fuel <= CONFIG.fuel.lowWarn ? pal.hudWarn : pal.hudGood;
  ctx.fillRect(W - 56, 308 + 130 * (1 - p.fuel / 100), 30, 130 * (p.fuel / 100));
  ctx.textAlign = 'left';

  // Bottom-left: damage bar and flaps/gear state.
  panel(ctx, 16, H - 66, 210, 50);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('DAMAGE', 28, H - 46);
  ctx.fillStyle = '#1d2f42';
  ctx.fillRect(28, H - 40, 150, 10);
  ctx.fillStyle = p.damage >= CONFIG.damage.warnAt ? pal.hudWarn : p.damage > 0 ? pal.hudAccent : pal.hudGood;
  ctx.fillRect(28, H - 40, 150 * (p.damage / 100), 10);
  ctx.fillStyle = pal.hudText;
  ctx.fillText(`${Math.round(p.damage)}%`, 186, H - 30);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.fillText(p.gearDown ? 'GEAR DOWN' : 'GEAR UP', 28, H - 18);
  ctx.fillText(p.flaps ? 'FLAPS' : '', 120, H - 18);

  // Bottom-right: artificial horizon + throttle buttons (mouse).
  const ahX = W - 150;
  const ahY = H - 110;
  panel(ctx, ahX - 62, ahY - 62, 124, 124);
  ctx.save();
  ctx.beginPath();
  ctx.arc(ahX, ahY, 46, 0, TAU);
  ctx.clip();
  ctx.translate(ahX, ahY);
  ctx.rotate(-p.bank);
  ctx.translate(0, p.pitch * 90);
  ctx.fillStyle = '#5aa3d6';
  ctx.fillRect(-60, -90, 120, 90);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(-60, 0, 120, 90);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ahX, ahY, 46, 0, TAU);
  ctx.strokeStyle = pal.hudText;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ahX - 18, ahY);
  ctx.lineTo(ahX + 18, ahY);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ahX, ahY + 60);

  // Centre message banner.
  if (state.messageTimer > 0 && state.message) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    const mw = ctx.measureText(state.message).width + 36;
    panel(ctx, W / 2 - mw / 2, H * 0.24, mw, 40);
    ctx.fillStyle = pal.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(state.message, W / 2, H * 0.24 + 27);
    ctx.textAlign = 'left';
  }

  // Low-fuel warning blink.
  if (p.fuel <= CONFIG.fuel.lowWarn && p.fuel > 0 && Math.sin(time * 6) > 0) {
    ctx.fillStyle = pal.hudWarn;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — find a strip', W / 2, H - 90);
    ctx.textAlign = 'left';
  }
}

// ---------------------------------------------------------------- screens

function dimScreen(ctx, W, H) {
  ctx.fillStyle = 'rgba(6, 18, 30, 0.55)';
  ctx.fillRect(0, 0, W, H);
}

function titleText(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, W, H, time) {
  const pal = CONFIG.palette;
  titleText(ctx, 'CENDRAWASIH AIRLIFT', W / 2, H * 0.3, 'bold 64px system-ui, sans-serif', '#fff8e6');
  titleText(ctx, 'Island courier runs across the archipelago', W / 2, H * 0.3 + 40, '22px system-ui, sans-serif', pal.hudText);
  const pulse = 0.6 + Math.sin(time * 2.5) * 0.4;
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Press ENTER to fly', W / 2, H * 0.52, 'bold 28px system-ui, sans-serif', pal.hudAccent);
  ctx.globalAlpha = 1;
  titleText(ctx, 'Arrows / WASD — pitch & bank   •   W/S or Shift — throttle   •   Space — flaps & brake', W / 2, H * 0.62, '17px system-ui, sans-serif', pal.hudText);
  titleText(ctx, 'Mouse: drag to steer, scroll for throttle   •   P pause   •   M mute', W / 2, H * 0.62 + 28, '17px system-ui, sans-serif', pal.hudText);
  titleText(ctx, 'Deliver cargo, thread the rings, mind the fuel — and flare before you touch down.', W / 2, H * 0.72, '17px system-ui, sans-serif', 'rgba(234, 246, 255, 0.8)');
}

function drawJobBoard(ctx, W, H, jobs, stripName, time) {
  const pal = CONFIG.palette;
  dimScreen(ctx, W, H);
  titleText(ctx, 'JOB BOARD', W / 2, 110, 'bold 44px system-ui, sans-serif', '#fff8e6');
  titleText(ctx, `At ${stripName} — pick a job (keys 1–3 or click)`, W / 2, 148, '18px system-ui, sans-serif', pal.hudText);
  const cardW = 320;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2;
  const y0 = 190;
  const cardH = 300;
  jobs.forEach((job, i) => {
    const x = x0 + i * (cardW + gap);
    const hover = false;
    panel(ctx, x, y0, cardW, cardH);
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y0, cardW, cardH, 8);
    ctx.stroke();
    ctx.fillStyle = pal.hudAccent;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${i + 1}]  ${job.label.toUpperCase()}`, x + cardW / 2, y0 + 34);
    ctx.fillStyle = pal.hudText;
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(job.cargo.name, x + cardW / 2, y0 + 70);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 246, 255, 0.8)';
    ctx.fillText(`→ ${job.to.name}`, x + cardW / 2, y0 + 100);
    ctx.fillText(job.desc, x + cardW / 2, y0 + 130);
    ctx.fillText(`Weight ${job.weight.toFixed(1)} t`, x + cardW / 2, y0 + 158);
    const mm = Math.floor(job.timeLimit / 60);
    const ss = job.timeLimit % 60;
    ctx.fillText(`Clock ${mm}:${String(ss).padStart(2, '0')}`, x + cardW / 2, y0 + 186);
    ctx.fillStyle = pal.hudAccent;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${job.payout} coins`, x + cardW / 2, y0 + 232);
    ctx.fillStyle = 'rgba(234, 246, 255, 0.7)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Rings on the way pay +25', x + cardW / 2, y0 + 264);
    ctx.textAlign = 'left';
  });
  titleText(ctx, 'Fuel is topped up at every strip. Fragile cargo fails past 40% damage.', W / 2, y0 + cardH + 46, '16px system-ui, sans-serif', 'rgba(234, 246, 255, 0.75)');
}

function drawDelivered(ctx, W, H, payout) {
  const pal = CONFIG.palette;
  dimScreen(ctx, W, H);
  titleText(ctx, 'DELIVERED', W / 2, 150, 'bold 48px system-ui, sans-serif', pal.hudGood);
  titleText(ctx, `${payout.cargo} → ${payout.dest}`, W / 2, 196, '22px system-ui, sans-serif', pal.hudText);
  const rows = [
    ['Job pay', payout.payout],
    ['Landing bonus', payout.landingBonus],
    ['On-time bonus', payout.onTime],
    ['Ring bonuses', payout.ringBonus],
  ];
  let y = 250;
  ctx.font = '20px system-ui, sans-serif';
  for (const [label, value] of rows) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(234, 246, 255, 0.85)';
    ctx.fillText(label, W / 2 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.hudAccent;
    ctx.fillText(`+${value}`, W / 2 + 20, y);
    y += 36;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = pal.hudText;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('Total', W / 2 - 20, y + 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = pal.hudAccent;
  ctx.fillText(`+${payout.total} coins`, W / 2 + 20, y + 8);
  titleText(ctx, `Landing: ${payout.quality}`, W / 2, y + 60, '18px system-ui, sans-serif', pal.hudText);
  const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Press ENTER for the next job', W / 2, y + 110, 'bold 24px system-ui, sans-serif', pal.hudAccent);
  ctx.globalAlpha = 1;
}

function drawShiftEnd(ctx, W, H, state) {
  const pal = CONFIG.palette;
  dimScreen(ctx, W, H);
  titleText(ctx, 'SHIFT COMPLETE', W / 2, 170, 'bold 52px system-ui, sans-serif', '#fff8e6');
  titleText(ctx, `Jobs flown: ${state.jobsDone}   •   Coins earned: ${state.coins}`, W / 2, 230, '24px system-ui, sans-serif', pal.hudText);
  titleText(ctx, `Best landing: ${state.landingScore || '—'}`, W / 2, 268, '20px system-ui, sans-serif', pal.hudText);
  titleText(ctx, 'The islands will still be here tomorrow.', W / 2, 320, '18px system-ui, sans-serif', 'rgba(234, 246, 255, 0.8)');
  const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Press ENTER to fly another shift', W / 2, 400, 'bold 26px system-ui, sans-serif', pal.hudAccent);
  ctx.globalAlpha = 1;
}

function drawCrash(ctx, W, H, state) {
  const pal = CONFIG.palette;
  dimScreen(ctx, W, H);
  titleText(ctx, 'SORTIE LOST', W / 2, 200, 'bold 56px system-ui, sans-serif', pal.hudWarn);
  titleText(ctx, state.crashReason || 'The airframe gave out', W / 2, 252, '22px system-ui, sans-serif', pal.hudText);
  titleText(ctx, `Coins kept: ${state.coins}   •   Jobs done: ${state.jobsDone}`, W / 2, 300, '19px system-ui, sans-serif', pal.hudText);
  const pulse = 0.6 + Math.sin(Date.now() / 400) * 0.4;
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Press ENTER to try again', W / 2, 380, 'bold 26px system-ui, sans-serif', pal.hudAccent);
  ctx.globalAlpha = 1;
}

function drawPaused(ctx, W, H) {
  dimScreen(ctx, W, H);
  titleText(ctx, 'PAUSED', W / 2, H / 2 - 20, 'bold 48px system-ui, sans-serif', '#fff8e6');
  titleText(ctx, 'Press P to keep flying', W / 2, H / 2 + 30, '20px system-ui, sans-serif', CONFIG.palette.hudText);
}

// The one entry point the loop calls each frame.
function drawFrame(ctx, state, cam, W, H, time, screen) {
  const horizonY = horizonYOf(cam, W, H);
  drawSky(ctx, W, H, horizonY, time);
  drawSea(ctx, W, H, horizonY, time);
  drawClouds(ctx, cam, W, H, horizonY, state.world, state.plane, time);
  drawIslands(ctx, cam, W, H, horizonY, state.world, state.plane, time);
  for (const strip of CONFIG.strips) drawRunway(ctx, cam, W, H, horizonY, strip);
  drawRings(ctx, cam, W, H, horizonY, state.rings, time);
  drawPlane(ctx, W, H, state.plane, time);
  if (screen === 'flying' || screen === 'paused' || screen === 'shot') {
    drawHud(ctx, state, W, H, time);
  }
  if (screen === 'title') drawTitle(ctx, W, H, time);
  if (screen === 'jobs') drawJobBoard(ctx, W, H, state.jobOffers, currentStripName(state), time);
  if (screen === 'delivered' && state.lastPayout) drawDelivered(ctx, W, H, state.lastPayout);
  if (screen === 'shiftend') drawShiftEnd(ctx, W, H, state);
  if (screen === 'crash') drawCrash(ctx, W, H, state);
  if (screen === 'paused') drawPaused(ctx, W, H);
}

function currentStripName(state) {
  const strip = CONFIG.strips.find((s) => s.id === state.plane.stripId);
  return strip ? strip.name : 'the islands';
}
