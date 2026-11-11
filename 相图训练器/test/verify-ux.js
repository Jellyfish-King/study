const fs = require('fs');
const net = require('net'), http = require('http'), crypto = require('crypto');
function getJSON(u) { return new Promise((r, j) => http.get(u, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => r(JSON.parse(d))); }).on('error', j)); }
class WS {
  constructor(s) { this.s = s; this.b = Buffer.alloc(0); this.h = []; s.on('data', c => this.f(c)); }
  f(c) { this.b = Buffer.concat([this.b, c]); for (; ;) { if (this.b.length < 2) return; const b1 = this.b[0], b2 = this.b[1]; let l = b2 & 0x7f, o = 2; if (l === 126) { if (this.b.length < 4) return; l = this.b.readUInt16BE(2); o = 4; } else if (l === 127) { if (this.b.length < 10) return; l = Number(this.b.readBigUInt64BE(2)); o = 10; } if (this.b.length < o + l) return; const p = this.b.slice(o, o + l); this.b = this.b.slice(o + l); if ((b1 & 0x0f) === 1) this.h.forEach(fn => fn(p.toString('utf8'))); } }
  send(t) { const p = Buffer.from(t, 'utf8'), m = crypto.randomBytes(4); let h; if (p.length < 126) h = Buffer.from([0x81, 0x80 | p.length]); else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(p.length, 2); } else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(p.length), 2); } const x = Buffer.alloc(p.length); for (let i = 0; i < p.length; i++) x[i] = p[i] ^ m[i % 4]; this.s.write(Buffer.concat([h, m, x])); }
  on(fn) { this.h.push(fn); } close() { this.s.end(); }
}
function conn(u0) { return new Promise((res, rej) => { const u = new URL(u0); const s = net.connect(+u.port, u.hostname); s.once('error', rej); s.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n'); let b = Buffer.alloc(0); const od = c => { b = Buffer.concat([b, c]); const i = b.indexOf('\r\n\r\n'); if (i < 0) return; s.removeListener('data', od); res(new WS(s)); }; s.on('data', od); }); }

(async () => {
  const list = await getJSON('http://127.0.0.1:9333/json');
  const page = list.find(t => t.type === 'page');
  const ws = await conn(page.webSocketDebuggerUrl);
  let id = 0; const pend = {}; const errs = [];
  ws.on(s => {
    const m = JSON.parse(s);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    else if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
  });
  const cmd = (m, p) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result); };
  const shot = async (name) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('相图训练器/test/' + name, Buffer.from(r.result.data, 'base64')); };

  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 900));

  // 1. 滑杆联动
  console.log('滑杆前', await ev("document.getElementById('fecCoord').textContent"));
  console.log('拖温度滑杆', await ev(`(function(){
    var el = document.getElementById('fecT');
    el.value = 1200;
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return document.getElementById('fecCoord').textContent + ' | ' + document.getElementById('fecTVal').textContent;
  })()`));
  console.log('拖含碳滑杆', await ev(`(function(){
    var el = document.getElementById('fecC');
    el.value = 2.5;
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return document.getElementById('fecCoord').textContent + ' | ' + document.getElementById('fecRegion').textContent;
  })()`));

  // 2. 滚动进度条
  await ev("window.scrollTo(0, document.scrollingElement.scrollHeight * 0.5)");
  await new Promise(r => setTimeout(r, 300));
  console.log('滚动后', await ev("JSON.stringify({y: window.scrollY, fill: document.getElementById('scrollFill').style.width})"));
  await shot('v-scrolled.png');

  // 3. 跳转按钮
  await ev("window.scrollTo(0,0)");
  await new Promise(r => setTimeout(r, 200));
  console.log('点跳转前 y=', await ev('window.scrollY'));
  await ev("document.getElementById('fecJump').click()");
  await new Promise(r => setTimeout(r, 900));
  console.log('点跳转后 y=', await ev('window.scrollY'));

  // 4. 刷题总数
  await ev("document.querySelector('[data-tab=\"quiz\"]').click()");
  await new Promise(r => setTimeout(r, 400));
  console.log('刷题头', await ev("document.getElementById('quizScore').textContent + ' | bar=' + document.getElementById('quizBar').style.width"));

  console.log('ERRORS', JSON.stringify(errs.slice(0, 4)));
  ws.close(); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
