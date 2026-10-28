import {cp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('public','dist',{recursive:true});
// Self-contained entry supports viewers that only receive one HTML file.
let html=await readFile('public/index.html','utf8');
const css=await readFile('public/style.css','utf8');
const core=(await readFile('public/core.js','utf8')).replace(/\bexport /g,'');
const app=(await readFile('public/app.js','utf8')).replace(/^import .*?;\n/,'');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`)
.replace('<script type="module" src="./app.js"></script>',()=>`<script type="module">\n${core}\n${app}\n</script>`);
await writeFile('dist/index.html',html);await writeFile('index.html',html);await writeFile('quiet-evening-v1.5.0.html',html);
console.log('Built dist and standalone index.html');
