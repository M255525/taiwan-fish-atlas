/* ================= 台灣漁港魚汛圖鑑：3D 場景 =================
 * Three.js（importmap 指到 jsdelivr）。台灣本島與離島用 FA.ISLANDS 的簡化輪廓，
 * 本島高度由幾條山脈脊線疊出來；海面以「離岸距離場」上色，區分近海（12 浬示意）與遠海。
 * 座標：x = 東西、z = 南北（北為 -z）、y = 高度；1 單位約 10 公里，山高有誇大。
 * 魚、船、燈塔全部程式自繪，卡通描邊＝背面放大法。
 */
(function(){
'use strict';
var S = window.FishScene = {ready:false};
var T, Orbit;
var NEAR = 2.4, FAR_OUT = NEAR + 6.5;
var INK = '#2f2638';
var EXT = {x0:-36, z0:-36, x1:18, z1:28}, RES = .25, FW = 0, FH = 0, FIELD = null;
var U = {time:{value:0}};
var renderer, scene, camera, controls, raycaster, ndc, toonGrad, clock;
var seaMat, bedMat, zoneMix = 0, zoneTarget = 0;
var ISL = [], PORT3 = {}, labels = [], schools = [], splashes = [], boats = [], gulls = [], clouds = [];
var pickables = [], hoverId = null, hlId = null, selPort = null, fly = null;
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var host, labelRoot, geoCache = {}, matCache = {}, lineStatic, tmpV;

function P(lon, lat){ return [(lon - 120.9) * 10.17, -(lat - 23.7) * 11.1]; }
S.proj = P;
function hash(n){ var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function smooth(a, b, x){ var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function col(h){ return new T.Color(h); }
function mixC(a, b, t){ return a.clone().lerp(b, t); }
function norm(v){ var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function ease(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/* ---------- 幾何：多邊形與距離場 ---------- */
function segD2(x, z, a, b){
  var dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? ((x - a[0]) * dx + (z - a[1]) * dz) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  var px = a[0] + t * dx - x, pz = a[1] + t * dz - z; return px * px + pz * pz;
}
function inPoly(x, z, poly){
  var c = false;
  for (var i = 0, n = poly.length, j = n - 1; i < n; j = i++){
    var a = poly[i], b = poly[j];
    if (((a[1] > z) !== (b[1] > z)) && (x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
  }
  return c;
}
function edgeDist(x, z, poly){
  var m = 1e9;
  for (var i = 0, n = poly.length, j = n - 1; i < n; j = i++){ var d = segD2(x, z, poly[j], poly[i]); if (d < m) m = d; }
  return Math.sqrt(m);
}
function sdIsland(x, z, I){ var d = edgeDist(x, z, I.poly); return inPoly(x, z, I.poly) ? -d : d; }
function sdAll(x, z){
  var best = 1e9;
  for (var k = 0; k < ISL.length; k++){
    var bb = ISL[k].bb, bx = Math.max(bb[0] - x, 0, x - bb[2]), bz = Math.max(bb[1] - z, 0, z - bb[3]);
    if (bx * bx + bz * bz > best * best) continue;
    var d = sdIsland(x, z, ISL[k]);
    if (d < best) best = d;
    if (best < 0) return best;
  }
  return best;
}
/* 離岸距離（海上為正、陸上為負），雙線性取樣預先算好的格點 */
function field(x, z){
  var fx = (x - EXT.x0) / RES, fz = (z - EXT.z0) / RES;
  if (fx < 0 || fz < 0 || fx >= FW - 1 || fz >= FH - 1) return 12;
  var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * FW + i;
  return (FIELD[k] * (1 - u) + FIELD[k + 1] * u) * (1 - v) + (FIELD[k + FW] * (1 - u) + FIELD[k + FW + 1] * u) * v;
}
S.field = function(x, z){ return field(x, z); };

var HGT = {penghu:.12, baisha:.1, xiyu:.12, kinmen:.26, lieyu:.2, nangan:.38, beigan:.4, dongyin:.3, juguang:.25,
  qimei:.14, wangan:.12, ludao:.34, lanyu:.62, liuqiu:.16, guishan:.55, keelungi:.22};
function buildPolys(){
  FA.ISLANDS.forEach(function(I, k){
    var poly;
    if (I.poly) poly = I.poly.map(function(p){ return P(p[0], p[1]); });
    else {
      var c = P(I.c[0], I.c[1]), r = I.km / 10 * 1.5, sx = I.sx || 1, sy = I.sy || 1;
      poly = [];
      for (var i = 0; i < 24; i++){
        var a = i / 24 * Math.PI * 2, rr = r * (1 + .1 * Math.sin(3 * a + k) + .06 * Math.sin(5 * a + k * 2));
        poly.push([c[0] + Math.cos(a) * rr * sx, c[1] + Math.sin(a) * rr * sy]);
      }
    }
    var bb = [1e9, 1e9, -1e9, -1e9];
    poly.forEach(function(p){ bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); });
    var cx = 0, cz = 0; poly.forEach(function(p){ cx += p[0]; cz += p[1]; });
    ISL.push({id:I.id, name:I.name, main:!!I.main, poly:poly, bb:bb, hgt:HGT[I.id] || .2, c:[cx / poly.length, cz / poly.length]});
  });
}
function buildField(){
  FW = Math.ceil((EXT.x1 - EXT.x0) / RES) + 1; FH = Math.ceil((EXT.z1 - EXT.z0) / RES) + 1;
  FIELD = new Float32Array(FW * FH);
  for (var j = 0; j < FH; j++) for (var i = 0; i < FW; i++) FIELD[j * FW + i] = sdAll(EXT.x0 + i * RES, EXT.z0 + j * RES);
  var data = new Uint8Array(FW * FH * 4);
  for (var k = 0; k < FW * FH; k++){ var d = Math.max(0, Math.min(12, FIELD[k])); data[k * 4] = Math.round(d / 12 * 255); data[k * 4 + 3] = 255; }
  var tex = new T.DataTexture(data, FW, FH, T.RGBAFormat);
  tex.magFilter = tex.minFilter = T.LinearFilter; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}

/* ---------- 地形 ---------- */
var RIDGES = [
  [[121.70,24.80,.6,1.2],[121.45,24.55,2.4,1.8],[121.30,24.30,3.5,2.0],[121.28,24.12,3.4,2.0],[121.22,23.85,3.3,2.1],[121.08,23.50,3.4,2.2],[121.00,23.20,3.0,2.0],[120.88,22.85,2.8,1.8],[120.78,22.55,2.7,1.6],[120.80,22.25,1.4,1.3],[120.83,22.00,.4,.8]],
  [[120.82,23.80,2.0,1.3],[120.957,23.47,3.95,1.3],[120.86,23.15,2.4,1.2]],
  [[121.55,24.72,1.6,1.3],[121.231,24.383,3.9,1.4],[121.02,24.20,2.6,1.3],[120.86,24.00,1.4,1.1]],
  [[121.53,23.78,.9,.6],[121.45,23.45,1.6,.6],[121.35,23.15,1.4,.6],[121.22,22.93,.9,.5]],
  [[121.50,25.20,.6,.6],[121.548,25.171,1.12,.7],[121.62,25.14,.7,.6]],
  [[120.62,23.30,.7,1.0],[120.72,23.65,.9,1.0],[120.80,24.35,.8,1.2]]
];
var KM = .42, RID = [];
function prepRidges(){
  RID = RIDGES.map(function(r){ return r.map(function(p){ var q = P(p[0], p[1]); return [q[0], q[1], p[2] * KM, p[3]]; }); });
}
function ridgeH(x, z){
  var best = 0;
  RID.forEach(function(r){
    for (var i = 0; i < r.length - 1; i++){
      var a = r[i], b = r[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
      var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
      var px = a[0] + t * dx - x, pz = a[1] + t * dz - z, d = Math.sqrt(px * px + pz * pz);
      var h = a[2] + (b[2] - a[2]) * t, w = a[3] + (b[3] - a[3]) * t;
      var v = h * Math.exp(-(d / w) * (d / w));
      if (v > best) best = v;
    }
  });
  return best;
}
function noise(x, z){ return .5 * Math.sin(x * 1.9 + z * .7) * Math.sin(z * 1.4 - x * .5) + .3 * Math.sin(x * 4.1 + 1.3) * Math.sin(z * 3.7 + .4) + .2 * Math.sin(x * 8.3 + z * 6.1); }
var LANDC;
function landColor(h, d){
  if (h < -.01) return LANDC.under;
  if (d < .09 || h < .085) return LANDC.sand;
  if (h < .3) return LANDC.plain;
  if (h < .65) return LANDC.grass;
  if (h < 1.05) return LANDC.forest;
  if (h < 1.45) return LANDC.deep;
  if (h < 1.72) return LANDC.rock;
  return LANDC.snow;
}
function buildLand(I){
  var m = I.main ? 1.1 : .8, w = I.bb[2] - I.bb[0], res = I.main ? .15 : (w < 1 ? .05 : .08);
  var x0 = I.bb[0] - m, z0 = I.bb[1] - m, nx = Math.ceil((w + 2 * m) / res) + 1, nz = Math.ceil((I.bb[3] - I.bb[1] + 2 * m) / res) + 1;
  var pos = new Float32Array(nx * nz * 3), cols = new Float32Array(nx * nz * 3), hs = new Float32Array(nx * nz);
  var inner = Math.min(w, I.bb[3] - I.bb[1]) * .4;
  for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++){
    var x = x0 + i * res, z = z0 + j * res, d = -sdIsland(x, z, I), h, k = j * nx + i;
    if (d > 0){
      var n = noise(x, z);
      if (I.main) h = .05 + ridgeH(x, z) * smooth(0, 1.1, d) * (1 + .28 * n) + .03 * smooth(0, .5, d) * (n + 1);
      else h = .04 + I.hgt * smooth(0, inner, d) * (1 + .2 * n);
    } else h = Math.max(-.62, d * .9);
    hs[k] = h; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    var c = landColor(h, d); cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
  }
  var idx = [];
  for (j = 0; j < nz - 1; j++) for (i = 0; i < nx - 1; i++){
    var a = j * nx + i, b = a + 1, c2 = a + nx, d2 = c2 + 1;
    if (hs[a] > -.6 || hs[b] > -.6 || hs[c2] > -.6 || hs[d2] > -.6){ idx.push(a, c2, b, b, c2, d2); }
  }
  var g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(cols, 3));
  g.setIndex(idx); g.computeVertexNormals();
  var mesh = new T.Mesh(g, new T.MeshToonMaterial({vertexColors:true, gradientMap:toonGrad}));
  scene.add(mesh);
  return mesh;
}
function landY(x, z){
  // 用於擺放燈塔：取最接近的島重算一次高度
  var best = null, bd = 1e9;
  ISL.forEach(function(I){ var d = sdIsland(x, z, I); if (d < bd){ bd = d; best = I; } });
  if (!best || bd > 0) return .05;
  var d = -bd;
  if (best.main) return .05 + ridgeH(x, z) * smooth(0, 1.1, d) * (1 + .28 * noise(x, z)) + .03 * smooth(0, .5, d) * (noise(x, z) + 1);
  return .04 + best.hgt * smooth(0, Math.min(best.bb[2] - best.bb[0], best.bb[3] - best.bb[1]) * .4, d);
}

/* ---------- 海 ---------- */
var SEA_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
var SEA_FS = [
  'uniform sampler2D uDist; uniform vec4 uExt; uniform float uTime, uNear, uMode, uCalm; uniform vec3 uHorizon; varying vec3 vW;',
  'void main(){',
  '  vec2 uv = (vW.xz - uExt.xy) / uExt.zw;',
  '  float d = texture2D(uDist, uv).r * 12.;',
  '  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) d = 12.;',
  '  vec3 c1 = vec3(.56,.93,.90), c2 = vec3(.31,.80,.90), c3 = vec3(.15,.55,.84), c4 = vec3(.10,.39,.72), c5 = vec3(.07,.27,.58);',
  '  vec3 col = mix(c1, c2, smoothstep(uNear*.42, uNear*.48, d));',
  '  col = mix(col, c3, smoothstep(uNear-.04, uNear+.04, d));',
  '  col = mix(col, c4, smoothstep(uNear+2.4, uNear+2.5, d));',
  '  col = mix(col, c5, smoothstep(uNear+6.4, uNear+6.6, d));',
  '  float inN = 1. - smoothstep(uNear-.05, uNear+.05, d);',
  '  float inF = smoothstep(uNear-.05, uNear+.05, d) * (1. - smoothstep(uNear+6.4, uNear+6.6, d));',
  '  float hi = inN * (1. - uMode) + inF * uMode, lo = inN * uMode + inF * (1. - uMode);',
  '  col += hi * (.07 + .04 * sin(uTime * 2.2)) ; col *= 1. - .16 * lo;',
  '  float t = uTime * uCalm;',
  '  float w = sin(vW.x*2.1 + sin(vW.z*1.3 + t*.5)*1.6 + t*.8) * sin(vW.z*2.6 - t*.6 + sin(vW.x*1.1)*1.3);',
  '  col = mix(col, vec3(1.), smoothstep(.86, .96, w) * .42);',
  '  float f = 1. - smoothstep(.04, .15 + .05 * sin(t*2. + vW.x*5. + vW.z*3.), d);',
  '  col = mix(col, vec3(1.), f * .92);',
  '  float b = 1. - smoothstep(0., .05, abs(d - uNear));',
  '  float dash = step(.42, fract((vW.x - vW.z) * 1.1 + t * .15));',
  '  col = mix(col, vec3(1.), b * dash * (.55 + .35 * (1. - uMode)));',
  '  float b2 = 1. - smoothstep(0., .06, abs(d - (uNear + 6.5)));',
  '  col = mix(col, vec3(1.), b2 * step(.6, fract((vW.x + vW.z) * 1.4)) * (.25 + .45 * uMode));',
  '  float alpha = mix(.5, .8, smoothstep(0., 4., d));',
  '  float hz = smoothstep(60., 200., length(vW.xz - cameraPosition.xz));',
  '  col = mix(col, uHorizon, hz); alpha = mix(alpha, 1., hz);',
  '  gl_FragColor = vec4(col, alpha);',
  '}'].join('\n');
var BED_FS = [
  'uniform sampler2D uDist; uniform vec4 uExt; uniform vec3 uHorizon; varying vec3 vW;',
  'void main(){',
  '  vec2 uv = (vW.xz - uExt.xy) / uExt.zw; float d = texture2D(uDist, uv).r * 12.;',
  '  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) d = 12.;',
  '  vec3 col = mix(vec3(.86,.82,.62), vec3(.22,.55,.62), smoothstep(.2, 1.6, d));',
  '  col = mix(col, vec3(.06,.2,.4), smoothstep(2., 6., d));',
  '  float hz = smoothstep(60., 200., length(vW.xz - cameraPosition.xz)); col = mix(col, uHorizon, hz);',
  '  gl_FragColor = vec4(col, 1.);',
  '}'].join('\n');
function buildSea(tex){
  var uni = {uDist:{value:tex}, uExt:{value:new T.Vector4(EXT.x0, EXT.z0, (FW - 1) * RES, (FH - 1) * RES)},
    uTime:U.time, uNear:{value:NEAR}, uMode:{value:0}, uCalm:{value:reduce ? .15 : 1}, uHorizon:{value:new T.Vector3(.74, .9, .97)}};
  seaMat = new T.ShaderMaterial({uniforms:uni, vertexShader:SEA_VS, fragmentShader:SEA_FS, transparent:true});
  var sea = new T.Mesh(new T.PlaneGeometry(520, 520), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(-8, 0, -4); sea.renderOrder = 2;
  scene.add(sea);
  bedMat = new T.ShaderMaterial({uniforms:{uDist:uni.uDist, uExt:uni.uExt, uHorizon:uni.uHorizon}, vertexShader:SEA_VS, fragmentShader:BED_FS});
  var bed = new T.Mesh(new T.PlaneGeometry(520, 520), bedMat);
  bed.rotation.x = -Math.PI / 2; bed.position.set(-8, -.62, -4);
  scene.add(bed);
}

/* ---------- 自繪幾何工具 ---------- */
function Geo(){ this.p = []; this.c = []; this.i = []; }
Geo.prototype.v = function(x, y, z, c){ this.p.push(x, y, z); this.c.push(c.r, c.g, c.b); return this.p.length / 3 - 1; };
Geo.prototype.tri2 = function(A, B, C, c){
  var a = this.v(A[0], A[1], A[2], c), b = this.v(B[0], B[1], B[2], c), d = this.v(C[0], C[1], C[2], c); this.i.push(a, b, d);
  a = this.v(A[0], A[1], A[2], c); b = this.v(B[0], B[1], B[2], c); d = this.v(C[0], C[1], C[2], c); this.i.push(a, d, b);
};
Geo.prototype.fan2 = function(pts, c){ for (var k = 1; k < pts.length - 1; k++) this.tri2(pts[0], pts[k], pts[k + 1], c); };
Geo.prototype.sweep = function(path, colFn, seg){
  seg = seg || 12;
  var n = path.length, base = this.p.length / 3, self = this, k, j;
  for (k = 0; k < n; k++){
    var a = path[Math.max(0, k - 1)].p, b = path[Math.min(n - 1, k + 1)].p;
    var t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    var up = Math.abs(t[1]) > .95 ? [1, 0, 0] : [0, 1, 0], dt = up[0] * t[0] + up[1] * t[1] + up[2] * t[2];
    var N = norm([up[0] - t[0] * dt, up[1] - t[1] * dt, up[2] - t[2] * dt]), B = cross(t, N), q = path[k];
    for (j = 0; j <= seg; j++){
      var an = j / seg * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
      var x = q.p[0] + N[0] * ca * q.h + B[0] * sa * q.w, y = q.p[1] + N[1] * ca * q.h + B[1] * sa * q.w, z = q.p[2] + N[2] * ca * q.h + B[2] * sa * q.w;
      this.v(x, y, z, colFn(k / (n - 1), ca, sa, x, y, z));
    }
  }
  for (k = 0; k < n - 1; k++) for (j = 0; j < seg; j++){
    var i0 = base + k * (seg + 1) + j, i1 = i0 + seg + 1;
    this.i.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
  }
  function cap(k, start){
    var q = path[k]; if (q.h < 1e-4) return;
    var c = self.v(q.p[0], q.p[1], q.p[2], colFn(k / (n - 1), 0, 0, q.p[0], q.p[1], q.p[2])), r0 = base + k * (seg + 1);
    for (var j = 0; j < seg; j++){ if (start) self.i.push(c, r0 + j + 1, r0 + j); else self.i.push(c, r0 + j, r0 + j + 1); }
  }
  cap(0, true); cap(n - 1, false);
};
var SPH;
Geo.prototype.ell = function(cx, cy, cz, rx, ry, rz, c){
  if (!SPH) SPH = new T.SphereGeometry(1, 12, 9);
  var p = SPH.attributes.position, base = this.p.length / 3, ix = SPH.index.array;
  for (var k = 0; k < p.count; k++){
    var x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    this.v(cx + x * rx, cy + y * ry, cz + z * rz, typeof c === 'function' ? c(x, y, z) : c);
  }
  for (k = 0; k < ix.length; k++) this.i.push(base + ix[k]);
};
Geo.prototype.stick = function(pts, r0, r1, c, seg){
  var n = pts.length;
  this.sweep(pts.map(function(p, k){ var r = r0 + (r1 - r0) * k / (n - 1); return {p:p, h:r, w:r}; }), function(){ return c; }, seg || 6);
};
Geo.prototype.build = function(){
  var g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
  g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
};

/* ---------- 魚的造型 ---------- */
var PAT = {seabream:'dots', mahi:'dots', dentex:'dots', bigeye:'none', rosy:'none'};
var WAVE = {
  def:{amp:.05, k:5, spd:7, head:.25, tail:-.55}, tuna:{amp:.03, k:4, spd:8, head:.15, tail:-.55}, deep:{amp:.03, k:5, spd:6, head:.2, tail:-.55},
  long:{amp:.08, k:5, spd:6, head:.7, tail:-1.1}, tiny:{amp:.05, k:7, spd:13, head:.25, tail:-.55}, ceph:{amp:.05, k:7, spd:6, head:-.1, tail:-.8},
  octopus:{amp:.08, k:6, spd:5, head:.05, tail:-.6}, shrimp:{amp:.02, k:6, spd:5, head:.1, tail:-.5}, crab:{amp:0, k:1, spd:1, head:1, tail:0}
};
function waveOf(f){
  var b = f.body;
  if (b === 'tuna' || b === 'bill') return WAVE.tuna;
  if (b === 'deep' || b === 'stocky') return WAVE.deep;
  if (b === 'long') return WAVE.long;
  if (b === 'tiny') return WAVE.tiny;
  if (b === 'squid' || b === 'bigfin' || b === 'cuttle') return WAVE.ceph;
  if (b === 'octopus') return WAVE.octopus;
  if (b === 'shrimp' || b === 'lobster') return WAVE.shrimp;
  if (b === 'crab') return WAVE.crab;
  return WAVE.def;
}
function fishGeo(f){
  if (geoCache[f.id]) return geoCache[f.id];
  var g = new Geo(), b = f.body;
  var C0 = col(f.col[0]), C1 = col(f.col[1]), C2 = col(f.col[2]), WH = col('#ffffff'), BK = col('#1a1420');
  if (b === 'squid' || b === 'bigfin' || b === 'cuttle') ceph(g, f, C0, C1, C2, WH, BK);
  else if (b === 'octopus') octo(g, C0, C1, C2, WH, BK);
  else if (b === 'shrimp' || b === 'lobster') shrimp(g, f, C0, C1, C2, BK);
  else if (b === 'crab') crab(g, f, C0, C1, C2, WH, BK);
  else fish(g, f, C0, C1, C2, WH, BK);
  return (geoCache[f.id] = g.build());
}
function eyes(g, x, y, z, r, WH, BK){
  [1, -1].forEach(function(s){
    g.ell(x, y, z * s, r, r, r * .7, WH);
    g.ell(x + r * .18, y - r * .05, s * (z + r * .42), r * .6, r * .66, r * .4, BK);
    g.ell(x + r * .34, y + r * .26, s * (z + r * .78), r * .2, r * .2, r * .12, WH);
  });
}
function fish(g, f, C0, C1, C2, WH, BK){
  var b = f.body, H = .28, W = .17, blunt = !!f.blunt, L0 = .5, L1 = -.3, pat = f.pat || PAT[f.id] || 'none';
  if (f.slim){ H = .2; W = .12; }
  if (b === 'tuna'){ H = .36; W = .27; }
  if (b === 'deep'){ H = f.mid ? .46 : .62; W = .15; }
  if (b === 'stocky'){ H = .4; W = .27; blunt = true; }
  if (b === 'mahi'){ H = .32; W = .14; blunt = true; }
  if (b === 'flyer'){ H = .2; W = .15; }
  if (b === 'bill'){ H = .26; W = .17; }
  if (b === 'tiny'){ H = .15; W = .08; }
  if (b === 'long'){ H = .13; W = .045; L0 = 1; L1 = -1.05; }
  function prof(u){
    if (b === 'long') return u < .05 ? .3 + .7 * Math.sqrt(u / .05) : 1 - (u - .05) / .95 * .93;
    if (u < .3) return Math.pow(Math.sin(u / .3 * Math.PI / 2), blunt ? .3 : .62);
    return 1 - Math.pow((u - .3) / .7, 1.5) * .86;
  }
  function uAt(x){ return (L0 - x) / (L0 - L1); }
  function topY(x){ return H / 2 * prof(Math.max(0, Math.min(1, uAt(x)))) * .92; }
  var path = [], N = b === 'long' ? 30 : 20;
  for (var k = 0; k <= N; k++){ var u = k / N, s = prof(u); path.push({p:[L0 + (L1 - L0) * u, 0, 0], h:H / 2 * s, w:W / 2 * s}); }
  g.sweep(path, function(u, ca, sa, x, y, z){
    var c = mixC(C1, C0, smooth(-.14, .14, ca));
    if (pat === 'wave' && ca > .25 && Math.sin(u * 48 + ca * 9) > .5) c = C2;
    else if (pat === 'bellyStripes' && ca < -.1 && Math.sin(ca * 22) > .3) c = C2;
    else if (pat === 'spots' && Math.sin(x * 70) * Math.sin(y * 65 + z * 80) > .5) c = mixC(c, C2, .85);
    else if (pat === 'dots' && Math.sin(x * 90) * Math.sin(y * 85 + z * 70) > .78) c = C2;
    else if (pat === 'bars' && ca > -.3 && Math.sin(u * 42) > .55) c = mixC(c, C2, .8);
    else if (pat === 'scute' && Math.abs(ca) < .1 && u > .25 && u < .95) c = C2;
    return c;
  }, 14);
  var FC = (b === 'tuna' || b === 'mahi' || b === 'flyer' || b === 'bill') ? C2 : mixC(C0, BK, .15);
  // 尾鰭
  var px = L1 + .01, hT = H * (b === 'deep' ? .72 : .7);
  if (b === 'long'){ /* 白帶魚尾端細尖，不加尾鰭 */ }
  else if (b === 'stocky' || f.file){
    var pts = [[px + .02, 0, 0]];
    for (var a = -70; a <= 70; a += 20){ var r = a * Math.PI / 180; pts.push([px - Math.cos(r) * H * .55, Math.sin(r) * H * .55, 0]); }
    g.fan2(pts, FC);
  } else if (b === 'tuna' || b === 'bill' || b === 'mahi'){
    g.tri2([px, 0, 0], [px - .2, H * .95, 0], [px - .08, 0, 0], FC); g.tri2([px, 0, 0], [px - .08, 0, 0], [px - .2, -H * .95, 0], FC);
  } else {
    g.tri2([px, 0, 0], [px - .22, hT, 0], [px - .13, 0, 0], FC); g.tri2([px, 0, 0], [px - .13, 0, 0], [px - .22, -hT, 0], FC);
  }
  // 背鰭
  if (b === 'mahi' || b === 'bill' || b === 'long'){
    var x0 = b === 'long' ? .9 : b === 'bill' ? .3 : .38, x1 = b === 'long' ? -.95 : b === 'bill' ? -.12 : -.25, segs = b === 'long' ? 12 : 6;
    for (var s2 = 0; s2 < segs; s2++){
      var xa = x0 + (x1 - x0) * s2 / segs, xb = x0 + (x1 - x0) * (s2 + 1) / segs;
      var ha = b === 'long' ? .045 : b === 'bill' ? H * 1.3 * Math.sin(Math.PI * (.15 + .85 * s2 / segs)) : H * .32;
      var hb = b === 'long' ? .045 : b === 'bill' ? H * 1.3 * Math.sin(Math.PI * (.15 + .85 * (s2 + 1) / segs)) : H * .32;
      if (b === 'bill' && s2 === segs - 1) hb = .02;
      var ya = topY(xa), yb = topY(xb);
      g.tri2([xa, ya, 0], [xa, ya + ha, 0], [xb, yb, 0], FC); g.tri2([xb, yb, 0], [xa, ya + ha, 0], [xb, yb + hb, 0], FC);
    }
  } else if (b === 'deep'){
    g.tri2([.15, topY(.15), 0], [-.05, topY(-.05) + H * .3, 0], [-.22, topY(-.22) * .9, 0], FC);
    g.tri2([.08, -topY(.08), 0], [-.2, -topY(-.2) * .9, 0], [-.06, -topY(-.06) - H * .25, 0], FC);
  } else {
    g.tri2([.13, topY(.13), 0], [-.02, topY(-.02) + H * .42, 0], [-.12, topY(-.12) * .95, 0], FC);
    g.tri2([-.04, -topY(-.04), 0], [-.18, -topY(-.18) * .9, 0], [-.12, -topY(-.12) - H * .25, 0], FC);
  }
  if (f.file) g.tri2([.3, topY(.3), 0], [.24, topY(.24) + H * .55, 0], [.22, topY(.22), 0], C2);
  if (b === 'tuna') for (var q = 0; q < 5; q++){
    var fx = -.06 - q * .05, ty = topY(fx);
    g.tri2([fx, ty * .9, 0], [fx - .02, ty + .04, 0], [fx - .04, ty * .85, 0], C2);
    g.tri2([fx, -ty * .9, 0], [fx - .04, -ty * .85, 0], [fx - .02, -ty - .04, 0], C2);
  }
  // 胸鰭／飛魚的翅膀
  var ew = W / 2 * prof(.25);
  [1, -1].forEach(function(s){
    if (b === 'flyer'){
      g.tri2([.2, 0, s * ew], [-.28, .03, s * (ew + .46)], [-.04, 0, s * ew], C2);
      g.tri2([-.04, 0, s * ew], [-.28, .03, s * (ew + .46)], [-.34, 0, s * (ew + .22)], C2);
      g.tri2([-.12, -.03, s * ew * .8], [-.32, -.02, s * (ew + .16)], [-.24, -.03, s * ew * .8], C2);
    } else g.tri2([.22, -H * .06, s * ew], [.06, -H * .22, s * (ew + .07)], [.08, -H * .02, s * ew], FC);
  });
  if (b === 'bill') g.stick([[L0 - .02, -.01, 0], [L0 + .4, -.02, 0]], .028, .004, C0, 6);
  var ue = b === 'long' ? .03 : .11, ex = L0 + (L1 - L0) * ue, er = Math.max(.032, Math.min(.075, H * .2));
  eyes(g, ex, H * .06, W / 2 * prof(ue) * .78, er, WH, BK);
}
function ceph(g, f, C0, C1, C2, WH, BK){
  var b = f.body, R = b === 'bigfin' ? .15 : b === 'cuttle' ? .17 : .1, len = f.big ? .62 : .55, path = [], N = 16;
  var fh = b === 'cuttle' ? .55 : 1, fw = b === 'cuttle' ? 1.15 : 1;
  for (var k = 0; k <= N; k++){
    var u = k / N, s = b === 'squid' ? Math.pow(Math.sin(Math.min(u / .75, 1) * Math.PI / 2), .9) : Math.pow(Math.sin(Math.min(u / .45, 1) * Math.PI / 2), .6);
    path.push({p:[.5 - u * len, 0, 0], h:Math.max(.004, R * s * fh), w:Math.max(.004, R * s * fw)});
  }
  function sk(u, ca, sa, x, y, z){
    if (Math.sin(x * 70 + z * 20) * Math.sin(y * 60 + z * 75) > .55) return C2;
    return mixC(C1, C0, smooth(-.3, .3, ca));
  }
  g.sweep(path, sk, 14);
  var hx = .5 - len - .05;
  g.ell(hx, 0, 0, R * .7, R * .6 * fh, R * .7 * fw, C0);
  eyes(g, hx + .01, R * .1, R * .55 * fw, .045, WH, BK);
  var ax = hx - .05, la = b === 'squid' ? .3 : .22;
  for (var a = 0; a < 8; a++){
    var an = a / 8 * Math.PI * 2, oy = Math.cos(an) * R * .38 * fh, oz = Math.sin(an) * R * .42 * fw, pts = [];
    for (var t = 0; t <= 4; t++){ var tt = t / 4; pts.push([ax - tt * la, oy * (1 + tt * .9), oz * (1 + tt * .9)]); }
    g.stick(pts, .022, .004, C0, 5);
  }
  if (b === 'squid') [1, -1].forEach(function(s){
    var pts = []; for (var t = 0; t <= 5; t++){ var tt = t / 5; pts.push([ax - tt * .55, -.01, s * (.015 + tt * .05)]); }
    g.stick(pts, .012, .006, C0, 5);
  });
  var FN = mixC(C0, C1, .3);
  if (b === 'squid'){
    [1, -1].forEach(function(s){ g.tri2([.5, 0, 0], [.33, 0, s * .16], [.18, 0, s * .02], FN); });
  } else {
    var segs = 10, wf = b === 'cuttle' ? .045 : .09;
    for (var q = 0; q < segs; q++){
      var u0 = q / segs, u1 = (q + 1) / segs, i0 = Math.round(u0 * N), i1 = Math.round(u1 * N);
      var xa = path[i0].p[0], xb = path[i1].p[0], wa = path[i0].w, wb = path[i1].w, da = wf * Math.sin(Math.PI * Math.min(1, u0 * 1.05 + .02)), db = wf * Math.sin(Math.PI * Math.min(1, u1 * 1.05 + .02));
      [1, -1].forEach(function(s){
        g.tri2([xa, 0, s * wa * .9], [xa, 0, s * (wa + da)], [xb, 0, s * wb * .9], FN);
        g.tri2([xb, 0, s * wb * .9], [xa, 0, s * (wa + da)], [xb, 0, s * (wb + db)], FN);
      });
    }
  }
}
function octo(g, C0, C1, C2, WH, BK){
  var path = [], N = 14;
  for (var k = 0; k <= N; k++){ var u = k / N, s = Math.pow(Math.sin(Math.PI * u), .7); path.push({p:[.5 - u * .42, .05, 0], h:Math.max(.004, .18 * s), w:Math.max(.004, .17 * s)}); }
  g.sweep(path, function(u, ca, sa, x, y, z){ return Math.sin(x * 60) * Math.sin(z * 55 + y * 40) > .6 ? C2 : mixC(C1, C0, smooth(-.4, .2, ca)); }, 14);
  eyes(g, .14, .1, .11, .045, WH, BK);
  for (var a = 0; a < 8; a++){
    var an = a / 8 * Math.PI * 2 + .2, pts = [];
    for (var t = 0; t <= 6; t++){
      var tt = t / 6, r = .05 + tt * .2;
      pts.push([.08 - tt * .6, -.03 - tt * .06 + Math.sin(tt * 3 + a) * .03, Math.sin(an) * r]);
      pts[t][1] += Math.cos(an) * r * .5;
    }
    g.sweep(pts.map(function(p, k){ var r = .045 * (1 - k / 6 * .9); return {p:p, h:r, w:r}; }), function(u, ca){ return ca < -.3 ? C1 : C0; }, 6);
  }
}
function shrimp(g, f, C0, C1, C2, BK){
  var lob = f.body === 'lobster', R = lob ? .12 : .085, path = [], N = 14;
  for (var k = 0; k <= N; k++){
    var u = k / N, r = (u < .35 ? R : R * (1 - (u - .35) / .65 * .6)) * (.45 + .55 * Math.sin(Math.min(u / .12, 1) * Math.PI / 2));
    path.push({p:[.42 - u * .82, .03 - .22 * u * u, 0], h:r, w:r * 1.05});
  }
  g.sweep(path, function(u, ca, sa, x, y, z){
    if (Math.sin(u * 44) > .75) return C2;
    if (lob && Math.sin(x * 60) * Math.sin(z * 60 + y * 30) > .6) return C2;
    return mixC(C1, C0, smooth(-.4, .2, ca));
  }, 12);
  var E = path[N].p, ex = E[0], ey = E[1];
  g.fan2([[ex + .02, ey, 0], [ex - .1, ey - .04, .1], [ex - .15, ey - .05, 0], [ex - .1, ey - .04, -.1]], C0);
  var al = lob ? [1.15, .2, .3, .024] : [1.0, .12, .24, .007];
  [1, -1].forEach(function(s){
    g.stick([[.4, .05, s * .03], [.7, .09, s * al[2] * .5], [al[0], al[1], s * al[2]]], al[3], al[3] * .3, lob ? C2 : C0, 5);
    g.ell(.4, .09, s * .05, .025, .025, .025, BK);
    for (var q = 0; q < 5; q++){ var lx = .3 - q * .09; g.stick([[lx, -R * .6, s * R * .5], [lx + .02, -R - .08, s * (R * .5 + .05)]], .008, .005, C0, 4); }
  });
  if (f.mud) g.ell(.5, -.02, .07, .11, .05, .05, C1);
}
function crab(g, f, C0, C1, C2, WH, BK){
  var flower = f.id === 'flowercrab';
  g.ell(0, 0, 0, .2, .085, .32, function(x, y, z){
    if (y < -.1) return C1;
    if (flower && Math.sin(x * 9 + z * 4) * Math.sin(z * 11) > .25) return C2;
    return C0;
  });
  if (!flower) [[-.09, .075, 0], [-.02, .075, .15], [-.02, .075, -.15]].forEach(function(p){ g.ell(p[0], p[1], p[2], .045, .015, .045, C2); });
  [1, -1].forEach(function(s){
    g.stick([[0, 0, s * .29], [-.02, .01, s * .45]], .03, .004, C0, 6);
    g.stick([[.08, 0, s * .2], [.3, .03, s * .32], [.42, .03, s * .22]], .036, .03, C0, 7);
    g.ell(.46, .03, s * .2, .075, .045, .055, C0);
    g.ell(.55, .03, s * .19, .045, .02, .03, mixC(C2, BK, .4));
    for (var q = 0; q < 3; q++){ var lx = .06 - q * .09; g.stick([[lx, 0, s * .26], [lx - .03, .04, s * .42], [lx - .06, -.06, s * .55]], .022, .008, C0, 5); }
    g.stick([[-.2, 0, s * .22], [-.3, .02, s * .36]], .02, .015, C0, 5);
    g.ell(-.33, .02, s * .41, .05, .01, .04, C0);
    g.ell(.2, .09, s * .06, .024, .024, .024, BK);
    g.ell(.215, .1, s * .07, .008, .008, .008, WH);
  });
}

/* ---------- 材質 ---------- */
function patchWave(mat, wp, out){
  mat.onBeforeCompile = function(sh){
    sh.uniforms.uTime = U.time;
    sh.uniforms.uAmp = {value:wp.amp}; sh.uniforms.uK = {value:wp.k}; sh.uniforms.uSpd = {value:wp.spd};
    sh.uniforms.uHead = {value:wp.head}; sh.uniforms.uTail = {value:wp.tail}; sh.uniforms.uOut = {value:out || 0};
    sh.vertexShader = 'uniform float uTime, uAmp, uK, uSpd, uHead, uTail, uOut;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      'transformed += normalize(normal) * uOut;\n' +
      'float wph = modelMatrix[3][0] * 1.7 + modelMatrix[3][2] * 2.3;\n' +
      'float ww = clamp((uHead - position.x) / (uHead - uTail), 0., 1.);\n' +
      'transformed.z += sin(position.x * uK - uTime * uSpd + wph) * uAmp * ww * ww;');
  };
  mat.customProgramCacheKey = function(){ return out ? 'wave-o' : 'wave'; };
  return mat;
}
function fishMats(f){
  if (matCache[f.id]) return matCache[f.id];
  var wp = waveOf(f);
  if (reduce) wp = {amp:wp.amp * .4, k:wp.k, spd:wp.spd * .4, head:wp.head, tail:wp.tail};
  var thick = f.body === 'tiny' ? .02 : f.body === 'long' ? .018 : .028;
  return (matCache[f.id] = {
    body:patchWave(new T.MeshToonMaterial({vertexColors:true, gradientMap:toonGrad}), wp, 0),
    line:patchWave(new T.MeshBasicMaterial({color:INK, side:T.BackSide}), wp, thick)
  });
}
function toon(c, extra){ var m = new T.MeshToonMaterial(Object.assign({color:c, gradientMap:toonGrad}, extra || {})); return m; }
function withLine(mesh, th){
  var l = new T.Mesh(mesh.geometry, th === undefined ? lineStatic : patchWave(new T.MeshBasicMaterial({color:INK, side:T.BackSide}), WAVE.crab, th));
  mesh.add(l); return mesh;
}
function makeFish(f){
  var g = fishGeo(f), m = fishMats(f), grp = new T.Group();
  var body = new T.Mesh(g, m.body); body.userData.fishId = f.id;
  var line = new T.Mesh(g, m.line);
  grp.add(body); grp.add(line); grp.rotation.order = 'YZX';
  return {grp:grp, body:body};
}
S.makeFishMesh = makeFish;

/* ---------- 燈塔、船、雲、海鷗 ---------- */
var LH = {};
function lighthouse(){
  if (!LH.base){
    LH.base = new T.CylinderGeometry(.07, .1, .42, 12);
    LH.band = new T.CylinderGeometry(.088, .093, .08, 12);
    LH.top = new T.ConeGeometry(.1, .14, 12);
    LH.lamp = new T.SphereGeometry(.055, 10, 8);
    LH.rock = new T.CylinderGeometry(.16, .2, .08, 9);
    LH.mW = toon('#ffffff'); LH.mR = toon('#e4473b'); LH.mL = new T.MeshBasicMaterial({color:'#ffe066'}); LH.mK = toon('#b9a88f');
  }
  var g = new T.Group();
  var rock = withLine(new T.Mesh(LH.rock, LH.mK)); rock.position.y = .04; g.add(rock);
  var b = withLine(new T.Mesh(LH.base, LH.mW)); b.position.y = .29; g.add(b);
  var band = new T.Mesh(LH.band, LH.mR); band.position.y = .3; g.add(band);
  var lamp = new T.Mesh(LH.lamp, LH.mL); lamp.position.y = .54; g.add(lamp);
  var top = withLine(new T.Mesh(LH.top, LH.mR)); top.position.y = .64; g.add(top);
  g.userData.lamp = lamp;
  return g;
}
var BT = {};
function boat(seed){
  if (!BT.hull){
    BT.hull = new T.SphereGeometry(1, 14, 8); BT.hull.scale(.36, .1, .14);
    BT.cab = new T.BoxGeometry(.16, .12, .14); BT.roof = new T.BoxGeometry(.2, .03, .17);
    BT.mast = new T.CylinderGeometry(.008, .008, .3, 5); BT.flag = new T.PlaneGeometry(.08, .05);
    BT.bulb = new T.SphereGeometry(.018, 6, 5);
    BT.m = ['#2f74d0', '#e4473b', '#1e9e8a', '#f2a93b'].map(function(c){ return toon(c); });
    BT.w = toon('#ffffff'); BT.y = new T.MeshBasicMaterial({color:'#ffe680'}); BT.f = new T.MeshBasicMaterial({color:'#ff5d73', side:T.DoubleSide});
  }
  var g = new T.Group(), c = BT.m[seed % 4];
  var h = withLine(new T.Mesh(BT.hull, c)); h.position.y = .015; g.add(h);
  var cab = withLine(new T.Mesh(BT.cab, BT.w)); cab.position.set(-.06, .1, 0); g.add(cab);
  var roof = new T.Mesh(BT.roof, c); roof.position.set(-.06, .175, 0); g.add(roof);
  var mast = new T.Mesh(BT.mast, BT.w); mast.position.set(.1, .2, 0); g.add(mast);
  var fl = new T.Mesh(BT.flag, BT.f); fl.position.set(.14, .32, 0); g.add(fl);
  for (var i = 0; i < 4; i++){ var bu = new T.Mesh(BT.bulb, BT.y); bu.position.set(.26 - i * .12, .1 + (i % 2) * .03, 0); g.add(bu); }
  return g;
}
function cloud(seed){
  var g = new T.Group(), m = toon('#ffffff', {transparent:true, opacity:.96});
  var n = 4 + (seed % 3);
  for (var i = 0; i < n; i++){
    var r = .9 + hash(seed * 7 + i) * .9, s = new T.Mesh(new T.SphereGeometry(r, 12, 9), m);
    s.position.set((i - n / 2) * 1.1 + hash(seed + i) * .6, hash(seed * 3 + i) * .5, (hash(seed * 5 + i) - .5) * 1.4);
    s.scale.y = .62; g.add(s);
  }
  return g;
}
function gull(){
  var g = new T.Group(), m = new T.MeshBasicMaterial({color:'#ffffff', side:T.DoubleSide}), mk = new T.MeshBasicMaterial({color:INK, side:T.DoubleSide});
  var body = new T.Mesh(new T.SphereGeometry(.05, 8, 6), m); body.scale.set(1.8, .8, .8); g.add(body);
  var wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -.06, 0, .22, .05, 0, .02], 3));
  var tip = new T.BufferGeometry(); tip.setAttribute('position', new T.Float32BufferAttribute([-.06, 0, .22, -.09, 0, .3, -.02, 0, .2], 3));
  [1, -1].forEach(function(s){
    var w = new T.Group(); w.add(new T.Mesh(wg, m)); w.add(new T.Mesh(tip, mk)); w.scale.z = s; g.add(w);
    g.userData[s > 0 ? 'wl' : 'wr'] = w;
  });
  return g;
}

/* ---------- 標籤 ---------- */
function addLabel(el, pos, pri, kind, extra){
  el.classList.add('lab3d', 'off');
  labelRoot.appendChild(el);
  var L = Object.assign({el:el, pos:pos, pri:pri, kind:kind, w:0, h:0, active:true, off:true}, extra || {});
  labels.push(L);
  labels.sort(function(a, b){ return b.pri - a.pri; });
  return L;
}
function removeLabel(L){ var i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); if (L.el.parentNode) L.el.parentNode.removeChild(L.el); }
function layoutLabels(){
  var W = host.clientWidth, H = host.clientHeight, placed = [];
  var sorted = labels.slice().sort(function(a, b){ return (b.pri + (b.boost || 0)) - (a.pri + (a.boost || 0)); });
  for (var i = 0; i < sorted.length; i++){
    var L = sorted[i];
    if (!L.active){ hide(L); continue; }
    if (L.follow) tmpV.copy(L.follow()); else tmpV.copy(L.pos);
    tmpV.project(camera);
    if (tmpV.z > 1 || tmpV.z < -1){ hide(L); continue; }
    var x = (tmpV.x * .5 + .5) * W, y = (-tmpV.y * .5 + .5) * H;
    if (!L.w){ L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    var r = [x - L.w / 2, y - L.h, x + L.w / 2, y];
    if (r[2] < 0 || r[0] > W || r[3] < 0 || r[1] > H){ hide(L); continue; }
    var hit = false;
    if (!L.force) for (var k = 0; k < placed.length; k++){ var q = placed[k]; if (r[0] < q[2] + 2 && r[2] > q[0] - 2 && r[1] < q[3] + 1 && r[3] > q[1] - 1){ hit = true; break; } }
    if (hit && L.kind !== 'sea'){ hide(L); continue; }
    if (L.kind !== 'sea') placed.push(r);
    L.el.style.transform = 'translate(' + Math.round(r[0]) + 'px,' + Math.round(r[1]) + 'px)';
    if (L.off){ L.el.classList.remove('off'); L.off = false; }
  }
  function hide(L){ if (!L.off){ L.el.classList.add('off'); L.off = true; } }
}

/* ---------- 漁港 ---------- */
function nearestCoast(x, z){
  var best = null;
  ISL.forEach(function(I){
    var poly = I.poly;
    for (var i = 0, n = poly.length, j = n - 1; i < n; j = i++){
      var a = poly[j], b = poly[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
      var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
      var px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = {d:d, x:px, z:pz, I:I, nx:-dz / Math.sqrt(l), nz:dx / Math.sqrt(l)};
    }
  });
  // 法線朝向海面
  if (inPoly(best.x + best.nx * .05, best.z + best.nz * .05, best.I.poly)){ best.nx = -best.nx; best.nz = -best.nz; }
  return best;
}
function buildPorts(){
  FA.PORTS.forEach(function(p){
    var q = P(p.at[0], p.at[1]), c = nearestCoast(q[0], q[1]);
    var x = c.x - c.nx * .1, z = c.z - c.nz * .1, y = landY(x, z);
    // 找比較開闊的出海方向：沿法線附近幾個角度挑離岸距離成長最快的
    var bestA = Math.atan2(c.nz, c.nx), bestV = -1;
    for (var da = -1.2; da <= 1.21; da += .2){
      var a = Math.atan2(c.nz, c.nx) + da, v = field(c.x + Math.cos(a) * 1.6, c.z + Math.sin(a) * 1.6) - Math.abs(da) * .25;
      if (v > bestV){ bestV = v; bestA = a; }
    }
    var lh = lighthouse(); lh.position.set(x, y, z); lh.scale.setScalar(.62);
    lh.traverse(function(o){ if (o.isMesh) o.userData.portId = p.id; });
    scene.add(lh);
    lh.children.forEach(function(o){ if (o.isMesh && o.material !== lineStatic) pickables.push(o); });
    var el = document.createElement('button'); el.type = 'button'; el.className = 'plab'; el.textContent = p.name; el.dataset.port = p.id;
    el.addEventListener('click', function(e){ e.stopPropagation(); if (S.onPickPort) S.onPickPort(p.id); });
    var P3 = {id:p.id, x:x, y:y, z:z, cx:c.x, cz:c.z, ox:Math.cos(bestA), oz:Math.sin(bestA), lh:lh};
    P3.label = addLabel(el, new T.Vector3(x, y + .7, z), 3, 'port');
    PORT3[p.id] = P3;
  });
}
S.port3 = function(id){ return PORT3[id]; };

/* ---------- 魚群 ---------- */
function placeAnchors(P3, zone, n, scale, taken){
  var near = zone === 'near', lo = near ? .45 * scale : NEAR + .8, hi = near ? NEAR - .3 : NEAR + 5.8, R = near ? 3.4 * scale : 9;
  var sep = (near ? .8 : 1.7) * scale, cands = [], step = near ? .25 : .45;
  for (var dz = -R; dz <= R; dz += step) for (var dx = -R; dx <= R; dx += step){
    var x = P3.cx + dx, z = P3.cz + dz, r = Math.hypot(dx, dz);
    if (r > R) continue;
    var d = field(x, z);
    if (d < lo || d > hi) continue;
    var dot = (dx * P3.ox + dz * P3.oz) / (r || 1);
    cands.push({x:x, z:z, s:r + (1 - dot) * (near ? 1.2 : 3)});
  }
  cands.sort(function(a, b){ return a.s - b.s; });
  var out = [];
  for (var pass = 0; pass < 3 && out.length < n; pass++){
    var sp = sep * [1, .72, .5][pass];
    for (var i = 0; i < cands.length && out.length < n; i++){
      var c = cands[i], ok = true;
      for (var k = 0; k < out.length && ok; k++) if (Math.hypot(out[k].x - c.x, out[k].z - c.z) < sp) ok = false;
      for (k = 0; k < taken.length && ok; k++) if (Math.hypot(taken[k].x - c.x, taken[k].z - c.z) < sp) ok = false;
      if (ok) out.push(c);
    }
  }
  while (out.length < n) out.push({x:P3.cx + P3.ox * (near ? 1 : NEAR + 2) + out.length * .3, z:P3.cz + P3.oz * (near ? 1 : NEAR + 2)});
  return out;
}
function clearSchools(){
  schools.forEach(function(s){
    s.fishes.forEach(function(F){ scene.remove(F.grp); var i = pickables.indexOf(F.body); if (i >= 0) pickables.splice(i, 1); });
    scene.remove(s.ring); removeLabel(s.label);
  });
  schools = [];
}
var RING_G, RING_M;
S.showCatch = function(groups, opts){
  if (!S.ready) return;
  opts = opts || {};
  clearSchools();
  var scale = opts.overview ? 1.9 : 1, taken = [];
  groups.forEach(function(G){
    var P3 = PORT3[G.portId]; if (!P3 || !G.list.length) return;
    var anchors = placeAnchors(P3, G.zone, G.list.length, scale, taken);
    G.list.forEach(function(item, idx){
      var f = item.f, a = anchors[idx]; taken.push(a);
      var crabLike = f.body === 'crab' || f.body === 'octopus' || f.body === 'lobster' || f.mud;
      var n = Math.min(f.school, opts.overview ? 3 : (f.body === 'tiny' || f.id === 'sakura' ? 12 : 7));
      var sc = .42 * f.size * scale, s = {f:f, x:a.x, z:a.z, r:(.28 + .1 * Math.min(n, 6) / 6) * scale * (G.zone === 'far' ? 1.3 : 1), fishes:[], born:clock.elapsedTime, hot:item.hot,
        w:(hash(idx * 3.1 + a.x) > .5 ? 1 : -1) * (.35 + hash(a.z * 1.7) * .25) * (crabLike ? .35 : 1), th:hash(idx + a.x) * 6.28, nextJump:clock.elapsedTime + 1 + hash(idx * 9.7) * 4,
        depth:crabLike ? -.16 : f.body === 'tiny' || f.id === 'sakura' ? -.05 : -.035, crab:f.body === 'crab', canJump:!crabLike && f.body !== 'tiny' && f.id !== 'sakura' && f.id !== 'filefish'};
      for (var i = 0; i < n; i++){
        var M = makeFish(f);
        M.grp.scale.setScalar(0.001);
        scene.add(M.grp); pickables.push(M.body);
        s.fishes.push({grp:M.grp, body:M.body, sc:sc * (.85 + hash(i * 4.3 + idx) * .3), off:i * (6.28 / Math.max(n, 3)) * .32 + hash(i) * .2, rr:.55 + hash(i * 2.7 + idx) * .6, bob:hash(i * 5.1) * 6.28, jump:null});
      }
      if (!RING_G){ RING_G = new T.RingGeometry(.86, 1, 48); RING_M = new T.MeshBasicMaterial({color:'#ffffff', transparent:true, opacity:.75, depthWrite:false}); }
      s.ring = new T.Mesh(RING_G, RING_M); s.ring.rotation.x = -Math.PI / 2; s.ring.position.set(a.x, .02, a.z); s.ring.scale.setScalar(s.r + .35 * scale); s.ring.visible = false; s.ring.renderOrder = 3;
      scene.add(s.ring);
      var el = document.createElement('button'); el.type = 'button'; el.className = 'slab';
      el.innerHTML = '<i style="background:' + f.col[0] + '"></i>' + f.name + (item.hot ? '<b>★</b>' : '');
      el.dataset.fish = f.id;
      el.addEventListener('click', function(e){ e.stopPropagation(); if (S.onPickFish) S.onPickFish(f.id); });
      el.addEventListener('mouseenter', function(){ if (S.onHoverFish) S.onHoverFish(f.id); });
      el.addEventListener('mouseleave', function(){ if (S.onHoverFish) S.onHoverFish(null); });
      s.label = addLabel(el, new T.Vector3(a.x, .55 * scale, a.z), 6 + (item.hot ? 1 : 0), 'fish');
      schools.push(s);
    });
  });
  S.highlight(hlId);
};
function updateSchools(t, dt){
  schools.forEach(function(s){
    var grow = Math.min(1, (t - s.born) / .7), on = hlId === s.f.id, pulse = on ? 1.22 + Math.sin(t * 6) * .06 : 1;
    s.th += s.w * dt * (reduce ? .3 : 1);
    if (s.canJump && !reduce && t > s.nextJump){
      var F = s.fishes[(Math.random() * s.fishes.length) | 0];
      if (F && !F.jump){ F.jump = {t0:t, dur:s.f.body === 'flyer' ? 2.2 : 1.1}; splash(F.grp.position.x, F.grp.position.z, F.sc); }
      s.nextJump = t + 2.5 + Math.random() * 5;
    }
    s.fishes.forEach(function(F, i){
      var th = s.th + F.off, rr = s.r * F.rr, x = s.x + Math.cos(th) * rr, z = s.z + Math.sin(th) * rr;
      var vx = -Math.sin(th) * s.w, vz = Math.cos(th) * s.w, yaw = Math.atan2(-vz, vx), y = s.depth + Math.sin(t * 2 + F.bob) * .012, pitch = 0;
      if (s.crab) yaw += Math.PI / 2;
      if (F.jump){
        var k = (t - F.jump.t0) / F.jump.dur;
        if (k >= 1){ splash(x, z, F.sc); F.jump = null; }
        else {
          var hgt = s.f.body === 'flyer' ? Math.min(1, Math.sin(Math.PI * k) * 2.2) * .45 : Math.sin(Math.PI * k) * .55;
          y = s.depth + hgt * Math.max(.6, F.sc * 2.2);
          pitch = s.f.body === 'flyer' ? Math.cos(Math.PI * k) * .25 : Math.cos(Math.PI * k) * .9;
        }
      }
      F.grp.position.set(x, y, z);
      F.grp.rotation.y = yaw; F.grp.rotation.z = pitch;
      F.grp.scale.setScalar(F.sc * ease(grow) * pulse);
    });
    s.ring.visible = on;
    if (on) s.ring.scale.setScalar(s.r + .3 + Math.sin(t * 4) * .05);
    s.label.boost = on ? 3 : 0;
    s.label.el.classList.toggle('on', on);
  });
}
var SPL_G, SPL_M;
function splash(x, z, sc){
  if (!SPL_G){ SPL_G = new T.RingGeometry(.7, 1, 32); }
  var m = new T.MeshBasicMaterial({color:'#ffffff', transparent:true, opacity:.9, depthWrite:false});
  var r = new T.Mesh(SPL_G, m); r.rotation.x = -Math.PI / 2; r.position.set(x, .015, z); r.renderOrder = 4;
  r.userData = {t0:clock.elapsedTime, s:Math.max(.12, sc * .8)};
  scene.add(r); splashes.push(r);
}
function updateSplashes(t){
  for (var i = splashes.length - 1; i >= 0; i--){
    var r = splashes[i], k = (t - r.userData.t0) / .9;
    if (k >= 1){ scene.remove(r); r.material.dispose(); splashes.splice(i, 1); continue; }
    r.scale.setScalar(r.userData.s * (.3 + k * 1.6)); r.material.opacity = .9 * (1 - k);
  }
}

S.highlight = function(id){
  hlId = id || null;
  document.querySelectorAll('.slab').forEach(function(el){ el.classList.toggle('on', el.dataset.fish === hlId); });
};
S.setZone = function(z){ zoneTarget = z === 'far' ? 1 : 0; };
S.selectPort = function(id){
  selPort = id || null;
  Object.keys(PORT3).forEach(function(k){
    var P3 = PORT3[k], on = k === selPort;
    P3.lh.scale.setScalar(on ? 1 : .62);
    P3.label.force = on; P3.label.pri = on ? 9 : 3;
    P3.label.el.classList.toggle('on', on);
  });
};

/* ---------- 鏡頭 ---------- */
S.flyTo = function(x, z, dist, polar, dur){
  var off = camera.position.clone().sub(controls.target), sph = new T.Spherical().setFromVector3(off);
  var to = new T.Spherical(dist, polar === undefined ? .9 : polar, sph.theta);
  var endT = new T.Vector3(x, 0, z), endP = new T.Vector3().setFromSpherical(to).add(endT);
  fly = {t0:clock.elapsedTime, dur:reduce ? .01 : (dur || 1.3), fromT:controls.target.clone(), toT:endT, fromP:camera.position.clone(), toP:endP};
};
S.overview = function(){
  var a = host.clientWidth / Math.max(1, host.clientHeight);
  S.flyTo(-8, 1, a < .8 ? 100 : a < 1.2 ? 84 : 72, .6);
};
S.focusPort = function(id, zone){
  var P3 = PORT3[id]; if (!P3) return;
  var far = zone === 'far', a = host.clientWidth / Math.max(1, host.clientHeight), k = a < .8 ? 1.45 : 1;
  S.flyTo(P3.cx + P3.ox * (far ? 3.6 : 1.1), P3.cz + P3.oz * (far ? 3.6 : 1.1), (far ? 17 : 11) * k, .86);
};
S.focusRegion = function(portIds){
  var xs = [], zs = [];
  portIds.forEach(function(id){ var P3 = PORT3[id]; if (P3){ xs.push(P3.cx); zs.push(P3.cz); } });
  if (!xs.length) return;
  var mx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, mz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
  var span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, zs) - Math.min.apply(null, zs));
  var a = host.clientWidth / Math.max(1, host.clientHeight);
  S.flyTo(mx, mz, Math.max(14, span * 2.2 + 10) * (a < .8 ? 1.4 : 1), .85);
};

/* ---------- 互動 ---------- */
function pick(ev){
  var r = renderer.domElement.getBoundingClientRect();
  ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  var hit = raycaster.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData : null;
}
function bindPointer(){
  var el = renderer.domElement, down = null, hoverQ = null, pending = false;
  el.addEventListener('pointerdown', function(e){ down = {x:e.clientX, y:e.clientY}; });
  el.addEventListener('pointerup', function(e){
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    down = null;
    var u = pick(e);
    if (u && u.fishId && S.onPickFish) S.onPickFish(u.fishId);
    else if (u && u.portId && S.onPickPort) S.onPickPort(u.portId);
  });
  el.addEventListener('pointermove', function(e){
    if (e.pointerType !== 'mouse') return;
    hoverQ = e;
    if (pending) return;
    pending = true;
    requestAnimationFrame(function(){
      pending = false;
      var u = pick(hoverQ);
      el.style.cursor = u ? 'pointer' : '';
      var id = u && u.fishId || null;
      if (id !== hoverId){ hoverId = id; if (S.onHoverFish) S.onHoverFish(id); }
    });
  });
}

/* ---------- 迴圈 ---------- */
function resize(){
  var w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h);
  // 右側清單（手機為底部抽屜）會蓋住畫面，把投影中心往空白處挪
  if (w > 760) camera.setViewOffset(w, h, Math.min(190, w * .13), 0, w, h);
  else camera.setViewOffset(w, h, 0, h * .2, w, h);
  camera.updateProjectionMatrix();
  labels.forEach(function(L){ L.w = 0; });
}
function loop(){
  requestAnimationFrame(loop);
  var dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  U.time.value = t;
  zoneMix += (zoneTarget - zoneMix) * Math.min(1, dt * 5); seaMat.uniforms.uMode.value = zoneMix;
  if (fly){
    var k = Math.min(1, (t - fly.t0) / fly.dur), e = ease(k);
    controls.target.lerpVectors(fly.fromT, fly.toT, e); camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (k >= 1) fly = null;
  }
  controls.update();
  updateSchools(t, dt); updateSplashes(t);
  boats.forEach(function(B){
    B.th += B.w * dt * (reduce ? .3 : 1);
    var x = B.cx + Math.cos(B.th) * B.r, z = B.cz + Math.sin(B.th) * B.r;
    B.g.position.set(x, Math.sin(t * 1.6 + B.ph) * .015, z);
    B.g.rotation.y = Math.atan2(-Math.cos(B.th) * B.w, -Math.sin(B.th) * B.w);
    B.g.rotation.z = Math.sin(t * 1.3 + B.ph) * .05;
  });
  gulls.forEach(function(G){
    G.th += G.w * dt;
    G.g.position.set(G.cx + Math.cos(G.th) * G.r, G.y + Math.sin(t + G.ph) * .1, G.cz + Math.sin(G.th) * G.r);
    G.g.rotation.y = Math.atan2(-Math.cos(G.th) * G.w, -Math.sin(G.th) * G.w);
    var fl = reduce ? .2 : Math.sin(t * 7 + G.ph) * .5;
    G.g.userData.wl.rotation.x = fl; G.g.userData.wr.rotation.x = -fl;
  });
  clouds.forEach(function(C){ C.g.position.x += dt * C.v; if (C.g.position.x > EXT.x1 + 14) C.g.position.x = EXT.x0 - 14; });
  Object.keys(PORT3).forEach(function(id){
    var P3 = PORT3[id], lamp = P3.lh.userData.lamp, on = id === selPort;
    lamp.scale.setScalar(on ? 1.2 + Math.sin(t * 5) * .25 : 1 + Math.sin(t * 2 + P3.x) * .1);
  });
  renderer.render(scene, camera);
  layoutLabels();
}

/* ---------- 單隻預覽（圖鑑彈窗） ---------- */
var PV = null;
S.preview = function(canvas, fishId){
  if (!S.ready) return {stop:function(){}};
  var f = FA.fishById[fishId]; if (!f) return {stop:function(){}};
  if (!PV){
    PV = {r:new T.WebGLRenderer({canvas:canvas, antialias:true, alpha:true}), s:new T.Scene(), c:new T.PerspectiveCamera(32, 1, .01, 50), canvas:canvas};
    PV.s.add(new T.HemisphereLight('#ffffff', '#9ad7e8', 2.2));
    var d = new T.DirectionalLight('#ffffff', 2); d.position.set(2, 3, 2); PV.s.add(d);
    PV.r.setPixelRatio(Math.min(devicePixelRatio, 2));
  } else if (PV.canvas !== canvas){ PV.r.dispose(); PV = null; return S.preview(canvas, fishId); }
  if (PV.obj) PV.s.remove(PV.obj);
  var M = makeFish(f), g = fishGeo(f), r = g.boundingSphere.radius, cx = g.boundingSphere.center;
  M.grp.position.set(-cx.x, -cx.y, -cx.z);
  var holder = new T.Group(); holder.add(M.grp); PV.s.add(holder); PV.obj = holder;
  var w = canvas.clientWidth || 280, h = canvas.clientHeight || 200;
  PV.r.setSize(w, h, false); PV.c.aspect = w / h; PV.c.updateProjectionMatrix();
  var dist = r / Math.sin(16 * Math.PI / 180) * (w / h < 1.3 ? 1.15 : .95);
  PV.c.position.set(0, r * .5, dist); PV.c.lookAt(0, 0, 0);
  var run = true, t0 = performance.now();
  (function tick(){
    if (!run) return;
    requestAnimationFrame(tick);
    var t = (performance.now() - t0) / 1000;
    holder.rotation.y = reduce ? -.35 : Math.sin(t * .6) * .55 - .35;
    holder.rotation.x = .15;
    PV.r.render(PV.s, PV.c);
  })();
  return {stop:function(){ run = false; }};
};

/* ---------- 啟動 ---------- */
S.init = function(opts){
  host = opts.host; labelRoot = opts.labels;
  return Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]).then(function(mods){
    T = mods[0]; Orbit = mods[1].OrbitControls; tmpV = new T.Vector3();
    clock = new T.Clock();
    LANDC = {under:col('#9fd8c4'), sand:col('#f4e3a8'), plain:col('#a9e07a'), grass:col('#78c95c'), forest:col('#4aa557'), deep:col('#3a8a53'), rock:col('#8f9c88'), snow:col('#f6f8fb')};
    renderer = new T.WebGLRenderer({antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(42, 1, .1, 600);
    camera.position.set(-5.5, 44, 34);
    controls = new Orbit(camera, renderer.domElement);
    controls.target.set(-5.5, 0, -3);
    controls.enableDamping = true; controls.dampingFactor = .08;
    controls.maxPolarAngle = 1.28; controls.minDistance = 2.5; controls.maxDistance = 110;
    controls.screenSpacePanning = false; controls.zoomSpeed = .9;
    controls.addEventListener('start', function(){ fly = null; });
    raycaster = new T.Raycaster(); ndc = new T.Vector2();
    toonGrad = new T.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, T.RedFormat);
    toonGrad.minFilter = toonGrad.magFilter = T.NearestFilter; toonGrad.needsUpdate = true;
    lineStatic = patchWave(new T.MeshBasicMaterial({color:INK, side:T.BackSide}), WAVE.crab, .02);
    scene.add(new T.HemisphereLight('#e8f8ff', '#8fcf8a', 1.5));
    var sun = new T.DirectionalLight('#fff6e0', 2.4); sun.position.set(-20, 40, 18); scene.add(sun);
    scene.add(new T.AmbientLight('#ffffff', .35));

    buildPolys(); prepRidges();
    var tex = buildField();
    buildSea(tex);
    ISL.forEach(buildLand);
    buildPorts();

    // 地名、山、海域名
    ISL.forEach(function(I){
      if (!I.name) return;
      var el = document.createElement('div'); el.className = I.main ? 'ilab main' : 'ilab'; el.textContent = I.name;
      var at = I.main ? new T.Vector3(1.5, 2.6, -2) : new T.Vector3(I.c[0], .5, I.c[1] - .2);
      addLabel(el, at, I.main ? 5 : 4, 'isle');
    });
    FA.PEAKS.forEach(function(pk){
      var q = P(pk.at[0], pk.at[1]), el = document.createElement('div'); el.className = 'pk';
      el.textContent = '▲ ' + pk.name + ' ' + pk.m.toLocaleString() + 'm';
      addLabel(el, new T.Vector3(q[0], landY(q[0], q[1]) + .25, q[1]), 1, 'peak');
    });
    [['台灣海峽', 119.6, 24.25], ['太平洋', 122.6, 23.3], ['巴士海峽', 120.6, 21.3], ['台灣海峽北口', 120.3, 25.7], ['南海', 118.6, 22.2]].forEach(function(s){
      var q = P(s[1], s[2]), el = document.createElement('div'); el.className = 'sealab'; el.textContent = s[0];
      addLabel(el, new T.Vector3(q[0], .1, q[1]), 0, 'sea');
    });

    // 小船、海鷗、雲
    FA.PORTS.forEach(function(p, i){
      var P3 = PORT3[p.id], b = boat(i);
      b.scale.setScalar(.7); scene.add(b);
      boats.push({g:b, cx:P3.cx + P3.ox * 1.1, cz:P3.cz + P3.oz * 1.1, r:.45 + hash(i) * .5, th:hash(i * 3) * 6.28, w:(hash(i * 7) > .5 ? 1 : -1) * (.12 + hash(i * 11) * .1), ph:i});
    });
    for (var i = 0; i < 12; i++){
      var P3 = PORT3[FA.PORTS[(i * 5) % FA.PORTS.length].id], gl = gull(); gl.scale.setScalar(.8); scene.add(gl);
      gulls.push({g:gl, cx:P3.cx + P3.ox, cz:P3.cz + P3.oz, r:.8 + hash(i) * .8, y:1.7 + hash(i * 2) * .9, th:hash(i * 5) * 6.28, w:(hash(i * 9) > .5 ? 1 : -1) * (.5 + hash(i * 13) * .4), ph:i * 1.7});
    }
    for (i = 0; i < 7; i++){
      var c = cloud(i + 1); c.position.set(EXT.x0 + hash(i * 3.3) * (EXT.x1 - EXT.x0 + 20), 13 + hash(i * 1.9) * 3, EXT.z0 + hash(i * 4.7) * (EXT.z1 - EXT.z0));
      c.scale.setScalar(.6 + hash(i * 2.2) * .5); scene.add(c); clouds.push({g:c, v:.25 + hash(i) * .3});
    }

    bindPointer();
    window.addEventListener('resize', resize); resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    S.ready = true;
    S.overview(); fly.dur = .01;
    loop();
  });
};
S.stats = function(){
  return {schools:schools.length, fish:schools.reduce(function(a, s){ return a + s.fishes.length; }, 0), labels:labels.length,
    visibleLabels:labels.filter(function(L){ return !L.off; }).length, ports:Object.keys(PORT3).length, islands:ISL.length};
};
})();
