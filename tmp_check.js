const fs=require('fs');
const {compileAsm}=require('./web/ui/asmCompiler.js');
const src=fs.readFileSync('tmp_user.asm','utf8');
const r=compileAsm(src);
console.log('ok',r.ok,'diag',r.diagnostics.length,'pc lines',r.pcToLine.length,'bytes',r.bytes.length);
console.log(r.diagnostics.filter(d=>d.level==='error').slice(0,5));
console.log('first pc lines',r.pcToLine.slice(0,5));
console.log('last pc lines',r.pcToLine.slice(-5));
console.log('hex first lines',r.hex.split(/\n/).slice(0,8));
