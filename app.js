/* ================= 台灣漁港魚汛圖鑑：介面 ================= */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var PREF_KEY = 'fishAtlasPrefs';
var REP = {N:'keelung', NE:'nanfangao', E:'chenggong', S:'donggang', SW:'anping', W:'wuqi', PH:'magong', KM:'liaoluo', EI:'lanyu'};
var SEASON = {12:'冬', 1:'冬', 2:'冬', 3:'春', 4:'春', 5:'春', 6:'夏', 7:'夏', 8:'夏', 9:'秋', 10:'秋', 11:'秋'};
var SKY = {春:['#a8e2ff', '#e8f8ff'], 夏:['#73cbff', '#d6f2ff'], 秋:['#ffd2a8', '#e3f2ff'], 冬:['#aebfe3', '#e2ebf7']};
var BODY = {spindle:'紡錘形', tuna:'鮪類', deep:'側扁形', stocky:'粗壯形', long:'帶狀', bill:'旗魚類', mahi:'高額頭', flyer:'大胸鰭', tiny:'仔稚魚',
  squid:'頭足類', bigfin:'頭足類', cuttle:'頭足類', octopus:'頭足類', shrimp:'蝦類', lobster:'龍蝦', crab:'蟹類'};
var NOW = new Date().getMonth() + 1;

function lsGet(k, d){ try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e){} }
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }

var pref = lsGet(PREF_KEY, {});
var st = {month:NOW, zone:pref.zone === 'far' ? 'far' : 'near', region:FA.regionById[pref.region] ? pref.region : 'all', port:FA.portById[pref.port] ? pref.port : null, hl:null};
if (st.port) st.region = FA.portById[st.port].r;
function save(){ lsSet(PREF_KEY, {zone:st.zone, region:st.region, port:st.port}); }

/* ---------- 小魚插圖（清單卡片、預覽備援） ---------- */
function fishSvg(f, anim){
  var a = f.col[0], b = f.col[1], c = f.col[2], k = '#2f2638', body = f.body, inner;
  if (body === 'crab') inner = '<g><path d="M14 22c-6-2-8-8-5-11M70 22c6-2 8-8 5-11" fill="none" stroke="' + k + '" stroke-width="2.5"/><circle cx="9" cy="10" r="4" fill="' + a + '" stroke="' + k + '" stroke-width="2"/><circle cx="75" cy="10" r="4" fill="' + a + '" stroke="' + k + '" stroke-width="2"/>' +
    '<path d="M20 30l-8 8M26 32l-6 9M58 30l8 8M64 32l6 9" stroke="' + k + '" stroke-width="2.5"/><ellipse cx="42" cy="26" rx="26" ry="13" fill="' + a + '" stroke="' + k + '" stroke-width="2.5"/>' +
    (f.id === 'redcrab' ? '<circle cx="42" cy="24" r="3" fill="' + c + '"/><circle cx="32" cy="22" r="3" fill="' + c + '"/><circle cx="52" cy="22" r="3" fill="' + c + '"/>' : '<path d="M24 24h36M42 15v20" stroke="' + c + '" stroke-width="3"/>') +
    '<circle cx="37" cy="15" r="2" fill="' + k + '"/><circle cx="47" cy="15" r="2" fill="' + k + '"/></g>';
  else if (body === 'shrimp' || body === 'lobster') inner = '<g><path d="M70 14c10-6 12-10 14-12M70 16c8 0 12 2 14 0" fill="none" stroke="' + k + '" stroke-width="1.6"/><path class="tail" d="M14 30l-10-4 2 10z" fill="' + a + '" stroke="' + k + '" stroke-width="2"/>' +
    '<path d="M14 30c4-12 22-18 40-16 10 1 16 4 18 6-4 6-14 10-26 10-10 0-20 4-32 0z" fill="' + a + '" stroke="' + k + '" stroke-width="2.5"/><path d="M28 22v10M38 18v12M48 17v12" stroke="' + c + '" stroke-width="2"/><circle cx="64" cy="17" r="2.4" fill="' + k + '"/></g>';
  else if (body === 'octopus') inner = '<g><path class="tail" d="M30 26c-8 4-14 10-24 8M34 30c-4 6-8 10-16 12M40 30c0 6-2 10-6 14M46 28c4 6 8 8 14 8" fill="none" stroke="' + a + '" stroke-width="5" stroke-linecap="round"/>' +
    '<ellipse cx="54" cy="18" rx="18" ry="14" fill="' + a + '" stroke="' + k + '" stroke-width="2.5"/><circle cx="46" cy="22" r="3" fill="#fff" stroke="' + k + '" stroke-width="1.5"/><circle cx="46" cy="22" r="1.4" fill="' + k + '"/></g>';
  else if (body === 'squid' || body === 'bigfin' || body === 'cuttle'){
    var wide = body !== 'squid';
    inner = '<g><path class="tail" d="M24 22c-8-3-14-2-20 0M24 25c-8 0-14 3-20 6M24 28c-6 3-10 6-14 10" fill="none" stroke="' + a + '" stroke-width="3.5" stroke-linecap="round"/>' +
      (wide ? '<ellipse cx="50" cy="25" rx="28" ry="15" fill="' + b + '" stroke="' + k + '" stroke-width="2"/>' : '<path d="M66 25l16-10-6 10 6 10z" fill="' + b + '" stroke="' + k + '" stroke-width="2"/>') +
      '<path d="M24 25c0-7 10-' + (wide ? 11 : 8) + ' 26-' + (wide ? 11 : 8) + 's' + (wide ? '26 4 26 11' : '24 4 30 8') + '-' + (wide ? '10 11-26 11' : '14 8-30 8') + 'S24 32 24 25z" fill="' + a + '" stroke="' + k + '" stroke-width="2.5"/>' +
      '<circle cx="30" cy="23" r="3.4" fill="#fff" stroke="' + k + '" stroke-width="1.5"/><circle cx="30" cy="23" r="1.6" fill="' + k + '"/></g>';
  } else {
    var h = body === 'deep' ? 17 : body === 'stocky' ? 14 : body === 'long' ? 5 : body === 'tuna' ? 12 : body === 'tiny' ? 6 : 10;
    var x0 = body === 'long' ? 4 : 18, x1 = 70;
    inner = '<g>' + (body === 'long' ? '' : '<path class="tail" d="M' + (x0 + 2) + ' 25L' + (x0 - 12) + ' ' + (25 - h * .8) + 'L' + (x0 - 7) + ' 25L' + (x0 - 12) + ' ' + (25 + h * .8) + 'z" fill="' + (body === 'tuna' || body === 'mahi' ? c : a) + '" stroke="' + k + '" stroke-width="2.2" stroke-linejoin="round"/>') +
      (body === 'bill' ? '<path d="M70 24l14-1-14 3z" fill="' + a + '" stroke="' + k + '" stroke-width="1.5"/><path d="M36 16c4-12 14-14 22-6z" fill="' + c + '" stroke="' + k + '" stroke-width="2"/>' : '') +
      (body === 'mahi' ? '<path d="M30 16c10-6 26-8 36-2z" fill="' + c + '" stroke="' + k + '" stroke-width="2"/>' : '') +
      (body === 'flyer' ? '<path d="M44 26l-16 14 26-10z" fill="' + c + '" stroke="' + k + '" stroke-width="2"/>' : '') +
      '<path d="M' + x0 + ' 25C' + (x0 + 10) + ' ' + (25 - h) + ' ' + (x1 - 16) + ' ' + (25 - h * 1.1) + ' ' + x1 + ' 25C' + (x1 - 16) + ' ' + (25 + h * 1.1) + ' ' + (x0 + 10) + ' ' + (25 + h) + ' ' + x0 + ' 25z" fill="' + b + '" stroke="' + k + '" stroke-width="2.5"/>' +
      '<path d="M' + (x0 + 2) + ' 24C' + (x0 + 10) + ' ' + (25 - h) + ' ' + (x1 - 16) + ' ' + (25 - h * 1.1) + ' ' + (x1 - 1) + ' 24z" fill="' + a + '"/>' +
      (f.pat === 'spots' ? '<circle cx="40" cy="22" r="2" fill="' + c + '"/><circle cx="50" cy="27" r="2" fill="' + c + '"/><circle cx="32" cy="27" r="2" fill="' + c + '"/>' : '') +
      (f.pat === 'wave' || f.pat === 'bars' ? '<path d="M34 19c2 2 2 4 0 6M42 18c2 2 2 4 0 6M50 18c2 2 2 4 0 6" fill="none" stroke="' + c + '" stroke-width="2"/>' : '') +
      '<circle cx="' + (x1 - 9) + '" cy="23" r="' + (body === 'long' ? 2.2 : 3.4) + '" fill="#fff" stroke="' + k + '" stroke-width="1.5"/><circle cx="' + (x1 - 8.4) + '" cy="23" r="' + (body === 'long' ? 1 : 1.7) + '" fill="' + k + '"/></g>';
  }
  return '<svg viewBox="0 0 88 50" aria-hidden="true"><g' + (anim ? ' class="swim"' : '') + '>' + inner + '</g></svg>';
}
FA.fishSvg = fishSvg;

/* ---------- 選擇器 ---------- */
function fillSelectors(){
  var r = $('selRegion');
  r.innerHTML = '<option value="all">全台灣（各區代表）</option>' + FA.REGIONS.map(function(x){ return '<option value="' + x.id + '">' + x.name + '｜' + x.sub + '</option>'; }).join('');
  r.value = st.region;
  var ports = FA.PORTS.filter(function(p){ return st.region === 'all' || p.r === st.region; });
  $('selPort').innerHTML = '<option value="">' + (st.region === 'all' ? '選一個漁港…' : '整個' + FA.regionById[st.region].name) + '</option>' +
    ports.map(function(p){ return '<option value="' + p.id + '">' + p.name + '（' + p.city.replace(/(市|縣).*/, '$1') + '）</option>'; }).join('');
  $('selPort').value = st.port || '';
}
function buildMonths(){
  var h = '';
  for (var m = 1; m <= 12; m++) h += '<button class="mbtn' + (m === NOW ? ' now' : '') + '" data-m="' + m + '" type="button" role="tab">' + m + '月<small>' + SEASON[m] + '</small></button>';
  $('months').innerHTML = h;
  var SC = {春:'#a8e6a1', 夏:'#ffd166', 秋:'#ff9f6e', 冬:'#9ec5ff'}, line = '';
  for (m = 1; m <= 12; m++) line += '<span style="background:' + SC[SEASON[m]] + '" title="' + SEASON[m] + '季"></span>';
  $('axLine').innerHTML = line;
}
/* 月份軸線：每月近海／遠海可捕種數 */
function countAt(zone, m){
  if (st.port) return FA.catchFor(FA.portById[st.port].r, zone, m).length;
  if (st.region !== 'all') return FA.catchFor(st.region, zone, m).length;
  return FA.FISH.filter(function(f){ return FA.REGIONS.some(function(r){ return FA.catchFor(r.id, zone, m).indexOf(f) >= 0; }); }).length;
}
function renderAxis(){
  var n = [], f = [], max = 1, m;
  for (m = 1; m <= 12; m++){ n[m] = countAt('near', m); f[m] = countAt('far', m); max = Math.max(max, n[m], f[m]); }
  var h = '';
  for (m = 1; m <= 12; m++){
    var cur = st.zone === 'near' ? n[m] : f[m];
    h += '<div class="axc' + (m === st.month ? ' on' : '') + '" title="' + m + ' 月：近海 ' + n[m] + ' 種、遠海 ' + f[m] + ' 種"><b>' + cur + '</b>' +
      '<i class="n' + (st.zone === 'near' ? '' : ' dim') + '" style="height:' + Math.round(n[m] / max * 30 + 2) + 'px"></i>' +
      '<i class="f' + (st.zone === 'far' ? '' : ' dim') + '" style="height:' + Math.round(f[m] / max * 30 + 2) + 'px"></i></div>';
  }
  $('axBars').innerHTML = h;
  $('mRange').value = st.month;
  $('mRange').setAttribute('aria-valuetext', st.month + ' 月');
}

/* ---------- 目前清單 ---------- */
function listNow(){
  var m = st.month, z = st.zone;
  if (st.port){
    var p = FA.portById[st.port];
    return FA.catchFor(p.r, z, m).map(function(f){ return {f:f, hot:f.hot.indexOf(p.id) >= 0}; }).sort(byHot);
  }
  if (st.region !== 'all'){
    var reg = st.region, ids = FA.PORTS.filter(function(p){ return p.r === reg; }).map(function(p){ return p.id; });
    return FA.catchFor(reg, z, m).map(function(f){ return {f:f, hot:f.hot.some(function(h){ return ids.indexOf(h) >= 0; })}; }).sort(byHot);
  }
  return FA.FISH.filter(function(f){ return FA.REGIONS.some(function(r){ return FA.catchFor(r.id, z, m).indexOf(f) >= 0; }); })
    .map(function(f){ return {f:f, hot:false, regions:FA.REGIONS.filter(function(r){ return FA.catchFor(r.id, z, m).indexOf(f) >= 0; })}; });
}
function byHot(a, b){ return (b.hot ? 1 : 0) - (a.hot ? 1 : 0); }
function groups3D(){
  var m = st.month, z = st.zone;
  if (st.port) return [{portId:st.port, zone:z, list:listNow().slice(0, 14)}];
  if (st.region !== 'all') return [{portId:REP[st.region], zone:z, list:listNow().slice(0, 12)}];
  var used = {};
  return FA.REGIONS.map(function(r){
    var ids = FA.PORTS.filter(function(p){ return p.r === r.id; }).map(function(p){ return p.id; });
    var l = FA.catchFor(r.id, z, m).map(function(f){ return {f:f, hot:f.hot.some(function(h){ return ids.indexOf(h) >= 0; })}; });
    l.sort(function(a, b){ return byHot(a, b) || ((used[a.f.id] || 0) - (used[b.f.id] || 0)); });
    l = l.slice(0, 3); l.forEach(function(x){ used[x.f.id] = (used[x.f.id] || 0) + 1; });
    return {portId:REP[r.id], zone:z, list:l};
  });
}

/* ---------- 畫面 ---------- */
function render(opts){
  opts = opts || {};
  document.querySelectorAll('.mbtn').forEach(function(b){ var on = +b.dataset.m === st.month; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  var mb = document.querySelector('.mbtn.on'), mc = $('months');
  if (mb && mc.scrollWidth > mc.clientWidth) mc.scrollLeft = mb.offsetLeft - mc.offsetLeft - (mc.clientWidth - mb.offsetWidth) / 2;
  document.querySelectorAll('.zbtn').forEach(function(b){ var on = b.dataset.z === st.zone; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  renderAxis();
  var sky = SKY[SEASON[st.month]], stage = $('stage');
  stage.style.setProperty('--sky1', sky[0]); stage.style.setProperty('--sky2', sky[1]);
  var place = $('place'), Z = FA.ZONES[st.zone];
  if (st.port){
    var p = FA.portById[st.port];
    place.innerHTML = '<h2>' + esc(p.name) + '<small>' + esc(p.city) + '・' + FA.regionById[p.r].name + '</small></h2><p>' + esc(p.note) + '</p>';
  } else if (st.region !== 'all'){
    var r = FA.regionById[st.region];
    place.innerHTML = '<h2>' + r.name + '<small>' + r.sub + '</small></h2><p>本區有 ' + FA.PORTS.filter(function(x){ return x.r === r.id; }).length + ' 個漁港，點地圖上的燈塔或上方選單看單一漁港。</p>';
  } else {
    place.innerHTML = '<h2>全台灣<small>本島＋澎湖、金馬、綠島、蘭嶼、小琉球</small></h2><p>地圖上每區先放幾種代表漁獲。點燈塔或上方選單選漁港，可以看到該港完整清單。</p>';
  }
  var L = listNow();
  $('sum').innerHTML = '<span>' + st.month + ' 月・' + SEASON[st.month] + '季・<span title="' + esc(Z.desc) + '">' + Z.name + '</span></span><b>' + L.length + '</b><span>種漁獲</span>';
  var list = $('list');
  if (!L.length) list.innerHTML = '<div class="empty">這個月份在此' + Z.name + '的主要漁獲較少。<br>換個月份、或切換到' + (st.zone === 'near' ? '遠海' : '近海') + '看看。</div>';
  else list.innerHTML = L.map(function(x){
    var f = x.f, sub = x.regions ? x.regions.map(function(r){ return r.name; }).join('・') : f.alias.split('、').slice(0, 3).join('、');
    return '<button class="fcard' + (st.hl === f.id ? ' on' : '') + '" type="button" data-fish="' + f.id + '"><span class="pic">' + fishSvg(f, true) + '<span class="bubbles"><span style="left:18%;animation-delay:-.6s"></span><span style="left:72%;animation-delay:-1.9s"></span></span></span>' +
      '<b>' + esc(f.show) + (x.hot ? '<em>★名產</em>' : '') + (f.ocean ? '<em style="color:#2a6fc4">遠洋</em>' : '') + '</b><small>' + esc(sub) + '</small></button>';
  }).join('');
  if (window.FishScene && FishScene.ready){
    FishScene.setZone(st.zone);
    FishScene.selectPort(st.port);
    FishScene.showCatch(groups3D(), {overview:!st.port && st.region === 'all'});
    if (opts.fly){
      if (st.port) FishScene.focusPort(st.port, st.zone);
      else if (st.region !== 'all') FishScene.focusRegion(FA.PORTS.filter(function(p){ return p.r === st.region; }).map(function(p){ return p.id; }));
      else FishScene.overview();
    }
  }
  save();
}

/* ---------- 動作 ---------- */
function setMonth(m){ st.month = ((m - 1 + 12) % 12) + 1; render(); }
function setZone(z){ if (z === st.zone) return; st.zone = z; render({fly:!!st.port}); }
function selectPort(id){
  st.port = id || null;
  if (st.port) st.region = FA.portById[st.port].r;
  fillSelectors(); render({fly:true});
}
function selectRegion(r){ st.region = r; st.port = null; fillSelectors(); render({fly:true}); }
function hover(id){
  st.hl = id || null;
  if (window.FishScene && FishScene.ready) FishScene.highlight(st.hl);
  document.querySelectorAll('.fcard').forEach(function(c){ c.classList.toggle('on', c.dataset.fish === st.hl); });
}

/* ---------- 圖鑑彈窗 ---------- */
var pvRun = null, lastFocus = null;
function calRows(f){
  var region = st.port ? FA.portById[st.port].r : st.region !== 'all' ? st.region : null;
  var h = '<div class="cal"><span></span>';
  for (var m = 1; m <= 12; m++) h += '<span class="h' + (m === st.month ? ' cur' : '') + '">' + m + '</span>';
  ['near', 'far'].forEach(function(z){
    var all = FA.monthsOf(f, z), here = region ? FA.monthsOf(f, z, region) : {};
    if (!Object.keys(all).length) return;
    h += '<span class="z">' + FA.ZONES[z].name + '</span>';
    for (var m = 1; m <= 12; m++) h += '<span class="c' + (all[m] ? ' yes ' + z : '') + (here[m] ? ' here' : '') + (m === st.month ? ' cur' : '') + '" title="' + m + ' 月' + (all[m] ? '有漁獲' : '') + '"></span>';
  });
  return h + '</div><div class="calnote">色塊＝全台有漁獲的月份' + (region ? '；白點＝' + FA.regionById[region].name + '也有' : '') + '；紅框＝目前選的月份。</div>';
}
function recipeHtml(r, i, n){
  return '<div class="recipe" data-r="' + i + '"' + (i ? ' hidden' : '') + '><div class="rhead"><b>' + esc(r.name) + '</b><span>⏱ ' + esc(r.time) + '　🍽 ' + esc(r.serve) + '</span></div>' +
    '<div class="rbody"><div><h4>材料</h4><ul>' + r.ing.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
    '<div><h4>步驟</h4><ol>' + r.steps.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>' +
    (r.note ? '<div class="rnote">💡 ' + esc(r.note) + '</div>' : '') + '</div>';
}
function openFish(id){
  var f = FA.fishById[id]; if (!f) return;
  lastFocus = document.activeElement;
  var zones = ['near', 'far'].filter(function(z){ return f.at.some(function(a){ return a.z === z; }); });
  var hotPorts = f.hot.map(function(h){ return FA.portById[h]; }).filter(Boolean);
  $('fishTitle').innerHTML = '<h2 id="fishName">' + esc(f.show) + '</h2><div class="sci">' + esc(f.sci) + '</div><div class="alias">別名：' + esc(f.alias) + '</div>' +
    '<div class="tags">' + zones.map(function(z){ return '<span class="tag ' + z + '">' + FA.ZONES[z].name + '</span>'; }).join('') +
    (f.ocean ? '<span class="tag far">遠洋漁業</span>' : '') + '<span class="tag">' + (BODY[f.body] || '') + '</span>' +
    hotPorts.map(function(p){ return '<span class="tag hot">★ ' + esc(p.name) + '</span>'; }).join('') + '</div>';
  var byRegion = {};
  FA.portsOf(f).forEach(function(p){ (byRegion[p.r] = byRegion[p.r] || []).push(p); });
  var portHtml = FA.REGIONS.filter(function(r){ return byRegion[r.id]; }).map(function(r){
    return '<div style="margin-bottom:6px"><b style="font-size:13px;color:var(--ink2)">' + r.name + '</b> <span class="chips" style="display:inline-flex">' +
      byRegion[r.id].map(function(p){ return '<button type="button" class="chip' + (f.hot.indexOf(p.id) >= 0 ? ' hot' : '') + '" data-goport="' + p.id + '">' + (f.hot.indexOf(p.id) >= 0 ? '★ ' : '') + esc(p.name) + '</button>'; }).join('') + '</span></div>';
  }).join('');
  $('fishBody').innerHTML =
    '<div class="sec"><h3>圖鑑說明</h3><p>' + esc(f.desc) + '</p></div>' +
    '<div class="sec cols"><div><h3>棲息環境</h3><p>' + esc(f.habitat) + '</p></div><div><h3>挑選要訣</h3><p>' + esc(f.tip) + '</p></div></div>' +
    '<div class="sec"><h3>產季月曆</h3>' + calRows(f) + '</div>' +
    '<div class="sec"><h3>可捕撈的漁港</h3>' + portHtml + '</div>' +
    '<div class="sec cook"><h3>推薦烹飪方式</h3><div class="chips">' + f.cook.map(function(c){ return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div></div>' +
    '<div class="sec"><h3>食譜</h3>' + (f.recipes.length > 1 ? '<div class="rtabs">' + f.recipes.map(function(r, i){ return '<button type="button" class="rtab' + (i ? '' : ' on') + '" data-rt="' + i + '">' + esc(r.name) + '</button>'; }).join('') + '</div>' : '') +
    f.recipes.map(function(r, i){ return recipeHtml(r, i, f.recipes.length); }).join('') + '</div>';
  $('fish').classList.add('show');
  $('fish').querySelector('.sheet').scrollTop = 0;
  var fb = $('pvFallback');
  if (pvRun){ pvRun.stop(); pvRun = null; }
  if (window.FishScene && FishScene.ready){ fb.hidden = true; $('pv').hidden = false; requestAnimationFrame(function(){ pvRun = FishScene.preview($('pv'), id); }); }
  else { fb.hidden = false; $('pv').hidden = true; fb.innerHTML = fishSvg(f, true); }
  hover(id);
  $('fish').querySelector('.x').focus();
}
function closeModal(el){
  el.classList.remove('show');
  if (el.id === 'fish' && pvRun){ pvRun.stop(); pvRun = null; hover(null); }
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/* ---------- 事件 ---------- */
function bind(){
  $('months').addEventListener('click', function(e){ var b = e.target.closest('.mbtn'); if (b){ stopPlay(); setMonth(+b.dataset.m); } });
  document.querySelectorAll('.zbtn').forEach(function(b){ b.addEventListener('click', function(){ setZone(b.dataset.z); }); });
  $('mRange').addEventListener('input', function(){ stopPlay(); if (+this.value !== st.month) setMonth(+this.value); });
  $('selRegion').addEventListener('change', function(){ selectRegion(this.value); });
  $('selPort').addEventListener('change', function(){ if (this.value) selectPort(this.value); else selectRegion(st.region); });
  $('list').addEventListener('click', function(e){ var c = e.target.closest('.fcard'); if (c) openFish(c.dataset.fish); });
  $('list').addEventListener('mouseover', function(e){ var c = e.target.closest('.fcard'); if (c && c.dataset.fish !== st.hl) hover(c.dataset.fish); });
  $('list').addEventListener('mouseleave', function(){ hover(null); });
  $('btnAll').addEventListener('click', function(){ st.region = 'all'; st.port = null; fillSelectors(); render({fly:true}); });
  $('btnAbout').addEventListener('click', function(){ lastFocus = document.activeElement; $('about').classList.add('show'); $('about').querySelector('.x').focus(); });
  $('btnPrint').addEventListener('click', function(){ window.print(); });
  $('sheetBtn').addEventListener('click', function(){
    var min = $('panel').classList.toggle('min'); document.body.classList.toggle('sheet-min', min); this.textContent = min ? '展開' : '收合';
  });
  document.querySelectorAll('.modal').forEach(function(m){
    m.addEventListener('click', function(e){ if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  });
  $('fishBody').addEventListener('click', function(e){
    var t = e.target.closest('.rtab');
    if (t){
      $('fishBody').querySelectorAll('.rtab').forEach(function(x){ x.classList.toggle('on', x === t); });
      $('fishBody').querySelectorAll('.recipe').forEach(function(r){ r.hidden = r.dataset.r !== t.dataset.rt; });
      return;
    }
    var g = e.target.closest('[data-goport]');
    if (g){ closeModal($('fish')); selectPort(g.dataset.goport); }
  });
  document.addEventListener('keydown', function(e){
    var open = document.querySelector('.modal.show');
    if (e.key === 'Escape' && open){ closeModal(open); return; }
    if (open || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight'){ stopPlay(); setMonth(st.month + 1); }
    if (e.key === 'ArrowLeft'){ stopPlay(); setMonth(st.month - 1); }
  });
  $('play').addEventListener('click', function(){ if (playT) stopPlay(); else startPlay(); });
}
var playT = 0;
function startPlay(){ $('play').classList.add('on'); $('play').textContent = '❚❚'; playT = setInterval(function(){ setMonth(st.month + 1); }, 2800); }
function stopPlay(){ if (!playT) return; clearInterval(playT); playT = 0; $('play').classList.remove('on'); $('play').textContent = '▶'; }

/* ---------- 啟動 ---------- */
buildMonths(); fillSelectors(); bind(); render();
FishScene.onPickFish = openFish;
FishScene.onPickPort = selectPort;
FishScene.onHoverFish = function(id){ hover(id); };
FishScene.init({host:$('stage'), labels:$('labels')}).then(function(){
  render({fly:true});
  if (st.port || st.region !== 'all'){ /* flyTo 已經在 render 裡處理 */ }
  setTimeout(function(){ $('loading').classList.add('hide'); }, 250);
}).catch(function(err){
  console.error(err);
  $('loadMsg').textContent = '3D 海圖載入失敗（可能是網路無法連到繪圖元件）';
  $('loadSub').textContent = '漁獲清單與圖鑑仍可使用，點畫面任一處繼續。';
  $('loading').addEventListener('click', function(){ $('loading').classList.add('hide'); }, {once:true});
});

window.__fishAtlas = {state:st, setMonth:setMonth, setZone:setZone, selectPort:selectPort, selectRegion:selectRegion, openFish:openFish,
  closeFish:function(){ closeModal($('fish')); }, listNow:listNow, groups3D:groups3D, FA:FA, scene:FishScene};
})();
