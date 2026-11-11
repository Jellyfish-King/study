const P = require('../src/core.js');
const F = P.FE_C;
let fails = 0;
function eq(name, got, want, tol) {
  tol = tol == null ? 0.6 : tol;
  const ok = (typeof want === 'number') ? Math.abs(got - want) <= tol : String(got) === String(want);
  if (!ok) { fails++; console.log('FAIL', name, '=> got', JSON.stringify(got), 'want', JSON.stringify(want)); }
}
function reg(c, t) { const r = F.regionAt(c, t); return r ? r.id : null; }
const ph = (c, t, n) => (F.phasesAt(c, t).find(o => o.name === n) || { pct: 0 }).pct;
const st = (c, n) => (F.structureAt(c).find(o => o.name === n) || { pct: 0 }).pct;

console.log('--- 相区 ---');
// 期望值按 Fe-Fe3C 关键线（直线段）手算，不使用被测函数
for (const [c, t, want] of [
  [0.45, 950, 'γ'], [0.45, 780, 'α+γ'], [0.45, 600, 'α+Fe3C'], [0.45, 850, 'γ'],
  [1.2, 950, 'γ'], [1.2, 880, 'γ'], [1.2, 800, 'γ+Fe3C'], [1.2, 600, 'α+Fe3C'],
  [3.0, 1300, 'L'], [3.0, 1250, 'L+γ'], [3.0, 900, 'γ+Fe3C'],
  [5.0, 1200, 'L'], [5.0, 1170, 'L+Fe3C'], [5.0, 900, 'γ+Fe3C'],
  [0.05, 1500, 'δ'], [0.3, 1505, 'L+δ'], [0.2, 1500, 'L+δ'], [0.1, 1500, 'L+δ'],
  [0.3, 1490, 'L+γ'], [4.3, 900, 'γ+Fe3C'], [4.3, 1300, 'L'], [4.3, 1200, 'L'],
  [2.11, 1300, 'L+γ'], [6.0, 1300, 'L'], [6.0, 1200, 'L+Fe3C'],
  [6.5, 1240, 'L+Fe3C'], [6.5, 1260, 'L'],
  [0.02, 500, 'α+Fe3C'], [0.005, 300, 'α'],
  [1.5, 1000, 'γ'], [0.9, 800, 'γ'], [0.9, 700, 'α+Fe3C'],
  [0.77, 750, 'γ'], [0.77, 700, 'α+Fe3C'],
  [0, 1000, 'γ'], [0, 950, 'γ'], [0, 800, 'α'],
  [2.0, 800, 'γ+Fe3C'], [0.5, 1550, 'L'],
  [2.5, 1160, 'L+γ'], [3.5, 1100, 'γ+Fe3C'], [2.5, 1200, 'L+γ']
]) eq(c + '% ' + t + '℃', reg(c, t), want);

console.log('--- 分类 ---');
for (const [c, n] of [[0.01,'工业纯铁'],[0.45,'亚共析钢'],[0.77,'共析钢'],[1.2,'过共析钢'],[3.0,'亚共晶白口铸铁'],[4.3,'共晶白口铸铁'],[5.5,'过共晶白口铸铁']])
  eq('分类 ' + c + '%', F.alloyType(c).name, n);

console.log('--- 相组成物 ---');
eq('0.45%C Fe3C%', ph(0.45, 20, 'Fe₃C'), 0.45 * 100 / 6.69, 0.2);
eq('0.77%C Fe3C%', ph(0.77, 20, 'Fe₃C'), 0.77 * 100 / 6.69, 0.2);
eq('3.0%C Fe3C%', ph(3.0, 20, 'Fe₃C'), 3.0 * 100 / 6.69, 0.2);
const g800 = F.boundary('ES', 800);
eq('1.2%C 800℃ γ%', ph(1.2, 800, 'γ'), 100 * (6.69 - 1.2) / (6.69 - g800), 0.6);
const gs780 = F.boundary('GS', 780), gp780 = F.boundary('GP', 780);
eq('0.45%C 780℃ α%', ph(0.45, 780, 'α'), 100 * (gs780 - 0.45) / (gs780 - gp780), 1.0);

console.log('--- 组织组成物 ---');
eq('0.45%C 珠光体%', st(0.45, '珠光体'), 100 * (0.45 - 0.0218) / (0.77 - 0.0218), 0.2);
eq('0.45%C 铁素体%', st(0.45, '铁素体'), 100 - 100 * (0.45 - 0.0218) / (0.77 - 0.0218), 0.2);
eq('0.77%C 珠光体%', st(0.77, '珠光体'), 100, 0.2);
eq('1.2%C 珠光体%', st(1.2, '珠光体'), 100 * (6.69 - 1.2) / (6.69 - 0.77), 0.2);
eq('1.2%C 二次渗碳体%', st(1.2, '二次渗碳体'), 100 * (1.2 - 0.77) / (6.69 - 0.77), 0.2);
eq('3.0%C 莱氏体%', st(3.0, '莱氏体'), 100 * (1 - (4.3 - 3.0) / (4.3 - 2.11)), 0.2);
eq('3.0%C 珠光体%', st(3.0, '珠光体'), 100 * ((4.3 - 3.0) / (4.3 - 2.11)) * 0.774, 0.2);
eq('4.3%C 莱氏体%', st(4.3, '莱氏体'), 100, 0.2);
eq('5.5%C 一次渗碳体%', st(5.5, '一次渗碳体'), 100 * (5.5 - 4.3) / (6.69 - 4.3), 0.2);
eq('0.02%C 三次渗碳体%', st(0.02, '三次渗碳体'), 100 * (0.02 - 0.0008) / (6.69 - 0.0008), 0.2);

for (const c of [0.01, 0.3, 0.45, 0.77, 1.2, 1.8, 2.5, 3.0, 4.3, 5.0, 6.0]) {
  eq('组织合计 ' + c, Math.round(F.structureAt(c).reduce((a, b) => a + b.pct, 0)), 100, 0.5);
  eq('相合计 ' + c, Math.round(F.phasesAt(c, 20).reduce((a, b) => a + b.pct, 0)), 100, 0.5);
}

console.log('--- 杠杆 ---');
let lv = F.lever('α+γ', 780, 0.45);
eq('α+γ 780 α%', lv.left.pct, 100 * (gs780 - 0.45) / (gs780 - gp780), 0.3);
eq('α+γ 780 γ%', lv.right.pct, 100 * (0.45 - gp780) / (gs780 - gp780), 0.3);
lv = F.lever('γ+Fe3C', 1000, 1.2);
eq('γ+Fe3C 相名', lv.left.name + '/' + lv.right.name, 'γ/Fe₃C');
const gx = F.boundary('ES', 1000);
eq('Acm 1000℃', Math.round(gx * 10) / 10, 1.6, 0.1);
eq('γ+Fe3C 1000 γ%', Math.min(100, lv.left.pct), 100, 0.3);
lv = F.lever('L+γ', 1300, 1.0);
eq('L+γ 1300 左相', lv.left.name, 'L');
eq('L+γ 1300 合计', Math.round(lv.left.pct + lv.right.pct), 100, 0.2);
lv = F.lever('αFe3C', 20, 0.45);
eq('727以下 α%', lv.left.pct, 100 * (6.69 - 0.45) / (6.69 - 0.0008), 0.3);

console.log('--- 冷却 ---');
for (const c of [0.45, 0.77, 1.2, 3.0, 4.3, 5.5, 0.05]) {
  const cool = F.cooling(c);
  if (!cool.tL) fails++;
  console.log('  ', c + '%', cool.type.name, 'tL=' + (cool.tL && Math.round(cool.tL)), 'tS=' + (cool.tS && Math.round(cool.tS)), 'steps=' + cool.steps.length);
}

console.log('--- 二元 ---');
function bin(k, x, t) { return P.readBinary(k, x, t).region; }
eq('Cu-Ni 50 1300', bin('Cu-Ni', 50, 1300), 'L');
eq('Cu-Ni 50 1250', bin('Cu-Ni', 50, 1250), 'L+α');
eq('Cu-Ni 50 1100', bin('Cu-Ni', 50, 1100), 'α');
eq('Pb-Sn 40 250', bin('Pb-Sn', 40, 250), 'L');
eq('Pb-Sn 40 200', bin('Pb-Sn', 40, 200), 'L+α');
eq('Pb-Sn 40 100', bin('Pb-Sn', 40, 100), 'α+β');
eq('Pb-Sn 10 100', bin('Pb-Sn', 10, 100), 'α');
eq('Pb-Sn 90 100', bin('Pb-Sn', 90, 100), 'α+β');
eq('Pb-Sn 99 100', bin('Pb-Sn', 99, 100), 'β');
eq('Pb-Sn 61.9 200', bin('Pb-Sn', 61.9, 200), 'L');
eq('Pb-Sn 70 190', bin('Pb-Sn', 70, 190), 'L+β');
eq('Pt-Ag 5 1300', bin('Pt-Ag', 5, 1300), 'α');
eq('Pt-Ag 7 1400', bin('Pt-Ag', 7, 1400), 'L+α');
eq('Pt-Ag 5 1400', bin('Pt-Ag', 5, 1400), 'α');
eq('Pt-Ag 5 1000', bin('Pt-Ag', 5, 1000), 'α');
eq('Pt-Ag 40 800', bin('Pt-Ag', 40, 800), 'α+β');
eq('Pt-Ag 99 800', bin('Pt-Ag', 99, 800), 'α+β');
eq('Pt-Ag 50 600', bin('Pt-Ag', 50, 600), 'α+β');

console.log('--- 三元 ---');
const bary = P.TERNARY.fromXY.apply(P.TERNARY, P.TERNARY.toXY(20, 30, 50));
eq('三元 A', bary.A, 20, 0.2);
eq('三元 B', bary.B, 30, 0.2);
eq('三元 C', bary.C, 50, 0.2);
for (const [a, b, c] of [[33, 33, 34], [80, 10, 10], [10, 80, 10], [10, 10, 80], [1, 1, 98]]) {
  const x = P.TERNARY.toXY(a, b, c);
  const back = P.TERNARY.fromXY(x[0], x[1]);
  eq('往返 ' + a + '/' + b + '/' + c, Math.abs(back.A - a) + Math.abs(back.B - b) + Math.abs(back.C - c) < 0.6, true);
}
// 三条读数辅助线端点应落在三角形边上
const lines = P.TERNARY.readLines(20, 30, 50);
for (const k of ['A', 'B', 'C']) eq('辅助线 ' + k, !!(lines[k][0] && lines[k][1]), true);

console.log('\n' + (fails ? '❌ ' + fails + ' 处失败' : '✅ 全部通过'));
process.exit(fails ? 1 : 0);
