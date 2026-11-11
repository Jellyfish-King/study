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
  let id = 0; const pend = {};
  ws.on(s => { const m = JSON.parse(s); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } });
  const cmd = (m, p) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : JSON.stringify(r.result); };
  await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 900));

  await ev(`(function(){
    var c = document.getElementById('fecC');
    c.value = 2.5; c.dispatchEvent(new Event('input', {bubbles:true}));
    var t = document.getElementById('fecT');
    t.value = 1200; t.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await new Promise(r => setTimeout(r, 300));
  console.log('2.5%C 冷却步骤：');
  console.log(await ev(`(function(){
    var a = [];
    document.querySelectorAll('#fecCoolSteps .cool-step h3').forEach(function(h){ a.push(h.textContent); });
    return a.join(' / ');
  })()`));
  console.log('相区：', await ev(`document.getElementById('fecRegion').textContent + ' | ' + document.getElementById('fecCoord').textContent`));
  ws.close(); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
