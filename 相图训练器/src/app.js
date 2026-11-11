/* ==========================================================
   相图训练器 · 界面与交互
   依赖：core.js（PHASE）、questions.js（QUESTIONS）
   约定：所有相图都在 1000×1000 的「单位空间」里绘制，
         viewBox 只决定「看哪一块」，屏幕尺寸按容器宽高比设置。
   ========================================================== */
(function () {
  'use strict';

  var P = PHASE, F = P.FE_C, NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function fmt(v, n) {
    if (v == null || isNaN(v)) return '—';
    n = n == null ? 1 : n;
    return v.toFixed(n);
  }

  /* ---------------- SVG 基础 ---------------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor) {
    var t = el('text', { x: x, y: y, class: cls || '', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = s;
    return t;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  // 按容器宽度和 viewBox 比例定尺寸；过高时按最大高度收缩宽度，保证整张图完整可见
  function fitSvg(svg) {
    var vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
    var r = vb[2] / vb[3];
    var wrap = svg.parentNode;
    var w = Math.max(240, wrap.clientWidth || 320);
    var h = w / r;
    var maxH = Math.round(window.innerHeight * 0.55);
    if (h > maxH) { h = maxH; w = Math.round(h * r); }
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
    svg.style.margin = '0 auto';
  }
  function fitAll() { $$('.diagram').forEach(fitSvg); }

  // 客户端坐标 -> 单位空间（1000×1000）。用 getScreenCTM 能自动处理留边/缩放。
  function unitPoint(svg, evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var m = svg.getScreenCTM();
    if (!m) return null;
    var loc = pt.matrixTransform(m.inverse());
    var vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number);
    return {
      x: (loc.x - vb[0]) / vb[2] * 1000,
      y: (loc.y - vb[1]) / vb[3] * 1000
    };
  }

  /* ==========================================================
     一、铁碳相图
     ========================================================== */
  var fec = { svg: null, overlay: null, x: 0.45, t: 800, preset: 'all' };

  var PAD = { l: 46, t: 24, w: 916, h: 780 };
  function fecPX(c) { return PAD.l + (c / F.xMax) * PAD.w; }
  function fecPY(t) { return PAD.t + (1 - (t - F.tMin) / (F.tMax - F.tMin)) * PAD.h; }

  function fecBuild() {
    var svg = $('#fecSvg');
    clear(svg);
    fec.svg = svg;
    var g = el('g', {}, svg);

    el('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: '#0d1627' }, g);

    // 网格
    var grid = el('g', {}, g);
    var xTicks = [
      { c: 0, s: '0' }, { c: 0.5, s: '0.5' }, { c: 0.77, s: '0.77' }, { c: 1.0, s: '1.0' },
      { c: 1.5, s: '1.5' }, { c: 2.0, s: '2.0' }, { c: 2.11, s: '2.11' }, { c: 3.0, s: '3.0' },
      { c: 4.0, s: '4.0' }, { c: 4.3, s: '4.3' }, { c: 5.0, s: '5.0' }, { c: 6.0, s: '6.0' }, { c: 6.69, s: '6.69' }
    ];
    xTicks.forEach(function (o) {
      var x = fecPX(o.c);
      el('line', { x1: x, y1: PAD.t, x2: x, y2: PAD.t + PAD.h, class: 'grid-line' }, grid);
      el('line', { x1: x, y1: PAD.t + PAD.h, x2: x, y2: PAD.t + PAD.h + 6, stroke: '#405773', 'stroke-width': 1.4 }, grid);
      txt(grid, x, PAD.t + PAD.h + 24, o.s, 'tick-text');
    });
    for (var t = 100; t <= 1600; t += 100) {
      var y = fecPY(t);
      if (y < PAD.t - 2 || y > PAD.t + PAD.h + 2) continue;
      el('line', { x1: PAD.l, y1: y, x2: PAD.l + PAD.w, y2: y, class: 'grid-line' }, grid);
      txt(grid, PAD.l + 5, y + 4, String(t), 'tick-text', 'start');
    }

    // 坐标轴
    el('line', { x1: PAD.l, y1: PAD.t, x2: PAD.l, y2: PAD.t + PAD.h, class: 'axis-line' }, g);
    el('line', { x1: PAD.l, y1: PAD.t + PAD.h, x2: PAD.l + PAD.w, y2: PAD.t + PAD.h, class: 'axis-line' }, g);
    txt(g, PAD.l + PAD.w / 2, PAD.t + PAD.h + 56, '碳的质量分数 w(C) / %', 'axis-label');
    el('text', { x: 14, y: 54, class: 'axis-label', transform: 'rotate(-90 14 54)' }, g).textContent = '温度 t / ℃';

    // 相区淡色
    var tints = {
      L: 'rgba(79,195,247,.055)',
      'L+d': 'rgba(79,195,247,.14)',
      d: 'rgba(140,180,255,.11)',
      'L+g': 'rgba(79,195,247,.09)',
      g: 'rgba(255,183,77,.085)',
      'a+g': 'rgba(255,183,77,.16)',
      a: 'rgba(74,222,128,.11)',
      'L+c': 'rgba(248,113,113,.09)',
      'g+c': 'rgba(248,113,113,.075)',
      'a+c': 'rgba(248,113,113,.05)'
    };
    var polys = {
      L: [[0, 1538], [0.53, 1495], [4.30, 1148], [6.69, 1250], [6.69, 1600], [0, 1600]],
      'L+d': [[0, 1538], [0.53, 1495], [0.09, 1495]],
      d: [[0, 1538], [0.09, 1495], [0, 1495]],
      'L+g': [[0.53, 1495], [4.30, 1148], [2.11, 1148], [0.17, 1495]],
      g: [[0, 912], [0, 1148], [2.11, 1148], [2.11, 1495], [0.17, 1495], [0.77, 727], [0.0218, 727]],
      'a+g': [[0, 912], [0.0218, 727], [0.77, 727]],
      a: [[0, 912], [0.0218, 727], [0.0008, 20], [0, 20]],
      'L+c': [[4.30, 1148], [6.69, 1250], [6.69, 1148]],
      'g+c': [[0.77, 727], [2.11, 1148], [2.11, 727]],
      'a+c': [[0.0218, 727], [6.69, 727], [6.69, 20], [0.0008, 20]]
    };
    Object.keys(polys).forEach(function (id) {
      var d = polys[id].map(function (p, i) { return (i ? 'L' : 'M') + fecPX(p[0]) + ' ' + fecPY(p[1]); }).join(' ') + ' Z';
      el('path', { d: d, fill: tints[id] || 'transparent' }, g);
    });

    // 相界线
    var linesG = el('g', {}, g);
    F.lines.forEach(function (ln) {
      var d = ln.pts.map(function (p, i) { return (i ? 'L' : 'M') + fecPX(p[0]) + ' ' + fecPY(p[1]); }).join(' ');
      var isInv = ln.id === 'HJB' || ln.id === 'ECF' || ln.id === 'PSK';
      el('path', { d: d, class: ln.dash ? 'boundary-dash' : (isInv ? 'boundary-inv' : 'boundary'), 'stroke-width': ln.w || 2 }, linesG);
    });

    // 特征温度（画在图右侧外）
    [
      [1538, '1538'], [1495, '1495 包晶'], [1148, '1148 共晶'],
      [912, '912 A3'], [770, '770 A2'], [727, '727 共析'], [230, '230 A0']
    ].forEach(function (o) {
      var y = fecPY(o[0]);
      if (y < PAD.t || y > PAD.t + PAD.h) return;
      el('line', { x1: PAD.l + PAD.w, y1: y, x2: 994, y2: y, stroke: 'rgba(255,209,138,.28)', 'stroke-width': 1 }, g);
      txt(g, 996, y + 3.5, o[1], 'region-sub', 'end');
    });

    // 相区标签
    var lg = el('g', {}, g);
    function label(c, t, s, cls, sub) {
      var x = fecPX(c), y = fecPY(t);
      txt(lg, x, y, s, cls || 'region-label');
      if (sub) txt(lg, x, y + 17, sub, 'region-sub');
    }
    label(1.25, 1470, 'L', 'region-label', '液相');
    label(0.22, 1512, 'L+δ', 'region-label small');
    label(0.035, 1512, 'δ', 'region-label small');
    label(1.75, 1290, 'L+γ', 'region-label');
    label(0.62, 985, 'γ', 'region-label', '奥氏体');
    label(0.28, 790, 'α+γ', 'region-label small');
    label(0.010, 430, 'α', 'region-label small');
    label(5.35, 1190, 'L+Fe₃C', 'region-label small');
    label(1.22, 895, 'γ+Fe₃C', 'region-label small');
    label(2.30, 610, 'α+Fe₃C', 'region-label small');
    el('text', { x: fecPX(6.45), y: fecPY(430), class: 'region-sub', transform: 'rotate(-90 ' + (fecPX(6.45) + 14) + ' ' + fecPY(430) + ')' }, lg).textContent = '渗碳体 Fe₃C';

    // 组织区标注
    label(0.40, 545, '铁素体 + 珠光体', 'region-label small', '亚共析钢');
    label(1.32, 545, '珠光体 + Fe₃C_II', 'region-label small', '过共析钢');
    label(3.15, 545, '珠光体+Fe₃C_II+莱氏体', 'region-label small', '亚共晶白口铸铁');
    label(5.50, 545, '莱氏体 + Fe₃C_I', 'region-label small', '过共晶白口铸铁');

    // 水平线说明
    txt(g, fecPX(0.60), fecPY(727) - 9, '727℃ 共析线 PSK', 'region-sub');
    txt(g, fecPX(3.05), fecPY(1148) - 9, '1148℃ 共晶线 ECF', 'region-sub');
    txt(g, fecPX(0.70), fecPY(1495) - 9, '1495℃ 包晶线 HJB', 'region-sub');

    // 关键点
    F.points.forEach(function (p) {
      if (p.k === 'M') return;
      var x = fecPX(p.x), y = fecPY(p.t);
      el('circle', { cx: x, cy: y, r: 4.6, class: 'pt-circle' }, g);
      el('circle', { cx: x, cy: y, r: 11, fill: 'transparent' }, g).setAttribute('data-pt', p.k);
      txt(g, x + (p.x > 6.2 ? -8 : 8), y - 8, p.k, 'pt-text', p.x > 6.2 ? 'end' : 'start');
    });

    // 与单位空间一致：viewBox 覆盖 0..1000，指针换算见 unitPoint
    fec.overlay = el('g', {}, svg);
    fec.built = true;
    fecApplyPreset('all');
  }

  function fecApplyPreset(name) {
    var svg = fec.svg;
    fec.preset = name;
    $$('[data-fec-preset]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-fec-preset') === name); });
    var box;
    // 看钢：聚焦 ±600～1000℃ 的相变区（A1/A3/Acm、α+γ、γ+Fe₃C）
    if (name === 'steel') box = { c0: 0, c1: 1.75, t0: 620, t1: 1010 };
    else if (name === 'ci') box = { c0: 2.6, c1: 6.85, t0: 520, t1: 1560 };
    else box = { c0: 0, c1: 6.85, t0: 40, t1: 1620 };
    var left = fecPX(box.c0) - 26;
    var right = fecPX(box.c1) + 20;
    var top = fecPY(box.t1) - 14;
    // 底部永远包含成分刻度与轴标题（这样任何预设都能看到刻度和标题）
    var bottom = Math.max(fecPY(box.t0), PAD.t + PAD.h + 80);
    var vbw = right - left, vbh = bottom - top;
    window.__fecVB = { name: name, left: left, top: top, vbw: vbw, vbh: vbh };
    svg.setAttribute('viewBox', left + ' ' + top + ' ' + vbw + ' ' + vbh);
    svg.setAttribute('data-ratio', vbw + '/' + vbh);
    fitSvg(svg);
    fecDrawCursor();
  }

  function fecDrawCursor() {
    var ov = fec.overlay; if (!ov) return;
    while (ov.firstChild) ov.removeChild(ov.firstChild);
    var x = fecPX(fec.x), y = fecPY(fec.t);
    el('line', { x1: x, y1: PAD.t, x2: x, y2: PAD.t + PAD.h, class: 'cursor-v' }, ov);
    el('line', { x1: PAD.l, y1: y, x2: PAD.l + PAD.w, y2: y, class: 'cursor-h' }, ov);

    var reg = F.regionAt(fec.x, fec.t);
    if (reg && reg.lever) {
      var lv = F.lever(reg.lever, fec.t, fec.x);
      if (lv && lv.left.x != null && lv.right.x != null && Math.abs(lv.right.x - lv.left.x) > 0.005) {
        var x1 = fecPX(lv.left.x), x2 = fecPX(lv.right.x);
        el('line', { x1: x1, y1: y, x2: x2, y2: y, class: 'tie-line' }, ov);
        el('circle', { cx: x1, cy: y, r: 3.6, class: 'tie-dot' }, ov);
        el('circle', { cx: x2, cy: y, r: 3.6, class: 'tie-dot' }, ov);
        txt(ov, (x1 + x2) / 2, y - 10, fmt(lv.left.pct, 0) + '% ' + lv.left.name + '　|　' + fmt(lv.right.pct, 0) + '% ' + lv.right.name, 'read-text');
      }
    }
    el('circle', { cx: x, cy: y, r: 7, class: 'cursor-ring' }, ov);
  }

  function fecUpdate() {
    var c = fec.x, t = fec.t;
    var reg = F.regionAt(c, t);
    var at = F.alloyType(c);

    $('#fecRegion').textContent = reg ? (reg.label + (reg.sub ? ' · ' + reg.sub : '')) : '—';
    $('#fecBadge').textContent = at.name;
    $('#fecCoord').textContent = '含碳量 ' + fmt(c, 2) + '%　温度 ' + fmt(t, 0) + '℃';

    var hint = reg ? reg.hint : '';
    if (reg && reg.org) {
      hint = '这个位置相组成物是 α + Fe₃C；但组织组成物要看含碳量——现在是「' + at.org + '」。相组成物和组织组成物是两套说法，考试常考。';
    }
    if (Math.abs(c - 0.77) < 0.03 && Math.abs(t - 727) < 8) hint = '你正好点在共析点 S（0.77%C，727℃）附近：γ → α + Fe₃C 的共析反应发生在这里，产物是珠光体。';
    if (Math.abs(c - 4.3) < 0.05 && Math.abs(t - 1148) < 10) hint = '你正好点在共晶点 C（4.3%C，1148℃）附近：L → γ + Fe₃C 的共晶反应发生在这里，产物是莱氏体。';
    $('#fecHint').textContent = hint || '点一下相图，这里会告诉你这个点的相组成、组织组成和判断依据。';

    var lv = reg && reg.lever ? F.lever(reg.lever, t, c) : null;
    if (lv && lv.left.x != null) {
      $('#fecLeverBlock').hidden = false;
      $('#fecLeverT').textContent = 't = ' + fmt(t, 0) + '℃';
      renderLever($('#fecLeverGraph'), $('#fecLeverTable'), lv, c);
    } else $('#fecLeverBlock').hidden = true;

    $('#fecPhaseList').innerHTML = F.phasesAt(c, t).map(function (o) { return row(o.name, o.pct); }).join('');
    $('#fecStructList').innerHTML = F.structureAt(c).map(function (o) { return row(o.name, o.pct); }).join('');
    $('#fecStructTitle').innerHTML = '组织组成物 <span class="muted">' + at.name + ' · 室温</span>';

    var cool = F.cooling(c);
    $('#fecCoolFor').textContent = at.name + ' · ' + fmt(c, 2) + '%C';
    $('#fecCoolSteps').innerHTML = cool.steps.map(function (s) {
      return '<div class="cool-step"><h3><em>' + s.t + '℃</em>' + s.title + '</h3><p>' + s.text + '</p></div>';
    }).join('');

    fecSyncSliders();
    fecDrawCursor();
  }

  function row(name, pct) {
    var w = Math.max(0, Math.min(100, pct));
    return '<div class="pct-row"><span class="pct-name">' + name + '</span>' +
      '<div class="pct-bar"><div class="pct-fill" style="width:' + w + '%"></div></div>' +
      '<span class="pct-num">' + fmt(pct, 1) + '%</span></div>';
  }

  function renderLever(graphEl, tableEl, lv, c) {
    var W = 340, H = 96, pad = 30;
    var lx = lv.left.x, rx = lv.right.x;
    var span = Math.abs(rx - lx);
    var lo = Math.min(lx, rx) - span * 0.3 - 0.005;
    var hi = Math.max(lx, rx) + span * 0.3 + 0.005;
    function X(v) { return pad + (v - lo) / (hi - lo) * (W - pad * 2); }
    var y = 48;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    s += '<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" stroke="#2a3d5c" stroke-width="2"/>';
    s += '<line x1="' + X(lx) + '" y1="' + y + '" x2="' + X(rx) + '" y2="' + y + '" stroke="#4fc3f7" stroke-width="5" stroke-linecap="round" opacity=".55"/>';
    s += '<circle cx="' + X(lx) + '" cy="' + y + '" r="4.5" fill="#4fc3f7"/>';
    s += '<circle cx="' + X(rx) + '" cy="' + y + '" r="4.5" fill="#7c6cff"/>';
    s += '<circle cx="' + X(c) + '" cy="' + y + '" r="6.5" fill="#ffb74d"/>';
    s += '<text x="' + X(c) + '" y="' + (y - 13) + '" fill="#ffd18a" font-size="11" font-weight="700" text-anchor="middle">合金 ' + fmt(c, 2) + '</text>';
    s += '<text x="' + X(lx) + '" y="' + (y + 21) + '" fill="#8fa3c4" font-size="10" text-anchor="middle">' + fmt(lx, 2) + '</text>';
    s += '<text x="' + X(rx) + '" y="' + (y + 21) + '" fill="#8fa3c4" font-size="10" text-anchor="middle">' + fmt(rx, 2) + '</text>';
    s += '<text x="' + pad + '" y="' + (H - 8) + '" fill="#63789b" font-size="10">← ' + lv.left.name + '　　段长之比 = 两相相对量　　' + lv.right.name + ' →</text>';
    s += '</svg>';
    graphEl.innerHTML = s;

    tableEl.innerHTML =
      '<div class="lever-line"><b>' + lv.left.name + ' 相</b><span>x = ' + fmt(lv.left.x, 2) + '%　→　' + fmt(lv.left.pct, 1) + '%</span></div>' +
      '<div class="lever-line"><b>' + lv.right.name + ' 相</b><span>x = ' + fmt(lv.right.x, 2) + '%　→　' + fmt(lv.right.pct, 1) + '%</span></div>' +
      '<div class="lever-line"><b>杠杆</b><span>' + fmt(lv.left.name) + ' 量 ∝ 对侧线段 ' + fmt(Math.abs(lv.right.x - c), 2) + '</span></div>';
  }

  /* ==========================================================
     二、二元相图
     ========================================================== */
  var bin = { key: 'Cu-Ni', svg: null, overlay: null, x: 50, t: 1250 };

  function binBounds() {
    if (bin.key === 'Cu-Ni') return { tMin: 20, tMax: 1500 };
    if (bin.key === 'Pb-Sn') return { tMin: 20, tMax: 360 };
    return { tMin: 20, tMax: 1850 };
  }
  function binPX(x) { return 74 + (x / 100) * 880; }
  function binPY(t) { var b = binBounds(); return 36 + (1 - (t - b.tMin) / (b.tMax - b.tMin)) * 810; }

  function binBuild() {
    var svg = $('#binSvg');
    clear(svg);
    var d = P.BINARIES[bin.key], b = binBounds();
    var g = el('g', {}, svg);
    bin.svg = svg;

    el('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: '#0d1627' }, g);

    var step = bin.key === 'Pb-Sn' ? 50 : (bin.key === 'Cu-Ni' ? 200 : 250);
    for (var t = Math.ceil(b.tMin / step) * step; t <= b.tMax; t += step) {
      var y = binPY(t);
      if (y < 30 || y > 850) continue;
      el('line', { x1: 74, y1: y, x2: 954, y2: y, class: 'grid-line' }, g);
      txt(g, 66, y + 4, String(t), 'tick-text', 'end');
    }
    for (var xx = 0; xx <= 100; xx += 20) {
      var x = binPX(xx);
      el('line', { x1: x, y1: 36, x2: x, y2: 846, class: 'grid-line' }, g);
      txt(g, x, 872, String(xx), 'tick-text');
    }
    el('line', { x1: 74, y1: 36, x2: 74, y2: 846, class: 'axis-line' }, g);
    el('line', { x1: 74, y1: 846, x2: 954, y2: 846, class: 'axis-line' }, g);
    txt(g, 514, 916, d.xLabel, 'axis-label');
    el('text', { x: 16, y: 50, class: 'axis-label', transform: 'rotate(-90 16 50)' }, g).textContent = '温度 t / ℃';

    // 区域着色
    function zonePath(pts, fill) {
      var p = pts.map(function (q, i) { return (i ? 'L' : 'M') + binPX(q[0]) + ' ' + binPY(q[1]); }).join(' ') + ' Z';
      el('path', { d: p, fill: fill }, g);
    }
    if (d.kind === 'eutectic') {
      zonePath([[0, b.tMax], [100, b.tMax], [100, 232], [61.9, 183], [0, 327]], 'rgba(79,195,247,.055)');
      zonePath([[0, b.tMin], [19.2, b.tMin], [19.2, 183], [0, 327]], 'rgba(74,222,128,.12)');
      zonePath([[97.5, b.tMin], [100, b.tMin], [100, 232], [97.5, 183]], 'rgba(255,183,77,.12)');
      zonePath([[19.2, b.tMin], [97.5, b.tMin], [97.5, 183], [19.2, 183]], 'rgba(124,108,255,.07)');
    } else if (d.kind === 'peritectic') {
      zonePath([[0, b.tMax], [100, b.tMax], [100, 962], [11.5, 1186], [0, 1772]], 'rgba(79,195,247,.055)');
      zonePath([[0, b.tMin], [10.5, b.tMin], [10.5, 1186], [0, 1772]], 'rgba(74,222,128,.12)');
      zonePath([[97, b.tMin], [100, b.tMin], [100, 962], [11.5, 1186]], 'rgba(255,183,77,.12)');
      zonePath([[1.5, b.tMin], [97, b.tMin], [97, 962], [10.5, 1186], [1.5, 1186]], 'rgba(124,108,255,.06)');
    } else {
      zonePath([[0, b.tMax], [100, b.tMax], [100, 1455], [0, 1083]], 'rgba(79,195,247,.055)');
      zonePath([[0, b.tMin], [100, b.tMin], [100, 1455], [0, 1083]], 'rgba(255,183,77,.06)');
      zonePath([[0, 1083], [25, 1125], [50, 1190], [75, 1295], [100, 1455], [100, 1455], [75, 1352], [50, 1269], [25, 1188], [0, 1083]], 'rgba(124,108,255,.09)');
    }

    // 相界线
    var lg = el('g', {}, g);
    function line(pts, cls, w) {
      var p = pts.map(function (q, i) { return (i ? 'L' : 'M') + binPX(q[0]) + ' ' + binPY(q[1]); }).join(' ');
      el('path', { d: p, class: cls || 'boundary', 'stroke-width': w || 2 }, lg);
    }
    line(d.liquidus, 'boundary', 2.4);
    if (d.kind === 'isomorphous') {
      line(d.solidus, 'boundary', 2.4);
    } else if (d.kind === 'eutectic') {
      line(d.solidusA, 'boundary', 2.4);
      line(d.solidusB, 'boundary', 2.4);
      line([[0, d.eutectic.t], [100, d.eutectic.t]], 'boundary-inv', 2.6);
      line(d.solvusA, 'boundary-dash', 1.5);
      line(d.solvusB, 'boundary-dash', 1.5);
    } else {
      line(d.solidusA, 'boundary', 2.4);
      line(d.solidusB, 'boundary', 2.4);
      line([[0, d.peritectic.t], [100, d.peritectic.t]], 'boundary-inv', 2.6);
      line(d.solvusA, 'boundary-dash', 1.5);
      line(d.solvusB, 'boundary-dash', 1.5);
    }

    // 相区文字
    var labs;
    if (d.kind === 'isomorphous') {
      labs = [[20, 1390, 'L', 'region-label'], [55, 1150, 'L + α', 'region-label'], [55, 620, 'α', 'region-label']];
    } else if (d.kind === 'eutectic') {
      labs = [[16, 300, 'L', 'region-label'], [28, 275, 'L+α', 'region-label small'], [78, 275, 'L+β', 'region-label small'],
      [10, 90, 'α', 'region-label'], [90, 90, 'β', 'region-label'], [50, 70, 'α+β', 'region-label'],
      [45, 205, '共晶线 183℃', 'region-sub']];
    } else {
      labs = [[15, 1650, 'L', 'region-label'], [30, 1400, 'L+α', 'region-label small'], [72, 1400, 'L+β', 'region-label small'],
      [7, 300, 'α', 'region-label'], [92, 300, 'β', 'region-label'], [50, 480, 'α+β', 'region-label'],
      [34, 1250, '包晶线 1186℃', 'region-sub']];
    }
    labs.forEach(function (o) { if (o[2]) txt(g, binPX(o[0]), binPY(o[1]), o[2], o[3]); });

    // 端点标识
    if (d.kind === 'eutectic') {
      el('circle', { cx: binPX(61.9), cy: binPY(183), r: 4.8, class: 'pt-circle' }, g);
      txt(g, binPX(61.9) + 8, binPY(183) - 8, 'E', 'pt-text', 'start');
    } else if (d.kind === 'peritectic') {
      el('circle', { cx: binPX(11.5), cy: binPY(1186), r: 4.8, class: 'pt-circle' }, g);
      txt(g, binPX(11.5) + 8, binPY(1186) - 8, 'P', 'pt-text', 'start');
    }

    bin.overlay = el('g', {}, svg);
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('data-ratio', '1000/1000');
    fitSvg(svg);
    binDrawCursor();
  }

  function binPoint(evt) {
    var u = unitPoint(bin.svg, evt), b = binBounds();
    if (!u) return null;
    return {
      x: P.clamp(u.x / 1000 * 100, 0, 100),
      t: P.clamp(b.tMin + (1 - u.y / 1000) * (b.tMax - b.tMin), b.tMin, b.tMax)
    };
  }

  function binDrawCursor() {
    var ov = bin.overlay; if (!ov) return;
    while (ov.firstChild) ov.removeChild(ov.firstChild);
    var r = P.readBinary(bin.key, bin.x, bin.t);
    var x = binPX(bin.x), y = binPY(bin.t);
    el('line', { x1: x, y1: 36, x2: x, y2: 846, class: 'cursor-v' }, ov);
    el('line', { x1: 74, y1: y, x2: 954, y2: y, class: 'cursor-h' }, ov);
    if (r.phases && r.phases.length === 2 && r.phases[0].x != null) {
      var x1 = binPX(r.phases[0].x), x2 = binPX(r.phases[1].x);
      el('line', { x1: x1, y1: y, x2: x2, y2: y, class: 'tie-line' }, ov);
      el('circle', { cx: x1, cy: y, r: 3.6, class: 'tie-dot' }, ov);
      el('circle', { cx: x2, cy: y, r: 3.6, class: 'tie-dot' }, ov);
      txt(ov, (x1 + x2) / 2, y - 10, fmt(r.phases[0].pct, 0) + '% ' + r.phases[0].name + '　|　' + fmt(r.phases[1].pct, 0) + '% ' + r.phases[1].name, 'read-text');
    }
    el('circle', { cx: x, cy: y, r: 7, class: 'cursor-ring' }, ov);
  }

  function binUpdate() {
    var d = P.BINARIES[bin.key];
    var r = P.readBinary(bin.key, bin.x, bin.t);
    $('#binRegion').textContent = r.region;
    $('#binKind').textContent = d.kind === 'isomorphous' ? '匀晶' : (d.kind === 'eutectic' ? '共晶' : '包晶');
    $('#binCoord').textContent = d.xLabel.replace('/ %', '') + ' = ' + fmt(bin.x, 1) + '%　温度 = ' + fmt(bin.t, 0) + '℃';

    var desc = {
      L: '液相区：温度高于液相线，合金全部是液体。',
      'L+α': '液 + 固两相区：正在凝固（或熔化）。降温时固相量增加，液相成分沿液相线变化，固相成分沿固相线变化。',
      'L+β': '液 + β 两相区：β 是另一个固溶体相。',
      α: 'α 固溶体单相区：固溶体成分均匀。',
      β: 'β 固溶体单相区。',
      'α+β': 'α+β 两相区：固态有限互溶，超出溶解度的部分以第二相析出。'
    }[r.region] || '—';
    $('#binDesc').textContent = desc;
    $('#binNote').textContent = d.note;

    if (r.phases && r.phases.length === 2 && r.phases[0].x != null) {
      $('#binLeverBlock').hidden = false;
      renderLever($('#binLeverGraph'), $('#binLeverTable'),
        { left: r.phases[0], right: r.phases[1] }, bin.x);
    } else $('#binLeverBlock').hidden = true;

    var cools;
    if (d.kind === 'eutectic') {
      cools = [
        { n: '亚共晶合金（如 40%Sn）', s: '先析出初生 α（成分沿固相线变），到 183℃ 剩余液相发生共晶反应 L→α+β，最终组织 = α初 + (α+β)共晶。' },
        { n: '共晶合金（61.9%Sn）', s: '在 183℃ 恒温结晶 L→α+β，得到细密的共晶组织；冷速越快组织越细。' },
        { n: '过共晶合金（如 90%Sn）', s: '先析出初生 β，到 183℃ 剩余液相共晶，最终组织 = β初 + (α+β)共晶。' }
      ];
    } else if (d.kind === 'isomorphous') {
      cools = [{ n: '任意成分', s: '在液相线与固相线之间结晶：固相成分沿固相线变、液相沿液相线变。平衡凝固得到均匀 α；冷速快则出现枝晶偏析。' }];
    } else {
      cools = [
        { n: '包晶点附近', s: '降到 1186℃ 时发生 L+α→β，新相 β 在 α 与液相的界面上形核长大，把 α 包围起来。' },
        { n: '包晶点右侧', s: '包晶反应后仍有液相剩余，继续结晶为 β，最终组织是 β + 少量包晶 α。' }
      ];
    }
    $('#binCool').innerHTML = cools.map(function (c) {
      return '<div class="cool-step"><h3>' + c.n + '</h3><p>' + c.s + '</p></div>';
    }).join('');

    binSyncSliders();
    binDrawCursor();
  }

  /* ==========================================================
     三、三元成分
     ========================================================== */
  var tri = { a: 60, b: 20, c: 20, svg: null, overlay: null, V: null };

  function triBuild() {
    var svg = $('#triSvg');
    clear(svg);
    var W = 600, H = 520;
    var V = { A: [300, 60], B: [60, 470], C: [540, 470] };
    tri.V = V;
    var g = el('g', {}, svg);
    tri.overlay = el('g', {}, svg);

    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#0d1627' }, g);

    function lerp(p, q, u) { return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; }
    var grid = el('g', {}, g);
    for (var k = 1; k < 10; k++) {
      var u = k / 10;
      // 等 A 线：平行于 BC（A 含量 = k×10%）
      var a1 = lerp(V.A, V.B, u), a2 = lerp(V.A, V.C, u);
      el('line', { x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1], stroke: 'rgba(79,195,247,.13)' }, grid);
      // 等 B 线：平行于 AC（B 含量 = k×10%）
      var b1 = lerp(V.A, V.B, u), b2 = lerp(V.C, V.B, u);
      el('line', { x1: b1[0], y1: b1[1], x2: b2[0], y2: b2[1], stroke: 'rgba(124,108,255,.13)' }, grid);
      // 等 C 线：平行于 AB（C 含量 = k×10%）
      var c1 = lerp(V.A, V.C, u), c2 = lerp(V.B, V.C, u);
      el('line', { x1: c1[0], y1: c1[1], x2: c2[0], y2: c2[1], stroke: 'rgba(255,183,77,.13)' }, grid);
    }

    el('path', { d: 'M' + V.A[0] + ' ' + V.A[1] + 'L' + V.B[0] + ' ' + V.B[1] + 'L' + V.C[0] + ' ' + V.C[1] + 'Z', fill: 'rgba(79,195,247,.04)', stroke: '#8fb4e0', 'stroke-width': 2.4 }, g);

    txt(g, V.A[0], V.A[1] - 18, 'A', 'region-label');
    txt(g, V.B[0] - 20, V.B[1] + 6, 'B', 'region-label');
    txt(g, V.C[0] + 20, V.C[1] + 6, 'C', 'region-label');

    function edgeTicks(p, q, fn, side) {
      for (var i = 0; i <= 10; i++) {
        var pt = lerp(p, q, i / 10);
        el('circle', { cx: pt[0], cy: pt[1], r: 1.8, fill: '#6d86a8' }, g);
        if (i % 2 === 0) {
          var dx = 0, dy = 0;
          if (side === 'bottom') { dy = 18; }
          else if (side === 'left') { dx = -16; dy = 4; }
          else { dx = 16; dy = 4; }
          txt(g, pt[0] + dx, pt[1] + dy, fn(i / 10), 'tick-text');
        }
      }
    }
    edgeTicks(V.B, V.C, function (u) { return String(Math.round(u * 100)); }, 'bottom');   // B 100→0

    // 顶点含量标注
    txt(g, V.A[0] + 18, V.A[1] + 14, 'A=100', 'region-sub', 'start');
    txt(g, V.B[0] + 6, V.B[1] - 10, 'B=100', 'region-sub', 'start');
    txt(g, V.C[0] - 6, V.C[1] - 10, 'C=100', 'region-sub', 'end');

    txt(g, 300, 505, 'B 含量（底边 BC）', 'axis-label');
    txt(g, 40, 300, 'C 含量（左边 AB）', 'axis-label');
    txt(g, 560, 300, 'B 含量（右边 AC）', 'axis-label');

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('data-ratio', W + '/' + H);
    tri.svg = svg;
    triDraw();
  }

  function triDraw() {
    var V = tri.V, ov = tri.overlay;
    while (ov.firstChild) ov.removeChild(ov.firstChild);
    var p = P.TERNARY.toXY(tri.a, tri.b, tri.c, V);
    var lines = P.TERNARY.readLines(tri.a, tri.b, tri.c, V);
    var colors = { A: '#4fc3f7', B: '#7c6cff', C: '#ffb74d' };
    ['A', 'B', 'C'].forEach(function (k) {
      var seg = lines[k];
      if (seg && seg[0] && seg[1]) {
        el('line', { x1: seg[0][0], y1: seg[0][1], x2: seg[1][0], y2: seg[1][1], stroke: colors[k], 'stroke-width': 1.8, 'stroke-dasharray': '6 4', opacity: .95 }, ov);
        el('circle', { cx: seg[0][0], cy: seg[0][1], r: 3, fill: colors[k] }, ov);
        el('circle', { cx: seg[1][0], cy: seg[1][1], r: 3, fill: colors[k] }, ov);
      }
    });
    el('circle', { cx: p[0], cy: p[1], r: 19, fill: 'rgba(255,255,255,.06)' }, ov);
    el('circle', { cx: p[0], cy: p[1], r: 8.5, fill: 'rgba(255,255,255,.2)', stroke: '#fff', 'stroke-width': 2.4 }, ov);

    $('#triRead').innerHTML = [['A', tri.a, 'a'], ['B', tri.b, 'b'], ['C', tri.c, 'c']].map(function (o) {
      return '<div class="tri-item ' + o[2] + '"><span class="k">' + o[0] + ' 组元</span><span class="v">' + fmt(o[1], 0) + '%</span></div>';
    }).join('');
    $('#triSum').textContent = '合计 ' + fmt(tri.a + tri.b + tri.c, 1) + '%';
  }

  function triSetFromEvent(evt) {
    var svg = tri.svg, pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    var m = svg.getScreenCTM(); if (!m) return;
    var loc = pt.matrixTransform(m.inverse());
    var bc = P.TERNARY.fromXY(loc.x, loc.y, tri.V);
    var a = Math.max(0, bc.A), b = Math.max(0, bc.B), c = Math.max(0, bc.C);
    var s = a + b + c;
    if (s <= 0.001) return;
    tri.a = a / s * 100; tri.b = b / s * 100; tri.c = c / s * 100;
    triDraw();
  }

  /* ==========================================================
     四、刷题
     ========================================================== */
  var quiz = { queue: [], idx: 0, right: 0, done: 0, answered: false, wrong: {} };
  var WRONG_KEY = 'phasediag_wrong_v1';
  function loadWrong() { try { quiz.wrong = JSON.parse(localStorage.getItem(WRONG_KEY) || '{}'); } catch (e) { quiz.wrong = {}; } }
  function saveWrong() { try { localStorage.setItem(WRONG_KEY, JSON.stringify(quiz.wrong)); } catch (e) { } }

  function quizStart() {
    quiz.queue = QUESTIONS.map(function (q, i) { return i; });
    for (var i = quiz.queue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = quiz.queue[i]; quiz.queue[i] = quiz.queue[j]; quiz.queue[j] = tmp;
    }
    quiz.idx = 0; quiz.right = 0; quiz.done = 0;
    $('#quizCard').hidden = false;
    $('#wrongbook').hidden = true;
    quizRender();
  }

  function quizRender() {
    var card = $('#quizCard');
    if (quiz.idx >= quiz.queue.length) {
      card.innerHTML = '<div style="text-align:center;padding:20px 0">' +
        '<div style="font-size:40px;font-weight:800;color:#4fc3f7">' + quiz.right + ' / ' + quiz.queue.length + '</div>' +
        '<p class="block-body" style="margin-top:6px">答对 ' + quiz.right + ' 题 · 答错 ' + (quiz.queue.length - quiz.right) + ' 题</p>' +
        '<button class="primary-btn" id="quizAgain">再来一轮</button></div>';
      var again = $('#quizAgain');
      if (again) again.onclick = quizStart;
      quizHUD();
      return;
    }
    var q = QUESTIONS[quiz.queue[quiz.idx]];
    quiz.answered = false;
    card.innerHTML =
      '<div class="quiz-meta"><span class="chip">' + q.topic + '</span><span class="quiz-idx">第 ' + (quiz.idx + 1) + ' / ' + quiz.queue.length + ' 题</span></div>' +
      '<p class="quiz-q">' + q.q + '</p>' +
      '<div class="quiz-opts">' + q.opts.map(function (o, i) {
        return '<button class="opt" data-i="' + i + '"><span class="tag">' + 'ABCD'[i] + '</span><span>' + o + '</span></button>';
      }).join('') + '</div>' +
      '<div class="quiz-explain" hidden></div>' +
      '<button class="primary-btn" hidden>下一题</button>';
    $$('.opt', card).forEach(function (b) {
      b.onclick = function () { quizAnswer(parseInt(b.getAttribute('data-i'), 10)); };
    });
    quizHUD();
    fitAll();
  }

  function quizAnswer(i) {
    if (quiz.answered) return;
    quiz.answered = true;
    var card = $('#quizCard');
    var q = QUESTIONS[quiz.queue[quiz.idx]];
    $$('.opt', card).forEach(function (b, j) {
      b.disabled = true;
      if (j === q.a) b.classList.add('is-right');
      else if (j === i) b.classList.add('is-wrong');
    });
    quiz.done++;
    if (i === q.a) quiz.right++;
    else {
      var key = String(quiz.queue[quiz.idx]);
      quiz.wrong[key] = (quiz.wrong[key] || 0) + 1;
      saveWrong(); updateWrongCount();
    }
    var ex = $('.quiz-explain', card);
    ex.hidden = false;
    ex.innerHTML = '<b>' + (i === q.a ? '✓ 答对了。' : '✗ 正确答案是 ' + 'ABCD'[q.a] + '。') + '</b>' + q.exp;
    var nx = $('.primary-btn', card);
    nx.hidden = false;
    nx.textContent = quiz.idx + 1 >= quiz.queue.length ? '看结果' : '下一题';
    nx.onclick = function () { quiz.idx++; quizRender(); };
    quizHUD();
    fitAll();
  }

  function quizHUD() {
    var total = quiz.queue.length || QUESTIONS.length;
    $('#quizScore').textContent = '共 ' + total + ' 题 · 已答 ' + quiz.done + ' · 答对 ' + quiz.right;
    $('#quizBar').style.width = (total ? Math.min(100, quiz.done / total * 100) : 0) + '%';
  }

  function updateWrongCount() { $('#wrongCount').textContent = Object.keys(quiz.wrong).length; }

  function renderWrongBook() {
    $('#quizCard').hidden = true;
    $('#wrongbook').hidden = false;
    var keys = Object.keys(quiz.wrong);
    $('#wrongEmpty').style.display = keys.length ? 'none' : 'block';
    $('#wrongList').innerHTML = keys.map(function (k) {
      var q = QUESTIONS[parseInt(k, 10)];
      if (!q) return '';
      return '<div class="wrong-item"><div class="q">' + q.q + '</div><div class="a">正确答案：<b>' +
        'ABCD'[q.a] + '. ' + q.opts[q.a] + '</b><br>错 ' + quiz.wrong[k] + ' 次 · ' + q.topic + '<br>' + q.exp + '</div></div>';
    }).join('');
    $('#wrongClear').style.display = keys.length ? 'block' : 'none';
  }

  /* ==========================================================
     事件与启动
     ========================================================== */
  function bindDrag(svg, convert, onTap, onDragX) {
    var start = null, startClient = null, moved = false;
    svg.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      start = convert(e);
      startClient = { x: e.clientX, y: e.clientY };
      moved = false;
    });
    svg.addEventListener('pointermove', function (e) {
      if (!start || !startClient) return;
      var dx = e.clientX - startClient.x, dy = e.clientY - startClient.y;
      if (!moved) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // 纵向滑动交给页面滚动（touch-action: pan-y），只有横向才算拖动改成分
        if (Math.abs(dy) > Math.abs(dx)) return;
        moved = true;
      }
      var p = convert(e);
      if (p && onDragX) onDragX(p, start);
    });
    svg.addEventListener('pointerup', function () {
      if (start && !moved) onTap(start);
      start = null; startClient = null; moved = false;
    });
    svg.addEventListener('pointercancel', function () {
      start = null; startClient = null; moved = false;
    });
  }

  function fecSyncSliders() {
    var cEl = $('#fecC'), tEl = $('#fecT');
    if (document.activeElement !== cEl) cEl.value = fec.x;
    if (document.activeElement !== tEl) tEl.value = fec.t;
    $('#fecCVal').textContent = fmt(fec.x, 2) + '%';
    $('#fecTVal').textContent = fmt(fec.t, 0) + '℃';
  }

  function initFec() {
    fecBuild();
    var toFec = function (e) {
      var u = unitPoint(fec.svg, e); if (!u) return null;
      return { c: P.clamp(u.x / 1000 * F.xMax, 0, F.xMax), t: P.clamp(F.tMin + (1 - u.y / 1000) * (F.tMax - F.tMin), F.tMin, F.tMax) };
    };
    bindDrag(fec.svg, toFec,
      function (p) { fec.x = p.c; fec.t = p.t; fecUpdate(); },              // 轻点：成分+温度一起选
      function (p, start) { fec.x = p.c; fec.t = start.t; fecUpdate(); }   // 横拖：只改成分
    );

    $('#fecC').oninput = function () { fec.x = +this.value; fecUpdate(); };
    $('#fecT').oninput = function () { fec.t = +this.value; fecUpdate(); };

    $$('[data-fec-preset]').forEach(function (b) {
      b.onclick = function () {
        var n = b.getAttribute('data-fec-preset');
        fecApplyPreset(n);
        if (n === 'steel') { fec.x = 0.45; fec.t = 800; }
        else if (n === 'ci') { fec.x = 3.0; fec.t = 900; }
        else { fec.x = 2.0; fec.t = 1000; }
        fecUpdate();
      };
    });
    $('#fecZoomIn').onclick = function () {
      var svg = fec.svg, vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      var nw = vb[2] * 0.72, nh = vb[3] * 0.72;
      svg.setAttribute('viewBox', (vb[0] + (vb[2] - nw) / 2) + ' ' + (vb[1] + (vb[3] - nh) / 2) + ' ' + nw + ' ' + nh);
      svg.setAttribute('data-ratio', nw + '/' + nh);
      fitSvg(svg); fecDrawCursor();
    };
    $('#fecZoomOut').onclick = function () { fecApplyPreset('all'); fecUpdate(); };
    fecUpdate();
  }

  function binSyncSliders() {
    var b = binBounds();
    var xEl = $('#binX'), tEl = $('#binT');
    tEl.min = b.tMin; tEl.max = b.tMax;
    if (document.activeElement !== xEl) xEl.value = bin.x;
    if (document.activeElement !== tEl) tEl.value = bin.t;
    $('#binXVal').textContent = fmt(bin.x, 1) + '%';
    $('#binTVal').textContent = fmt(bin.t, 0) + '℃';
    $('#binXLabel').textContent = bin.key === 'Pb-Sn' ? 'Sn 含量' : (bin.key === 'Cu-Ni' ? 'Ni 含量' : 'Ag 含量');
  }

  function initBinary() {
    binBuild();
    bindDrag(bin.svg, binPoint,
      function (p) { bin.x = p.x; bin.t = p.t; binUpdate(); },
      function (p, start) { bin.x = p.x; bin.t = start.t; binUpdate(); }
    );

    $('#binX').oninput = function () { bin.x = +this.value; binUpdate(); };
    $('#binT').oninput = function () { bin.t = +this.value; binUpdate(); };

    $$('[data-binary]').forEach(function (b) {
      b.onclick = function () {
        $$('[data-binary]').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        bin.key = b.getAttribute('data-binary');
        if (bin.key === 'Cu-Ni') { bin.x = 50; bin.t = 1250; }
        else if (bin.key === 'Pb-Sn') { bin.x = 40; bin.t = 200; }
        else { bin.x = 7; bin.t = 1250; }
        binBuild(); binUpdate();
      };
    });
    binUpdate();
  }

  function initTri() {
    triBuild();
    var dragging = false;
    var wrap = $('#triSvg');
    wrap.addEventListener('pointerdown', function (e) { dragging = true; triSetFromEvent(e); });
    wrap.addEventListener('pointermove', function (e) { if (dragging) triSetFromEvent(e); });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointercancel', function () { dragging = false; });

    // 三元共晶投影
    var svg = $('#triProjSvg');
    var V = { A: [300, 90], B: [80, 450], C: [520, 450] };
    var g = el('g', {}, svg);
    el('rect', { x: 0, y: 0, width: 600, height: 520, fill: '#0d1627' }, g);
    el('path', { d: 'M' + V.A[0] + ' ' + V.A[1] + 'L' + V.B[0] + ' ' + V.B[1] + 'L' + V.C[0] + ' ' + V.C[1] + 'Z', fill: 'rgba(79,195,247,.03)', stroke: '#8fb4e0', 'stroke-width': 2.2 }, g);
    txt(g, V.A[0], V.A[1] - 14, 'A', 'region-label');
    txt(g, V.B[0] - 16, V.B[1] + 4, 'B', 'region-label');
    txt(g, V.C[0] + 16, V.C[1] + 4, 'C', 'region-label');

    var E = [300, 270];
    var e12 = [125, 270], e13 = [475, 270], e23 = [300, 450];
    el('path', { d: 'M' + e12[0] + ' ' + e12[1] + 'L' + E[0] + ' ' + E[1] + 'L' + e13[0] + ' ' + e13[1] + 'L' + V.A[0] + ' ' + V.A[1] + 'Z', fill: 'rgba(79,195,247,.11)' }, g);
    el('path', { d: 'M' + e12[0] + ' ' + e12[1] + 'L' + E[0] + ' ' + E[1] + 'L' + e23[0] + ' ' + e23[1] + 'L' + V.B[0] + ' ' + V.B[1] + 'Z', fill: 'rgba(124,108,255,.11)' }, g);
    el('path', { d: 'M' + e13[0] + ' ' + e13[1] + 'L' + E[0] + ' ' + E[1] + 'L' + e23[0] + ' ' + e23[1] + 'L' + V.C[0] + ' ' + V.C[1] + 'Z', fill: 'rgba(255,183,77,.11)' }, g);
    [[e12, E], [e13, E], [e23, E]].forEach(function (pr) {
      el('line', { x1: pr[0][0], y1: pr[0][1], x2: pr[1][0], y2: pr[1][1], stroke: '#ffd18a', 'stroke-width': 2.2, 'stroke-dasharray': '6 4' }, g);
    });
    [[e12, 'e₁'], [e13, 'e₂'], [e23, 'e₃']].forEach(function (o) {
      el('circle', { cx: o[0][0], cy: o[0][1], r: 4.2, class: 'pt-circle' }, g);
      txt(g, o[0][0] + 7, o[0][1] - 7, o[1], 'pt-text', 'start');
    });
    el('circle', { cx: E[0], cy: E[1], r: 6.5, fill: '#ffd18a', stroke: '#0d1627', 'stroke-width': 2 }, g);
    txt(g, E[0] + 11, E[1] + 5, 'E', 'pt-text', 'start');
    txt(g, 300, 175, 'A 初晶区', 'region-label');
    txt(g, 160, 375, 'B 初晶区', 'region-label small');
    txt(g, 440, 375, 'C 初晶区', 'region-label small');
    txt(g, 300, 492, '三条共晶线汇聚于 E：L → A + B + C', 'region-sub');
    svg.setAttribute('viewBox', '0 0 600 520');
    svg.setAttribute('data-ratio', '600/520');
    $('#triProjNote').textContent = '示意：e₁、e₂、e₃ 是三个二元系在三角形边上的共晶点，三条共晶线（界线）从它们向内部延伸，汇聚到三元共晶点 E。成分落在某个初晶区内的合金，冷却时先析出该区的初晶，最后都在 Te 温度发生三元共晶反应 L→A+B+C。';
  }

  function initTabs() {
    $$('#tabs .tab').forEach(function (b) {
      b.onclick = function () {
        $$('#tabs .tab').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var id = b.getAttribute('data-tab');
        $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
        var view = $('#view-' + id);
        view.classList.add('is-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fitAll();
        if (id === 'fec') { fecDrawCursor(); }
        if (id === 'binary') { binDrawCursor(); }
        if (id === 'quiz' && !$('#quizCard').innerHTML) quizStart();
      };
    });
  }

  function initHelp() {
    $('#btnHelp').onclick = function () { $('#helpModal').hidden = false; };
    $('#helpClose').onclick = function () { $('#helpModal').hidden = true; };
    $('#helpModal').onclick = function (e) { if (e.target.id === 'helpModal') $('#helpModal').hidden = true; };
  }

  function initScrollProgress() {
    var fill = $('#scrollFill');
    if (!fill) return;
    var update = function () {
      var el = document.scrollingElement || document.documentElement;
      var max = el.scrollHeight - el.clientHeight;
      var p = max > 8 ? el.scrollTop / max : 0;
      fill.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.setTimeout(update, 120);
    window.setTimeout(update, 600);
    return update;
  }

  function jumpTo(el) {
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (e) { el.scrollIntoView(); }
  }

  function boot() {
    initTabs();
    initHelp();
    initFec();
    initBinary();
    initTri();
    $('#fecJump').onclick = function () { jumpTo($('#fecDetail')); };
    $('#binJump').onclick = function () { jumpTo($('#view-binary .panel')); };
    initScrollProgress();
    loadWrong(); updateWrongCount();
    $('#quizWrongBook').onclick = renderWrongBook;
    $('#quizReset').onclick = quizStart;
    $('#wrongClear').onclick = function () { quiz.wrong = {}; saveWrong(); updateWrongCount(); renderWrongBook(); };
    quizStart();
    fitAll();
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      fitAll();
      fecDrawCursor(); binDrawCursor();
    });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () { fitAll(); fecDrawCursor(); binDrawCursor(); }, 250);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
