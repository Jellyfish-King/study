/* 把 src/ 打包成一个可离线打开的单文件 HTML */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = path.join(root, 'src');
const out = path.join(path.dirname(root), '材料科学基础-相图训练器.html');

const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const js = ['core.js', 'questions.js', 'app.js'].map(f => fs.readFileSync(path.join(src, f), 'utf8'));

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

// 关键：String.replace 的替换串中 $$ 会被转义成 $，
// 代码里恰好有 $$ 选择器，所以必须用函数形式返回替换内容。
html = html.replace('<link rel="stylesheet" href="src/style.css">', () => '<style>\n' + css + '\n</style>');
html = html.replace('<script src="src/core.js"></script>', () => '<script>\n' + js[0] + '\n</script>');
html = html.replace('<script src="src/questions.js"></script>', () => '<script>\n' + js[1] + '\n</script>');
html = html.replace('<script src="src/app.js"></script>', () => '<script>\n' + js[2] + '\n</script>');

if (html.includes('src/style.css') || html.includes('src/app.js')) {
  throw new Error('内联失败：仍有外部引用');
}
if (!html.includes('var $$ = function')) {
  throw new Error('内联失败：$$ 选择器被替换损坏');
}

fs.writeFileSync(out, html, 'utf8');
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log('已生成：' + out);
console.log('大小：' + kb + ' KB');
console.log('包含：CSS ' + css.length + ' 字符，JS ' + js.reduce((a, b) => a + b.length, 0) + ' 字符');
