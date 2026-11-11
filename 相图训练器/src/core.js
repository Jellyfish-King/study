/* ============================================================
   材料科学基础 · 相图训练器 —— 核心数据与计算（无 DOM 依赖）
   x：成分（质量分数 %）   t：温度（℃）
   数据取值参照胡庚祥《材料科学基础》（第3版）第5～7章常用数据
   ============================================================ */
var PHASE = (function () {
  'use strict';

  /* ---------------- 通用工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function round(v, n) { var m = Math.pow(10, n == null ? 0 : n); return Math.round(v * m) / m; }

  function inPoly(p, poly) {
    var x = p[0], y = p[1], inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // 折线按温度取成分（点序温度单调）
  function compAtTemp(pts, t) {
    if (!pts || pts.length < 2) return null;
    var EPS = 1e-9;
    for (var i = 0; i < pts.length - 1; i++) {
      var y1 = pts[i][1], y2 = pts[i + 1][1], x1 = pts[i][0], x2 = pts[i + 1][0];
      if (Math.abs(y1 - t) < EPS) return x1;
      if (Math.abs(y2 - t) < EPS) return x2;
      if ((t - y1) * (t - y2) < 0 && Math.abs(y2 - y1) > EPS) {
        var k = (t - y1) / (y2 - y1);
        return x1 + k * (x2 - x1);
      }
    }
    return null;
  }

  // 折线按成分取温度；成分在折线定义域外时返回 null
  function compAtTempInv(pts, c) {
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
      if (c >= lo - 1e-9 && c <= hi + 1e-9 && Math.abs(b[0] - a[0]) > 1e-12) {
        var k = (c - a[0]) / (b[0] - a[0]);
        return a[1] + k * (b[1] - a[1]);
      }
    }
    return null;
  }

  function samplePoly(pts, nPerSeg) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      for (var k = 0; k < nPerSeg; k++) {
        var u = k / nPerSeg;
        out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  /* ============================================================
     一、Fe-Fe3C 相图
     ============================================================ */
  var E3 = 6.69, TP = 0.0218, TS = 0.77, TE = 2.11, TC = 4.30;
  var T_EUTEC = 1148, T_EUTECTOID = 727, T_PERI = 1495;

  var FE_C = {
    xMax: E3, tMin: 20, tMax: 1600,
    T: { A1: 727, A3: 912, A2: 770, A0: 230, eutectic: 1148, peritectic: 1495, melt: 1538 },
    C: { P: TP, S: TS, E: TE, C: TC, Fe3C: E3, Q: 0.0008 },

    lines: [
      { id: 'AB', pts: [[0, 1538], [0.53, 1495]], w: 2 },
      { id: 'BC', pts: [[0.53, 1495], [4.30, 1148]], w: 2 },
      { id: 'CD', pts: [[4.30, 1148], [6.69, 1250]], w: 2 },
      { id: 'AH', pts: [[0, 1538], [0.09, 1495]], w: 2 },
      { id: 'JE', pts: [[0.17, 1495], [2.11, 1148]], w: 2 },
      { id: 'HJB', pts: [[0.09, 1495], [0.53, 1495]], w: 2.6 },
      { id: 'ECF', pts: [[2.11, 1148], [6.69, 1148]], w: 2.6 },
      { id: 'PSK', pts: [[0.0218, 727], [6.69, 727]], w: 2.6 },
      { id: 'GS', pts: [[0, 912], [0.77, 727]], w: 2 },
      { id: 'GP', pts: [[0, 912], [0.0218, 727]], w: 2 },
      { id: 'ES', pts: [[2.11, 1148], [0.77, 727]], w: 2 },
      { id: 'PQ', pts: [[0.0218, 727], [0.0008, 20]], w: 1.4, dash: 1 },
      { id: 'M2', pts: [[0, 770], [6.69, 770]], w: 1.1, dash: 1 },
      { id: 'M0', pts: [[0, 230], [6.69, 230]], w: 1.1, dash: 1 }
    ],

    points: [
      { k: 'A', x: 0, t: 1538, name: '纯铁熔点', desc: '1538℃。纯铁以 δ 铁素体形式熔化。' },
      { k: 'B', x: 0.53, t: 1495, name: '包晶液相点', desc: '1495℃时液相成分 0.53%C，是包晶反应 L+δ→γ 的液相成分。' },
      { k: 'H', x: 0.09, t: 1495, name: 'δ 最大溶解度', desc: 'δ 铁素体在 1495℃ 最多溶 0.09%C。' },
      { k: 'J', x: 0.17, t: 1495, name: '包晶生成相', desc: '包晶反应 L(0.53)+δ(0.09)→γ(0.17)，γ 的成分是 0.17%C。' },
      { k: 'N', x: 2.11, t: 1495, name: 'γ 高温边界', desc: 'N 点（2.11%C，1495℃）是奥氏体在高温侧的成分边界。' },
      { k: 'D', x: 6.69, t: 1250, name: '渗碳体熔点', desc: 'Fe₃C 熔点约 1227～1250℃，是亚稳相，高温长时间保温会分解。' },
      { k: 'C', x: 4.30, t: 1148, name: '共晶点', desc: '1148℃、4.30%C。共晶反应 L(4.3)→γ(2.11)+Fe₃C(6.69)，产物是莱氏体。' },
      { k: 'E', x: 2.11, t: 1148, name: 'γ 最大溶解度', desc: '奥氏体在 1148℃ 最多溶 2.11%C；E 点也是钢与白口铸铁的分界。' },
      { k: 'F', x: 6.69, t: 1148, name: '共晶线右端', desc: '共晶线上 Fe₃C 一侧的成分点（6.69%C）。' },
      { k: 'G', x: 0, t: 912, name: 'A3 起点', desc: '912℃，纯铁发生 α→γ 同素异构转变的温度。' },
      { k: 'S', x: 0.77, t: 727, name: '共析点', desc: '727℃、0.77%C。共析反应 γ(0.77)→α(0.0218)+Fe₃C(6.69)，产物是珠光体。' },
      { k: 'P', x: 0.0218, t: 727, name: 'α 最大溶解度', desc: '铁素体在 727℃ 最多溶 0.0218%C。' },
      { k: 'K', x: 6.69, t: 727, name: '共析线右端', desc: '共析线上 Fe₃C 一侧的成分点。' },
      { k: 'Q', x: 0.0008, t: 20, name: '室温溶解度', desc: '室温时铁素体只含约 0.0008%C，多余碳以三次渗碳体析出。' },
      { k: 'M', x: 0, t: 770, name: 'A2 居里点', desc: '770℃，铁素体的磁性转变温度。注意：它不是相变！' }
    ],

    regions: [
      { id: 'L', label: 'L', sub: '液相', phases: ['L'], hint: '液相区：温度在液相线以上，合金完全熔化。' },
      { id: 'L+δ', label: 'L+δ', phases: ['L', 'δ'], lever: 'Lδ', hint: '液相 + 高温铁素体（δ）两相区，只在包晶温度以上很小一块。' },
      { id: 'δ', label: 'δ', phases: ['δ'], hint: 'δ 铁素体单相区（高温、极低碳）。' },
      { id: 'L+γ', label: 'L+γ', phases: ['L', 'γ'], lever: 'Lγ', hint: '液相 + 奥氏体两相区，是钢凝固时的主要两相区。' },
      { id: 'γ', label: 'γ', sub: '奥氏体', phases: ['γ'], hint: '奥氏体单相区（面心立方）。钢加热到 Ac3 以上就进入此区。' },
      { id: 'α+γ', label: 'α+γ', phases: ['α', 'γ'], lever: 'αγ', hint: '铁素体 + 奥氏体两相区。亚共析钢在 Ac1～Ac3 之间就处在这里。' },
      { id: 'α', label: 'α', sub: '铁素体', phases: ['α'], hint: '铁素体单相区（体心立方），溶碳极少，室温约 0.0008%。' },
      { id: 'L+Fe3C', label: 'L+Fe₃C', phases: ['L', 'Fe₃C'], lever: 'LFe3C', hint: '液相 + 渗碳体两相区（过共晶白口铸铁熔化时）。' },
      { id: 'γ+Fe3C', label: 'γ+Fe₃C', phases: ['γ', 'Fe₃C'], lever: 'γFe3C', hint: '奥氏体 + 渗碳体两相区，过共析钢加热到 Acm 以上、1148℃ 以下时进入。' },
      { id: 'α+Fe3C', label: 'α+Fe₃C', org: 1, phases: ['α', 'Fe₃C'], lever: 'αFe3C', hint: '727℃ 以下：相组成物是铁素体 + 渗碳体，但随含碳量不同，组织组成物完全不同。' }
    ],

    boundary: function (key, t) {
      var map = {
        AB: [[0, 1538], [0.53, 1495]],
        AH: [[0, 1538], [0.09, 1495]],
        BC: [[0.53, 1495], [4.30, 1148]],
        JE: [[0.17, 1495], [2.11, 1148]],
        CD: [[4.30, 1148], [6.69, 1250]],
        GP: [[0, 912], [0.0218, 727]],
        GS: [[0, 912], [0.77, 727]],
        ES: [[2.11, 1148], [0.77, 727]]
      };
      return compAtTemp(map[key], t);
    },

    _byId: function (id) {
      for (var i = 0; i < this.regions.length; i++) if (this.regions[i].id === id) return this.regions[i];
      return null;
    },

    /* 核心：给定成分与温度，返回相区 */
    regionAt: function (c, t) {
      if (c < 0) c = 0;
      if (c > E3 + 1e-9) c = E3;

      var AB = [[0, 1538], [0.53, 1495]];
      var AH = [[0, 1538], [0.09, 1495]];
      var BC = [[0.53, 1495], [4.30, 1148]];
      var JE = [[0.17, 1495], [2.11, 1148]];
      var CD = [[4.30, 1148], [6.69, 1250]];
      var GP = [[0, 912], [0.0218, 727]];
      var GS = [[0, 912], [0.77, 727]];
      var ES = [[2.11, 1148], [0.77, 727]];

      // ===== 727℃ 以下 =====
      if (t < T_EUTECTOID) {
        if (c <= 0.0008) return this._byId('α');
        if (c < TP) {
          var edge = compAtTemp([[0.0218, 727], [0.0008, 20]], t);
          if (edge != null && c <= edge) return this._byId('α');
        }
        return this._byId('α+Fe3C');
      }

      // ===== 1495℃ 以上：液相 / L+δ / δ =====
      if (t > T_PERI) {
        if (c === 0) return t < 1538 ? (this._byId('δ')) : this._byId('L');
        var tAB = compAtTempInv(AB, c);
        var tAH = compAtTempInv(AH, c);
        if (c < 0.53 && tAB != null) {
          if (t > tAB) return this._byId('L');
          if (c <= 0.09) {
            if (tAH != null && t <= tAH) return this._byId('δ');
            return this._byId('L+δ');
          }
          return this._byId('L+δ');
        }
        return this._byId('L');
      }

      // ===== 1148～1495℃ =====
      if (t > T_EUTEC) {
        if (c > 4.30) {
          var tCDtop = compAtTempInv(CD, c);
          return (tCDtop != null && t > tCDtop) ? this._byId('L') : this._byId('L+Fe3C');
        }
        if (c > 2.11) {
          var tBC0 = compAtTempInv(BC, c);
          return (tBC0 != null && t > tBC0) ? this._byId('L') : this._byId('L+γ');
        }
        if (c <= 0.17) return this._byId('γ');
        var tBC = compAtTempInv(BC, c);
        var tJE = compAtTempInv(JE, c);
        if (tBC != null && t > tBC) return this._byId('L');
        if (tJE != null && t < tJE) return this._byId('γ');
        return this._byId('L+γ');
      }

      // ===== 727～1148℃ =====
      if (c > 2.11) return this._byId('γ+Fe3C');

      if (c <= TP) {
        if (t >= 912) return this._byId('γ');
        return this._byId('α');
      }
      if (c <= TS) {
        // GS 线（A3）定义域 0～0.77；超出时用两端点线性外推
        var tGS, tGP;
        if (c <= 0.77) {
          tGS = compAtTempInv(GS, c);
          tGP = compAtTempInv(GP, c);
        } else {
          tGS = 912 + (727 - 912) * (c - 0) / 0.77;
          tGP = null;
        }
        if (tGS != null && t >= tGS) return this._byId('γ');
        if (tGP != null && t >= tGP) return this._byId('α+γ');
        if (t > 727) return this._byId('α+γ');
        return this._byId('α+Fe3C');
      }
      // 0.77～2.11
      if (c <= TE) {
        var tES = compAtTempInv(ES, c);
        if (tES != null) return t >= tES ? this._byId('γ') : this._byId('γ+Fe3C');
        return this._byId('γ+Fe3C');
      }
      // 2.11～6.69：727～1148 全为 γ+Fe₃C（含莱氏体区）
      return this._byId('γ+Fe3C');
    },
    /* 杠杆定律 */
    lever: function (regionId, t, c) {
      var pair = null;
      if (regionId === 'L+δ') pair = { ln: 'L', rn: 'δ', lx: this.boundary('AB', t), rx: this.boundary('AH', t) };
      else if (regionId === 'L+γ') pair = { ln: 'L', rn: 'γ', lx: this.boundary('BC', t), rx: this.boundary('JE', t) };
      else if (regionId === 'α+γ') pair = { ln: 'α', rn: 'γ', lx: this.boundary('GP', t), rx: this.boundary('GS', t) };
      else if (regionId === 'γ+Fe3C') pair = { ln: 'γ', rn: 'Fe₃C', lx: this.boundary('ES', t), rx: 6.69 };
      else if (regionId === 'L+Fe3C') pair = { ln: 'L', rn: 'Fe₃C', lx: this.boundary('CD', t), rx: 6.69 };
      else if (t < T_EUTECTOID) pair = { ln: 'α', rn: 'Fe₃C', lx: 0.0008, rx: 6.69 };
      if (!pair || pair.lx == null || pair.rx == null) return null;
      var span = pair.rx - pair.lx;
      if (span <= 1e-9) return { left: { name: pair.ln, x: pair.lx, pct: 100 }, right: { name: pair.rn, x: pair.rx, pct: 0 } };
      var pR = clamp((c - pair.lx) / span, 0, 1) * 100;
      return {
        left: { name: pair.ln, x: pair.lx, pct: round(100 - pR, 1) },
        right: { name: pair.rn, x: pair.rx, pct: round(pR, 1) }
      };
    },

    alloyType: function (c) {
      if (c < TP) return { name: '工业纯铁', tag: 'pure', org: '铁素体 + 三次渗碳体（极少）' };
      if (c < TS - 0.005) return { name: '亚共析钢', tag: 'hypo', org: '铁素体 + 珠光体' };
      if (Math.abs(c - TS) <= 0.005) return { name: '共析钢', tag: 'eutectoid', org: '珠光体（100%）' };
      if (c < TE) return { name: '过共析钢', tag: 'hyper', org: '珠光体 + 二次渗碳体' };
      if (Math.abs(c - TC) <= 0.01) return { name: '共晶白口铸铁', tag: 'eutecticCI', org: '莱氏体（100%）' };
      if (c < TC) return { name: '亚共晶白口铸铁', tag: 'hypoCI', org: '珠光体 + 二次渗碳体 + 莱氏体' };
      return { name: '过共晶白口铸铁', tag: 'hyperCI', org: '莱氏体 + 一次渗碳体' };
    },

    /* 室温组织组成物（质量分数 %） */
    structureAt: function (c) {
      var out = [];
      function push(n, p) { out.push({ name: n, pct: round(clamp(p, 0, 100), 1) }); }
      if (c < TP) {
        push('铁素体', 100 * (E3 - c) / (E3 - 0.0008));
        push('三次渗碳体', 100 * (c - 0.0008) / (E3 - 0.0008));
      } else if (c < TS - 0.005) {
        var p = 100 * (c - TP) / (TS - TP);
        push('珠光体', p); push('铁素体', 100 - p);
      } else if (c <= TS + 0.005) {
        push('珠光体', 100);
      } else if (c < TE) {
        var p2 = 100 * (E3 - c) / (E3 - TS);
        push('珠光体', p2); push('二次渗碳体', 100 - p2);
      } else if (c < TC) {
        var a = (TC - c) / (TC - TE);                 // 共晶温度时的奥氏体量
        push('珠光体', 100 * a * (1 - 0.226));          // 奥氏体→珠光体，其中约22.6%为二次渗碳体
        push('二次渗碳体', 100 * a * 0.226);
        push('莱氏体', 100 * (1 - a));
      } else if (c <= TC + 0.01) {
        push('莱氏体', 100);
      } else {
        var t = (c - TC) / (E3 - TC);
        push('一次渗碳体', 100 * t); push('莱氏体', 100 * (1 - t));
      }
      return out;
    },

    /* 相组成物（质量分数 %） */
    phasesAt: function (c, t) {
      function two(a, b, x) {
        x = clamp(x, 0, 1);
        return [{ name: a, pct: round((1 - x) * 100, 1) }, { name: b, pct: round(x * 100, 1) }];
      }
      if (t > 1495 && t <= 1538 && c <= 0.53) {
        var l1 = this.boundary('AB', t), d1 = this.boundary('AH', t);
        if (l1 != null && d1 != null && l1 > d1 && c >= d1 && c <= l1) return two('液相', 'δ', (c - d1) / (l1 - d1));
      }
      if (t > 1148 && t <= 1495 && c >= 0.17 && c <= 2.11) {
        var l2 = this.boundary('BC', t), g2 = this.boundary('JE', t);
        if (l2 != null && g2 != null && l2 > g2 && c >= g2 && c <= l2) return two('液相', 'γ', (c - g2) / (l2 - g2));
      }
      if (t > 1148 && t <= 1250 && c >= 4.30) {
        var l3 = this.boundary('CD', t);
        if (l3 != null && l3 > 4.30 && c <= l3) return two('液相', 'Fe₃C', (c - 4.30) / (l3 - 4.30));
      }
      if (t > 727 && t <= 912 && c >= TP && c <= TS) {
        var a1 = this.boundary('GP', t), g1 = this.boundary('GS', t);
        if (a1 != null && g1 != null && g1 > a1 && c >= a1 && c <= g1) return two('α', 'γ', (c - a1) / (g1 - a1));
      }
      if (t > 727 && t <= 1148 && c >= TS && c <= E3) {
        var g3 = this.boundary('ES', t);
        if (g3 != null && c >= g3) return two('γ', 'Fe₃C', (c - g3) / (E3 - g3));
      }
      if (c <= 0.0008) return [{ name: 'α', pct: 100 }];
      return two('α', 'Fe₃C', (c - 0.0008) / (E3 - 0.0008));
    },

    /* 冷却关键点 */
    cooling: function (c) {
      var at = this.alloyType(c);
      var steps = [];
      var tL = null, tS = null;

      if (c > 4.30) {
        tL = compAtTempInv([[4.30, 1148], [6.69, 1250]], c);
        tS = 1148;
      } else if (c > 0.53) {
        tL = compAtTempInv([[0.53, 1495], [4.30, 1148]], c);
        tS = c <= 2.11 ? compAtTempInv([[0.17, 1495], [2.11, 1148]], c) : 1148;
      } else if (c > 0.09) {
        // 先经 L+δ，1495℃ 包晶后进入 L+γ
        tL = compAtTempInv([[0, 1538], [0.53, 1495]], c);
        tS = compAtTempInv([[0.17, 1495], [2.11, 1148]], c);
      } else {
        tL = c === 0 ? 1538 : compAtTempInv([[0, 1538], [0.53, 1495]], c);
        tS = compAtTempInv([[0, 1538], [0.09, 1495]], c);
      }

      steps.push({ t: 1600, title: '全部为液相', text: '合金完全熔化，为均匀液相 L。' });
      if (tL != null) steps.push({ t: round(tL, 0), title: '到达液相线', text: c > 2.11 ? '开始结晶，析出初生相（γ 或 Fe₃C）。' : '开始结晶，析出初生相 γ（或 δ）。' });
      if (c > 0.09 && c <= 0.53) steps.push({ t: 1495, title: '包晶温度 1495℃', text: '发生包晶反应 L+δ→γ；0.17%C 以上的合金凝固后得到单相 γ。' });

      if (c > 2.11) {
        // 含碳量超过 E 点：共晶线就是凝固终点，只保留一条说明，避免与"到达固相线"重复
        steps.push({
          t: 1148,
          title: '到达共晶线',
          text: c < 4.30
            ? '先析出初生 γ（成分沿 JE 线变化），到 1148℃ 剩余液相发生共晶反应 L→γ+Fe₃C，得到莱氏体。'
            : '先析出初生 Fe₃C（成分沿 CD 线变化），到 1148℃ 剩余液相发生共晶反应 L→γ+Fe₃C，得到莱氏体。'
        });
      } else if (tS != null && tS !== tL) {
        steps.push({
          t: round(tS, 0),
          title: '到达固相线',
          text: c < 0.09 ? '结晶结束，全部转变为 δ 铁素体。' : '结晶结束，全部转变为单相 γ（奥氏体）。'
        });
      }

      if (c >= 0.77 && c <= 2.11) steps.push({ t: 1148, title: 'Acm 线之下', text: '沿 Acm 线析出二次渗碳体 Fe₃C_II，随温度降低析出量增加。' });
      if (c >= 0.77 && c <= 2.11) steps.push({ t: 1148, title: 'Acm 线之下', text: '沿 Acm 线析出二次渗碳体 Fe₃C_II，随温度降低析出量增加。' });
      steps.push({ t: 727, title: '共析线 A1', text: c <= 2.11 ? '奥氏体发生共析转变 γ→α+Fe₃C，形成珠光体。' : '莱氏体中的奥氏体在 727℃ 发生共析，转变为珠光体。' });
      steps.push({ t: 20, title: '室温', text: '室温组织：' + at.org + '。' });
      return { type: at, steps: steps, tL: tL, tS: tS };
    }
  };

  /* ============================================================
     二、二元相图（匀晶 / 共晶 / 包晶）
     ============================================================ */
  var BINARIES = {
    'Cu-Ni': {
      title: 'Cu-Ni 匀晶相图', kind: 'isomorphous',
      A: 'Cu', B: 'Ni', xLabel: 'Ni 质量分数 / %',
      liquidus: [[0, 1083], [25, 1188], [50, 1269], [75, 1352], [100, 1455]],
      solidus: [[0, 1083], [25, 1125], [50, 1190], [75, 1295], [100, 1455]],
      note: '两组元液态、固态都无限互溶，没有共晶或包晶反应。凝固在一个温度区间内完成：先结晶出的固相成分沿固相线变化，液相成分沿液相线变化；冷速较慢、扩散充分时，最终得到成分均匀的 α 固溶体。'
    },
    'Pb-Sn': {
      title: 'Pb-Sn 共晶相图', kind: 'eutectic',
      A: 'Pb', B: 'Sn', xLabel: 'Sn 质量分数 / %',
      eutectic: { x: 61.9, t: 183 },
      liquidus: [[0, 327], [61.9, 183], [100, 232]],
      solidusA: [[0, 327], [19.2, 183]],
      solidusB: [[97.5, 183], [100, 232]],
      solvusA: [[19.2, 183], [2, 20]],
      solvusB: [[97.5, 183], [99.5, 20]],
      note: '两组元液态无限互溶、固态有限互溶，存在共晶反应 L→α+β。共晶成分合金在 183℃ 恒温结晶，得到细密 α+β 混合物；其他成分先析出初生相，再在共晶温度发生共晶反应。'
    },
    'Pt-Ag': {
      title: 'Pt-Ag 包晶相图', kind: 'peritectic',
      A: 'Pt', B: 'Ag', xLabel: 'Ag 质量分数 / %',
      peritectic: { xL: 11.5, xS: 10.5, t: 1186 },
      liquidus: [[0, 1772], [11.5, 1186], [100, 962]],
      solidusA: [[0, 1772], [10.5, 1186]],
      solidusB: [[10.5, 1186], [100, 962]],
      solvusA: [[10.5, 1186], [1.5, 20]],
      solvusB: [[100, 962], [97, 20]],
      note: '液态无限互溶、固态有限互溶，存在包晶反应 L+α→β。包晶反应是「液相 + 一种固相 → 另一种固相」，新相 β 把旧相 α 包围起来长大。'
    }
  };

  function twoPhase(out, ln, rn, lx, rx, x) {
    if (lx == null || rx == null || Math.abs(lx - rx) < 1e-9) { out.region = ln + '+' + rn; return out; }
    var lo = Math.min(lx, rx), hi = Math.max(lx, rx);
    if (x < lo - 1e-9 || x > hi + 1e-9) { out.region = ln + '+' + rn; return out; }
    var pR = clamp((x - lx) / (rx - lx), 0, 1) * 100;
    out.region = ln + '+' + rn;
    out.phases = [{ name: ln, x: round(lx, 1), pct: round(100 - pR, 1) }, { name: rn, x: round(rx, 1), pct: round(pR, 1) }];
    return out;
  }

  function readBinary(key, x, t) {
    var d = BINARIES[key], out = { key: key, x: x, t: t, phases: [], region: '', note: d.note };

    if (d.kind === 'isomorphous') {
      var tl = compAtTempInv(d.liquidus, x), ts = compAtTempInv(d.solidus, x);
      if (tl == null || ts == null) { out.region = 'L'; out.phases = [{ name: 'L', pct: 100 }]; return out; }
      if (t > tl) { out.region = 'L'; out.phases = [{ name: 'L', pct: 100 }]; return out; }
      if (t < ts) { out.region = 'α'; out.phases = [{ name: 'α', pct: 100 }]; return out; }
      return twoPhase(out, 'L', 'α', compAtTemp(d.liquidus, t), compAtTemp(d.solidus, t), x);
    }

    var inv = d.eutectic ? d.eutectic.t : d.peritectic.t;
    var tLiqAtX = compAtTempInv(d.liquidus, x);
    if (tLiqAtX == null || t > tLiqAtX) { out.region = 'L'; out.phases = [{ name: 'L', pct: 100 }]; return out; }

    if (t > inv) {
      var xsA = compAtTemp(d.solidusA, t);
      var xsB = compAtTemp(d.solidusB, t);
      if (d.kind === 'eutectic') {
        if (xsA != null && x <= xsA) { out.region = 'α'; out.phases = [{ name: 'α', pct: 100 }]; return out; }
        if (xsB != null && x >= xsB) { out.region = 'β'; out.phases = [{ name: 'β', pct: 100 }]; return out; }
        if (x < d.eutectic.x) return twoPhase(out, 'L', 'α', compAtTemp(d.liquidus, t), xsA, x);
        return twoPhase(out, 'L', 'β', compAtTemp(d.liquidus, t), xsB, x);
      }
      // 包晶
      if (x <= d.peritectic.xS) {
        if (xsA != null && x <= xsA) { out.region = 'α'; out.phases = [{ name: 'α', pct: 100 }]; return out; }
        return twoPhase(out, 'L', 'α', compAtTemp(d.liquidus, t), xsA, x);
      }
      if (xsB != null && x >= xsB) { out.region = 'β'; out.phases = [{ name: 'β', pct: 100 }]; return out; }
      return twoPhase(out, 'L', 'β', compAtTemp(d.liquidus, t), xsB, x);
    }

    // 恒温线以下
    if (d.kind === 'eutectic') {
      var solA = compAtTemp(d.solvusA, t);
      var solB = compAtTemp(d.solvusB, t);
      if (solA == null) solA = 2;
      if (solB == null) solB = 99.5;
      if (x <= solA) { out.region = 'α'; out.phases = [{ name: 'α', pct: 100 }]; return out; }
      if (x >= solB) { out.region = 'β'; out.phases = [{ name: 'β', pct: 100 }]; return out; }
      return twoPhase(out, 'α', 'β', solA, solB, x);
    }
    var aS = compAtTemp(d.solvusA, t), bS = compAtTemp(d.solvusB, t);
    if (aS == null) aS = 1.5;
    if (bS == null) bS = 99;
    if (x <= aS) { out.region = 'α'; out.phases = [{ name: 'α', pct: 100 }]; return out; }
    if (x >= bS) { out.region = 'β'; out.phases = [{ name: 'β', pct: 100 }]; return out; }
    return twoPhase(out, 'α', 'β', aS, bS, x);
  }

  /* ============================================================
     三、三元成分三角形
     ============================================================ */
  var TERNARY = {
    vertices: { A: [300, 40], B: [46, 470], C: [554, 470] },
    toXY: function (a, b, c, V) {
      V = V || this.vertices;
      return [a / 100 * V.A[0] + b / 100 * V.B[0] + c / 100 * V.C[0],
              a / 100 * V.A[1] + b / 100 * V.B[1] + c / 100 * V.C[1]];
    },
    fromXY: function (px, py, V) {
      V = V || this.vertices;
      var x1 = V.A[0], y1 = V.A[1], x2 = V.B[0], y2 = V.B[1], x3 = V.C[0], y3 = V.C[1];
      var det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      var l1 = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / det;
      var l2 = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / det;
      var l3 = 1 - l1 - l2;
      return { A: round(l1 * 100, 1), B: round(l2 * 100, 1), C: round(l3 * 100, 1) };
    },
    // 过点 P 作三条分别平行于三边的线，标出读数
    readLines: function (a, b, c, V) {
      V = V || this.vertices;
      function seg(p, d, s1, s2) {
        // 直线 p+t*d 与线段 s1-s2 的交点
        var d1 = d[0], d2 = d[1];
        var q1 = s1, q2 = s2;
        var den = d1 * (q2[1] - q1[1]) - d2 * (q2[0] - q1[0]);
        if (Math.abs(den) < 1e-9) return null;
        var tt = ((q1[0] - p[0]) * (q2[1] - q1[1]) - (q1[1] - p[1]) * (q2[0] - q1[0])) / den;
        return [p[0] + tt * d1, p[1] + tt * d2];
      }
      var p = this.toXY(a, b, c, V);
      var dBC = [V.C[0] - V.B[0], V.C[1] - V.B[1]];   // 平行 BC → 读 A
      var dAC = [V.C[0] - V.A[0], V.C[1] - V.A[1]];   // 平行 AC → 读 B
      var dAB = [V.B[0] - V.A[0], V.B[1] - V.A[1]];   // 平行 AB → 读 C
      return {
        A: [seg(p, dBC, V.A, V.B), seg(p, dBC, V.A, V.C)],
        B: [seg(p, dAC, V.A, V.B), seg(p, dAC, V.B, V.C)],
        C: [seg(p, dAB, V.A, V.C), seg(p, dAB, V.B, V.C)]
      };
    },
    projection: {
      e1: [42, 62], e2: [58, 62], e3: [50, 92], E: [50, 68],
      note: '三条共晶线 e₁E、e₂E、e₃E 把液相面分成三块：A 初晶区、B 初晶区、C 初晶区。E 点是三元共晶点，成分落在 E 的合金冷却到 Te 时发生 L→A+B+C 三元共晶反应，得到三种固相的细密混合物。'
    }
  };

  return {
    FE_C: FE_C, BINARIES: BINARIES, TERNARY: TERNARY,
    compAtTemp: compAtTemp, compAtTempInv: compAtTempInv, inPoly: inPoly,
    clamp: clamp, round: round, samplePoly: samplePoly, readBinary: readBinary
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PHASE;
