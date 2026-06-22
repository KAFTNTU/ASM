import{File as e,OpenFile as t,PreopenDirectory as n,WASI as r}from"https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/+esm";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var i=class{constructor(){Object.defineProperty(this,`devices`,{enumerable:!0,configurable:!0,writable:!0,value:new Map}),Object.defineProperty(this,`readProviders`,{enumerable:!0,configurable:!0,writable:!0,value:[]})}registerDevice(e,t){this.devices.set(e&255,t)}registerReadProvider(e){this.readProviders.push(e)}write(e,t){this.devices.get(e&255)?.write(t&255)}read(e,t={joystick:{x:2048,y:2048},keypadPressed:new Set}){for(let n of this.readProviders){let r=n(e&255,t);if(r!=null)return r&255}return null}},a=class{constructor(){Object.defineProperty(this,`bus`,{enumerable:!0,configurable:!0,writable:!0,value:new i}),Object.defineProperty(this,`ports`,{enumerable:!0,configurable:!0,writable:!0,value:{P0:255,P2:0,P3:255}}),Object.defineProperty(this,`abortSignal`,{enumerable:!0,configurable:!0,writable:!0,value:null}),Object.defineProperty(this,`extraDevices`,{enumerable:!0,configurable:!0,writable:!0,value:{}}),Object.defineProperty(this,`joystick`,{enumerable:!0,configurable:!0,writable:!0,value:{x:2048,y:2048}}),Object.defineProperty(this,`keypadPressed`,{enumerable:!0,configurable:!0,writable:!0,value:new Set})}reset(){this.ports={P0:255,P2:0,P3:255},this.joystick={x:2048,y:2048},this.abortSignal=null,this.keypadPressed.clear();for(let e of Object.values(this.extraDevices))e&&typeof e.reset==`function`?e.reset():e&&typeof e.clear==`function`&&e.clear()}setAbortSignal(e){this.abortSignal=e}formatHex8(e){return`0x`+(e&255).toString(16).padStart(2,`0`).toUpperCase()}readPort(e){if(e===`P0`&&this.readBit(`P3`,6)===0){let e=this.bus.read(this.ports.P2,{joystick:this.joystick,keypadPressed:this.getReadableKeys()});return e==null?255:e&255}return this.ports[e]&255}getPortRaw(e){return this.ports[e]&255}writePort(e,t){let n=t&255;if(e===`P2`){let e=this.ports.P2&255;this.ports.P2=n,e!==0&&n===0&&this.readBit(`P3`,6)===1&&this.bus.write(e,this.ports.P0&255);return}this.ports[e]=n}applyCpuPorts(e){this.ports.P3=e.p3&255,this.ports.P0=e.p0&255,this.writePort(`P2`,e.p2&255)}readBit(e,t){return this.ports[e]>>>t&1?1:0}writeBit(e,t,n){let r=1<<t,i=this.ports[e]&255;this.ports[e]=n?i|r:i&~r}async delay(e){let t=Math.max(0,Math.min(6e4,e|0));await new Promise((e,n)=>{let r=window.setTimeout(e,t),i=this.abortSignal;if(!i)return;let a=()=>{window.clearTimeout(r),i.removeEventListener(`abort`,a),n(Error(`Aborted`))};if(i.aborted)return a();i.addEventListener(`abort`,a)})}setJoystick(e,t){this.joystick.x=o(e),this.joystick.y=o(t),this.extraDevices.adc?.set(this.joystick.x,this.joystick.y)}getJoystick(){return{...this.joystick}}keypadPress(e,t=!0){this.keypadPressed.add(e),this.extraDevices.keypad?.press(e),t||(this.keypadPressed.delete(e),this.extraDevices.keypad?.release(e))}keypadRelease(e){this.keypadPressed.delete(e),this.extraDevices.keypad?.release(e)}getPressedKeys(){return Array.from(this.keypadPressed).sort((e,t)=>e-t)}getKeypadBusPreview(){let e=this.getReadableKeys(),t={joystick:this.joystick,keypadPressed:e},n=this.bus.read(96,t),r=this.bus.read(80,t),i=this.bus.read(48,t);return{col1:(n??255)&255,col2:(r??255)&255,col3:(i??255)&255}}getReadableKeys(){return new Set(this.keypadPressed)}render(e,t,n){e.clearRect(0,0,t,n),e.fillStyle=`#101723`,e.fillRect(0,0,t,n);let r=t-20,i=n-20,a=e.createLinearGradient(10,10,10+r,10+i);a.addColorStop(0,`#245748`),a.addColorStop(.55,`#296353`),a.addColorStop(1,`#193d34`),e.fillStyle=a,s(e,10,10,r,i,14,!0,!1),e.save(),e.beginPath(),s(e,10,10,r,i,14,!1,!1),e.clip(),this.extraDevices.sevenSeg?.render(e,10+r-282,44),this.extraDevices.ledBar?.render(e,38,158),this.extraDevices.matrix?.render(e,82,266),this.extraDevices.lcd?.render(e,10+r-306,262),e.restore()}};function o(e){return Math.max(0,Math.min(4095,e|0))}function s(e,t,n,r,i,a,o,s){e.beginPath(),e.moveTo(t+a,n),e.arcTo(t+r,n,t+r,n+i,a),e.arcTo(t+r,n+i,t,n+i,a),e.arcTo(t,n+i,t,n,a),e.arcTo(t,n,t+r,n,a),e.closePath(),o&&e.fill(),s&&e.stroke()}var c=class{constructor(){Object.defineProperty(this,`value`,{enumerable:!0,configurable:!0,writable:!0,value:255})}write(e){this.value=e&255}reset(){this.value=255}render(e,t,n){e.save(),e.fillStyle=`rgba(0,0,0,0.64)`,e.strokeStyle=`rgba(255,255,255,0.2)`,e.fillRect(t,n,232,56),e.strokeRect(t+.5,n+.5,231,55);for(let r=0;r<8;r++){let i=(this.value>>>r&1)==0,a=t+20+r*27,o=n+28;e.beginPath(),e.arc(a,o,10,0,Math.PI*2),e.fillStyle=i?`rgba(120, 255, 140, 1)`:`rgba(45, 60, 62, 0.45)`,e.fill(),e.strokeStyle=i?`rgba(210, 255, 220, 1)`:`rgba(120, 140, 140, 0.35)`,e.stroke()}e.restore()}},l=`rgba(255,204,102,0.95)`,u=`rgba(255,255,255,0.10)`,d=class{constructor(e){Object.defineProperty(this,`state`,{enumerable:!0,configurable:!0,writable:!0,value:e})}write(e){this.state.raw=e&255}},f=class{constructor(){Object.defineProperty(this,`digits`,{enumerable:!0,configurable:!0,writable:!0,value:[{raw:255},{raw:255},{raw:255},{raw:255}]})}digit(e){return new d(this.digits[e])}reset(){for(let e of this.digits)e.raw=255}render(e,t,n){e.save(),e.fillStyle=`rgba(0,0,0,0.64)`,e.strokeStyle=`rgba(255,255,255,0.2)`,e.fillRect(t,n,232,104),e.strokeRect(t+.5,n+.5,231,103);for(let r=0;r<4;r++)this.renderDigit(e,t+16+r*53,n+22,this.digits[r].raw);e.restore()}renderDigit(e,t,n,r){let i=e=>r>>>e&1?u:l,a=(t,n,r,i,a)=>{e.fillStyle=a,e.fillRect(t,n,r,i)};a(t+6,n,22,6,i(0)),a(t+34-6,n+6,6,58/2-6,i(1)),a(t+34-6,n+58/2,6,58/2-6,i(2)),a(t+6,n+58-6,22,6,i(3)),a(t,n+58/2,6,58/2-6,i(4)),a(t,n+6,6,58/2-6,i(5)),a(t+6,n+58/2-6/2,22,6,i(6)),e.beginPath(),e.arc(t+34-2,n+58-6,4,0,Math.PI*2),e.fillStyle=i(7),e.fill()}},p=class{constructor(e){Object.defineProperty(this,`onWrite`,{enumerable:!0,configurable:!0,writable:!0,value:e})}write(e){this.onWrite(e&255)}},m=class e{constructor(){Object.defineProperty(this,`rowReg`,{enumerable:!0,configurable:!0,writable:!0,value:255}),Object.defineProperty(this,`colReg`,{enumerable:!0,configurable:!0,writable:!0,value:0}),Object.defineProperty(this,`forcedPoint`,{enumerable:!0,configurable:!0,writable:!0,value:null}),Object.defineProperty(this,`glowUntil`,{enumerable:!0,configurable:!0,writable:!0,value:Array.from({length:7},()=>[,,,,,].fill(0))})}rowsDevice(){return new p(e=>{this.rowReg=e})}colsDevice(){return new p(e=>{this.colReg=e,this.refreshGlow()})}setPoint(e,t,n){if(!n){this.forcedPoint=null;return}this.forcedPoint={row:e,col:t}}reset(){this.rowReg=255,this.colReg=0,this.forcedPoint=null,this.glowUntil=Array.from({length:7},()=>[,,,,,].fill(0))}render(e,t,n){e.save(),e.fillStyle=`rgba(0,0,0,0.64)`,e.strokeStyle=`rgba(255,255,255,0.2)`,e.fillRect(t,n,132,186),e.strokeRect(t+.5,n+.5,131,185);let r=h();for(let i=0;i<7;i++)for(let a=0;a<5;a++){let o=this.rowReg>>>i&1,s=this.colReg>>>a&1,c=o===0&&s===1,l=this.glowUntil[i][a]>r;c||=l,this.forcedPoint&&this.forcedPoint.row===i&&this.forcedPoint.col===a&&(c=!0);let u=t+20+(4-a)*23,d=n+24+i*23;e.beginPath(),e.arc(u,d,7.36,0,Math.PI*2),e.fillStyle=c?`rgba(122,162,255,0.95)`:`rgba(255,255,255,0.10)`,e.fill(),e.strokeStyle=c?`rgba(122,162,255,0.75)`:`rgba(255,255,255,0.16)`,e.stroke()}e.restore()}refreshGlow(){let t=h();for(let n=0;n<7;n++)if(!(this.rowReg>>>n&1))for(let r=0;r<5;r++)(this.colReg>>>r&1)==1&&(this.glowUntil[n][r]=Math.max(this.glowUntil[n][r],t+e.PERSIST_MS))}};Object.defineProperty(m,`PERSIST_MS`,{enumerable:!0,configurable:!0,writable:!0,value:6});function h(){return typeof performance<`u`&&typeof performance.now==`function`?performance.now():Date.now()}var ee=class{press(e){}release(e){}reset(){}read(e,t){let n=g(e);return n==null?null:_(n,t)}};function g(e){let t=e&255;return t===239||(t&240)==224?0:t===223||(t&240)==208?1:t===191||(t&240)==176?2:t===96?0:t===80?1:t===48?2:null}function _(e,t){let n=255;for(let r=0;r<4;r++){let i=e+r*3;t.has(i)&&(n&=~(1<<r))}return n&255}var v=4,y=10,te=[0,64,10,74],ne=[0,64,20,84],re={160:`Б`,161:`Г`,162:`Е`,163:`Ж`,164:`З`,165:`И`,166:`Й`,167:`Л`,168:`П`,169:`У`,170:`Ф`,171:`Ч`,172:`Ш`,173:`Ь`,174:`Ы`,175:`Э`,176:`Ю`,177:`Я`,178:`б`,179:`в`,180:`г`,181:`ё`,182:`ж`,183:`з`,184:`и`,185:`й`,186:`к`,187:`л`,188:`м`,189:`н`,190:`п`,191:`т`,192:`ч`,193:`ш`,194:`ь`,195:`ы`,196:`ъ`,197:`э`,198:`ю`,199:`я`,202:`є`,203:`ґ`,205:`с`,206:`ґ`,207:`€`,224:`Д`,225:`Ц`,226:`Щ`,227:`Я`,228:`ф`,229:`ц`,230:`ш`,234:`є`,235:`Є`,236:`и`,237:`д`,238:`×`,239:`о`,240:`У`,241:`Ч`,242:`Ч`,243:`Ч`,244:`Н`,245:`"`,246:`д`,253:`б`,254:`Я`,255:`█`};Object.assign(re,{160:`Б`,161:`Г`,162:`Е`,163:`Ж`,164:`З`,165:`И`,166:`Й`,167:`Л`,168:`П`,169:`У`,170:`Ф`,171:`Ч`,172:`Ш`,173:`Ь`,174:`Ы`,175:`Э`,176:`Ю`,177:`Я`,178:`б`,179:`в`,180:`г`,181:`ё`,182:`ж`,183:`з`,184:`и`,185:`й`,186:`к`,187:`л`,188:`м`,189:`н`,190:`п`,191:`т`,192:`ч`,193:`ш`,194:`ь`,195:`ы`,196:`ъ`,197:`э`,198:`ю`,199:`я`,202:`є`,203:`ґ`,205:`с`,206:`ґ`,207:`€`,224:`Д`,225:`Ц`,226:`Щ`,227:`Я`,228:`ф`,229:`ц`,230:`ш`,234:`є`,235:`Є`,236:`и`,237:`д`,238:`×`,239:`о`,240:`У`,241:`Ч`,242:`Ч`,243:`Ч`,244:`Н`,246:`д`,253:`б`,254:`Я`,255:`█`}),Object.assign(re,{160:`Б`,161:`Г`,162:`Е`,163:`Ж`,164:`З`,165:`И`,166:`Й`,167:`Л`,168:`П`,169:`У`,170:`Ф`,171:`Ч`,172:`Ш`,173:`Ь`,174:`Ы`,175:`Э`,176:`Ю`,177:`Я`,178:`б`,179:`в`,180:`г`,181:`ё`,182:`ж`,183:`з`,184:`и`,185:`й`,186:`к`,187:`л`,188:`м`,189:`н`,190:`п`,191:`т`,192:`ч`,193:`ш`,194:`ь`,195:`ы`,196:`ъ`,197:`э`,198:`ю`,199:`я`,202:`є`,203:`ґ`,205:`с`,206:`ґ`,207:`€`,224:`Д`,225:`Ц`,226:`Щ`,227:`Я`,228:`ф`,229:`ц`,230:`ш`,234:`є`,235:`Є`,236:`и`,237:`д`,238:`×`,239:`о`,240:`У`,241:`Ч`,242:`Ч`,243:`Ч`,244:`Н`,245:`"`,246:`д`,253:`б`,254:`Я`,255:`█`});var ie=class{constructor(){Object.defineProperty(this,`lines`,{enumerable:!0,configurable:!0,writable:!0,value:Array.from({length:v},()=>ae(y))}),Object.defineProperty(this,`cellCodes`,{enumerable:!0,configurable:!0,writable:!0,value:Array.from({length:v},()=>Array.from({length:y},()=>32))}),Object.defineProperty(this,`cursor`,{enumerable:!0,configurable:!0,writable:!0,value:0}),Object.defineProperty(this,`pendingNibble`,{enumerable:!0,configurable:!0,writable:!0,value:null}),Object.defineProperty(this,`busLog`,{enumerable:!0,configurable:!0,writable:!0,value:[]})}reset(){this.lines=Array.from({length:v},()=>ae(y)),this.cellCodes=Array.from({length:v},()=>Array.from({length:y},()=>32)),this.cursor=0,this.pendingNibble=null,this.busLog=[]}clear(){this.reset()}print(e,t,n){let r=Math.max(0,Math.min(y-1,t|0)),i=n.slice(0,y-r),a=this.lines[e];this.lines[e]=(a.slice(0,r)+i+a.slice(r+i.length)).slice(0,y)}write(e){let t=e&1;if(this.pendingNibble===null){this.pendingNibble={rs:t,raw:e&255},this.pushBusLog(`0x08 <- ${se(e)} pending RS=${t}`);return}let n=this.pendingNibble.raw&240|e>>4&15,r=this.pendingNibble.rs===1;this.pendingNibble.rs!==t&&this.pushBusLog(`0x08 <- ${se(this.pendingNibble.raw)} + ${se(e)} RS mismatch ${this.pendingNibble.rs}/${t}`),this.pushBusLog(`0x08 <- ${se(this.pendingNibble.raw)} + ${se(e)} = ${se(n)} RS=${this.pendingNibble.rs}`),this.pendingNibble=null,this.processByte(n,r)}writeDataByte(e){this.pendingNibble=null,this.pushBusLog(`0x09 <- ${se(e)} data-byte`),this.processByte(e&255,!0)}writeCommandByte(e){this.pendingNibble=null,this.pushBusLog(`cmd-byte ${se(e)}`),this.processByte(e&255,!1)}getDebugRows(){let e=[];for(let t=0;t<v;t++){let n=this.cellCodes[t].map(e=>`0x${(e&255).toString(16).padStart(2,`0`).toUpperCase()}`),r=this.lines[t].replace(/\s/g,`·`);e.push(`L${t+1}: ${r}`),e.push(`    ${n.join(` `)}`)}return e.push(`LCD BUS LOG:`),e.push(...this.busLog.length?this.busLog.slice(-12):[`    -`]),e}processByte(e,t){if(t){this.writeCharacter(e&255);return}this.executeCommand(e&255)}executeCommand(e){if(e===1){this.clear();return}if(e===2){this.cursor=0;return}e&128&&(this.cursor=e&127)}writeCharacter(e){let t=this.cursorToLineAndColumn(this.cursor);if(!t)return;let{row:n,col:r}=t,i=this.lines[n],a=oe(e);this.cellCodes[n][r]=e&255,this.lines[n]=i.slice(0,r)+a+i.slice(r+1),this.cursor+=1}pushBusLog(e){this.busLog.push(e),this.busLog.length>80&&this.busLog.splice(0,this.busLog.length-80)}cursorToLineAndColumn(e){return ce(e,te)||ce(e,ne)||null}render(e,t,n){e.save(),e.fillStyle=`rgba(0,0,0,0.64)`,e.strokeStyle=`rgba(255,255,255,0.2)`,e.fillRect(t,n,268,184),e.strokeRect(t+.5,n+.5,267,183),e.fillStyle=`rgba(0,0,0,0.35)`,e.fillRect(t+14,n+24,238,130),e.strokeStyle=`rgba(122,162,255,0.25)`,e.strokeRect(t+14.5,n+24.5,237,129);let r=238/y,i=130/v;e.strokeStyle=`rgba(110,180,255,0.15)`;for(let r=0;r<=v;r++){let a=n+24+r*i;e.beginPath(),e.moveTo(t+14,a+.5),e.lineTo(t+252,a+.5),e.stroke()}for(let i=0;i<=y;i++){let a=t+14+i*r;e.beginPath(),e.moveTo(a+.5,n+24),e.lineTo(a+.5,n+154),e.stroke()}e.fillStyle=`rgba(165,255,205,1)`,e.shadowColor=`rgba(40,255,170,0.45)`,e.shadowBlur=3,e.textAlign=`center`,e.textBaseline=`middle`,e.font=`15px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;for(let a=0;a<this.lines.length;a++){let o=this.lines[a];for(let s=0;s<y;s++){let c=o[s]??` `,l=t+14+s*r+r/2,u=n+24+a*i+i/2+.5;e.fillText(c,l,u)}}e.textAlign=`start`,e.textBaseline=`alphabetic`,e.restore()}};function ae(e){return` `.repeat(e)}function oe(e){let t=e&255;return t>=32&&t<=126?String.fromCharCode(t):re[t]||`.`}function se(e){return`0x${(e&255).toString(16).padStart(2,`0`).toUpperCase()}`}function ce(e,t){for(let n=0;n<t.length;n++){let r=e-t[n];if(r>=0&&r<y)return{row:n,col:r}}return null}var le=class{constructor(){Object.defineProperty(this,`x`,{enumerable:!0,configurable:!0,writable:!0,value:512}),Object.defineProperty(this,`y`,{enumerable:!0,configurable:!0,writable:!0,value:512})}set(e,t){this.x=ue(e),this.y=ue(t)}read(){return{x:this.x,y:this.y}}};function ue(e){return Math.max(0,Math.min(1023,e|0))}var b={ledBarAddr:7,sevenSegAddrs:[1,2,3,4],matrixRowsAddr:5,matrixColsAddr:6,lcdAddr:8,keypadColumnAddrs:[239,223,191],keypadColumnAddrsFromExample:[96,80,48],stepperMotorAddr:9,adc:{adcon1:239,adcon2:216,dataLow:217,dataHigh:218,adciMask:128,sconvMask:16,xChannel:6,yChannel:7}},x={p0:128,sp:129,dpl:130,dph:131,p1:144,p2:160,ie:168,p3:176,ip:184,tcon:136,tmod:137,tl0:138,tl1:139,th0:140,th1:141,scon:152,sbuf:153,psw:208,acc:224,b:240},de=class i{constructor(e,t){Object.defineProperty(this,`exports`,{enumerable:!0,configurable:!0,writable:!0,value:e}),Object.defineProperty(this,`cpuPtr`,{enumerable:!0,configurable:!0,writable:!0,value:t})}static async create(a={}){let o=a.codeSize??64*1024,s=a.xdataSize??64*1024,c=new r([],[],[new t(new e([])),new t(new e([])),new t(new e([])),new n(`/`,new Map)]),l=new URL(``+new URL(`../emu8051.wasm`,import.meta.url).href,``+import.meta.url).href,u=await fetch(l);if(!u.ok)throw Error(`Failed to fetch ${l}: ${u.status}`);let d=await u.arrayBuffer(),f=await WebAssembly.compile(d),p=await WebAssembly.instantiate(f,{wasi_snapshot_preview1:c.wasiImport});c.initialize(p);let m=p.exports.emu_create(o,s);if(!m)throw Error(`emu_create failed`);return new i(p.exports,m)}destroy(){this.exports.emu_destroy(this.cpuPtr),this.cpuPtr=0}reset(e=!0){this.exports.emu_reset(this.cpuPtr,+!!e)}tick(){return this.exports.emu_tick(this.cpuPtr)!==0}getPC(){return this.exports.emu_get_pc(this.cpuPtr)&65535}getSfr(e){return this.exports.emu_get_sfr(this.cpuPtr,e&255)&255}setSfr(e,t){this.exports.emu_set_sfr(this.cpuPtr,e&255,t&255)}writeCode(e,t){this.exports.emu_write_code(this.cpuPtr,e&65535,t&255)}readCode(e){return this.exports.emu_read_code(this.cpuPtr,e&65535)&255}readIram(e){return this.exports.emu_read_iram(this.cpuPtr,e&255)&255}readXram(e){return this.exports.emu_read_xram(this.cpuPtr,e&65535)&255}};function S(e){let t=e.split(/\r?\n/).map(e=>e.trim()).filter(Boolean),n=[],r=0;for(let e of t){if(!e.startsWith(`:`))continue;let t=parseInt(e.slice(1,3),16),i=parseInt(e.slice(3,7),16),a=parseInt(e.slice(7,9),16);if(a===1)break;if(a===4){r=parseInt(e.slice(9,13),16)<<16;continue}if(a===0)for(let a=0;a<t;a++){let t=parseInt(e.slice(9+a*2,11+a*2),16);n.push({addr:r+i+a&65535,value:t&255})}}return n}var fe=class e{constructor(e){Object.defineProperty(this,`board`,{enumerable:!0,configurable:!0,writable:!0,value:e}),Object.defineProperty(this,`emu`,{enumerable:!0,configurable:!0,writable:!0,value:null}),Object.defineProperty(this,`rafId`,{enumerable:!0,configurable:!0,writable:!0,value:0}),Object.defineProperty(this,`running`,{enumerable:!0,configurable:!0,writable:!0,value:!1}),Object.defineProperty(this,`adcPending`,{enumerable:!0,configurable:!0,writable:!0,value:null}),Object.defineProperty(this,`instructions`,{enumerable:!0,configurable:!0,writable:!0,value:0}),Object.defineProperty(this,`batchSize`,{enumerable:!0,configurable:!0,writable:!0,value:184320}),Object.defineProperty(this,`trace`,{enumerable:!0,configurable:!0,writable:!0,value:[]})}async init(){this.emu||(this.emu=await de.create(),this.seedPorts())}async reset(){await this.init(),this.stop(),this.emu?.reset(!0),this.adcPending=null,this.instructions=0,this.trace=[],this.seedPorts(),this.syncCpuToBoard()}async loadHex(e){await this.reset();let t=S(e);for(let e=0;e<=65535;e++)this.emu?.writeCode(e,0);for(let e of t)this.emu?.writeCode(e.addr,e.value);return this.syncCpuToBoard(),t.length}step(t=1){if(this.emu)for(let n=0;n<t;n++){let t=this.emu.getPC()&65535,r=this.emu.readCode(t)&255,i=this.emu.readCode(t+1&65535)&255,a=r===229&&i===x.p0;if(this.syncBoardInputsToCpu(),a){let e=this.emu.getSfr(x.p3)&255;this.board.applyCpuPorts({p0:this.emu.getSfr(x.p0)&255,p2:this.emu.getSfr(x.p2)&255,p3:e}),e>>6&1||this.emu.setSfr(x.p0,this.board.readPort(`P0`))}this.emu.tick()&&(this.instructions+=1,(!this.running||n%e.TRACE_SAMPLE_WHILE_RUN===0)&&this.pushTrace({pc:t,opcode:r,acc:this.emu.getSfr(x.acc)&255,p0:this.emu.getSfr(x.p0)&255,p2:this.emu.getSfr(x.p2)&255,tick:this.instructions})),this.syncCpuToBoard()}}setSpeed(e){this.batchSize=Math.max(1,Math.min(5e5,e|0))}run(e=this.batchSize){if(!this.emu||this.running)return;this.batchSize=Math.max(1,Math.min(5e5,e|0)),this.running=!0;let t=()=>{this.running&&(this.step(this.batchSize),this.rafId=window.requestAnimationFrame(t))};this.rafId=window.requestAnimationFrame(t)}stop(){this.running=!1,this.rafId&&=(window.cancelAnimationFrame(this.rafId),0)}isRunning(){return this.running}getPC(){return this.emu?.getPC()??0}getSfr(e){return this.emu?.getSfr(e)??0}readCode(e){return this.emu?.readCode(e)??0}readIram(e){return this.emu?.readIram(e)??0}readXram(e){return this.emu?.readXram(e)??0}getInstructionCount(){return this.instructions}getTrace(e=40){let t=Math.max(1,Math.min(200,e|0));return this.trace.slice(-t)}clearTrace(){this.trace=[]}seedPorts(){this.emu?.setSfr(x.p0,255),this.emu?.setSfr(x.sp,7),this.emu?.setSfr(x.p2,0),this.emu?.setSfr(x.p3,255),this.emu?.setSfr(b.adc.adcon1,0),this.emu?.setSfr(b.adc.adcon2,0),this.emu?.setSfr(b.adc.dataLow,0),this.emu?.setSfr(b.adc.dataHigh,0)}syncBoardInputsToCpu(){if(!this.emu)return;this.serviceTimer0(),this.serviceAdc();let e=this.emu.getSfr(x.p3);this.board.applyCpuPorts({p0:this.emu.getSfr(x.p0),p2:this.emu.getSfr(x.p2),p3:e}),e>>6&1||this.emu.setSfr(x.p0,this.board.readPort(`P0`))}syncCpuToBoard(){this.emu&&this.board.applyCpuPorts({p0:this.emu.getSfr(x.p0),p2:this.emu.getSfr(x.p2),p3:this.emu.getSfr(x.p3)})}serviceAdc(){if(!this.emu)return;let e=this.emu.getSfr(b.adc.adcon2)&15,t=this.board.getJoystick(),n=this.readAdcChannel(e,t);this.emu.setSfr(b.adc.dataLow,n&255),this.emu.setSfr(b.adc.dataHigh,(e&15)<<4|n>>8&15);let r=this.emu.getSfr(b.adc.adcon2)&~b.adc.sconvMask|b.adc.adciMask;this.emu.setSfr(b.adc.adcon2,r)}serviceTimer0(){if(!this.emu)return;let t=this.emu.getSfr(x.tcon)&255,n=this.emu.getSfr(x.tmod)&255;if(!(t&16)||(n&3)!=1)return;let r=this.emu.getSfr(x.tl0)&255,i=this.emu.getSfr(x.th0)&255;for(let n=0;n<e.TIMER0_ACCEL;n++)r+=1,r>255&&(r=0,i+=1,i>255&&(i=0,this.emu.setSfr(x.tcon,(t|32)&255)));this.emu.setSfr(x.tl0,r&255),this.emu.setSfr(x.th0,i&255)}readAdcChannel(e,t){switch(e&15){case b.adc.xChannel:return C(t.x);case b.adc.yChannel:return C(t.y);case 0:return t.x&4095;case 1:return t.y&4095;case 11:return 0;case 12:return 4095;default:return 2048}}pushTrace(e){this.trace.push(e),this.trace.length>400&&this.trace.splice(0,this.trace.length-400)}};Object.defineProperty(fe,`TIMER0_ACCEL`,{enumerable:!0,configurable:!0,writable:!0,value:6}),Object.defineProperty(fe,`TRACE_SAMPLE_WHILE_RUN`,{enumerable:!0,configurable:!0,writable:!0,value:64});function C(e){let t=[1,3,5,7,9,11,12,14,15],n=Math.max(0,Math.min(4095,e|0));return(t[Math.round(n/4095*(t.length-1))]&15)<<8|128}var w={p0:128,sp:129,dpl:130,dph:131,dpp:132,pcon:135,p1:144,p2:160,ie:168,p3:176,ip:184,tcon:136,tmod:137,tl0:138,tl1:139,th0:140,th1:141,t2con:200,t2mod:201,rcap2l:202,rcap2h:203,tl2:204,th2:205,scon:152,sbuf:153,t3con:174,t3fd:175,pwmcon:215,pwm0h:251,pwm0l:250,pwm1h:253,pwm1l:252,adccon1:239,adccon2:216,adcdatal:217,adcdatah:218,adccon3:245,adcofsl:241,adcofsh:242,adcgainl:243,adcgainh:244,dac0l:249,dac0h:250,dac1l:251,dac1h:252,daccon:253,psw:208,acc:224,b:240},pe={ri:152,ti:153,rb8:154,tb8:155,ren:156,sm2:157,sm1:158,sm0:159,it0:136,ie0:137,it1:138,ie1:139,tr0:140,tf0:141,tr1:142,tf1:143,ex0:168,et0:169,ex1:170,et1:171,es:172,et2:173,eadc:174,ea:175,px0:184,pt0:185,px1:186,pt1:187,ps:188,pt2:189,padc:190,psi:191,p:208,f1:209,ov:210,rs0:211,rs1:212,f0:213,ac:214,cy:215,adci:223,sconv:220,tf2:207,exf2:206};function me(e){let t=[],n=e.split(/\r?\n/),r=new Map,i=new Map,a=[],o=0;for(let e=0;e<n.length;e++){let s=e+1,c=he(n[e]).trim();if(c.startsWith(`=`)&&(c=c.slice(1).trim()),!c)continue;let l=/^([A-Za-z_.$?][\w.$?]*)\s+equ\s+(.+)$/i.exec(c);if(l){i.set(l[1].toLowerCase(),l[2].trim());continue}let u=/^([A-Za-z_.$?][\w.$?]*)\s+data\s+(.+)$/i.exec(c);if(u){i.set(u[1].toLowerCase(),u[2].trim());continue}let d=/^([A-Za-z_.$?][\w.$?]*)\s+bit\s+(.+)$/i.exec(c);if(d){i.set(d[1].toLowerCase(),d[2].trim());continue}let f=/^org\s+(.+)$/i.exec(c);if(f){let e=Se(f[1],i);e==null?t.push({level:`error`,line:s,message:`Invalid ORG value.`}):o=e&65535;continue}if(/^(\.module|\.area|\.end|end|cseg|dseg|xseg|bseg|using|name|public|extrn|extern)\b/i.test(c)||/^\$?include\b/i.test(c)||/^\$mod/i.test(c))continue;let p=/^([A-Za-z_.$?][\w.$?]*):\s*(.*)$/.exec(c);if(p&&(r.set(p[1].toLowerCase(),o),c=p[2].trim(),!c))continue;let{mnemonic:m,operands:h}=ge(c),ee=ve(m,h,i);if(ee===0){t.push({level:`error`,line:s,message:`Unsupported instruction: ${m} ${h.join(`, `)}`.trim()});continue}a.push({line:s,address:o,mnemonic:m,operands:h}),o=o+ee&65535}let s=new Map,c=[];for(let e of a){c.push({pc:e.address&65535,line:e.line});let n=ye(e,r,i,t);n&&n.forEach((t,n)=>s.set(e.address+n&65535,t&255))}let l=Ce(s),u=we(s);return l.length&&!t.length&&t.push({level:`hint`,message:`ASM compiled to HEX successfully.`}),{ok:t.every(e=>e.level!==`error`),hex:u,bytes:l,pcToLine:c,diagnostics:t}}function he(e){let t=e.indexOf(`;`),n=e.indexOf(`//`),r=e.length;return t>=0&&(r=Math.min(r,t)),n>=0&&(r=Math.min(r,n)),e.slice(0,r)}function ge(e){let t=e.trim(),n=/^([^\s]+)\s*(.*)$/.exec(t);return{mnemonic:(n?.[1]??``).toLowerCase(),operands:(n?.[2]??``).split(`,`).map(e=>e.trim()).filter(Boolean)}}function _e(e){let t=0;for(let n of e){let e=n.trim(),r=/^(?:'([^']*)'|"([^"]*)")$/.exec(e);t+=r?(r[1]??r[2]??``).length:1}return t}function ve(e,t,n){let r=t[0]?.trim().toLowerCase()??``,i=t[1]?.trim().toLowerCase()??``,a=E(r,n),o=E(i,n);switch(e){case`db`:return _e(t);case`dw`:return t.length*2;case`mov`:return t.length===2?a===`dptr`&&o.startsWith(`#`)?3:a===`c`||o===`c`?2:o.startsWith(`#`)?O(a)||a===`a`||a===`acc`?2:3:2:0;case`xch`:return t.length===2?1+(O(o)||o===`@r0`||o===`@r1`?0:1):0;case`xchd`:return+(t.length===2);case`anl`:case`orl`:case`xrl`:return t.length===2?a===`a`||a===`acc`||a===`c`||O(a)?2:(O(a)||a===`@r0`||a===`@r1`)&&o.startsWith(`#`)?4:o.startsWith(`#`)?3:2:0;case`add`:case`addc`:case`subb`:return t.length===2?2:0;case`setb`:case`clr`:case`cpl`:return t.length===1?a===`c`||a===`a`||a===`acc`?1:2:0;case`push`:case`pop`:return t.length===1?2:0;case`dec`:case`inc`:return t.length===1?O(a)||a===`@r0`||a===`@r1`||a===`a`||a===`acc`||a===`dptr`?1:2:0;case`nop`:case`da`:case`ret`:case`reti`:case`rr`:case`rl`:case`rrc`:case`rlc`:case`swap`:case`movc`:return 1;case`mul`:case`div`:return+(t.length<=1);case`movx`:return+(t.length===2);case`call`:case`acall`:case`lcall`:case`jmp`:case`ajmp`:case`ljmp`:return t.length===1?e===`jmp`&&a.replace(/\s+/g,``)===`@a+dptr`?1:3:0;case`sjmp`:case`jz`:case`jnz`:case`jc`:case`jnc`:return t.length===1?2:0;case`jb`:case`jnb`:case`jbc`:return t.length===2?3:0;case`cjne`:return t.length===3?O(a)||a===`a`||a===`acc`||a===`@r0`||a===`@r1`?3:o.startsWith(`#`)&&Se(a,n)!=null?5:3:0;case`djnz`:return t.length===2?O(a)?2:3:0;default:return 0}}function ye(e,t,n,r){let i=T(e.mnemonic,e.operands),a=e.operands.map((r,a)=>be(r,t,n,i[a]??`any`,e.address));if(a.some(e=>e.type===`unknown`||`unresolved`in e&&e.unresolved))return r.push({level:`error`,line:e.line,message:`Cannot resolve operands for ${e.mnemonic}.`}),null;let o=t=>(r.push({level:`error`,line:e.line,message:t}),null);switch(e.mnemonic){case`db`:{let r=[];for(let i of e.operands){let e=i.trim(),a=/^(?:'([^']*)'|"([^"]*)")$/.exec(e);if(a){for(let e of a[1]??a[2]??``)r.push(e.charCodeAt(0)&255);continue}let s=xe(i,t,n);if(s==null)return o(`Cannot resolve DB value: ${i}`);r.push(s&255)}return r}case`dw`:{let r=[];for(let i of e.operands){let e=xe(i,t,n);if(e==null)return o(`Cannot resolve DW value: ${i}`);r.push(e&255,e>>8&255)}return r}case`mov`:{let[t,n]=a,r=Te((e.operands[1]??``).trim());return t.type===`reg`&&n.type===`imm`?[120+t.value,n.value]:t.type===`indirect`&&n.type===`imm`?[118+t.value,n.value]:t.type===`reg`&&n.type===`a`?[248+t.value]:t.type===`indirect`&&n.type===`a`?[246+t.value]:t.type===`a`&&n.type===`imm`?[116,n.value]:t.type===`a`&&n.type===`reg`?[232+n.value]:t.type===`a`&&n.type===`indirect`?[230+n.value]:t.type===`dptr`&&n.type===`imm`?[144,n.value>>8&255,n.value&255]:t.type===`direct`&&n.type===`imm`?[117,t.value,n.value]:t.type===`direct`&&n.type===`direct`&&r?[117,t.value,n.value&255]:t.type===`direct`&&n.type===`reg`?[136+n.value,t.value]:t.type===`direct`&&n.type===`indirect`?[134+n.value,t.value]:t.type===`reg`&&n.type===`direct`?[168+t.value,n.value]:t.type===`indirect`&&n.type===`direct`?[166+t.value,n.value]:t.type===`direct`&&n.type===`a`?[245,t.value]:t.type===`a`&&n.type===`direct`?[229,n.value]:t.type===`direct`&&n.type===`direct`?[133,n.value,t.value]:t.type===`c`&&n.type===`bit`?[162,n.value]:t.type===`bit`&&n.type===`c`?[146,t.value]:o(`Unsupported MOV form.`)}case`xch`:{let[e,t]=a;return e.type===`a`?t.type===`reg`?[200+t.value]:t.type===`direct`?[197,t.value]:t.type===`indirect`?[198+t.value]:o(`Unsupported XCH form.`):o(`XCH expects A as first operand.`)}case`xchd`:{let[e,t]=a;return e.type!==`a`||t.type!==`indirect`?o(`XCHD expects A,@R0 or A,@R1.`):[214+t.value]}case`anl`:case`orl`:case`xrl`:{let[t,n]=a,r=e.mnemonic===`anl`?{aImm:84,aDir:85,aInd0:86,aInd1:87,aReg:88,dirImm:83,dirA:82,cBit:130,cNBit:176}:e.mnemonic===`orl`?{aImm:68,aDir:69,aInd0:70,aInd1:71,aReg:72,dirImm:67,dirA:66,cBit:114,cNBit:160}:{aImm:100,aDir:101,aInd0:102,aInd1:103,aReg:104,dirImm:99,dirA:98,cBit:-1,cNBit:-1};if(t.type===`a`&&n.type===`imm`)return[r.aImm,n.value];if(t.type===`a`&&n.type===`direct`)return[r.aDir,n.value];if(t.type===`a`&&n.type===`indirect`)return[n.value===0?r.aInd0:r.aInd1];if(t.type===`a`&&n.type===`reg`)return[r.aReg+n.value];if(t.type===`direct`&&n.type===`imm`)return[r.dirImm,t.value,n.value];if(t.type===`direct`&&n.type===`a`)return[r.dirA,t.value];if(r.cBit>=0&&t.type===`c`&&n.type===`bit`)return[r.cBit,n.value];if(r.cNBit>=0&&t.type===`c`&&n.type===`nbit`)return[r.cNBit,n.value];if(n.type===`imm`&&t.type===`reg`){let e=232+t.value,i=r.aImm,a=248+t.value;return[e,i,n.value,a]}if(n.type===`imm`&&t.type===`indirect`){let e=230+t.value,i=r.aImm,a=246+t.value;return[e,i,n.value,a]}return o(`Unsupported ${e.mnemonic.toUpperCase()} form.`)}case`add`:case`addc`:case`subb`:{let[t,n]=a;if(t.type!==`a`)return o(`${e.mnemonic.toUpperCase()} expects A as first operand.`);let r=e.mnemonic===`add`?32:e.mnemonic===`addc`?48:144;return n.type===`imm`?[r+4,n.value]:n.type===`reg`?[r+8+n.value]:n.type===`indirect`?[r+6+n.value]:n.type===`direct`?[r+5,n.value]:o(`Unsupported ${e.mnemonic.toUpperCase()} form.`)}case`setb`:{let[e]=a;return e.type===`c`?[211]:e.type===`bit`?[210,e.value]:o(`SETB expects C or bit.`)}case`clr`:{let[e]=a;return e.type===`a`?[228]:e.type===`c`?[195]:e.type===`bit`?[194,e.value]:o(`CLR expects A, C, or bit.`)}case`cpl`:{let[e]=a;return e.type===`a`?[244]:e.type===`c`?[179]:e.type===`bit`?[178,e.value]:o(`CPL expects A, C, or bit.`)}case`push`:{let[e]=a;return e.type===`direct`?[192,e.value]:o(`PUSH expects direct.`)}case`pop`:{let[e]=a;return e.type===`direct`?[208,e.value]:o(`POP expects direct.`)}case`dec`:{let[e]=a;return e.type===`reg`?[24+e.value]:e.type===`indirect`?[22+e.value]:e.type===`direct`?[21,e.value]:e.type===`a`?[20]:o(`DEC supports A/register/@Ri/direct.`)}case`inc`:{let[e]=a;return e.type===`reg`?[8+e.value]:e.type===`indirect`?[6+e.value]:e.type===`direct`?[5,e.value]:e.type===`a`?[4]:e.type===`dptr`?[163]:o(`INC supports A/DPTR/register/@Ri/direct.`)}case`nop`:return[0];case`da`:{let[t]=a;return!e.operands.length||t.type===`a`?[212]:o(`DA expects A.`)}case`ret`:return[34];case`reti`:return[50];case`rr`:{let[e]=a;return e.type===`a`?[3]:o(`RR expects A.`)}case`rl`:{let[e]=a;return e.type===`a`?[35]:o(`RL expects A.`)}case`rrc`:{let[e]=a;return e.type===`a`?[19]:o(`RRC expects A.`)}case`rlc`:{let[e]=a;return e.type===`a`?[51]:o(`RLC expects A.`)}case`swap`:{let[e]=a;return e.type===`a`?[196]:o(`SWAP expects A.`)}case`movc`:return/^a$/i.test(e.operands[0]??``)&&/^@a\+dptr$/i.test((e.operands[1]??``).replace(/\s+/g,``))?[147]:/^a$/i.test(e.operands[0]??``)&&/^@a\+pc$/i.test((e.operands[1]??``).replace(/\s+/g,``))?[131]:o(`Only MOVC A,@A+DPTR or MOVC A,@A+PC is supported.`);case`movx`:{let[e,t]=a;return e.type===`a`&&t.type===`dptrindirect`?[224]:e.type===`dptrindirect`&&t.type===`a`?[240]:e.type===`a`&&t.type===`indirect`?[226+t.value]:e.type===`indirect`&&t.type===`a`?[242+e.value]:o(`Unsupported MOVX form.`)}case`mul`:return!e.operands.length||/^ab$/i.test((e.operands[0]??``).replace(/\s+/g,``))?[164]:o(`Only MUL AB is supported.`);case`div`:return!e.operands.length||/^ab$/i.test((e.operands[0]??``).replace(/\s+/g,``))?[132]:o(`Only DIV AB is supported.`);case`call`:case`acall`:case`lcall`:{let[e]=a;return e.type===`addr`?[18,e.value>>8&255,e.value&255]:o(`CALL expects address.`)}case`jmp`:case`ajmp`:case`ljmp`:{let[t]=a;return e.mnemonic===`jmp`&&t.type===`codeptr`?[115]:t.type===`addr`?[2,t.value>>8&255,t.value&255]:o(`JMP expects address.`)}case`sjmp`:case`jz`:case`jnz`:case`jc`:case`jnc`:{let[t]=a;if(t.type!==`addr`)return o(`${e.mnemonic.toUpperCase()} expects label.`);let n=D(e.address,2,t.value);return n==null?o(`${e.mnemonic.toUpperCase()} target is out of range.`):[e.mnemonic===`sjmp`?128:e.mnemonic===`jz`?96:e.mnemonic===`jnz`?112:e.mnemonic===`jc`?64:80,n]}case`jb`:case`jnb`:case`jbc`:{let[t,n]=a;if(n.type!==`addr`||t.type!==`bit`)return o(`${e.mnemonic.toUpperCase()} expects bit,label.`);let r=D(e.address,3,n.value);return r==null?o(`${e.mnemonic.toUpperCase()} target is out of range.`):[e.mnemonic===`jb`?32:e.mnemonic===`jnb`?48:16,t.value,r]}case`cjne`:{let[t,n,r]=a;if(r.type!==`addr`)return o(`CJNE expects two operands plus label.`);if(t.type===`a`&&n.type===`imm`){let t=D(e.address,3,r.value);return t==null?o(`CJNE target is out of range.`):[180,n.value,t]}if(t.type===`a`&&n.type===`direct`){let t=D(e.address,3,r.value);return t==null?o(`CJNE target is out of range.`):[181,n.value,t]}if(t.type===`reg`&&n.type===`imm`){let i=D(e.address,3,r.value);return i==null?o(`CJNE target is out of range.`):[184+t.value,n.value,i]}if(t.type===`indirect`&&n.type===`imm`){let i=D(e.address,3,r.value);return i==null?o(`CJNE target is out of range.`):[182+t.value,n.value,i]}if(t.type===`direct`&&n.type===`imm`){let i=D(e.address+2,3,r.value);return i==null?o(`CJNE target is out of range.`):[229,t.value,180,n.value,i]}return o(`Unsupported CJNE form.`)}case`djnz`:{let[t,n]=a;if(n.type!==`addr`)return o(`DJNZ expects label.`);if(t.type===`reg`){let r=D(e.address,2,n.value);return r==null?o(`DJNZ target is out of range.`):[216+t.value,r]}if(t.type===`direct`){let r=D(e.address,3,n.value);return r==null?o(`DJNZ target is out of range.`):[213,t.value,r]}return o(`Unsupported DJNZ form.`)}default:return o(`Unsupported mnemonic: ${e.mnemonic}`)}}function be(e,t,n,r=`any`,i=0){let a=e.trim();if(!a)return{type:`unknown`};if(/^(?:'[^']*'|"[^"]*")$/.test(a))return{type:`imm`,value:0};if(a.startsWith(`#`)){let e=xe(a.slice(1),t,n);return e==null?{type:`unknown`}:{type:`imm`,value:e}}let o=a.toLowerCase(),s=E(o,n);if(s!==o)return be(s,t,n,r,i);if(o===`$`)return{type:`addr`,value:i&65535};if(o===`a`||o===`acc`)return{type:`a`};if(o===`c`)return{type:`c`};if(o===`ab`)return{type:`ab`};if(o.replace(/\s+/g,``)===`@a+dptr`)return{type:`codeptr`};if(o.replace(/\s+/g,``)===`@a+pc`)return{type:`codeptrpc`};if(o.replace(/\s+/g,``)===`@dptr`)return{type:`dptrindirect`};if(o===`dptr`)return{type:`dptr`};if(o===`@r0`)return{type:`indirect`,value:0};if(o===`@r1`)return{type:`indirect`,value:1};if(O(o))return{type:`reg`,value:Number(o[1])};let c=/^p([0-3])\.([0-7])$/i.exec(a);if(c)return{type:`bit`,value:[128,144,160,176][Number(c[1])]+Number(c[2])};let l=/^([a-z_.$?][\w.$?]*)\.([0-7])$/i.exec(a);if(l){let e=l[1].toLowerCase(),t=Number(l[2]),n=w[e];if(n!=null&&n>=128&&n<=255)return{type:`bit`,value:(n&248)+t}}let u=/^\/p([0-3])\.([0-7])$/i.exec(a);if(u)return{type:`nbit`,value:[128,144,160,176][Number(u[1])]+Number(u[2])};let d=/^\/([a-z_.$?][\w.$?]*)\.([0-7])$/i.exec(a);if(d){let e=d[1].toLowerCase(),t=Number(d[2]),n=w[e];if(n!=null&&n>=128&&n<=255)return{type:`nbit`,value:(n&248)+t}}if(o in pe)return{type:`bit`,value:pe[o]};if(o in w)return{type:`direct`,value:w[o]};let f=Se(a,n);return f==null?t.has(o)?{type:`addr`,value:t.get(o)??0}:{type:`addr`,value:0,unresolved:!0}:r===`immediate`?{type:`imm`,value:f&255}:r===`bit`?{type:`bit`,value:f&255}:{type:`direct`,value:f&255}}function T(e,t){let n=e.toLowerCase();if(n===`setb`||n===`cpl`)return[`bit`];if(n===`clr`){let e=(t[0]??``).trim().toLowerCase();return e===`a`||e===`acc`||e===`c`?[`any`]:[`bit`]}if(n===`jb`||n===`jnb`||n===`jbc`)return[`bit`,`any`];if(n===`mov`){let e=(t[0]??``).trim().toLowerCase(),n=(t[1]??``).trim().toLowerCase();if(e===`c`)return[`any`,`bit`];if(n===`c`)return[`bit`,`any`]}return(n===`anl`||n===`orl`)&&(t[0]??``).trim().toLowerCase()===`c`?[`any`,`bit`]:t.map(()=>`any`)}function xe(e,t,n){let r=e.trim(),i=r.toLowerCase();if(t.has(i))return t.get(i)??0;let a=Se(r,n);if(a!=null)return a;let o=n.get(i);return o&&o.toLowerCase()!==i?xe(o,t,n):null}function Se(e,t){let n=e.trim(),r=n.toLowerCase();if(r in w)return w[r];if(O(r))return null;let i=t.get(r);return i&&i.toLowerCase()!==r?Se(i,t):/^0x[0-9a-f]+$/i.test(n)?Number.parseInt(n,16)&65535:/^[0-9a-f]+h$/i.test(n)?Number.parseInt(n.slice(0,-1),16)&65535:/^[01]+b$/i.test(n)?Number.parseInt(n.slice(0,-1),2)&65535:/^\d+$/.test(n)?Number.parseInt(n,10)&65535:null}function E(e,t,n=0){let r=e.trim().toLowerCase();if(!r||n>16)return r;let i=t.get(r);if(!i)return r;let a=i.trim().toLowerCase();return!a||a===r?r:E(a,t,n+1)}function D(e,t,n){let r=n-(e+t);return r<-128||r>127?null:r&255}function Ce(e){let t=[];return[...e.entries()].sort((e,t)=>e[0]-t[0]).forEach(([e,n])=>{t.push(e&65535,n&255)}),Uint8Array.from(t)}function we(e){let t=[...e.entries()].sort((e,t)=>e[0]-t[0]);if(!t.length)return``;let n=[],r=0;for(;r<t.length;){let e=[t[r]],i=t[r][0]+1;for(r+=1;r<t.length&&e.length<16&&t[r][0]===i;)e.push(t[r]),i+=1,r+=1;let a=e[0][0]&65535,o=e.map(([,e])=>e&255),s=[o.length,a>>8&255,a&255,0,...o],c=~s.reduce((e,t)=>e+t&255,0)+1&255;n.push(`:`+s.concat(c).map(e=>e.toString(16).padStart(2,`0`).toUpperCase()).join(``))}return n.push(`:00000001FF`),n.join(`
`)}function O(e){return/^r[0-7]$/i.test(e)}function Te(e){let t=e.trim().toLowerCase();return/^0x[0-9a-f]+$/.test(t)||/^[0-9a-f]+h$/.test(t)||/^[01]+b$/.test(t)||/^\d+$/.test(t)}function Ee(e){let t=[],n=De(e.replace(/\r/g,``));if(!n.trim())return{ok:!0,diagnostics:t};(n.match(/\{/g)??[]).length!==(n.match(/\}/g)??[]).length&&t.push({level:`error`,message:`Unbalanced braces in C source.`}),/\b(main)\s*\(/.test(n)||t.push({level:`warning`,message:"C: add `main()` entry function."});let r=n.split(`
`),i=!1;for(let e=0;e<r.length;e++){let n=r[e].trim();if(i){/^\}\s*;/.test(n)&&(i=!1);continue}if(/=\s*\{\s*$/.test(n)){i=!0;continue}n&&(n.startsWith(`//`)||/[{}]$/.test(n)||n.startsWith(`#`)||n.endsWith(`,`)||/^\}\s*else\b/.test(n)||/\b(if|while|for|switch)\b.*\)\s*$/.test(n)||/^(?:void|int|char|bit|long|uint8_t|unsigned\s+char|unsigned\s+int|signed\s+char|signed\s+int|unsigned\s+long|signed\s+long)\s+[A-Za-z_]\w*\s*\([^)]*\)\s*$/.test(n)||/^(?:const\s+)?(?:unsigned\s+char|char|uint8_t)\s+(?:code\s+)?[A-Za-z_]\w*\s*\[[^\]]*\]\s*=\s*$/.test(n)||n.endsWith(`;`)||t.push({level:`warning`,line:e+1,message:`Possible missing semicolon.`}))}return t.some(e=>e.level===`error`)||t.push({level:`hint`,message:`C syntax check passed (basic checker).`}),{ok:t.every(e=>e.level!==`error`),diagnostics:t}}function De(e){return e.replace(/\/\*[\s\S]*?\*\//g,e=>e.replace(/[^\n]/g,` `))}var Oe=new Set([`a`,`acc`,`b`,`p0`,`p1`,`p2`,`p3`,`sp`,`dpl`,`dph`,`tl0`,`th0`,`tl1`,`th1`,`tcon`,`tmod`,`psw`,`ie`,`ip`,`scon`,`sbuf`]),k=new Set([`read_adc`,`adc_read`,`adc_high`,`read_adc_high`,`adc_low`,`read_adc_low`,`joystick_x`,`joy_x`,`joystick_y`,`joy_y`,`keypad_read`,`key_read`,`readkey`,`read_key`,`keypad_col1`,`keypad_col2`,`keypad_col3`,`getadc`,`get_adc`,`adc`,`readadc`]),ke=new Set(`write.st_write.bus_write.delay.sleep.delay_ms.nop._nop_.led.leds.led_line.led_bar.led_off.leds_off.led_all.leds_all.led_on.seg.sevenseg.seven_seg.seg_digit.sevenseg_digit.digit.seg_clear.sevenseg_clear.matrix.matrix_write.matrix_rows.matrix_cols.lcd_cmd.lcd_command.lcd_data.lcd_char.lcd_putc.lcd_clear.lcd_home.lcd_init.lcd_line.lcd_puts.lcd_print.clear_latches.clearlatches.clearstatic.clear_static.static.staticl.statich.step.stepv.motor.stepper`.split(`.`)),A=[192,249,164,176,153,146,130,248,128,152,136,131,198,161,134,142];function Ae(e){let t=[],n=mt(pt(e).replace(/\r/g,``)),r={diagnostics:t,constants:ct(n),sfr:z(n),sbit:lt(n),vars:new Map,functions:at(n),labels:0,needDelay:!1,needWrite:!1,needReadAdc:!1,needReadAdcLow:!1,needKeypadRead:!1,needLcd:!1,needLedOn:!1,needSegDigit:!1,needMethodKey:!1,needStepper:!1,needStaticDisplay:!1,arrays:ot(n),breakStack:[],continueStack:[]};if(st(n,r),!r.functions.has(`main`))return{ok:!1,asm:``,diagnostics:t};let i=[];i.push(`org 0x0000`),i.push(`c_start:`),i.push(`mov sp,#0x2f`),i.push(`call main`),i.push(`c_stop:`),i.push(`sjmp c_stop`),i.push(``),je(`main`,r,i,new Set);for(let e of r.functions.keys())e!==`main`&&!ke.has(e)&&!k.has(e)&&je(e,r,i,new Set);return(r.needWrite||r.needLcd||r.needLedOn||r.needSegDigit)&&Je(i),r.needReadAdc&&Ye(i),r.needReadAdcLow&&Xe(i),r.needKeypadRead&&Ze(i),r.needLcd&&Qe(i),r.needLedOn&&$e(i),r.needSegDigit&&et(i),r.needMethodKey&&vt(i),r.needStepper&&bt(i),r.needStaticDisplay&&yt(i),r.arrayRoutines&&tt(i,r.arrayRoutines),r.needDelay&&nt(i),i.push(`end`),t.some(e=>e.level===`error`)||t.push({level:`hint`,message:`C Keil/ST841 Pack3 subset: include/prototypes, sfr/sbit, code/data arrays, string arrays, params, return, if/else, switch/case/default, while/do/for, break/continue, ternary, sizeof, basic pointer syntax warning, LED/7seg/matrix/LCD/keypad/stepper/ADC helpers.`}),{ok:t.every(e=>e.level!==`error`),asm:i.join(`
`),diagnostics:t}}function je(e,t,n,r){if(r.has(e))return;let i=t.functions.get(e);if(i){r.add(e);for(let e of i.params??[])L(e.name,t,e.size);n.push(`${ft(e)}:`),j(B(i.body),i.lineOffset,t,n),n.push(`ret`),n.push(``)}}function j(e,t,n,r){for(let i of e)Me(i,t,n,r)}function Me(e,t,n,r){let i=G(e.text.trim());if(!i)return;let a=t+e.line;if(/^break\s*;?$/i.test(i)){let e=n.breakStack?.[n.breakStack.length-1];e?F(e,r):n.diagnostics.push({level:`warning`,line:a,message:`break використано поза циклом/switch.`});return}if(/^continue\s*;?$/i.test(i)){let e=n.continueStack?.[n.continueStack.length-1];e?F(e,r):n.diagnostics.push({level:`warning`,line:a,message:`continue використано поза циклом.`});return}let o=/^do\s*\{([\s\S]*)\}\s*while\s*\(([^)]*)\)\s*;?$/i.exec(i);if(o){let i=K(n,`do`),s=K(n,`doend`);n.breakStack.push(s),n.continueStack.push(i),r.push(`${i}:`),j(B(o[1]),t+e.line,n,r),P(o[2],s,a,n,r),F(i,r),r.push(`${s}:`),n.breakStack.pop(),n.continueStack.pop();return}let s=/^switch\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(i);if(s){qe(s[1],s[2],a,t+e.line,n,r);return}let c=/^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*(?:\{([\s\S]*)\}|([\s\S]*))$/i.exec(i);if(c){let i=c[1].trim(),o=c[2].trim(),s=c[3].trim(),l=(c[4]==null?c[5]||``:c[4]).trim();i&&Me({text:i.endsWith(`;`)?i:i+`;`,line:e.line},t,n,r);let u=K(n,`for`),d=K(n,`forcont`),f=K(n,`forend`);r.push(`${u}:`),o&&P(o,f,a,n,r),n.breakStack.push(f),n.continueStack.push(d),l&&l!==`;`&&j(B(l),t+e.line,n,r),r.push(`${d}:`),s&&Me({text:s.endsWith(`;`)?s:s+`;`,line:e.line},t,n,r),F(u,r),r.push(`${f}:`),n.breakStack.pop(),n.continueStack.pop();return}let l=/^while\s*\(\s*(?:1|true)\s*\)\s*\{([\s\S]*)\}$/i.exec(i);if(l){let i=K(n,`while`);r.push(`${i}:`),j(B(l[1]),t+e.line,n,r),F(i,r);return}let u=/^while\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(i);if(u){let i=K(n,`while`),o=K(n,`wend`);r.push(`${i}:`),P(u[1],o,a,n,r),j(B(u[2]),t+e.line,n,r),F(i,r),r.push(`${o}:`);return}let d=/^for\s*\(\s*(?:unsigned\s+char\s+|unsigned\s+int\s+|int\s+|uint8_t\s+|char\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*\1\s*<\s*([^;]+);\s*\1\s*\+\+\s*\)\s*\{([\s\S]*)\}$/i.exec(i);if(d){let o=d[1],s=H(d[2],n),c=H(d[3],n);if(s==null||c==null||c<=s||c-s>255){n.diagnostics.push({level:`warning`,line:a,message:`C for-loop skipped або занадто великий: ${i.slice(0,70)}`});return}let l=K(n,`for`),u=L(o,n).addr;r.push(`mov ${q(u)},#${q(c-s)}`),r.push(`${l}:`),j(B(d[4]),t+e.line,n,r);let f=K(n,`foragain`),p=K(n,`forend`);r.push(`djnz ${q(u)},${f}`),F(p,r),r.push(`${f}:`),F(l,r),r.push(`${p}:`);return}let f=/^if\s*\(([^)]*)\)\s*\{([\s\S]*?)\}(?:\s*else\s*\{([\s\S]*)\})?$/i.exec(i);if(f){let i=K(n,`else`),o=K(n,`endif`);P(f[1],i,a,n,r),j(B(f[2]),t+e.line,n,r),F(o,r),r.push(`${i}:`),f[3]&&j(B(f[3]),t+e.line,n,r),r.push(`${o}:`);return}let p=/^while\s*\(([^)]*)\)\s*;$/i.exec(i);if(p){let e=K(n,`whilewait`),t=K(n,`whilewaitend`);r.push(`${e}:`),P(p[1],t,a,n,r),F(e,r),r.push(`${t}:`);return}let m=/^if\s*\(([^)]*)\)\s*([\s\S]+?;?)(?:\s*else\s*([\s\S]+?;?))?$/i.exec(i);if(m&&!m[2].trim().startsWith(`{`)){let i=K(n,`else`),o=K(n,`endif`);P(m[1],i,a,n,r),Me({text:dt(m[2].trim()),line:e.line},t,n,r),F(o,r),r.push(`${i}:`),m[3]&&Me({text:dt(m[3].trim()),line:e.line},t,n,r),r.push(`${o}:`);return}let h=/^return(?:\s+(.+?))?\s*;?$/i.exec(i);if(h){h[1]&&N(h[1],a,n,r),r.push(`ret`);return}let ee=/^(?:volatile\s+)?(?:(?:unsigned|signed)\s+)?(?:char|int|long|bit|uint8_t)(?:\s+(?:data|idata|xdata|bdata|pdata|far))?\s+(.+);?$/i.exec(i);if(ee){for(let e of V(ee[1])){let t=/^([A-Za-z_]\w*)(?:\s*=\s*(.+))?$/.exec(e.trim());if(!t)continue;let o=i.toLowerCase(),s=L(t[1],n,/\b(?:int|long)\b/.test(o)?2:1);t[2]!=null&&(s.size===2?Fe(s,t[2],a,n,r):Ve(s.addr,t[2],a,n,r))}return}let g=/^([A-Za-z_]\w*)\s*\((.*)\)\s*;?$/i.exec(i);if(g){Ne(g[1],g[2],a,n,r);return}let _=/^([A-Za-z_]\w*)\s*(\+\+|--)\s*;?$/i.exec(i);if(_){let e=I(_[1],n);e?r.push(`${_[2]===`++`?`inc`:`dec`} ${e}`):n.diagnostics.push({level:`warning`,line:a,message:`C increment target unknown: ${i}`});return}let v=/^([A-Za-z_]\w*)\s*([+\-&|^])=\s*(.+)\s*;?$/i.exec(i);if(v){He(v[1],v[2],v[3],a,n,r);return}let y=/^([A-Za-z_]\w*)\s*=\s*(.+)\s*;?$/i.exec(i);if(y){Be(y[1],y[2],a,n,r);return}n.diagnostics.push({level:`warning`,line:a,message:`C line not translated: ${i}`})}function Ne(e,t,n,r,i){let a=e.toLowerCase(),o=V(t);if(a===`clearlatches`||a===`clear_latches`){for(let e=1;e<=8;e++)M([q(e),`0xff`],n,r,i);return}if(a===`clearstatic`||a===`clear_static`){for(let e=1;e<=4;e++)M([q(e),`0xff`],n,r,i);return}if(a===`static`){N(o[0]??`0`,n,r,i),i.push(`mov r4,a`);let e=Ie(o[0]??`0`,r);e==null?(N(o[0]??`0`,n,r,i),i.push(`mov r6,a`),i.push(`call static_display_low_byte`),r.needStaticDisplay=!0):(M([`0x01`,q(A[e&15])],n,r,i),M([`0x02`,q(A[e>>4&15])],n,r,i),M([`0x03`,q(A[e>>8&15])],n,r,i),M([`0x04`,q(A[e>>12&15])],n,r,i));return}if(a===`staticl`){let e=H(o[0]??`0`,r);e==null?(N(o[0]??`0`,n,r,i),i.push(`mov r6,a`),i.push(`call static_display_l`),r.needStaticDisplay=!0):(M([`0x01`,q(A[e&15])],n,r,i),M([`0x02`,q(A[e>>4&15])],n,r,i));return}if(a===`statich`){let e=H(o[0]??`0`,r);e==null?(N(o[0]??`0`,n,r,i),i.push(`mov r6,a`),i.push(`call static_display_h`),r.needStaticDisplay=!0):(M([`0x03`,q(A[e&15])],n,r,i),M([`0x04`,q(A[e>>4&15])],n,r,i));return}if(a===`step`||a===`stepper`){N(o[0]??`0`,n,r,i),i.push(`call stepper_halfstep`),r.needStepper=!0;return}if(a===`stepv`){N(o[0]??`0`,n,r,i),i.push(`call stepper_v`),r.needStepper=!0;return}if(a===`delay`||a===`sleep`){r.needDelay=!0,i.push(`call delay`);return}if(a===`delay_ms`){let e=H(o[0]??`1`,r)??1;r.needDelay=!0;for(let t=0;t<Math.max(1,Math.min(e,20));t++)i.push(`call delay`);return}if(a===`_nop_`||a===`nop`){i.push(`nop`);return}if(a===`write`||a===`st_write`||a===`bus_write`){M(o,n,r,i);return}if(a===`led`||a===`leds`||a===`led_line`||a===`led_bar`){M([`0x07`,o[0]??`0xff`],n,r,i);return}if(a===`led_off`||a===`leds_off`){M([`0x07`,`0xff`],n,r,i);return}if(a===`led_all`||a===`leds_all`){M([`0x07`,`0x00`],n,r,i);return}if(a===`led_on`){N(o[0]??`1`,n,r,i),i.push(`call led_on`),r.needLedOn=!0;return}if(a===`seg`||a===`sevenseg`||a===`seven_seg`){Le(o,n,r,i);return}if(a===`seg_digit`||a===`sevenseg_digit`||a===`digit`){Re(o,n,r,i);return}if(a===`seg_clear`||a===`sevenseg_clear`){for(let e=1;e<=4;e++)M([q(e),`0xff`],n,r,i);return}if(a===`matrix`||a===`matrix_write`){M([`0x05`,o[0]??`0`],n,r,i),M([`0x06`,o[1]??`0`],n,r,i);return}if(a===`matrix_rows`){M([`0x05`,o[0]??`0`],n,r,i);return}if(a===`matrix_cols`){M([`0x06`,o[0]??`0`],n,r,i);return}if(a===`lcd_cmd`||a===`lcd_command`){N(o[0]??`0`,n,r,i),i.push(`mov r5,#0x00`),i.push(`call lcd_write_byte`),r.needLcd=!0;return}if(a===`lcd_data`||a===`lcd_char`||a===`lcd_putc`){N(o[0]??`' '`,n,r,i),i.push(`mov r5,#0x01`),i.push(`call lcd_write_byte`),r.needLcd=!0;return}if(a===`lcd_clear`){rt(1,r,i);return}if(a===`lcd_home`){rt(2,r,i);return}if(a===`lcd_init`){for(let e of[40,12,6,1])rt(e,r,i);return}if(a===`lcd_line`){let e=H(o[0]??`1`,r)??1,t=[128,192,148,212][Math.max(0,Math.min(3,e-1))];rt(t,r,i);return}if(a===`lcd_puts`||a===`lcd_print`){let t=W(o[0]??``);if(t==null){r.diagnostics.push({level:`warning`,line:n,message:`${e}(...) підтримує поки тільки рядок у лапках.`});return}for(let e of t.slice(0,64))it(e.charCodeAt(0),r,i);return}if(k.has(a)){ze(a,o,n,r,i);return}if(r.functions.has(a)){Pe(a,o,n,r,i);return}r.diagnostics.push({level:`warning`,line:n,message:`C function not known: ${e}()`})}function Pe(e,t,n,r,i){let a=r.functions.get(e);if(!a){i.push(`call ${ft(e)}`);return}let o=a.params??[];for(let e=0;e<o.length;e++){let a=o[e],s=L(a.name,r,a.size),c=t[e]??`0`;a.size===2?Fe(s,c,n,r,i):(N(c,n,r,i),i.push(`mov ${q(s.addr)},a`))}i.push(`call ${ft(e)}`)}function Fe(e,t,n,r,i){let a=Ie(t,r);if(a!=null){i.push(`mov ${q(e.addr)},#${q(a&255)}`),i.push(`mov ${q(e.addr+1)},#${q(a>>8&255)}`);return}let o=r.vars.get(t.trim().toLowerCase());if(o&&o.size===2){i.push(`mov a,${q(o.addr)}`),i.push(`mov ${q(e.addr)},a`),i.push(`mov a,${q(o.addr+1)}`),i.push(`mov ${q(e.addr+1)},a`);return}N(t,n,r,i),i.push(`mov ${q(e.addr)},a`),i.push(`mov ${q(e.addr+1)},#0x00`)}function Ie(e,t){let n=e.trim().replace(/;$/,``),r=t.constants?.get(n.toLowerCase());if(r)return Ie(r,t);let i=U(n);return i?/^0x/i.test(i)?Number.parseInt(i.slice(2),16)&65535:/^[01]+b$/i.test(i)?Number.parseInt(i.slice(0,-1),2)&65535:/^0b/i.test(i)?Number.parseInt(i.slice(2),2)&65535:Number.parseInt(i,10)&65535:null}function M(e,t,n,r){if(e.length<2){n.diagnostics.push({level:`error`,line:t,message:`write(addr,data) потребує 2 аргументи.`});return}N(e[1],t,n,r),r.push(`mov r7,a`),N(e[0],t,n,r),r.push(`mov r6,a`),r.push(`call write`),n.needWrite=!0}function Le(e,t,n,r){let i=H(e[0]??`1`,n);if(i==null||i<1||i>4){n.diagnostics.push({level:`warning`,line:t,message:`sevenseg(pos,value): pos має бути 1..4.`});return}M([q(5-i),e[1]??`0xff`],t,n,r)}function Re(e,t,n,r){let i=H(e[0]??`1`,n);if(i==null||i<1||i>4){n.diagnostics.push({level:`warning`,line:t,message:`seg_digit(pos,digit): pos має бути 1..4.`});return}N(e[1]??`0`,t,n,r),r.push(`call seg_digit_to_pattern`),r.push(`mov r7,a`),r.push(`mov r6,#${q(5-i)}`),r.push(`call write`),n.needSegDigit=!0}function ze(e,t,n,r,i){if(e===`read_adc`||e===`adc_read`||e===`adc_high`||e===`read_adc_high`||e===`getadc`||e===`get_adc`||e===`adc`||e===`readadc`){N(t[0]??`0`,n,r,i),i.push(`call read_adc`),r.needReadAdc=!0;return}if(e===`adc_low`||e===`read_adc_low`){N(t[0]??`0`,n,r,i),i.push(`call read_adc_low`),r.needReadAdcLow=!0;return}if(e===`joystick_x`||e===`joy_x`){i.push(`mov a,#0x06`),i.push(`call read_adc`),r.needReadAdc=!0;return}if(e===`joystick_y`||e===`joy_y`){i.push(`mov a,#0x07`),i.push(`call read_adc`),r.needReadAdc=!0;return}if(e===`keypad_read`||e===`key_read`||e===`readkey`||e===`read_key`){N(t[0]??`0x60`,n,r,i),i.push(`call keypad_read`),r.needKeypadRead=!0;return}if(e===`keypad_col1`){i.push(`mov a,#0x60`),i.push(`call keypad_read`),r.needKeypadRead=!0;return}if(e===`keypad_col2`){i.push(`mov a,#0x50`),i.push(`call keypad_read`),r.needKeypadRead=!0;return}if(e===`keypad_col3`){i.push(`mov a,#0x30`),i.push(`call keypad_read`),r.needKeypadRead=!0;return}}function Be(e,t,n,r,i){let a=e.trim(),o=a.toLowerCase(),s=r.sbit.get(o);if(s){let e=H(t,r);e===0||e===1?i.push(e?`setb ${s}`:`clr ${s}`):r.diagnostics.push({level:`warning`,line:n,message:`sbit ${a}=... підтримує тільки 0 або 1.`});return}let c=t.trim().replace(/;$/,``),l=/^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(c);if(l&&k.has(l[1].toLowerCase())){ze(l[1].toLowerCase(),V(l[2]),n,r,i);let e=I(a,r)??q(L(a,r).addr);i.push(`mov ${e},a`);return}if(l&&r.functions.has(l[1].toLowerCase())){Pe(l[1].toLowerCase(),V(l[2]),n,r,i);let e=I(a,r)??q(L(a,r).addr);i.push(`mov ${e},a`);return}let u=/^([A-Za-z_]\w*)\s*\[([\s\S]+)\]$/.exec(a);if(u){let e=r.vars.get(u[1].toLowerCase()),o=H(u[2],r);if(e&&o!=null){N(t,n,r,i),i.push(`mov ${q(e.addr+o)},a`);return}r.diagnostics.push({level:`warning`,line:n,message:`array assignment supports constant index only: ${a}`});return}let d=I(a,r)??q(L(a,r).addr);N(t,n,r,i),i.push(`mov ${d},a`)}function Ve(e,t,n,r,i){N(t,n,r,i),i.push(`mov ${q(e)},a`)}function He(e,t,n,r,i,a){let o=I(e,i)??q(L(e,i).addr);a.push(`mov a,${o}`);let s=H(n,i),c=I(n,i),l=s==null?c:`#${q(s)}`;l||=(N(n,r,i,a),a.push(`mov r0,a`),a.push(`mov a,${o}`),`r0`),t===`+`?a.push(`add a,${l}`):t===`-`?(a.push(`clr c`),a.push(`subb a,${l}`)):t===`&`?a.push(`anl a,${l}`):t===`|`?a.push(`orl a,${l}`):t===`^`&&a.push(`xrl a,${l}`),a.push(`mov ${o},a`)}function Ue(e,t,n,r,i){We(t,n,r,i);let a=r.arrays.get(e)??[],o=`lookup_${ft(e)}`;i.push(`call ${o}`),r[`need_array_${e}`]=!0,r.arrayRoutines=r.arrayRoutines??new Map,r.arrayRoutines.set(o,a)}function We(e,t,n,r){let i=e.trim().replace(/\s+/g,``),a=/^\(?([A-Za-z_]\w*)>>(\d+)\)?&(?:0x0[fF]|15)$/.exec(i);if(a){let e=n.vars.get(a[1].toLowerCase()),t=Number(a[2]);if(e&&e.size===2){t<8?r.push(`mov a,${q(e.addr)}`):r.push(`mov a,${q(e.addr+1)}`),t%8==4&&r.push(`swap a`),r.push(`anl a,#0x0f`);return}}let o=/^\(?([A-Za-z_]\w*)\)?&(?:0x0[fF]|15)$/.exec(i);if(o){let e=n.vars.get(o[1].toLowerCase());if(e){r.push(`mov a,${q(e.addr)}`),r.push(`anl a,#0x0f`);return}let t=I(o[1],n);if(t){r.push(`mov a,${t}`),r.push(`anl a,#0x0f`);return}}let s=/^\(?([A-Za-z_]\w*)>>(\d+)\)?$/.exec(i);if(s){let e=n.vars.get(s[1].toLowerCase()),t=Number(s[2]);if(e&&e.size===2){t<8?r.push(`mov a,${q(e.addr)}`):r.push(`mov a,${q(e.addr+1)}`),t%8==4&&r.push(`swap a`);return}}let c=H(e,n);if(c!=null){r.push(`mov a,#${q(c)}`);return}N(e,t,n,r)}function N(e,t,n,r){let i=ht(e.trim().replace(/;$/,``)),a=/^sizeof\s*\(\s*([^)]*)\s*\)$/i.exec(i);if(a){let e=a[1].trim().toLowerCase(),t=1;/\b(int|long)\b/.test(e)&&(t=2);let i=n.vars?.get(e);i&&(t=i.size??1),r.push(`mov a,#${q(t)}`);return}let o=gt(i);if(o){let e=K(n,`ternfalse`),i=K(n,`ternend`);P(o.cond,e,t,n,r),N(o.whenTrue,t,n,r),F(i,r),r.push(`${e}:`),N(o.whenFalse,t,n,r),r.push(`${i}:`);return}let s=/^(\+\+|--)([A-Za-z_]\w*)$/i.exec(i);if(s){let e=I(s[2],n);if(e){r.push(`${s[1]===`++`?`inc`:`dec`} ${e}`),r.push(`mov a,${e}`);return}}let c=/^([A-Za-z_]\w*)(\+\+|--)$/i.exec(i);if(c){let e=I(c[1],n);if(e){r.push(`mov a,${e}`),r.push(`${c[2]===`++`?`inc`:`dec`} ${e}`);return}}let l=/^([A-Za-z_]\w*)\s*\[([\s\S]+)\]$/.exec(i);if(l&&n.arrays?.has(l[1].toLowerCase())){Ue(l[1].toLowerCase(),l[2],t,n,r);return}let u=H(i,n);if(u!=null){r.push(`mov a,#${q(u)}`);return}let d=/^~\s*(.+)$/i.exec(i);if(d){N(d[1],t,n,r),r.push(`cpl a`);return}let f=/^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(i);if(f&&k.has(f[1].toLowerCase())){ze(f[1].toLowerCase(),V(f[2]),t,n,r);return}if(f&&n.functions.has(f[1].toLowerCase())){Pe(f[1].toLowerCase(),V(f[2]),t,n,r);return}let p=_t(i);if(p){N(p.left,t,n,r);let e=H(p.right,n),a=I(p.right,n),o=e==null?a:`#${q(e)}`;if(!o){n.diagnostics.push({level:`warning`,line:t,message:`C expression RHS unsupported: ${i}`});return}if(p.op===`+`)r.push(`add a,${o}`);else if(p.op===`-`)r.push(`clr c`),r.push(`subb a,${o}`);else if(p.op===`&`)r.push(`anl a,${o}`);else if(p.op===`|`)r.push(`orl a,${o}`);else if(p.op===`^`)r.push(`xrl a,${o}`);else if(p.op===`<<`||p.op===`>>`){let e=H(p.right,n);e==null?(N(p.left,t,n,r),r.push(`mov r0,a`),N(p.right,t,n,r),r.push(`mov r1,a`),r.push(`mov a,r0`),Ke(p.op,r,n)):(N(p.left,t,n,r),Ge(p.op,e&31,r))}return}let m=I(i,n);if(m){r.push(`mov a,${m}`);return}n.diagnostics.push({level:`warning`,line:t,message:`C expression not translated, using 0: ${i}`}),r.push(`mov a,#0`)}function Ge(e,t,n){let r=Math.max(0,Math.min(31,Number(t)||0));for(let t=0;t<r;t++)e===`<<`?n.push(`add a,a`):(n.push(`clr c`),n.push(`rrc a`))}function Ke(e,t,n){let r=K(n,e===`<<`?`shl`:`shr`),i=K(n,e===`<<`?`shlend`:`shrend`);t.push(`${r}:`),t.push(`mov r2,a`),t.push(`mov a,r1`),t.push(`jz ${i}`),t.push(`dec r1`),t.push(`mov a,r2`),e===`<<`?t.push(`add a,a`):(t.push(`clr c`),t.push(`rrc a`)),t.push(`sjmp ${r}`),t.push(`${i}:`),t.push(`mov a,r2`)}function P(e,t,n,r,i){let a=ht(e.trim()),o=J(a,`||`);if(o.length>1){let e=K(r,`orpass`);for(let t of o){let a=K(r,`ornext`);P(t,a,n,r,i),F(e,i),i.push(`${a}:`)}F(t,i),i.push(`${e}:`);return}let s=J(a,`&&`);if(s.length>1){for(let e of s)P(e,t,n,r,i);return}let c=r.sbit.get(a.toLowerCase());if(c){let e=K(r,`bitpass`);i.push(`jb ${c},${e}`),F(t,i),i.push(`${e}:`);return}let l=/^!\s*([A-Za-z_]\w*)$/.exec(a);if(l){let e=r.sbit.get(l[1].toLowerCase());if(e){let n=K(r,`bitpass`);i.push(`jnb ${e},${n}`),F(t,i),i.push(`${n}:`);return}}let u=/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(a);if(u){N(u[1],n,r,i);let e=H(u[3],r),o=I(u[3],r),s=e==null?o:`#${q(e)}`;if(!s){r.diagnostics.push({level:`warning`,line:n,message:`C compare RHS unsupported: ${a}`}),F(t,i);return}let c=u[2];if(c===`==`){let e=K(r,`cmpneq`),n=K(r,`cmppass`);i.push(`cjne a,${s},${e}`),F(n,i),i.push(`${e}:`),F(t,i),i.push(`${n}:`)}else if(c===`!=`){let e=K(r,`cmpnepass`);i.push(`cjne a,${s},${e}`),F(t,i),i.push(`${e}:`)}else if(c===`<`){let e=K(r,`cmplt`),n=K(r,`cmppass`);i.push(`cjne a,${s},${e}`),F(t,i),i.push(`${e}:`),i.push(`jc ${n}`),F(t,i),i.push(`${n}:`)}else if(c===`>=`){let e=K(r,`cmpge`),n=K(r,`cmppass`);i.push(`cjne a,${s},${e}`),F(n,i),i.push(`${e}:`),i.push(`jnc ${n}`),F(t,i),i.push(`${n}:`)}else if(c===`>`){let e=K(r,`cmpgt`),n=K(r,`cmppass`);i.push(`cjne a,${s},${e}`),F(t,i),i.push(`${e}:`),i.push(`jnc ${n}`),F(t,i),i.push(`${n}:`)}else if(c===`<=`){let e=K(r,`cmple`),n=K(r,`cmppass`);i.push(`cjne a,${s},${e}`),F(n,i),i.push(`${e}:`),i.push(`jc ${n}`),F(t,i),i.push(`${n}:`)}return}N(a,n,r,i);let d=K(r,`nzpass`);i.push(`jnz ${d}`),F(t,i),i.push(`${d}:`)}function qe(e,t,n,r,i,a){let o=K(i,`switchend`),s=K(i,`switchdefault`),c=[],l=/\bcase\s+([^:]+):|\bdefault\s*:/gi,u,d=null;for(;u=l.exec(t);)d&&(d.body=t.slice(d.start,u.index),c.push(d)),d=u[0].toLowerCase().startsWith(`case`)?{value:u[1].trim(),label:K(i,`case`),start:l.lastIndex,body:``}:{value:null,label:s,start:l.lastIndex,body:``};d&&(d.body=t.slice(d.start),c.push(d)),N(e,n,i,a),a.push(`mov r0,a`);for(let e of c){if(e.value==null)continue;let t=H(e.value,i);t!=null&&(a.push(`mov a,r0`),a.push(`cjne a,#${q(t)},${e.label}_skip`),F(e.label,a),a.push(`${e.label}_skip:`))}F(c.some(e=>e.value==null)?s:o,a),i.breakStack.push(o);for(let e of c)a.push(`${e.label}:`),j(B(e.body),r,i,a);i.breakStack.pop(),a.push(`${o}:`)}function F(e,t){t.push(`ljmp ${e}`)}function I(e,t){let n=e.trim().toLowerCase();if(Oe.has(n))return n===`acc`?`a`:n;let r=t.sfr.get(n);if(r)return r;let i=t.vars.get(n);if(i)return q(i.addr);let a=H(e,t);return a!=null&&a>=128&&a<=255?q(a):null}function L(e,t,n=1){let r=e.toLowerCase(),i=t.vars.get(r);if(i)return i;let a=32;for(let e of t.vars.values())a+=e.size??1;let o={name:r,addr:a,size:n};return t.vars.set(r,o),o}function Je(e){e.push(`write:`),e.push(`setb p3.6`),e.push(`mov p0,r7`),e.push(`mov p2,r6`),e.push(`nop`),e.push(`mov p2,#0x00`),e.push(`ret`),e.push(``)}function Ye(e){e.push(`read_adc:`),e.push(`mov 0xd8,a`),e.push(`clr 0xdf`),e.push(`setb 0xdc`),e.push(`jnb 0xdf,$`),e.push(`mov a,0xda`),e.push(`anl a,#00001111b`),e.push(`ret`),e.push(``)}function Xe(e){e.push(`read_adc_low:`),e.push(`mov 0xd8,a`),e.push(`clr 0xdf`),e.push(`setb 0xdc`),e.push(`jnb 0xdf,$`),e.push(`mov a,0xd9`),e.push(`ret`),e.push(``)}function Ze(e){e.push(`keypad_read:`),e.push(`clr p3.6`),e.push(`mov p2,a`),e.push(`nop`),e.push(`mov a,p0`),e.push(`anl a,#0x0f`),e.push(`ret`),e.push(``)}function Qe(e){e.push(`lcd_write_byte:`),e.push(`mov b,a`),e.push(`anl a,#0xf0`),e.push(`orl a,r5`),e.push(`mov r7,a`),e.push(`mov r6,#0x08`),e.push(`call write`),e.push(`mov a,b`),e.push(`swap a`),e.push(`anl a,#0xf0`),e.push(`orl a,r5`),e.push(`mov r7,a`),e.push(`mov r6,#0x08`),e.push(`call write`),e.push(`ret`),e.push(``)}function $e(e){e.push(`led_on:`),e.push(`dec a`),e.push(`anl a,#0x07`),e.push(`mov r4,a`),e.push(`mov a,#0x01`),e.push(`led_on_shift:`),e.push(`cjne r4,#0x00,led_on_do_shift`),e.push(`sjmp led_on_ready`),e.push(`led_on_do_shift:`),e.push(`rl a`),e.push(`dec r4`),e.push(`sjmp led_on_shift`),e.push(`led_on_ready:`),e.push(`cpl a`),e.push(`mov r7,a`),e.push(`mov r6,#0x07`),e.push(`call write`),e.push(`ret`),e.push(``)}function et(e){e.push(`seg_digit_to_pattern:`);for(let t=0;t<A.length;t++){let n=`seg_digit_${t+1}`;e.push(`cjne a,#${q(t)},${n}`),e.push(`mov a,#${q(A[t])}`),e.push(`ret`),e.push(`${n}:`)}e.push(`mov a,#0x00`),e.push(`ret`),e.push(``)}function tt(e,t){for(let[n,r]of t.entries()){e.push(`${n}:`);for(let t=0;t<r.length;t++){let i=`${n}_${t+1}`;e.push(`cjne a,#${q(t)},${i}`),e.push(`mov a,#${q(r[t])}`),e.push(`ret`),e.push(`${i}:`)}e.push(`mov a,#0xff`),e.push(`ret`),e.push(``)}}function nt(e){e.push(`delay:`),e.push(`mov r3,#20`),e.push(`d3:`),e.push(`mov r2,#255`),e.push(`d2:`),e.push(`mov r1,#255`),e.push(`d1:`),e.push(`djnz r1,d1`),e.push(`djnz r2,d2`),e.push(`djnz r3,d3`),e.push(`ret`),e.push(``)}function rt(e,t,n){n.push(`mov a,#${q(e)}`),n.push(`mov r5,#0x00`),n.push(`call lcd_write_byte`),t.needLcd=!0}function it(e,t,n){n.push(`mov a,#${q(e)}`),n.push(`mov r5,#0x01`),n.push(`call lcd_write_byte`),t.needLcd=!0}function at(e){let t=new Map,n=/\b(?:void|int|unsigned\s+char|unsigned\s+int|uint8_t|char|signed\s+char|signed\s+int|signed\s+long|unsigned\s+long|long|bit)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:interrupt\s+\d+)?\s*\{/gi,r;for(;r=n.exec(e);){let i=r[1].toLowerCase(),a=R(r[2]),o=n.lastIndex,s=1,c=o;for(;c<e.length&&s>0;){let t=e[c];t===`{`?s+=1:t===`}`&&--s,c+=1}if(s===0){let r=e.slice(o,c-1),s=e.slice(0,o).split(`
`).length-1;t.set(i,{name:i,body:r,lineOffset:s,params:a}),n.lastIndex=c}}return t}function R(e){let t=e.trim();if(!t||/^void$/i.test(t))return[];let n=[],r=`(?:data|idata|xdata|bdata|pdata|far|code)`;for(let e of V(t)){let t=e.trim().replace(/\s+/g,` `),i=RegExp(`^(?:${r}\\s+)?(?:(unsigned|signed)\\s+)?(char|int|long|bit|uint8_t)(?:\\s+${r})?\\s*(\\*)?\\s+([A-Za-z_]\\w*)$`,`i`).exec(t);if(!i)continue;let a=i[2].toLowerCase(),o=i[4].toLowerCase(),s=i[3]||a===`int`||a===`long`?2:1;n.push({name:o,size:s})}return n}function ot(e){let t=new Map,n=/\bconst\s+(?:unsigned\s+char|char|uint8_t)\s+code\s+([A-Za-z_]\w*)\s*\[\s*(?:\d+)?\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/gi,r;for(;r=n.exec(e);){let e=[];for(let t of V(r[2])){let n=H(t,{constants:new Map,arrays:new Map,sfr:new Map,sbit:new Map,vars:new Map,diagnostics:[]});n!=null&&e.push(n&255)}t.set(r[1].toLowerCase(),e)}let i=/(?:const\s+)?(?:unsigned\s+char|char|uint8_t)\s+code\s+([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*"([\s\S]*?)"\s*;/gi,a;for(;a=i.exec(e);){let e=a[2].replace(/\\n/g,`
`).replace(/\\r/g,`\r`).replace(/\\t/g,`	`).replace(/\\"/g,`"`).replace(/\\\\/g,`\\`);t.set(a[1].toLowerCase(),Array.from(e).map(e=>e.charCodeAt(0)&255).concat([0]))}return t}function st(e,t){let n=e.replace(/\b(?:void|int|unsigned\s+char|unsigned\s+int|uint8_t|char|signed\s+char|signed\s+int|signed\s+long|unsigned\s+long|long|bit)\s+[A-Za-z_]\w*\s*\([^)]*\)\s*(?:interrupt\s+\d+)?\s*\{[\s\S]*?\}/gi,``),r=/^\s*(?!(?:const|sfr|sbit|#))(?:(?:unsigned|signed)\s+)?(char|int|long|bit|uint8_t)(?:\s+(?:data|idata|xdata|bdata|pdata|far))?\s+([^;()]+);/gim,i;for(;i=r.exec(n);){let e=/^(?:int|long)$/i.test(i[1])?2:1;for(let n of V(i[2])){let r=/^([A-Za-z_]\w*)(?:\s*\[\s*(\d+)\s*\])?(?:\s*=\s*(.+))?$/.exec(n.trim());if(!r)continue;let i=r[2]?Math.max(1,Number(r[2])||1):1,a=L(r[1],t,e*i);r[3]&&!r[2]&&e===2&&Fe(a,r[3],0,t,[])}}}function ct(e){let t=new Map,n=/^\s*#define\s+([A-Za-z_]\w*)\s+([^\s/]+).*$/gim,r;for(;r=n.exec(e);)t.set(r[1].toLowerCase(),U(r[2])??r[2]);return t}function z(e){let t=new Map,n=/\b(?:sfr|__sfr)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi,r;for(;r=n.exec(e);){let e=U(r[2]);e&&t.set(r[1].toLowerCase(),e)}for(let[e,n]of[[`p0`,`0x80`],[`sp`,`0x81`],[`dpl`,`0x82`],[`dph`,`0x83`],[`p1`,`0x90`],[`p2`,`0xa0`],[`p3`,`0xb0`],[`psw`,`0xd0`],[`acc`,`0xe0`],[`b`,`0xf0`],[`ie`,`0xa8`],[`ip`,`0xb8`],[`scon`,`0x98`],[`sbuf`,`0x99`],[`adccon1`,`0xef`],[`adccon2`,`0xd8`],[`adcdatal`,`0xd9`],[`adcdatah`,`0xda`],[`tcon`,`0x88`],[`tmod`,`0x89`],[`tl0`,`0x8a`],[`tl1`,`0x8b`],[`th0`,`0x8c`],[`th1`,`0x8d`],[`t2con`,`0xc8`],[`t2mod`,`0xc9`],[`rcap2l`,`0xca`],[`rcap2h`,`0xcb`],[`tl2`,`0xcc`],[`th2`,`0xcd`],[`dac0l`,`0xf9`],[`dac0h`,`0xfa`],[`dac1l`,`0xfb`],[`dac1h`,`0xfc`],[`daccon`,`0xfd`],[`pwmcon`,`0xd7`],[`pwm0h`,`0xfb`],[`pwm0l`,`0xfa`],[`pwm1h`,`0xfd`],[`pwm1l`,`0xfc`]])t.has(e.toLowerCase())||t.set(e.toLowerCase(),n);return t}function lt(e){let t=new Map,n=/\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*P([0-3])\s*\^\s*([0-7])\s*;/gi,r;for(;r=n.exec(e);)t.set(r[1].toLowerCase(),`p${r[2]}.${r[3]}`);let i=/\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi;for(;r=i.exec(e);){let e=U(r[2]);e&&!t.has(r[1].toLowerCase())&&t.set(r[1].toLowerCase(),e)}return t.set(`wr`,`p3.6`),t.set(`rd`,`p3.7`),t.set(`int0`,`p3.2`),t.set(`int1`,`p3.3`),t.set(`t0`,`p3.4`),t.set(`t1`,`p3.5`),t.set(`adci`,`0xdf`),t.set(`sconv`,`0xdc`),t}function B(e){let t=[],n=0,r=0,i=``,a=1,o=1,s=null;for(let c=0;c<e.length;c++){let l=e[c],u=e[c-1];if(i+=l,l===`
`&&(a+=1),(l===`"`||l===`'`)&&u!==`\\`&&(s=s===l?null:s??l),!s&&(l===`(`&&(r+=1),l===`)`&&--r,l===`{`&&(n+=1),l===`}`&&--n,l===`;`&&n===0&&r===0||l===`}`&&n===0)){if(l===`}`&&/^\s*else\b/i.test(e.slice(c+1))||l===`;`&&/^\s*if\b/i.test(i)&&/^\s*else\b/i.test(e.slice(c+1))||l===`}`&&/^\s*while\s*\(/i.test(e.slice(c+1))&&/^\s*do\b/i.test(i))continue;let n=i.trim();n&&t.push({text:n,line:o}),i=``,o=a}}let c=i.trim();return c&&t.push({text:c,line:o}),t}function V(e){let t=[],n=0,r=``,i=null;for(let a=0;a<e.length;a++){let o=e[a],s=e[a-1];if((o===`"`||o===`'`)&&s!==`\\`&&(i=i===o?null:i??o),!i&&(o===`(`&&(n+=1),o===`)`&&--n,o===`,`&&n===0)){t.push(r.trim()),r=``;continue}r+=o}return r.trim()&&t.push(r.trim()),t}function H(e,t){let n=e.trim().replace(/^\((.*)\)$/,`$1`).replace(/;$/,``),r=t.constants?.get(n.toLowerCase());if(r)return H(r,t);if(/^~/.test(n)){let e=H(n.slice(1),t);if(e!=null)return~e&255}let i=/^'(?:\\(.)|([^\\]))'$/.exec(n);if(i)return(i[1]??i[2]).charCodeAt(0)&255;let a=ut(n,t);if(a!=null)return a&255;let o=U(n);return o?/^0x/i.test(o)?Number.parseInt(o.slice(2),16)&255:/^[01]+b$/i.test(o)?Number.parseInt(o.slice(0,-1),2)&255:/^0b/i.test(o)?Number.parseInt(o.slice(2),2)&255:Number.parseInt(o,10)&255:null}function ut(e,t){if(!/[+\-*/&|^~<>]/.test(e))return null;let n=e;for(let[e,r]of t.constants??new Map)n=n.replace(RegExp(`\\b${xt(e)}\\b`,`gi`),r);if(!/^[\dxa-fA-FbBoO\s()+\-*/&|^~<>]+$/.test(n))return null;n=n.replace(/\b([01]+)b\b/gi,(e,t)=>`0b${t}`);try{let e=Function(`"use strict"; return (${n});`)();return Number.isFinite(e)?Number(e)&255:null}catch{return null}}function U(e){let t=e.trim().replace(/[uUlL]+$/g,``);return/^0x[0-9a-f]+$/i.test(t)?t.toLowerCase():/^0[0-7]+$/.test(t)?`0x${Number.parseInt(t,8).toString(16)}`:/^\d+$/.test(t)?String(Number.parseInt(t,10)):/^0b[01]+$/i.test(t)?`${t.slice(2)}b`:/^[01]+b$/i.test(t)?t.toLowerCase():null}function W(e){let t=e.trim(),n=/^"([\s\S]*)"$/.exec(t);return n?n[1].replace(/\\n/g,`
`).replace(/\\r/g,`\r`).replace(/\\t/g,`	`).replace(/\\"/g,`"`).replace(/\\\\/g,`\\`):null}function dt(e){let t=e.trim();return!t||t.endsWith(`;`)||t.endsWith(`}`)?t:t+`;`}function G(e){return e.replace(/^\s+|\s+$/g,``)}function K(e,t){return e.labels+=1,`c_${t}_${e.labels}`}function ft(e){return e.toLowerCase().replace(/[^a-z0-9_$?]/g,`_`)}function q(e){return`0x`+(e&255).toString(16).padStart(2,`0`)}function pt(e){return e.replace(/\/\*[\s\S]*?\*\//g,``).split(`
`).map(e=>e.replace(/\/\/.*$/,``)).join(`
`)}function mt(e){return e.replace(/^\s*#\s*include\s+[<"][^>"]+[>"]\s*$/gim,``).replace(/\b__sfr\b/g,`sfr`).replace(/\b__sbit\b/g,`sbit`).replace(/\bvoid\s+main\s*\(\s*void\s*\)/gi,`void main()`).replace(/\binterrupt\s+\d+\s+using\s+\d+/gi,e=>e.replace(/using\s+\d+/i,``))}function ht(e){let t=e.trim(),n=!0;for(;n&&t.startsWith(`(`)&&t.endsWith(`)`);){n=!1;let e=0,r=!0,i=null;for(let n=0;n<t.length;n++){let a=t[n],o=t[n-1];if((a===`"`||a===`'`)&&o!==`\\`&&(i=i===a?null:i??a),!i&&(a===`(`&&e++,a===`)`&&e--,e===0&&n<t.length-1)){r=!1;break}}r&&(t=t.slice(1,-1).trim(),n=!0)}return t}function gt(e){let t=0,n=-1,r=null;for(let i=0;i<e.length;i++){let a=e[i],o=e[i-1];if((a===`"`||a===`'`)&&o!==`\\`&&(r=r===a?null:r??a),!r){if(a===`(`)t++;else if(a===`)`)t--;else if(a===`?`&&t===0){n=i;break}}}if(n<0)return null;t=0,r=null;for(let i=n+1;i<e.length;i++){let a=e[i],o=e[i-1];if((a===`"`||a===`'`)&&o!==`\\`&&(r=r===a?null:r??a),!r){if(a===`(`)t++;else if(a===`)`)t--;else if(a===`:`&&t===0)return{cond:e.slice(0,n).trim(),whenTrue:e.slice(n+1,i).trim(),whenFalse:e.slice(i+1).trim()}}}return null}function J(e,t){let n=[],r=0,i=0,a=null;for(let o=0;o<e.length;o++){let s=e[o],c=e[o-1];(s===`"`||s===`'`)&&c!==`\\`&&(a=a===s?null:a??s),!a&&(s===`(`?r++:s===`)`?r--:r===0&&e.slice(o,o+t.length)===t&&(n.push(e.slice(i,o).trim()),i=o+t.length,o+=t.length-1))}return n.length&&n.push(e.slice(i).trim()),n.length?n:[e]}function _t(e){let t=[`<<`,`>>`,`+`,`-`,`*`,`/`,`%`,`&`,`^`,`|`],n=0,r=null,i=null;for(let a=e.length-1;a>=0;a--){let o=e[a],s=e[a-1];if((o===`"`||o===`'`)&&s!==`\\`&&(r=r===o?null:r??o),!r&&(o===`)`?n++:o===`(`&&n--,n===0)){for(let n of t){let t=a-n.length+1;if(t<0||e.slice(t,a+1)!==n||(n===`+`||n===`-`)&&t===0)continue;let r=e.slice(0,t).trim(),o=e.slice(a+1).trim();if(!(!r||!o)){i={left:r,op:n,right:o};break}}if(i)break}}return i}function vt(e){e.push(`method_readkey:`),e.push(`mov a,#0x60`),e.push(`call keypad_read`),e.push(`cjne a,#0x0e,method_key_c1_r2`),e.push(`mov a,#0x01`),e.push(`ret`),e.push(`method_key_c1_r2:`),e.push(`cjne a,#0x0d,method_key_c1_r3`),e.push(`mov a,#0x04`),e.push(`ret`),e.push(`method_key_c1_r3:`),e.push(`cjne a,#0x0b,method_key_c1_r4`),e.push(`mov a,#0x07`),e.push(`ret`),e.push(`method_key_c1_r4:`),e.push(`cjne a,#0x07,method_key_col2`),e.push(`mov a,#0x0a`),e.push(`ret`),e.push(`method_key_col2:`),e.push(`mov a,#0x50`),e.push(`call keypad_read`),e.push(`cjne a,#0x0e,method_key_c2_r2`),e.push(`mov a,#0x02`),e.push(`ret`),e.push(`method_key_c2_r2:`),e.push(`cjne a,#0x0d,method_key_c2_r3`),e.push(`mov a,#0x05`),e.push(`ret`),e.push(`method_key_c2_r3:`),e.push(`cjne a,#0x0b,method_key_c2_r4`),e.push(`mov a,#0x08`),e.push(`ret`),e.push(`method_key_c2_r4:`),e.push(`cjne a,#0x07,method_key_col3`),e.push(`mov a,#0x00`),e.push(`ret`),e.push(`method_key_col3:`),e.push(`mov a,#0x30`),e.push(`call keypad_read`),e.push(`cjne a,#0x0e,method_key_c3_r2`),e.push(`mov a,#0x03`),e.push(`ret`),e.push(`method_key_c3_r2:`),e.push(`cjne a,#0x0d,method_key_c3_r3`),e.push(`mov a,#0x06`),e.push(`ret`),e.push(`method_key_c3_r3:`),e.push(`cjne a,#0x0b,method_key_c3_r4`),e.push(`mov a,#0x09`),e.push(`ret`),e.push(`method_key_c3_r4:`),e.push(`cjne a,#0x07,method_key_none`),e.push(`mov a,#0x0b`),e.push(`ret`),e.push(`method_key_none:`),e.push(`mov a,#0xff`),e.push(`ret`),e.push(``)}function yt(e){e.push(`static_display_l:`),e.push(`mov a,r6`),e.push(`anl a,#0x0f`),e.push(`call seg_digit_to_pattern`),e.push(`mov r7,a`),e.push(`mov r6,#0x01`),e.push(`call write`),e.push(`mov a,r6`),e.push(`swap a`),e.push(`anl a,#0x0f`),e.push(`call seg_digit_to_pattern`),e.push(`mov r7,a`),e.push(`mov r6,#0x02`),e.push(`call write`),e.push(`ret`),e.push(`static_display_h:`),e.push(`mov a,r6`),e.push(`anl a,#0x0f`),e.push(`call seg_digit_to_pattern`),e.push(`mov r7,a`),e.push(`mov r6,#0x03`),e.push(`call write`),e.push(`mov a,r6`),e.push(`swap a`),e.push(`anl a,#0x0f`),e.push(`call seg_digit_to_pattern`),e.push(`mov r7,a`),e.push(`mov r6,#0x04`),e.push(`call write`),e.push(`ret`),e.push(`static_display_low_byte:`),e.push(`call static_display_l`),e.push(`ret`),e.push(``)}function bt(e){e.push(`stepper_halfstep:`),e.push(`; A=0 forward, non-zero reverse. Simple ST841 half-step state demo.`),e.push(`mov r5,a`),e.push(`mov a,0x2f`),e.push(`jz stepper_init_state`),e.push(`sjmp stepper_have_state`),e.push(`stepper_init_state:`),e.push(`mov a,#0x01`),e.push(`stepper_have_state:`),e.push(`cjne r5,#0x00,stepper_reverse`),e.push(`rl a`),e.push(`anl a,#0x0f`),e.push(`jnz stepper_save`),e.push(`mov a,#0x01`),e.push(`sjmp stepper_save`),e.push(`stepper_reverse:`),e.push(`rr a`),e.push(`anl a,#0x0f`),e.push(`jnz stepper_save`),e.push(`mov a,#0x08`),e.push(`stepper_save:`),e.push(`mov 0x2f,a`),e.push(`mov r7,a`),e.push(`mov r6,#0x08`),e.push(`call write`),e.push(`ret`),e.push(`stepper_v:`),e.push(`jz stepper_v_done`),e.push(`jnb acc.7,stepper_v_forward`),e.push(`mov a,#0x01`),e.push(`call stepper_halfstep`),e.push(`sjmp stepper_v_done`),e.push(`stepper_v_forward:`),e.push(`mov a,#0x00`),e.push(`call stepper_halfstep`),e.push(`stepper_v_done:`),e.push(`ret`),e.push(``)}function xt(e){return e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`)}function St(e){let{board:t}=e,n=new fe(t),r=Q(`div`,{class:`minimalShell`}),i=Q(`div`,{class:`windowCard`});r.appendChild(i);let a=Q(`div`,{class:`windowChrome`});a.appendChild(Q(`div`,{class:`trafficLights`})).innerHTML=`<span class="red"></span><span class="yellow"></span><span class="green"></span>`,i.appendChild(a);let o=Q(`div`,{class:`toolbar`}),s=Tt(`Start`,`green`),c=Tt(`Reset`),l=Tt(`Step`),u=Tt(`Runner`),d=Q(`select`,{class:`samplePicker`});d.append(Ct(`asm`,`ASM`),Ct(`c`,`C`)),d.title=`Тип коду і розширення файлу`;let f=Q(`input`,{class:`fileNameInput mono`,value:`main`,title:`File name`}),p=Q(`div`,{class:`fileMenuWrap`}),m=Tt(`Файл ▾`);m.classList.add(`fileMenuBtn`);let h=Q(`div`,{class:`fileMenu hidden`}),ee=Q(`button`,{class:`fileMenuItem`,type:`button`});ee.textContent=`Відкрити файл`;let g=Q(`button`,{class:`fileMenuItem`,type:`button`});g.textContent=`Завантажити`;let _=Q(`button`,{class:`fileMenuItem autosaveMenuItem`,type:`button`});_.textContent=`Автозбереження`,_.title=`Зберегти код у браузері одним кліком. Галочка означає, що поточний код уже збережено.`;let v=Q(`input`,{type:`file`,accept:`.c,.h,.asm,.a51,.txt`,class:`hiddenFileInput`});h.append(ee,g,_),p.append(m,h,v);let y=Q(`div`,{class:`speedGroup`}),te=[1,10,100,1e3,1e4].map(e=>{let t=Tt(`${e}`,e===1?`speed active`:`speed`);return t.title=`Швидкість виконання ${e}`,t.addEventListener(`click`,()=>Vt(e)),y.appendChild(t),{speed:e,node:t}});o.append(s,c,l,f,d,p,u,y),i.appendChild(o);let ne=Q(`div`,{class:`debugModal hidden`}),re=Q(`div`,{class:`debugCard`}),ie=Q(`div`,{class:`debugHead`}),ae=Q(`div`,{class:`debugTitle`});ae.textContent=`Runner / registers / memory`;let oe=Tt(`Close`);oe.classList.add(`debugClose`),ie.append(ae,oe);let se=Q(`div`,{class:`debugBody`});re.append(ie,se),ne.appendChild(re),r.appendChild(ne);let ce=Q(`div`,{class:`mainRow`}),le=Q(`section`,{class:`boardPane`}),ue=Q(`section`,{class:`editorPane`});ce.append(le,ue),i.appendChild(ce);let b=Q(`div`,{class:`boardSurfaceMini`}),de=Q(`canvas`,{class:`boardCanvasMini`});de.width=720,de.height=720,b.appendChild(de),le.appendChild(b);let S=Q(`div`,{class:`boardOverlayMini`});b.appendChild(S),b.addEventListener(`pointerdown`,()=>{O.blur()});let C=Q(`div`,{class:`boardBox keypadBox`});C.appendChild(wt(`KEYPAD`));let w=Q(`div`,{class:`miniKeypad`});C.appendChild(w);for(let[e,n]of[`1`,`2`,`3`,`4`,`5`,`6`,`7`,`8`,`9`,`*`,`0`,`#`].entries()){let r=Q(`button`,{class:`miniKey`});r.textContent=n,r.addEventListener(`pointerdown`,n=>{r.classList.add(`active`),t.keypadPress(e,!0),$(),r.setPointerCapture(n.pointerId)});let i=()=>{r.classList.remove(`active`),t.keypadRelease(e),$()};r.addEventListener(`pointerup`,i),r.addEventListener(`pointercancel`,i),w.appendChild(r)}S.appendChild(C);let pe=Q(`div`,{class:`boardBox joystickBox`});pe.appendChild(wt(`ADC / JOYSTICK`));let he=Q(`div`,{class:`joystickFaceMini`}),ge=Q(`div`,{class:`joystickKnobMini`});he.appendChild(ge),pe.appendChild(he),S.appendChild(pe);let _e=Q(`div`,{class:`editorBox`}),ve=Q(`div`,{class:`editorTopMini`}),ye=Q(`div`,{class:`editorTitleLeft`}),be=Q(`div`,{class:`editorTag mono`});be.textContent=`ASM`;let T=Q(`div`,{class:`editorStatusChip mono idle`});T.textContent=``,ye.append(be,T);let xe=Q(`div`,{class:`runtimeBar mono`});ve.append(ye,xe),_e.appendChild(ve),T.addEventListener(`click`,()=>{let e=[...ot.entries()].find(([,e])=>e===`error`);e&&Wt(e[0])});let Se=Q(`div`,{class:`editorShell`}),E=Q(`pre`,{class:`lineNumbers mono`}),D=Q(`div`,{class:`execMarker`,title:`Current instruction`}),Ce=Q(`div`,{class:`editorStack`}),we=Q(`pre`,{class:`codeHighlight mono`}),O=Q(`textarea`,{class:`editorText spellcheck-false`}),Te=Q(`div`,{class:`editorScrollSlider`}),De=Q(`div`,{class:`editorScrollThumb`});Te.appendChild(De),O.spellcheck=!1,Ce.append(we,O);let Oe=Q(`div`,{class:`autocompleteMenu hidden`});Ce.appendChild(Oe);let k=Q(`pre`,{class:`autocompleteGhost mono hidden`});Ce.appendChild(k),Oe.addEventListener(`wheel`,e=>{ut&&e.stopPropagation()},{passive:!0}),Se.append(E,D,Ce,Te),_e.appendChild(Se);let ke=Q(`div`,{class:`statusStrip mono`});_e.appendChild(ke),ue.appendChild(_e);let A=`st841.editor.autosave.v2`,je=null,j=localStorage.getItem(`st841.editor.autosave.enabled`)!==`0`,Me=``,Ne=[],Pe=[],Fe=``,Ie=!1;function M(){return JSON.stringify({name:f.value||`main`,mode:R,text:O.value})}function Le(){let e=Me===M();if(_.classList.remove(`saved`,`dirty`,`disabled`),!j){_.innerHTML=`<span>Автозбереження</span><span class="autosaveIcon off">✕</span>`,_.title=`Автозбереження вимкнено. Натисни, щоб увімкнути.`,_.classList.add(`disabled`);return}e?(_.innerHTML=`<span>Автозбереження</span><span class="autosaveIcon on">✓</span>`,_.title=`Автозбереження увімкнено: код збережено. Натисни, щоб вимкнути.`,_.classList.add(`saved`)):(_.innerHTML=`<span>Автозбереження</span><span class="autosaveIcon off">✕</span>`,_.title=`Є незбережені зміни. Автозбереження збереже їх автоматично або натисни, щоб вимкнути.`,_.classList.add(`dirty`))}function Re(e=!0){let t={name:f.value||`main`,mode:R,text:O.value,savedAt:Date.now()};localStorage.setItem(A,JSON.stringify(t)),Me=M(),Le(),e&&(Ye.textContent=`autosaved ${Ve()}`)}function ze(){if(je!=null&&(window.clearTimeout(je),je=null),!j){Le();return}je=window.setTimeout(()=>{Re(!1),je=null},600)}function Be(){let e=localStorage.getItem(A);if(!e)return!1;try{let t=JSON.parse(e);return f.value=t.name||`main`,R=t.mode===`c`?`c`:`asm`,d.value=R,be.textContent=R.toUpperCase(),O.value=String(t.text||``).replace(/\r\n?/g,`
`),Me=M(),Le(),Ye.textContent=`restored ${Ve()}`,!0}catch{return!1}}function Ve(){return`${(f.value||`main`).trim().replace(/[\\/:*?"<>|]+/g,`_`).replace(/\.(c|h|asm|a51|txt)$/i,``)||`main`}.${R===`c`?`c`:`asm`}`}function He(e){!e||Ne.length&&Ne[Ne.length-1].text===e.text||(Ne.push(e),Ne.length>120&&Ne.shift())}function Ue(e=O.value){return{text:e,start:O.selectionStart??0,end:O.selectionEnd??O.selectionStart??0}}function We(){if(Ie){Fe=O.value;return}O.value!==Fe&&(He({text:Fe,start:O.selectionStart??0,end:O.selectionStart??0}),Fe=O.value,Pe=[])}function N(e){if(!e)return;Ie=!0,O.value=e.text,Fe=O.value,O.dispatchEvent(new Event(`input`,{bubbles:!0}));let t=O.value.length;O.focus(),O.setSelectionRange(Math.min(e.start??0,t),Math.min(e.end??e.start??0,t)),Ie=!1}function Ge(){let e=Ne.pop();e&&(Pe.push(Ue()),N(e))}function Ke(){let e=Pe.pop();e&&(Ne.push(Ue()),N(e))}function P(e){O.value=String(e??``).replace(/\r\n?/g,`
`),O.dispatchEvent(new Event(`input`,{bubbles:!0})),Ut(),Gt(),qt()}function qe(){h.classList.add(`hidden`)}m.addEventListener(`click`,e=>{e.stopPropagation(),h.classList.toggle(`hidden`)}),document.addEventListener(`click`,qe),h.addEventListener(`click`,e=>e.stopPropagation()),ee.addEventListener(`click`,()=>{qe(),v.click()}),v.addEventListener(`change`,async()=>{let e=v.files?.[0];if(!e)return;let t=await e.text(),n=e.name||`main`;f.value=n.replace(/\.(c|h|asm|a51|txt)$/i,``)||`main`,R=/\.(c|h)$/i.test(n)?`c`:`asm`,d.value=R,be.textContent=R.toUpperCase(),P(t),Re(),Ye.textContent=`opened ${n}`,v.value=``}),_.addEventListener(`click`,()=>{j=!j,localStorage.setItem(`st841.editor.autosave.enabled`,j?`1`:`0`),j?Re(!0):(je!=null&&(window.clearTimeout(je),je=null),Le(),Ye.textContent=`autosave off`),qe()}),g.addEventListener(`click`,()=>{qe();let e=new Blob([O.value.replace(/\n/g,`\r
`)],{type:`text/plain;charset=utf-8`}),t=document.createElement(`a`);t.href=URL.createObjectURL(e),t.download=Ve(),document.body.appendChild(t),t.click(),t.remove(),setTimeout(()=>URL.revokeObjectURL(t.href),500),Ye.textContent=`downloaded ${Ve()}`});let F=Q(`div`,{class:`splitHandle`,title:``});F.appendChild(Q(`div`,{class:`splitDot`})),i.appendChild(F);let I=Q(`section`,{class:`messagesPane`}),L=Q(`div`,{class:`messagesHead`}),Je=Q(`div`,{class:`messagesTitle`});Je.textContent=`Output`;let Ye=Q(`div`,{class:`messagesMeta mono`});L.append(Je,Ye),I.appendChild(L);let Xe=Q(`div`,{class:`messagesBody`});I.appendChild(Xe),i.appendChild(I);let Ze=de.getContext(`2d`);if(!Ze)throw Error(`No 2d context`);let Qe=Ze,$e=``,et=!1,tt=!1,nt=2048,rt=2048,it=!1,at=1,R=`asm`,ot=new Map,st=!1;n.setSpeed(Et(at));let ct=!1,z=[],lt=0,B=0,V=!1,H=null,ut=!1,U=0,W=[],dt=``,G=!1;function K(){let e=O.selectionStart??0,t=O.value.slice(0,e).match(/[A-Za-z_.$][A-Za-z0-9_.$#]$|[A-Za-z_.$][A-Za-z0-9_.$#]*$/);return t?t[0]:``}function ft(){let e=K();if(dt=e,!e||e.length<2){J();return}let t=e.toLowerCase();W=It.filter(e=>e.label!==`END`).filter(e=>(e.mode===R||e.mode===`both`)&&(e.trigger.toLowerCase().startsWith(t)||e.label.toLowerCase().startsWith(t)||e.trigger.toLowerCase().includes(t))).slice(0,120),U=-1,G=!1,q()}function q(){if(!W.length){J();return}ut=!0,Oe.classList.remove(`hidden`),Oe.innerHTML=W.map((e,t)=>`
      <button class="autocompleteItem ${G&&t===U?`active`:``}" data-index="${t}" type="button">
        <span class="autocompleteLabel">${Z(e.label)}</span>
        <span class="autocompleteDesc">${Z(e.description)}</span>
        <span class="autocompleteKey">Tab</span>
      </button>
    `).join(``);for(let e of Array.from(Oe.querySelectorAll(`.autocompleteItem`)))e.addEventListener(`mousemove`,()=>{let t=Number(e.dataset.index||`0`);(t!==U||!G)&&(U=t,G=!0,pt())}),e.addEventListener(`mousedown`,t=>{t.preventDefault(),_t(Number(e.dataset.index||`0`))});mt(),ht()}function pt(){for(let e of Array.from(Oe.querySelectorAll(`.autocompleteItem`)))e.classList.toggle(`active`,G&&Number(e.dataset.index||`0`)===U);mt(),ht()}function mt(){G&&Oe.querySelector(`.autocompleteItem.active`)?.scrollIntoView({block:`nearest`})}function ht(){let e=ut&&G&&U>=0?W[U]:null;if(!e||!dt){k.classList.add(`hidden`),k.innerHTML=``;return}let t=O.selectionStart??0;O.selectionEnd;let n=Math.max(0,t-dt.length),r=O.value.slice(0,n);k.classList.remove(`hidden`),k.innerHTML=`${Z(r)}<span class="autocompleteGhostInsert">${Z(e.insertText)}</span>`,gt()}function gt(){k.style.transform=`translate(${-O.scrollLeft}px, ${-O.scrollTop}px)`}function J(){k.classList.add(`hidden`),k.innerHTML=``,ut=!1,W=[],U=-1,G=!1,Oe.classList.add(`hidden`),Oe.innerHTML=``}function _t(e=U){if(e<0)return;let t=W[e];if(!t)return;let n=O.selectionStart??0,r=O.selectionEnd??n,i=Math.max(0,n-dt.length);O.setRangeText(t.insertText,i,r,`end`),J(),O.dispatchEvent(new Event(`input`,{bubbles:!0})),O.focus()}function vt(){O.dispatchEvent(new Event(`input`,{bubbles:!0}))}function yt(){let e=O.selectionStart??0,t=O.selectionEnd??e,n=O.value,r=n.lastIndexOf(`
`,Math.max(0,e-1))+1,i=n.slice(r,t);if(i.includes(`
`)){let n=i.replace(/^/gm,`  `);O.setRangeText(n,r,t,`end`),O.setSelectionRange(e+2,r+n.length)}else O.setRangeText(`  `,e,t,`end`);vt()}function bt(){let e=O.selectionStart??0,t=O.selectionEnd??e,n=O.value,r=n.lastIndexOf(`
`,Math.max(0,e-1))+1,i=n.slice(r,t).replace(/^( {1,2}|\t)/gm,``);O.setRangeText(i,r,t,`end`),O.setSelectionRange(Math.max(r,e-2),r+i.length),vt()}function xt(){let e=R===`c`?`//`:`;`,t=O.selectionStart??0,n=O.selectionEnd??t,r=O.value,i=r.lastIndexOf(`
`,Math.max(0,t-1))+1,a=n>t&&r[n-1]===`
`?n-1:n,o=r.indexOf(`
`,a),s=o===-1?r.length:o,c=r.slice(i,s).split(`
`),l=c.every(t=>t.trim()===``||t.replace(/^\s*/,``).startsWith(e)),u=c.map(t=>{if(t.trim()===``)return t;if(l){let n=t.match(/^\s*/)?.[0]||``;return n+t.slice(n.length).replace(e,``).replace(/^ /,``)}return t.replace(/^\s*/,t=>t+e+` `)}).join(`
`);O.setRangeText(u,i,s,`end`),O.setSelectionRange(i,i+u.length),vt()}function St(){let e=O.selectionStart??0,t=O.selectionEnd??e,n=O.value;if(e!==t){let r=n.slice(e,t);O.setRangeText(r+r,e,t,`end`),vt();return}let r=n.lastIndexOf(`
`,Math.max(0,e-1))+1,i=n.indexOf(`
`,e),a=i===-1?n.length:i,o=n.slice(r,a),s=i===-1?n.length:i+1,c=i===-1?`
`+o:o+`
`;O.setRangeText(c,s,s,`end`),O.setSelectionRange(s+c.length,s+c.length),vt()}O.addEventListener(`keydown`,e=>{let t=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&t===`z`){e.preventDefault(),e.shiftKey?Ke():Ge(),J();return}if((e.ctrlKey||e.metaKey)&&t===`y`){e.preventDefault(),Ke(),J();return}if((e.ctrlKey||e.metaKey)&&t===`s`){e.preventDefault(),e.shiftKey?g.click():Re();return}if((e.ctrlKey||e.metaKey)&&t===`o`){e.preventDefault(),ee.click();return}if((e.ctrlKey||e.metaKey)&&e.key===`/`){e.preventDefault(),xt(),J();return}if((e.ctrlKey||e.metaKey)&&t===`d`){e.preventDefault(),St(),J();return}if(!ut){if(e.key===`Tab`){e.preventDefault(),e.shiftKey?bt():yt(),J();return}return}e.key===`Tab`?(e.preventDefault(),G&&U>=0?_t():(e.shiftKey?bt():yt(),J())):e.key===`Enter`?J():e.key===`ArrowDown`?(e.preventDefault(),G=!0,U=U<0?0:(U+1)%W.length,pt()):e.key===`ArrowUp`?(e.preventDefault(),G=!0,U=U<0?W.length-1:(U-1+W.length)%W.length,pt()):e.key===`PageDown`?(e.preventDefault(),G=!0,U=U<0?0:Math.min(W.length-1,U+8),pt()):e.key===`PageUp`?(e.preventDefault(),G=!0,U=U<0?0:Math.max(0,U-8),pt()):e.key===`Home`?(e.preventDefault(),G=!0,U=0,pt()):e.key===`End`?(e.preventDefault(),G=!0,U=W.length-1,pt()):e.key===`Escape`&&(e.preventDefault(),J())}),O.addEventListener(`input`,()=>{We(),st=!1,Ut(),Gt(),qt(),ft(),Le(),ze(),H!=null&&window.clearTimeout(H),H=window.setTimeout(()=>{Gt(),At(!1),H=null},120)}),O.addEventListener(`paste`,e=>{let t=e.clipboardData?.getData(`text`);if(!t)return;e.preventDefault();let n=jt(t),r=O.selectionStart??0,i=O.selectionEnd??0;O.setRangeText(n,r,i,`end`),O.dispatchEvent(new Event(`input`,{bubbles:!0}))}),d.addEventListener(`change`,()=>{R=d.value===`c`?`c`:`asm`,be.textContent=R.toUpperCase(),J(),st=!1,Gt(),Le(),ze(),At(!0)}),f.addEventListener(`input`,()=>{Le(),ze()}),O.addEventListener(`scroll`,()=>{E.scrollTop=O.scrollTop,Kt(),qt(),Jt()}),Se.addEventListener(`wheel`,e=>{e.preventDefault(),O.scrollTop+=e.deltaY,E.scrollTop=O.scrollTop,qt(),Jt()},{passive:!1}),Te.addEventListener(`pointerdown`,e=>{ct=!0,Te.setPointerCapture(e.pointerId),Yt(e)}),Te.addEventListener(`pointermove`,e=>{ct&&Yt(e)}),Te.addEventListener(`pointerup`,()=>{ct=!1}),Te.addEventListener(`pointercancel`,()=>{ct=!1}),F.addEventListener(`pointerdown`,e=>{et=!0,F.setPointerCapture(e.pointerId)}),F.addEventListener(`pointermove`,e=>{if(!et)return;let t=i.getBoundingClientRect(),n=Math.max(28,Math.min(280,t.bottom-e.clientY));i.style.setProperty(`--messages-height`,`${n}px`)}),F.addEventListener(`pointerup`,()=>{et=!1}),he.addEventListener(`pointerdown`,e=>{tt=!0,he.setPointerCapture(e.pointerId),Zt(e)}),he.addEventListener(`pointermove`,e=>{tt&&Zt(e)});let kt=()=>{tt=!1,nt=2048,rt=2048,Xt()};he.addEventListener(`pointerup`,kt),he.addEventListener(`pointercancel`,kt),u.addEventListener(`click`,()=>{V=!V,ne.classList.toggle(`hidden`,!V),u.classList.toggle(`active`,V),V&&zt()}),oe.addEventListener(`click`,()=>{V=!1,ne.classList.add(`hidden`),u.classList.remove(`active`)}),s.addEventListener(`click`,async()=>{if(it){n.stop(),it=!1,t.reset(),await n.reset(),st=!1,nt=2048,rt=2048,Xt(),Bt(),$();return}if(At(!0).ok){if(!$e.trim()){Lt([],``,!0);return}await n.loadHex($e),st=!0,n.run(),it=!0,Bt(),$()}}),c.addEventListener(`click`,async()=>{n.stop(),it=!1,t.reset(),await n.reset(),st=!1,Bt(),$()}),l.addEventListener(`click`,async()=>{if(At(!1).ok){if(!$e.trim()){Lt([],``,!0);return}st||=(await n.loadHex($e),!0),n.step(1),it=!1,Bt(),$()}});function At(e=!1){if(R===`c`){let t=Ee(O.value);if(!t.ok){$e=``,z=[];let n=O.value.trim()?`errors`:``;return Lt(t.diagnostics,n,e),$(!1),{ok:!1,diagnostics:t.diagnostics,hex:``,pcToLine:[]}}let n=Ae(O.value);if(!n.ok)return $e=``,z=[],Lt(n.diagnostics,`errors`,e),$(!1),{ok:!1,diagnostics:n.diagnostics,hex:``,pcToLine:[]};let r=me(n.asm);$e=r.hex,z=[];let i=[...t.diagnostics.filter(e=>e.level!==`hint`),...n.diagnostics,...r.diagnostics];return Lt(i,O.value.trim()?r.ok?`ok`:`errors`:``,e),$(r.ok),{ok:r.ok,diagnostics:i,hex:r.hex,pcToLine:[]}}let t=me(O.value);$e=t.hex,z=t.pcToLine;let n=O.value.trim()?t.ok?`ok`:`errors`:``;return Lt(t.diagnostics,n,e),$(t.ok),{ok:t.ok,diagnostics:t.diagnostics,hex:t.hex,pcToLine:t.pcToLine}}function Lt(e,t,n=!1){e=e.filter(e=>e.level!==`hint`),Xe.replaceChildren(),ot=Nt(e),Gt();let r=e.filter(e=>e.level===`error`).length,i=e.filter(e=>e.level===`warning`).length;Ye.textContent=`${r} / ${i}`,Rt(r,i,t);let a=(e,t=`info`,n=null)=>{let r=document.createElement(n==null?`div`:`button`);r.className=`diagOutputLine ${t}${n==null?``:` clickable`}`,r.textContent=e,n!=null&&(r.type=`button`,r.addEventListener(`click`,()=>Wt(n))),Xe.appendChild(r)};for(let t of e)a(`${t.line==null?``:`L${t.line}  `}${t.message||(t.level===`error`?`Помилка компіляції`:`Повідомлення`)}`,t.level||`info`,t.line??null);!e.length&&t&&a(t===`errors`?`Є помилка, але компілятор не повернув текст діагностики.`:`OK`,t===`errors`?`error`:`ok`),n&&(Xe.scrollTop=0),ke.textContent=t}function Rt(e,t,n=``){if(T.classList.remove(`ok`,`error`,`idle`),!O.value.trim()&&!n){T.textContent=``,T.classList.add(`idle`);return}if(e>0){T.textContent=e===1?`ERROR`:`ERROR ${e}`,T.classList.add(`error`),T.title=`Є помилки. Натисни, щоб перейти до першої помилки.`;return}T.textContent=`OK`,T.classList.add(`ok`),T.title=t>0?`OK, warnings: ${t}`:`Код без помилок`}function $(e=!0){it=n.isRunning(),Ot(n.getTrace(64),n.getPC(),z),Bt(),xe.textContent=[e?n.isRunning()?`RUNNING`:`READY`:`ERROR`,`PC ${X(n.getPC())}`,`L${z.find(e=>(e.pc&65535)==(n.getPC()&65535))?.line??`-`}`,`OP ${Y(n.readCode(n.getPC()))}`,Dt(n),`ACC ${Y(n.getSfr(x.acc))}`,`P0 ${Y(t.readPort(`P0`))}`,`P2 ${Y(t.readPort(`P2`))}`,`x${at}`,n.isRunning()?`RUN`:`STOP`].join(`   `),zt(),Jt()}function zt(){if(!V)return;let e=performance.now();if(n.isRunning()&&e-B<240)return;B=e;let r=n.getTrace(64),i=n.getPC()&65535,a=n.readCode(i)&255,o=Ot(r,i,z),s=z.find(e=>(e.pc&65535)===i),c=z.filter(e=>(e.pc&65535)<=i).sort((e,t)=>t.pc-e.pc)[0],l=s?.line??c?.line??null,u=l==null?``:O.value.split(/\r?\n/)[l-1]??``,d=s?`точно`:c?`найближча`:`нема`,f=n.isRunning()?`RUN`:`STOP`,p=(n.getSfr(x.p3)>>6&1)==1?`TX / запис`:`RX / читання`,m=n.getSfr(x.psw),h=m>>3&3,ee=h*8,g=n.getSfr(x.sp),_=(g-7&255).toString(10),v=Array.from({length:8},(e,t)=>[`R${t}`,Y(n.readIram(ee+t))]),y=[[`PC`,X(i)],[`OP`,Y(a)],[`ASM`,l==null?`-`:`L${l}`],[`ACC`,Y(n.getSfr(x.acc))],[`B`,Y(n.getSfr(x.b))],[`PSW`,Y(m)],[`SP`,Y(g)],[`DPTR`,`${Y(n.getSfr(x.dph))}${Y(n.getSfr(x.dpl)).slice(2)}`]],te=[[`P0 / шина даних`,Y(n.getSfr(x.p0))],[`P1`,Y(n.getSfr(x.p1))],[`P2 / адреса`,Y(n.getSfr(x.p2))],[`P3`,Y(n.getSfr(x.p3))],[`P3.6 режим`,p]],ne=[[`IE`,Y(n.getSfr(x.ie))],[`IP`,Y(n.getSfr(x.ip))],[`TCON`,Y(n.getSfr(x.tcon))],[`TMOD`,Y(n.getSfr(x.tmod))],[`ADCCON1`,Y(n.getSfr(239))],[`ADCCON2`,Y(n.getSfr(216))],[`ADCDATAL`,Y(n.getSfr(217))],[`ADCDATAH`,Y(n.getSfr(218))]],re=t.getPressedKeys().map(e=>[`1`,`2`,`3`,`4`,`5`,`6`,`7`,`8`,`9`,`*`,`0`,`#`][e]??`?`).join(` `),ie=t.getKeypadBusPreview(),ae=t.getJoystick(),oe=typeof t.extraDevices.lcd?.getDebugRows==`function`?t.extraDevices.lcd.getDebugRows():[],ce=[0,1,2,3,4,5,6,7].map(e=>{let t=g-e&255;return[Y(t),Y(n.readIram(t)),e===0?`SP`:``]}),le=[];for(let e=0;e<32;e+=8)le.push([Y(e),[0,1,2,3,4,5,6,7].map(t=>Y(n.readIram(e+t))).join(` `)]);let ue=[0,1,2,3,4,5,6,7].map(e=>Y(n.readXram(e))).join(` `),b=r.slice(-22).map(e=>{let t=(e.pc&65535)===i,n=z.find(t=>(t.pc&65535)==(e.pc&65535));return`<tr class="${t?`runnerCurrentRow`:``}"><td>${Z(String(e.tick))}</td><td>${X(e.pc)}</td><td>${Y(e.opcode)}</td><td>${n?`L${n.line}`:`-`}</td><td>${Y(e.acc)}</td><td>${Y(e.p0)}</td><td>${Y(e.p2)}</td></tr>`}).join(``),de=[0,1,2,3].map(e=>Y(n.readCode(i+e))).join(` `),S=(e,t,n=``)=>`<div class="runnerKv ${n}"><span>${Z(e)}</span><b>${Z(String(t))}</b></div>`,fe=e=>e.map(([e,t])=>S(e,t)).join(``),C=(e,t,n=``)=>`<section class="runnerCard ${n}"><h3>${Z(e)}</h3>${t}</section>`,w=(e,t)=>`<table class="runnerTable"><thead><tr>${t.map(e=>`<th>${Z(e)}</th>`).join(``)}</tr></thead><tbody>${e.map(e=>`<tr>${e.map(e=>`<td>${Z(String(e))}</td>`).join(``)}</tr>`).join(``)}</tbody></table>`;se.innerHTML=`
      <div class="runnerPanel">
        <section class="runnerHero">
          <div>
            <div class="runnerLabel">Зараз виконується</div>
            <div class="runnerInstruction mono">${Z(Dt(n))}</div>
            <pre class="runnerSourceLine mono">${l==null?`L-  `:`L${l}  `}${Z(u||`-`)}</pre>
          </div>
          <div class="runnerStatusBox mono">
            <span class="runnerPill ${n.isRunning()?`run`:`stop`}">${f}</span>
            <span>PC ${X(i)}</span>
            <span>OP ${Y(a)}</span>
            <span>bytes ${de}</span>
            <span>line: ${d}</span>
          </div>
        </section>

        <div class="runnerGrid">
          ${C(`Ввід / шини`,`
            ${S(`P3.6`,p,p.startsWith(`RX`)?`warn`:`ok`)}
            ${S(`Натиснуто`,re||`-`)}
            ${S(`Keypad col1`,Y(ie.col1))}
            ${S(`Keypad col2`,Y(ie.col2))}
            ${S(`Keypad col3`,Y(ie.col3))}
            ${S(`Joystick X`,ae.x)}
            ${S(`Joystick Y`,ae.y)}
          `)}

          ${C(`Регістри CPU`,fe(y)+`<div class="runnerSub mono">Bank ${h} · SP delta +${_}</div>`)}

          ${C(`Порти / SFR`,fe(te)+`<hr class="runnerHr"/>`+fe(ne))}

          ${C(`R0–R7 активного банку`,fe(v))}

          ${C(`LCD`,`<pre class="runnerPre mono">${Z(oe.join(`
`)||`-`)}</pre>`,`wide lcdCard`)}

          ${C(`Стек`,w(ce,[`Addr`,`Value`,`Mark`]))}

          ${C(`IRAM 0x00..0x1F`,w(le,[`Addr`,`Bytes`])+`${S(`XRAM 00..07`,ue)}`)}

          ${C(`Потік виконання`,`
            ${S(`current PC`,X(i))}
            ${S(`ASM line`,l==null?`-`:`L${l}`)}
            ${S(`last known`,o.lastKnown)}
            ${S(`last CALL/RET`,o.lastCallRet)}
            ${S(`same-PC streak`,o.streak)}
            ${S(`recent PCs`,o.recent)}
          `,`wide`)}
        </div>

        <section class="runnerCard runnerTraceCard">
          <h3>Trace — останні інструкції</h3>
          <table class="runnerTrace mono">
            <thead><tr><th>tick</th><th>PC</th><th>OP</th><th>ASM</th><th>ACC</th><th>P0</th><th>P2</th></tr></thead>
            <tbody>${b||`<tr><td colspan="7">-</td></tr>`}</tbody>
          </table>
        </section>
      </div>
    `}function Bt(){s.textContent=it?`Stop`:`Start`,s.className=`topBtn ${it?`red`:`green`}`}function Vt(e){at=e,n.setSpeed(Et(at)),Ht(),$()}function Ht(){for(let e of te){let t=e.speed===at;e.node.textContent=`${e.speed}`,e.node.className=`topBtn speed ${t?`active`:``}`.trim()}}function Ut(){let e=O.value.replace(/\r/g,``),t=Math.max(1,e.split(`
`).length);E.textContent=Array.from({length:t},(e,t)=>String(t+1)).join(`
`),E.scrollTop=O.scrollTop,Jt()}function Wt(e){let t=O.value.replace(/\r/g,``).split(`
`),n=Math.max(1,Math.min(Number(e)||1,t.length)),r=0;for(let e=0;e<n-1;e++)r+=t[e].length+1;let i=r+(t[n-1]?.length??0);O.focus(),O.setSelectionRange(r,i),O.scrollTop=Math.max(0,(n-1)*(13*1.55)-O.clientHeight/3),E.scrollTop=O.scrollTop,Kt(),qt(),Jt()}function Gt(){we.innerHTML=Mt(R===`c`?Ft(O.value):Pt(O.value),ot,O.value.endsWith(`
`)),Kt()}function Kt(){we.style.transform=`translate(${-O.scrollLeft}px, ${-O.scrollTop}px)`,gt()}function qt(){let e=Math.max(1,O.scrollHeight-O.clientHeight),t=Math.max(0,Math.min(100,O.scrollTop/e*100)),n=De.offsetHeight||34,r=Te.clientHeight,i=Math.max(0,r-n);De.style.top=`${t/100*i}px`}function Jt(){if(R!==`asm`||!st||!z.length){D.style.setProperty(`--marker-opacity`,`0`);return}let e=n.getPC()&65535,t=z.find(t=>t.pc===e);if(!t){D.style.setProperty(`--marker-opacity`,`0`);return}let r=Math.max(1,O.value.replace(/\r/g,``).split(`
`).length);if(t.line>r){D.style.setProperty(`--marker-opacity`,`0`);return}let i=13*1.55,a=10+(t.line-1)*i-O.scrollTop+i/2-4;if(a<-8||a>O.clientHeight+8){D.style.setProperty(`--marker-opacity`,`0`);return}D.style.setProperty(`--marker-top`,`${Math.round(a)}px`),D.style.setProperty(`--marker-opacity`,`1`)}function Yt(e){let t=Te.getBoundingClientRect(),n=De.offsetHeight||34,r=Math.max(0,Math.min(t.height-n,e.clientY-t.top-n/2));O.scrollTop=(t.height>n?r/(t.height-n):0)*Math.max(1,O.scrollHeight-O.clientHeight)}function Xt(){t.setJoystick(nt,rt);let e=(nt-2048)/2047,n=(rt-2048)/2047;ge.style.left=`${50+e*34}%`,ge.style.top=`${50+n*34}%`}function Zt(e){let t=he.getBoundingClientRect(),n=t.width/2,r=t.height/2,i=Math.max(6,Math.min(t.width,t.height)/2-17-2),a=e.clientX-t.left-n,o=e.clientY-t.top-r,s=Math.hypot(a,o);if(s>i){let e=i/s;a*=e,o*=e}let c=a/i,l=o/i;nt=Math.round(2048+c*2047),rt=Math.round(2048+l*2047),Xt()}function Qt(){t.render(Qe,de.width,de.height);let e=performance.now();(!n.isRunning()||e-lt>=100)&&($(),lt=e),window.requestAnimationFrame(Qt)}return Be()||(Fe=O.value,Le()),Ht(),Ut(),Gt(),qt(),At(!1),Xt(),window.requestAnimationFrame(Qt),r}function Ct(e,t){let n=document.createElement(`option`);return n.value=e,n.textContent=t,n}function wt(e){let t=Q(`div`,{class:`boardCaption mono`});return t.textContent=e,t}function Tt(e,t=``){let n=Q(`button`,{class:`topBtn ${t}`.trim()});return n.textContent=e,n}function Y(e){return`0x`+(e&255).toString(16).padStart(2,`0`).toUpperCase()}function X(e){return`0x`+(e&65535).toString(16).padStart(4,`0`).toUpperCase()}function Et(e){return Math.max(1,Math.round(e*16700))}function Dt(e){let t=e.getPC(),n=e.readCode(t);return n>=120&&n<=127?`MOV R${n-120},#${Y(e.readCode(t+1))}`:n>=216&&n<=223?`DJNZ R${n-216}`:n===0?`NOP`:n===2?`LJMP ${X(e.readCode(t+1)<<8|e.readCode(t+2))}`:n===3?`RR A`:n===18?`LCALL ${X(e.readCode(t+1)<<8|e.readCode(t+2))}`:n===34?`RET`:n===50?`RETI`:n===116?`MOV A,#${Y(e.readCode(t+1))}`:n===117?`MOV ${Y(e.readCode(t+1))},#${Y(e.readCode(t+2))}`:n===128?`SJMP`:n===160?`ORL C,/bit`:n===210?`SETB ${Y(e.readCode(t+1))}`:n===245?`MOV ${Y(e.readCode(t+1))},A`:n>=232&&n<=239?`MOV A,R${n-232}`:`EXEC`}function Ot(e,t,n){let r=t&65535,i=n.find(e=>e.pc===r),a=i?`ASM line: ${i.line}`:`ASM line: -`,o=0;for(let t=e.length-1;t>=0&&(e[t].pc&65535)===r;t--)o+=1;let s=e.slice(-10).map(e=>X(e.pc)).join(` -> `),c=n.map(e=>e.pc&65535);c.length&&Math.min(...c),c.length&&Math.max(...c);let l=r>=0&&r<=65535,u=n.filter(e=>(e.pc&65535)<=r).sort((e,t)=>t.pc-e.pc)[0],d=[...e].reverse().find(e=>kt(e.opcode)),f=d?`${X(d.pc)} OP ${Y(d.opcode)} ${At(d.opcode)}`:`-`;return{current:`current PC: ${X(r)}`,line:a,streak:o,recent:s||`-`,range:`0x0000 .. 0xFFFF`,inRange:l?`yes`:`no`,lastKnown:u?`PC ${X(u.pc)} line ${u.line}`:`-`,lastCallRet:f}}function kt(e){let t=e&255;return t===18||t===34||t===50?!0:(t&31)==17}function At(e){let t=e&255;return t===18?`LCALL`:(t&31)==17?`ACALL`:t===34?`RET`:t===50?`RETI`:`OP`}function jt(e){return e.replace(/\r\n?/g,`
`).replace(/\n{3,}/g,`

`)}function Mt(e,t,n){return e.split(`
`).map((e,n)=>{let r=n+1,i=t.get(r);return i?`<span class="${i===`error`?`diag-line diag-error`:`diag-line diag-warning`}">${e||` `}</span>`:e||` `}).join(`
`)+(n?`
`:``)}function Nt(e){let t=new Map;for(let n of e)n.line!=null&&n.level===`error`&&t.set(n.line,`error`);return t}function Pt(e){return e.split(`
`).map(e=>Lt(e)).join(`
`)}function Ft(e){return Rt(e)}function Z(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}var It=[{mode:`asm`,trigger:`mov`,label:`MOV`,description:`8051 move instruction`,insertText:`MOV `},{mode:`asm`,trigger:`movimm`,label:`MOV immediate`,description:`MOV A,#0x00`,insertText:`MOV A,#0x00`},{mode:`asm`,trigger:`movp0`,label:`MOV P0 immediate`,description:`MOV P0,#0x00`,insertText:`MOV P0,#0x00`},{mode:`asm`,trigger:`movp2`,label:`MOV P2 immediate`,description:`MOV P2,#0x00`,insertText:`MOV P2,#0x00`},{mode:`asm`,trigger:`setb`,label:`SETB bit`,description:`SETB `,insertText:`SETB `},{mode:`asm`,trigger:`clr`,label:`CLR bit/A/C`,description:`CLR `,insertText:`CLR `},{mode:`asm`,trigger:`call`,label:`CALL label`,description:`CALL `,insertText:`CALL `},{mode:`asm`,trigger:`ret`,label:`RET`,description:`RET`,insertText:`RET`},{mode:`asm`,trigger:`jmp`,label:`JMP label`,description:`JMP `,insertText:`JMP `},{mode:`asm`,trigger:`sjmp`,label:`SJMP label`,description:`SJMP `,insertText:`SJMP `},{mode:`asm`,trigger:`djnz`,label:`DJNZ loop`,description:`DJNZ R7,`,insertText:`DJNZ R7,`},{mode:`asm`,trigger:`cjne`,label:`CJNE compare`,description:`CJNE A,#0x00,`,insertText:`CJNE A,#0x00,`},{mode:`asm`,trigger:`jnb`,label:`JNB bit,label`,description:`JNB `,insertText:`JNB `},{mode:`asm`,trigger:`jb`,label:`JB bit,label`,description:`JB `,insertText:`JB `},{mode:`asm`,trigger:`jz`,label:`JZ label`,description:`JZ `,insertText:`JZ `},{mode:`asm`,trigger:`jnz`,label:`JNZ label`,description:`JNZ `,insertText:`JNZ `},{mode:`asm`,trigger:`inc`,label:`INC`,description:`INC `,insertText:`INC `},{mode:`asm`,trigger:`dec`,label:`DEC`,description:`DEC `,insertText:`DEC `},{mode:`asm`,trigger:`add`,label:`ADD A,#imm`,description:`ADD A,#0x00`,insertText:`ADD A,#0x00`},{mode:`asm`,trigger:`subb`,label:`SUBB A,#imm`,description:`SUBB A,#0x00`,insertText:`SUBB A,#0x00`},{mode:`asm`,trigger:`anl`,label:`ANL A,#mask`,description:`ANL A,#0x0F`,insertText:`ANL A,#0x0F`},{mode:`asm`,trigger:`orl`,label:`ORL A,#mask`,description:`ORL A,#0x00`,insertText:`ORL A,#0x00`},{mode:`asm`,trigger:`xrl`,label:`XRL A,#mask`,description:`XRL A,#0x00`,insertText:`XRL A,#0x00`},{mode:`asm`,trigger:`rl`,label:`RL A`,description:`RL A`,insertText:`RL A`},{mode:`asm`,trigger:`rr`,label:`RR A`,description:`RR A`,insertText:`RR A`},{mode:`asm`,trigger:`swap`,label:`SWAP A`,description:`SWAP A`,insertText:`SWAP A`},{mode:`asm`,trigger:`org`,label:`ORG`,description:`ORG 0x0000`,insertText:`ORG 0x0000`},{mode:`asm`,trigger:`equ`,label:`EQU`,description:`NAME EQU 0x20`,insertText:`NAME EQU 0x20`},{mode:`asm`,trigger:`data`,label:`DATA SFR alias`,description:`ADCCON2 DATA 0D8H`,insertText:`ADCCON2 DATA 0D8H`},{mode:`asm`,trigger:`bit`,label:`BIT alias`,description:`ADCI BIT 0DFH`,insertText:`ADCI BIT 0DFH`},{mode:`asm`,trigger:`db`,label:`DB bytes`,description:`DB 0x00`,insertText:`DB 0x00`},{mode:`asm`,trigger:`dw`,label:`DW word`,description:`DW 0x0000`,insertText:`DW 0x0000`},{mode:`asm`,trigger:`base`,label:`ASM base template`,description:`ORG 0x0000

START:
    MOV SP,#0x2F

MAIN:
    JMP MAIN

END`,insertText:`ORG 0x0000

START:
    MOV SP,#0x2F

MAIN:
    JMP MAIN

END`},{mode:`asm`,trigger:`write`,label:`ST841 write routine`,description:`WRIT:
    SETB P3.6
    MOV P0,DAT
    MOV P2,ADR
    NOP
    MOV P2,#0x00
    RET`,insertText:`WRIT:
    SETB P3.6
    MOV P0,DAT
    MOV P2,ADR
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`buswrite`,label:`Direct ST841 bus write`,description:`SETB P3.6
MOV P0,#0x00
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`SETB P3.6
MOV P0,#0x00
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`delay`,label:`Delay routine`,description:`DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET`,insertText:`DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET`},{mode:`asm`,trigger:`ledoff`,label:`LED line off`,description:`MOV P0,#11111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`ledall`,label:`LED line all on`,description:`MOV P0,#00000000b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#00000000b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led1`,label:`LED 1 on`,description:`MOV P0,#11111110b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11111110b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led2`,label:`LED 2 on`,description:`MOV P0,#11111101b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11111101b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led3`,label:`LED 3 on`,description:`MOV P0,#11111011b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11111011b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led4`,label:`LED 4 on`,description:`MOV P0,#11110111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11110111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led5`,label:`LED 5 on`,description:`MOV P0,#11101111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11101111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led6`,label:`LED 6 on`,description:`MOV P0,#11011111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#11011111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led7`,label:`LED 7 on`,description:`MOV P0,#10111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#10111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`led8`,label:`LED 8 on`,description:`MOV P0,#01111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`,insertText:`MOV P0,#01111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`ledrun`,label:`LED running light`,description:`MAIN:
    MOV P0,#11111110b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    MOV P0,#11111101b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    JMP MAIN`,insertText:`MAIN:
    MOV P0,#11111110b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    MOV P0,#11111101b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    JMP MAIN`},{mode:`asm`,trigger:`adcregs`,label:`ADuC ADC register aliases`,description:`ADCCON1  DATA 0EFH
ADCCON2  DATA 0D8H
ADCDATAL DATA 0D9H
ADCDATAH DATA 0DAH
ADCI     BIT 0DFH
SCONV    BIT 0DCH`,insertText:`ADCCON1  DATA 0EFH
ADCCON2  DATA 0D8H
ADCDATAL DATA 0D9H
ADCDATAH DATA 0DAH
ADCI     BIT 0DFH
SCONV    BIT 0DCH`},{mode:`asm`,trigger:`adc6`,label:`Read joystick X ADC6`,description:`READ_ADC6:
    MOV ADCCON2,#6h
    CLR ADCI
    SETB SCONV
WAIT_ADC6:
    JNB ADCI,WAIT_ADC6
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`,insertText:`READ_ADC6:
    MOV ADCCON2,#6h
    CLR ADCI
    SETB SCONV
WAIT_ADC6:
    JNB ADCI,WAIT_ADC6
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`},{mode:`asm`,trigger:`adc7`,label:`Read joystick Y ADC7`,description:`READ_ADC7:
    MOV ADCCON2,#7h
    CLR ADCI
    SETB SCONV
WAIT_ADC7:
    JNB ADCI,WAIT_ADC7
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`,insertText:`READ_ADC7:
    MOV ADCCON2,#7h
    CLR ADCI
    SETB SCONV
WAIT_ADC7:
    JNB ADCI,WAIT_ADC7
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`},{mode:`asm`,trigger:`joyled`,label:`Joystick X to LED`,description:`MAIN:
    CALL READ_ADC6
    CJNE A,#0x08,JOY_LEFT
    MOV P0,#11100111b
    SJMP JOY_OUT
JOY_LEFT:
    JC JOY_LOW
    MOV P0,#01111111b
    SJMP JOY_OUT
JOY_LOW:
    MOV P0,#11111110b
JOY_OUT:
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    JMP MAIN`,insertText:`MAIN:
    CALL READ_ADC6
    CJNE A,#0x08,JOY_LEFT
    MOV P0,#11100111b
    SJMP JOY_OUT
JOY_LEFT:
    JC JOY_LOW
    MOV P0,#01111111b
    SJMP JOY_OUT
JOY_LOW:
    MOV P0,#11111110b
JOY_OUT:
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    JMP MAIN`},{mode:`asm`,trigger:`keypadcols`,label:`Keypad column read constants`,description:`; P2=0x60 col1, P2=0x50 col2, P2=0x30 col3
; row values: 0x0E,0x0D,0x0B,0x07`,insertText:`; P2=0x60 col1, P2=0x50 col2, P2=0x30 col3
; row values: 0x0E,0x0D,0x0B,0x07`},{mode:`asm`,trigger:`keycol1`,label:`Read keypad column 1`,description:`CLR P3.6
MOV P2,#0x60
MOV A,P0
ANL A,#0x0F`,insertText:`CLR P3.6
MOV P2,#0x60
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`keycol2`,label:`Read keypad column 2`,description:`CLR P3.6
MOV P2,#0x50
MOV A,P0
ANL A,#0x0F`,insertText:`CLR P3.6
MOV P2,#0x50
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`keycol3`,label:`Read keypad column 3`,description:`CLR P3.6
MOV P2,#0x30
MOV A,P0
ANL A,#0x0F`,insertText:`CLR P3.6
MOV P2,#0x30
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`lcdaddr`,label:`LCD address write`,description:`MOV P0,DAT
MOV P2,#0x08
NOP
MOV P2,#0x00`,insertText:`MOV P0,DAT
MOV P2,#0x08
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`lcdclear`,label:`LCD clear command nibbles`,description:`MOV P0,#0x00
MOV P2,#0x08
NOP
MOV P2,#0x00
MOV P0,#0x10
MOV P2,#0x08
NOP
MOV P2,#0x00`,insertText:`MOV P0,#0x00
MOV P2,#0x08
NOP
MOV P2,#0x00
MOV P0,#0x10
MOV P2,#0x08
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`lcdchar3`,label:`LCD print character 3`,description:`MOV P0,#0x31
MOV P2,#0x08
NOP
MOV P2,#0x00
MOV P0,#0x31
MOV P2,#0x08
NOP
MOV P2,#0x00`,insertText:`MOV P0,#0x31
MOV P2,#0x08
NOP
MOV P2,#0x00
MOV P0,#0x31
MOV P2,#0x08
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`sp`,label:`Safe stack pointer`,description:`MOV SP,#0x2F`,insertText:`MOV SP,#0x2F`},{mode:`asm`,trigger:`xramwrite`,label:`MOVX write @DPTR`,description:`MOV DPTR,#0x2000
MOV A,#0x55
MOVX @DPTR,A`,insertText:`MOV DPTR,#0x2000
MOV A,#0x55
MOVX @DPTR,A`},{mode:`asm`,trigger:`xramread`,label:`MOVX read @DPTR`,description:`MOV DPTR,#0x2000
MOVX A,@DPTR`,insertText:`MOV DPTR,#0x2000
MOVX A,@DPTR`},{mode:`asm`,trigger:`acall`,label:`ACALL`,description:`8051 instruction mnemonic`,insertText:`ACALL `},{mode:`asm`,trigger:`add`,label:`ADD`,description:`8051 instruction mnemonic`,insertText:`ADD `},{mode:`asm`,trigger:`ajmp`,label:`AJMP`,description:`8051 instruction mnemonic`,insertText:`AJMP `},{mode:`asm`,trigger:`anl`,label:`ANL`,description:`8051 instruction mnemonic`,insertText:`ANL `},{mode:`asm`,trigger:`cjb`,label:`CJB`,description:`8051 instruction mnemonic`,insertText:`CJB `},{mode:`asm`,trigger:`cjne`,label:`CJNE`,description:`8051 instruction mnemonic`,insertText:`CJNE `},{mode:`asm`,trigger:`clr`,label:`CLR`,description:`8051 instruction mnemonic`,insertText:`CLR `},{mode:`asm`,trigger:`cpl`,label:`CPL`,description:`8051 instruction mnemonic`,insertText:`CPL `},{mode:`asm`,trigger:`da`,label:`DA`,description:`8051 instruction mnemonic`,insertText:`DA `},{mode:`asm`,trigger:`dec`,label:`DEC`,description:`8051 instruction mnemonic`,insertText:`DEC `},{mode:`asm`,trigger:`div`,label:`DIV`,description:`8051 instruction mnemonic`,insertText:`DIV `},{mode:`asm`,trigger:`djnz`,label:`DJNZ`,description:`8051 instruction mnemonic`,insertText:`DJNZ `},{mode:`asm`,trigger:`inc`,label:`INC`,description:`8051 instruction mnemonic`,insertText:`INC `},{mode:`asm`,trigger:`jb`,label:`JB`,description:`8051 instruction mnemonic`,insertText:`JB `},{mode:`asm`,trigger:`jbc`,label:`JBC`,description:`8051 instruction mnemonic`,insertText:`JBC `},{mode:`asm`,trigger:`jc`,label:`JC`,description:`8051 instruction mnemonic`,insertText:`JC `},{mode:`asm`,trigger:`jnb`,label:`JNB`,description:`8051 instruction mnemonic`,insertText:`JNB `},{mode:`asm`,trigger:`jnc`,label:`JNC`,description:`8051 instruction mnemonic`,insertText:`JNC `},{mode:`asm`,trigger:`jnz`,label:`JNZ`,description:`8051 instruction mnemonic`,insertText:`JNZ `},{mode:`asm`,trigger:`jz`,label:`JZ`,description:`8051 instruction mnemonic`,insertText:`JZ `},{mode:`asm`,trigger:`lcall`,label:`LCALL`,description:`8051 instruction mnemonic`,insertText:`LCALL `},{mode:`asm`,trigger:`ljmp`,label:`LJMP`,description:`8051 instruction mnemonic`,insertText:`LJMP `},{mode:`asm`,trigger:`mov`,label:`MOV`,description:`8051 instruction mnemonic`,insertText:`MOV `},{mode:`asm`,trigger:`movc`,label:`MOVC`,description:`8051 instruction mnemonic`,insertText:`MOVC `},{mode:`asm`,trigger:`movx`,label:`MOVX`,description:`8051 instruction mnemonic`,insertText:`MOVX `},{mode:`asm`,trigger:`mul`,label:`MUL`,description:`8051 instruction mnemonic`,insertText:`MUL `},{mode:`asm`,trigger:`nop`,label:`NOP`,description:`8051 instruction mnemonic`,insertText:`NOP`},{mode:`asm`,trigger:`orl`,label:`ORL`,description:`8051 instruction mnemonic`,insertText:`ORL `},{mode:`asm`,trigger:`pop`,label:`POP`,description:`8051 instruction mnemonic`,insertText:`POP `},{mode:`asm`,trigger:`push`,label:`PUSH`,description:`8051 instruction mnemonic`,insertText:`PUSH `},{mode:`asm`,trigger:`ret`,label:`RET`,description:`8051 instruction mnemonic`,insertText:`RET`},{mode:`asm`,trigger:`reti`,label:`RETI`,description:`8051 instruction mnemonic`,insertText:`RETI`},{mode:`asm`,trigger:`rl`,label:`RL`,description:`8051 instruction mnemonic`,insertText:`RL `},{mode:`asm`,trigger:`rr`,label:`RR`,description:`8051 instruction mnemonic`,insertText:`RR `},{mode:`asm`,trigger:`rrc`,label:`RRC`,description:`8051 instruction mnemonic`,insertText:`RRC `},{mode:`asm`,trigger:`setb`,label:`SETB`,description:`8051 instruction mnemonic`,insertText:`SETB `},{mode:`asm`,trigger:`subb`,label:`SUBB`,description:`8051 instruction mnemonic`,insertText:`SUBB `},{mode:`asm`,trigger:`swap`,label:`SWAP`,description:`8051 instruction mnemonic`,insertText:`SWAP `},{mode:`asm`,trigger:`xch`,label:`XCH`,description:`8051 instruction mnemonic`,insertText:`XCH `},{mode:`asm`,trigger:`xrl`,label:`XRL`,description:`8051 instruction mnemonic`,insertText:`XRL `},{mode:`asm`,trigger:`a`,label:`A`,description:`8051 register/SFR`,insertText:`A`},{mode:`asm`,trigger:`acc`,label:`ACC`,description:`8051 register/SFR`,insertText:`ACC`},{mode:`asm`,trigger:`b`,label:`B`,description:`8051 register/SFR`,insertText:`B`},{mode:`asm`,trigger:`c`,label:`C`,description:`8051 register/SFR`,insertText:`C`},{mode:`asm`,trigger:`dptr`,label:`DPTR`,description:`8051 register/SFR`,insertText:`DPTR`},{mode:`asm`,trigger:`dpl`,label:`DPL`,description:`8051 register/SFR`,insertText:`DPL`},{mode:`asm`,trigger:`dph`,label:`DPH`,description:`8051 register/SFR`,insertText:`DPH`},{mode:`asm`,trigger:`psw`,label:`PSW`,description:`8051 register/SFR`,insertText:`PSW`},{mode:`asm`,trigger:`sp`,label:`SP`,description:`8051 register/SFR`,insertText:`SP`},{mode:`asm`,trigger:`p0`,label:`P0`,description:`8051 register/SFR`,insertText:`P0`},{mode:`asm`,trigger:`p1`,label:`P1`,description:`8051 register/SFR`,insertText:`P1`},{mode:`asm`,trigger:`p2`,label:`P2`,description:`8051 register/SFR`,insertText:`P2`},{mode:`asm`,trigger:`p3`,label:`P3`,description:`8051 register/SFR`,insertText:`P3`},{mode:`asm`,trigger:`r0`,label:`R0`,description:`8051 register/SFR`,insertText:`R0`},{mode:`asm`,trigger:`r1`,label:`R1`,description:`8051 register/SFR`,insertText:`R1`},{mode:`asm`,trigger:`r2`,label:`R2`,description:`8051 register/SFR`,insertText:`R2`},{mode:`asm`,trigger:`r3`,label:`R3`,description:`8051 register/SFR`,insertText:`R3`},{mode:`asm`,trigger:`r4`,label:`R4`,description:`8051 register/SFR`,insertText:`R4`},{mode:`asm`,trigger:`r5`,label:`R5`,description:`8051 register/SFR`,insertText:`R5`},{mode:`asm`,trigger:`r6`,label:`R6`,description:`8051 register/SFR`,insertText:`R6`},{mode:`asm`,trigger:`r7`,label:`R7`,description:`8051 register/SFR`,insertText:`R7`},{mode:`asm`,trigger:`tl0`,label:`TL0`,description:`8051 register/SFR`,insertText:`TL0`},{mode:`asm`,trigger:`th0`,label:`TH0`,description:`8051 register/SFR`,insertText:`TH0`},{mode:`asm`,trigger:`tl1`,label:`TL1`,description:`8051 register/SFR`,insertText:`TL1`},{mode:`asm`,trigger:`th1`,label:`TH1`,description:`8051 register/SFR`,insertText:`TH1`},{mode:`asm`,trigger:`tcon`,label:`TCON`,description:`8051 register/SFR`,insertText:`TCON`},{mode:`asm`,trigger:`tmod`,label:`TMOD`,description:`8051 register/SFR`,insertText:`TMOD`},{mode:`asm`,trigger:`ie`,label:`IE`,description:`8051 register/SFR`,insertText:`IE`},{mode:`asm`,trigger:`ip`,label:`IP`,description:`8051 register/SFR`,insertText:`IP`},{mode:`asm`,trigger:`scon`,label:`SCON`,description:`8051 register/SFR`,insertText:`SCON`},{mode:`asm`,trigger:`sbuf`,label:`SBUF`,description:`8051 register/SFR`,insertText:`SBUF`},{mode:`asm`,trigger:`adccon1`,label:`ADCCON1 DATA 0EFH`,description:`ST841/ADuC alias`,insertText:`ADCCON1 DATA 0EFH`},{mode:`asm`,trigger:`adccon2`,label:`ADCCON2 DATA 0D8H`,description:`ST841/ADuC alias`,insertText:`ADCCON2 DATA 0D8H`},{mode:`asm`,trigger:`adcdatal`,label:`ADCDATAL DATA 0D9H`,description:`ST841/ADuC alias`,insertText:`ADCDATAL DATA 0D9H`},{mode:`asm`,trigger:`adcdatah`,label:`ADCDATAH DATA 0DAH`,description:`ST841/ADuC alias`,insertText:`ADCDATAH DATA 0DAH`},{mode:`asm`,trigger:`adci`,label:`ADCI BIT 0DFH`,description:`ST841/ADuC alias`,insertText:`ADCI BIT 0DFH`},{mode:`asm`,trigger:`sconv`,label:`SCONV BIT 0DCH`,description:`ST841/ADuC alias`,insertText:`SCONV BIT 0DCH`},{mode:`asm`,trigger:`datr0`,label:`DAT EQU R0`,description:`ST841/ADuC alias`,insertText:`DAT EQU R0`},{mode:`asm`,trigger:`adrr1`,label:`ADR EQU R1`,description:`ST841/ADuC alias`,insertText:`ADR EQU R1`},{mode:`asm`,trigger:`temp1`,label:`Temp1 EQU R2`,description:`ST841/ADuC alias`,insertText:`Temp1 EQU R2`},{mode:`asm`,trigger:`temp2`,label:`Temp2 EQU R3`,description:`ST841/ADuC alias`,insertText:`Temp2 EQU R3`},{mode:`asm`,trigger:`sv1`,label:`sv1 LED pattern`,description:`LED line subroutine`,insertText:`sv1:
    MOV P0,#11111110b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv2`,label:`sv2 LED pattern`,description:`LED line subroutine`,insertText:`sv2:
    MOV P0,#11111101b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv3`,label:`sv3 LED pattern`,description:`LED line subroutine`,insertText:`sv3:
    MOV P0,#11111011b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv4`,label:`sv4 LED pattern`,description:`LED line subroutine`,insertText:`sv4:
    MOV P0,#11110111b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv5`,label:`sv5 LED pattern`,description:`LED line subroutine`,insertText:`sv5:
    MOV P0,#11101111b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv6`,label:`sv6 LED pattern`,description:`LED line subroutine`,insertText:`sv6:
    MOV P0,#11011111b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv7`,label:`sv7 LED pattern`,description:`LED line subroutine`,insertText:`sv7:
    MOV P0,#10111111b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`asm`,trigger:`sv8`,label:`sv8 LED pattern`,description:`LED line subroutine`,insertText:`sv8:
    MOV P0,#01111111b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    RET`},{mode:`c`,trigger:`main`,label:`C main template`,description:`C/ST841 helper`,insertText:`void main(){
  while(1){
  }
}`},{mode:`c`,trigger:`while1`,label:`while forever`,description:`C/ST841 helper`,insertText:`while(1){
  
}`},{mode:`c`,trigger:`if`,label:`if block`,description:`C/ST841 helper`,insertText:`if(condition){
  
}`},{mode:`c`,trigger:`ifelse`,label:`if else block`,description:`C/ST841 helper`,insertText:`if(condition){
  
} else {
  
}`},{mode:`c`,trigger:`for`,label:`for loop`,description:`C/ST841 helper`,insertText:`for(i=0; i<10; i++){
  
}`},{mode:`c`,trigger:`delay`,label:`delay()`,description:`C/ST841 helper`,insertText:`delay();`},{mode:`c`,trigger:`delayms`,label:`delay_ms(n)`,description:`C/ST841 helper`,insertText:`delay_ms(10);`},{mode:`c`,trigger:`nop`,label:`nop()`,description:`C/ST841 helper`,insertText:`nop();`},{mode:`c`,trigger:`_nop_`,label:`_nop_()`,description:`C/ST841 helper`,insertText:`_nop_();`},{mode:`c`,trigger:`write`,label:`write(addr,data)`,description:`C/ST841 helper`,insertText:`write(0x07, 0xff);`},{mode:`c`,trigger:`bus_write`,label:`bus_write(addr,data)`,description:`C/ST841 helper`,insertText:`bus_write(0x07, 0xff);`},{mode:`c`,trigger:`st_write`,label:`st_write(addr,data)`,description:`C/ST841 helper`,insertText:`st_write(0x07, 0xff);`},{mode:`c`,trigger:`led`,label:`led(value)`,description:`C/ST841 helper`,insertText:`led(0b11111110);`},{mode:`c`,trigger:`leds`,label:`leds(value)`,description:`C/ST841 helper`,insertText:`leds(0b11111110);`},{mode:`c`,trigger:`led_line`,label:`led_line(value)`,description:`C/ST841 helper`,insertText:`led_line(0b11111110);`},{mode:`c`,trigger:`ledoff`,label:`led_off()`,description:`C/ST841 helper`,insertText:`led_off();`},{mode:`c`,trigger:`ledall`,label:`led_all()`,description:`C/ST841 helper`,insertText:`led_all();`},{mode:`c`,trigger:`ledon`,label:`led_on(n)`,description:`C/ST841 helper`,insertText:`led_on(1);`},{mode:`c`,trigger:`blink`,label:`LED blink example`,description:`C/ST841 helper`,insertText:`void main(){
  while(1){
    led_on(1);
    delay();
    led_off();
    delay();
  }
}`},{mode:`c`,trigger:`ledrun`,label:`LED running example`,description:`C/ST841 helper`,insertText:`void main(){
  unsigned char i;
  while(1){
    for(i=1; i<=8; i++){
      led_on(i);
      delay();
    }
  }
}`},{mode:`c`,trigger:`adc_read`,label:`adc_read(channel)`,description:`C/ST841 helper`,insertText:`adc_read(6)`},{mode:`c`,trigger:`read_adc`,label:`read_adc(channel)`,description:`C/ST841 helper`,insertText:`read_adc(6)`},{mode:`c`,trigger:`adclow`,label:`adc_low(channel)`,description:`C/ST841 helper`,insertText:`adc_low(6)`},{mode:`c`,trigger:`joystick_x`,label:`joystick_x()`,description:`C/ST841 helper`,insertText:`joystick_x()`},{mode:`c`,trigger:`joystick_y`,label:`joystick_y()`,description:`C/ST841 helper`,insertText:`joystick_y()`},{mode:`c`,trigger:`joy_x`,label:`joy_x()`,description:`C/ST841 helper`,insertText:`joy_x()`},{mode:`c`,trigger:`joy_y`,label:`joy_y()`,description:`C/ST841 helper`,insertText:`joy_y()`},{mode:`c`,trigger:`joyled`,label:`Joystick to LED example`,description:`C/ST841 helper`,insertText:`void main(){
  unsigned char x;
  while(1){
    x = joystick_x();
    if(x < 4){
      led_on(1);
    } else {
      led_on(8);
    }
  }
}`},{mode:`c`,trigger:`keypad_read`,label:`keypad_read(addr)`,description:`C/ST841 helper`,insertText:`keypad_read(0x60)`},{mode:`c`,trigger:`key_read`,label:`key_read(addr)`,description:`C/ST841 helper`,insertText:`key_read(0x60)`},{mode:`c`,trigger:`keypad_col1`,label:`keypad_col1()`,description:`C/ST841 helper`,insertText:`keypad_col1()`},{mode:`c`,trigger:`keypad_col2`,label:`keypad_col2()`,description:`C/ST841 helper`,insertText:`keypad_col2()`},{mode:`c`,trigger:`keypad_col3`,label:`keypad_col3()`,description:`C/ST841 helper`,insertText:`keypad_col3()`},{mode:`c`,trigger:`keytest`,label:`Keypad test example`,description:`C/ST841 helper`,insertText:`void main(){
  unsigned char k;
  while(1){
    k = keypad_col1();
    if(k == 0x0e){ led_on(1); }
    else { led_off(); }
  }
}`},{mode:`c`,trigger:`lcd_init`,label:`lcd_init()`,description:`C/ST841 helper`,insertText:`lcd_init();`},{mode:`c`,trigger:`lcd_clear`,label:`lcd_clear()`,description:`C/ST841 helper`,insertText:`lcd_clear();`},{mode:`c`,trigger:`lcd_home`,label:`lcd_home()`,description:`C/ST841 helper`,insertText:`lcd_home();`},{mode:`c`,trigger:`lcd_line`,label:`lcd_line(n)`,description:`C/ST841 helper`,insertText:`lcd_line(1);`},{mode:`c`,trigger:`lcd_cmd`,label:`lcd_cmd(byte)`,description:`C/ST841 helper`,insertText:`lcd_cmd(0x01);`},{mode:`c`,trigger:`lcd_data`,label:`lcd_data(byte)`,description:`C/ST841 helper`,insertText:`lcd_data('A');`},{mode:`c`,trigger:`lcd_char`,label:`lcd_char(byte)`,description:`C/ST841 helper`,insertText:`lcd_char('A');`},{mode:`c`,trigger:`lcd_putc`,label:`lcd_putc(byte)`,description:`C/ST841 helper`,insertText:`lcd_putc('A');`},{mode:`c`,trigger:`lcd_print`,label:`lcd_print("TEXT")`,description:`C/ST841 helper`,insertText:`lcd_print("HELLO");`},{mode:`c`,trigger:`lcd_puts`,label:`lcd_puts("TEXT")`,description:`C/ST841 helper`,insertText:`lcd_puts("HELLO");`},{mode:`c`,trigger:`lcdhello`,label:`LCD hello example`,description:`C/ST841 helper`,insertText:`void main(){
  lcd_init();
  lcd_line(1);
  lcd_print("HELLO");
  while(1){}
}`},{mode:`c`,trigger:`seg`,label:`seg(pos,pattern)`,description:`C/ST841 helper`,insertText:`seg(1, 0x3f);`},{mode:`c`,trigger:`sevenseg`,label:`sevenseg(pos,pattern)`,description:`C/ST841 helper`,insertText:`sevenseg(1, 0x3f);`},{mode:`c`,trigger:`seg_digit`,label:`seg_digit(pos,digit)`,description:`C/ST841 helper`,insertText:`seg_digit(1, 5);`},{mode:`c`,trigger:`sevenseg_digit`,label:`sevenseg_digit(pos,digit)`,description:`C/ST841 helper`,insertText:`sevenseg_digit(1, 5);`},{mode:`c`,trigger:`seg_clear`,label:`seg_clear()`,description:`C/ST841 helper`,insertText:`seg_clear();`},{mode:`c`,trigger:`segcounter`,label:`7-segment counter`,description:`C/ST841 helper`,insertText:`void main(){
  unsigned char i;
  while(1){
    for(i=0; i<10; i++){
      seg_digit(1,i);
      delay();
    }
  }
}`},{mode:`c`,trigger:`matrix`,label:`matrix(rows,cols)`,description:`C/ST841 helper`,insertText:`matrix(0xff, 0x01);`},{mode:`c`,trigger:`matrix_write`,label:`matrix_write(rows,cols)`,description:`C/ST841 helper`,insertText:`matrix_write(0xff, 0x01);`},{mode:`c`,trigger:`matrix_rows`,label:`matrix_rows(value)`,description:`C/ST841 helper`,insertText:`matrix_rows(0xff);`},{mode:`c`,trigger:`matrix_cols`,label:`matrix_cols(value)`,description:`C/ST841 helper`,insertText:`matrix_cols(0x01);`},{mode:`c`,trigger:`matrixtest`,label:`Matrix test`,description:`C/ST841 helper`,insertText:`void main(){
  while(1){
    matrix(0xff, 0x01);
    delay();
    matrix(0x00, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`sfr`,label:`sfr declaration`,description:`C/ST841 helper`,insertText:`sfr P0 = 0x80;`},{mode:`c`,trigger:`sbit`,label:`sbit declaration`,description:`C/ST841 helper`,insertText:`sbit WR = P3^6;`},{mode:`c`,trigger:`uchar`,label:`unsigned char variable`,description:`C/ST841 helper`,insertText:`unsigned char x;`},{mode:`c`,trigger:`uint8`,label:`uint8_t variable`,description:`C/ST841 helper`,insertText:`uint8_t x;`},{mode:`c`,trigger:`define`,label:`#define constant`,description:`C/ST841 helper`,insertText:`#define LED_ADDR 0x07`},{mode:`c`,trigger:`auto`,label:`auto`,description:`C keyword`,insertText:`auto `},{mode:`c`,trigger:`break`,label:`break`,description:`C keyword`,insertText:`break;`},{mode:`c`,trigger:`case`,label:`case`,description:`C keyword`,insertText:`case `},{mode:`c`,trigger:`char`,label:`char`,description:`C keyword`,insertText:`char `},{mode:`c`,trigger:`const`,label:`const`,description:`C keyword`,insertText:`const `},{mode:`c`,trigger:`continue`,label:`continue`,description:`C keyword`,insertText:`continue;`},{mode:`c`,trigger:`default`,label:`default`,description:`C keyword`,insertText:`default `},{mode:`c`,trigger:`do`,label:`do`,description:`C keyword`,insertText:`do `},{mode:`c`,trigger:`double`,label:`double`,description:`C keyword`,insertText:`double `},{mode:`c`,trigger:`else`,label:`else`,description:`C keyword`,insertText:`else `},{mode:`c`,trigger:`enum`,label:`enum`,description:`C keyword`,insertText:`enum `},{mode:`c`,trigger:`extern`,label:`extern`,description:`C keyword`,insertText:`extern `},{mode:`c`,trigger:`float`,label:`float`,description:`C keyword`,insertText:`float `},{mode:`c`,trigger:`for`,label:`for`,description:`C keyword`,insertText:`for `},{mode:`c`,trigger:`goto`,label:`goto`,description:`C keyword`,insertText:`goto `},{mode:`c`,trigger:`if`,label:`if`,description:`C keyword`,insertText:`if `},{mode:`c`,trigger:`int`,label:`int`,description:`C keyword`,insertText:`int `},{mode:`c`,trigger:`long`,label:`long`,description:`C keyword`,insertText:`long `},{mode:`c`,trigger:`register`,label:`register`,description:`C keyword`,insertText:`register `},{mode:`c`,trigger:`return`,label:`return`,description:`C keyword`,insertText:`return `},{mode:`c`,trigger:`short`,label:`short`,description:`C keyword`,insertText:`short `},{mode:`c`,trigger:`signed`,label:`signed`,description:`C keyword`,insertText:`signed `},{mode:`c`,trigger:`sizeof`,label:`sizeof`,description:`C keyword`,insertText:`sizeof `},{mode:`c`,trigger:`static`,label:`static`,description:`C keyword`,insertText:`static `},{mode:`c`,trigger:`struct`,label:`struct`,description:`C keyword`,insertText:`struct `},{mode:`c`,trigger:`switch`,label:`switch`,description:`C keyword`,insertText:`switch `},{mode:`c`,trigger:`typedef`,label:`typedef`,description:`C keyword`,insertText:`typedef `},{mode:`c`,trigger:`union`,label:`union`,description:`C keyword`,insertText:`union `},{mode:`c`,trigger:`unsigned`,label:`unsigned`,description:`C keyword`,insertText:`unsigned `},{mode:`c`,trigger:`void`,label:`void`,description:`C keyword`,insertText:`void `},{mode:`c`,trigger:`volatile`,label:`volatile`,description:`C keyword`,insertText:`volatile `},{mode:`c`,trigger:`while`,label:`while`,description:`C keyword`,insertText:`while `},{mode:`c`,trigger:`uint8_t`,label:`uint8_t`,description:`C keyword`,insertText:`uint8_t `},{mode:`c`,trigger:`uint16_t`,label:`uint16_t`,description:`C keyword`,insertText:`uint16_t `},{mode:`c`,trigger:`include`,label:`include`,description:`C keyword`,insertText:`include `},{mode:`c`,trigger:`define`,label:`define`,description:`C keyword`,insertText:`define `},{mode:`c`,trigger:`led1`,label:`led_on(1)`,description:`Turn one LED on`,insertText:`led_on(1);`},{mode:`c`,trigger:`led2`,label:`led_on(2)`,description:`Turn one LED on`,insertText:`led_on(2);`},{mode:`c`,trigger:`led3`,label:`led_on(3)`,description:`Turn one LED on`,insertText:`led_on(3);`},{mode:`c`,trigger:`led4`,label:`led_on(4)`,description:`Turn one LED on`,insertText:`led_on(4);`},{mode:`c`,trigger:`led5`,label:`led_on(5)`,description:`Turn one LED on`,insertText:`led_on(5);`},{mode:`c`,trigger:`led6`,label:`led_on(6)`,description:`Turn one LED on`,insertText:`led_on(6);`},{mode:`c`,trigger:`led7`,label:`led_on(7)`,description:`Turn one LED on`,insertText:`led_on(7);`},{mode:`c`,trigger:`led8`,label:`led_on(8)`,description:`Turn one LED on`,insertText:`led_on(8);`},{mode:`c`,trigger:`led0000`,label:`led(0x00) all on`,description:`LED pattern`,insertText:`led(0x00);`},{mode:`c`,trigger:`ledffff`,label:`led(0xff) off`,description:`LED pattern`,insertText:`led(0xff);`},{mode:`c`,trigger:`digit0`,label:`seg_digit(1,0)`,description:`7-seg digit`,insertText:`seg_digit(1,0);`},{mode:`c`,trigger:`digit1`,label:`seg_digit(1,1)`,description:`7-seg digit`,insertText:`seg_digit(1,1);`},{mode:`c`,trigger:`digit2`,label:`seg_digit(1,2)`,description:`7-seg digit`,insertText:`seg_digit(1,2);`},{mode:`c`,trigger:`digit3`,label:`seg_digit(1,3)`,description:`7-seg digit`,insertText:`seg_digit(1,3);`},{mode:`c`,trigger:`digit4`,label:`seg_digit(1,4)`,description:`7-seg digit`,insertText:`seg_digit(1,4);`},{mode:`c`,trigger:`digit5`,label:`seg_digit(1,5)`,description:`7-seg digit`,insertText:`seg_digit(1,5);`},{mode:`c`,trigger:`digit6`,label:`seg_digit(1,6)`,description:`7-seg digit`,insertText:`seg_digit(1,6);`},{mode:`c`,trigger:`digit7`,label:`seg_digit(1,7)`,description:`7-seg digit`,insertText:`seg_digit(1,7);`},{mode:`c`,trigger:`digit8`,label:`seg_digit(1,8)`,description:`7-seg digit`,insertText:`seg_digit(1,8);`},{mode:`c`,trigger:`digit9`,label:`seg_digit(1,9)`,description:`7-seg digit`,insertText:`seg_digit(1,9);`},{mode:`c`,trigger:`line1`,label:`lcd_line(1)`,description:`LCD line select`,insertText:`lcd_line(1);`},{mode:`c`,trigger:`line2`,label:`lcd_line(2)`,description:`LCD line select`,insertText:`lcd_line(2);`},{mode:`c`,trigger:`line3`,label:`lcd_line(3)`,description:`LCD line select`,insertText:`lcd_line(3);`},{mode:`c`,trigger:`line4`,label:`lcd_line(4)`,description:`LCD line select`,insertText:`lcd_line(4);`},{mode:`c`,trigger:`puta`,label:`lcd_putc('A')`,description:`LCD character`,insertText:`lcd_putc('A');`},{mode:`c`,trigger:`putb`,label:`lcd_putc('B')`,description:`LCD character`,insertText:`lcd_putc('B');`},{mode:`c`,trigger:`putc`,label:`lcd_putc('C')`,description:`LCD character`,insertText:`lcd_putc('C');`},{mode:`c`,trigger:`putd`,label:`lcd_putc('D')`,description:`LCD character`,insertText:`lcd_putc('D');`},{mode:`c`,trigger:`pute`,label:`lcd_putc('E')`,description:`LCD character`,insertText:`lcd_putc('E');`},{mode:`c`,trigger:`putf`,label:`lcd_putc('F')`,description:`LCD character`,insertText:`lcd_putc('F');`},{mode:`c`,trigger:`putg`,label:`lcd_putc('G')`,description:`LCD character`,insertText:`lcd_putc('G');`},{mode:`c`,trigger:`puth`,label:`lcd_putc('H')`,description:`LCD character`,insertText:`lcd_putc('H');`},{mode:`c`,trigger:`puti`,label:`lcd_putc('I')`,description:`LCD character`,insertText:`lcd_putc('I');`},{mode:`c`,trigger:`putj`,label:`lcd_putc('J')`,description:`LCD character`,insertText:`lcd_putc('J');`},{mode:`c`,trigger:`putk`,label:`lcd_putc('K')`,description:`LCD character`,insertText:`lcd_putc('K');`},{mode:`c`,trigger:`putl`,label:`lcd_putc('L')`,description:`LCD character`,insertText:`lcd_putc('L');`},{mode:`c`,trigger:`putm`,label:`lcd_putc('M')`,description:`LCD character`,insertText:`lcd_putc('M');`},{mode:`c`,trigger:`putn`,label:`lcd_putc('N')`,description:`LCD character`,insertText:`lcd_putc('N');`},{mode:`c`,trigger:`puto`,label:`lcd_putc('O')`,description:`LCD character`,insertText:`lcd_putc('O');`},{mode:`c`,trigger:`putp`,label:`lcd_putc('P')`,description:`LCD character`,insertText:`lcd_putc('P');`},{mode:`c`,trigger:`putq`,label:`lcd_putc('Q')`,description:`LCD character`,insertText:`lcd_putc('Q');`},{mode:`c`,trigger:`putr`,label:`lcd_putc('R')`,description:`LCD character`,insertText:`lcd_putc('R');`},{mode:`c`,trigger:`puts`,label:`lcd_putc('S')`,description:`LCD character`,insertText:`lcd_putc('S');`},{mode:`c`,trigger:`putt`,label:`lcd_putc('T')`,description:`LCD character`,insertText:`lcd_putc('T');`},{mode:`c`,trigger:`putu`,label:`lcd_putc('U')`,description:`LCD character`,insertText:`lcd_putc('U');`},{mode:`c`,trigger:`putv`,label:`lcd_putc('V')`,description:`LCD character`,insertText:`lcd_putc('V');`},{mode:`c`,trigger:`putw`,label:`lcd_putc('W')`,description:`LCD character`,insertText:`lcd_putc('W');`},{mode:`c`,trigger:`putx`,label:`lcd_putc('X')`,description:`LCD character`,insertText:`lcd_putc('X');`},{mode:`c`,trigger:`puty`,label:`lcd_putc('Y')`,description:`LCD character`,insertText:`lcd_putc('Y');`},{mode:`c`,trigger:`putz`,label:`lcd_putc('Z')`,description:`LCD character`,insertText:`lcd_putc('Z');`},{mode:`c`,trigger:`put0`,label:`lcd_putc('0')`,description:`LCD character`,insertText:`lcd_putc('0');`},{mode:`c`,trigger:`put1`,label:`lcd_putc('1')`,description:`LCD character`,insertText:`lcd_putc('1');`},{mode:`c`,trigger:`put2`,label:`lcd_putc('2')`,description:`LCD character`,insertText:`lcd_putc('2');`},{mode:`c`,trigger:`put3`,label:`lcd_putc('3')`,description:`LCD character`,insertText:`lcd_putc('3');`},{mode:`c`,trigger:`put4`,label:`lcd_putc('4')`,description:`LCD character`,insertText:`lcd_putc('4');`},{mode:`c`,trigger:`put5`,label:`lcd_putc('5')`,description:`LCD character`,insertText:`lcd_putc('5');`},{mode:`c`,trigger:`put6`,label:`lcd_putc('6')`,description:`LCD character`,insertText:`lcd_putc('6');`},{mode:`c`,trigger:`put7`,label:`lcd_putc('7')`,description:`LCD character`,insertText:`lcd_putc('7');`},{mode:`c`,trigger:`put8`,label:`lcd_putc('8')`,description:`LCD character`,insertText:`lcd_putc('8');`},{mode:`c`,trigger:`put9`,label:`lcd_putc('9')`,description:`LCD character`,insertText:`lcd_putc('9');`},{mode:`c`,trigger:`addr_led`,label:`addr_led 0x07`,description:`ST841 address`,insertText:`0x07`},{mode:`c`,trigger:`addr_lcd`,label:`addr_lcd 0x08`,description:`ST841 address`,insertText:`0x08`},{mode:`c`,trigger:`addr_key1`,label:`addr_key1 0x60`,description:`ST841 address`,insertText:`0x60`},{mode:`c`,trigger:`addr_key2`,label:`addr_key2 0x50`,description:`ST841 address`,insertText:`0x50`},{mode:`c`,trigger:`addr_key3`,label:`addr_key3 0x30`,description:`ST841 address`,insertText:`0x30`},{mode:`c`,trigger:`addr_cfg5`,label:`addr_cfg5 0x05`,description:`ST841 address`,insertText:`0x05`},{mode:`c`,trigger:`addr_cfg6`,label:`addr_cfg6 0x06`,description:`ST841 address`,insertText:`0x06`},{mode:`asm`,trigger:`mov_a_imm`,label:`MOV A immediate`,description:`8051 instruction snippet`,insertText:`MOV A,#0x00`},{mode:`asm`,trigger:`mov_b_imm`,label:`MOV B immediate`,description:`8051 instruction snippet`,insertText:`MOV B,#0x00`},{mode:`asm`,trigger:`mov_r0_imm`,label:`MOV R0 immediate`,description:`8051 instruction snippet`,insertText:`MOV R0,#0x00`},{mode:`asm`,trigger:`mov_r1_imm`,label:`MOV R1 immediate`,description:`8051 instruction snippet`,insertText:`MOV R1,#0x00`},{mode:`asm`,trigger:`mov_r2_imm`,label:`MOV R2 immediate`,description:`8051 instruction snippet`,insertText:`MOV R2,#0x00`},{mode:`asm`,trigger:`mov_r3_imm`,label:`MOV R3 immediate`,description:`8051 instruction snippet`,insertText:`MOV R3,#0x00`},{mode:`asm`,trigger:`mov_r4_imm`,label:`MOV R4 immediate`,description:`8051 instruction snippet`,insertText:`MOV R4,#0x00`},{mode:`asm`,trigger:`mov_r5_imm`,label:`MOV R5 immediate`,description:`8051 instruction snippet`,insertText:`MOV R5,#0x00`},{mode:`asm`,trigger:`mov_r6_imm`,label:`MOV R6 immediate`,description:`8051 instruction snippet`,insertText:`MOV R6,#0x00`},{mode:`asm`,trigger:`mov_r7_imm`,label:`MOV R7 immediate`,description:`8051 instruction snippet`,insertText:`MOV R7,#0x00`},{mode:`asm`,trigger:`mov_a_r0`,label:`MOV A,R0`,description:`8051 instruction snippet`,insertText:`MOV A,R0`},{mode:`asm`,trigger:`mov_a_r1`,label:`MOV A,R1`,description:`8051 instruction snippet`,insertText:`MOV A,R1`},{mode:`asm`,trigger:`mov_a_direct`,label:`MOV A,direct`,description:`8051 instruction snippet`,insertText:`MOV A,0x20`},{mode:`asm`,trigger:`mov_direct_a`,label:`MOV direct,A`,description:`8051 instruction snippet`,insertText:`MOV 0x20,A`},{mode:`asm`,trigger:`mov_direct_imm`,label:`MOV direct,#imm`,description:`8051 instruction snippet`,insertText:`MOV 0x20,#0x00`},{mode:`asm`,trigger:`mov_dptr_imm`,label:`MOV DPTR,#addr`,description:`8051 instruction snippet`,insertText:`MOV DPTR,#0x2000`},{mode:`asm`,trigger:`mov_p0_a`,label:`MOV P0,A`,description:`8051 instruction snippet`,insertText:`MOV P0,A`},{mode:`asm`,trigger:`mov_p2_a`,label:`MOV P2,A`,description:`8051 instruction snippet`,insertText:`MOV P2,A`},{mode:`asm`,trigger:`mov_a_p0`,label:`MOV A,P0`,description:`8051 instruction snippet`,insertText:`MOV A,P0`},{mode:`asm`,trigger:`mov_a_p2`,label:`MOV A,P2`,description:`8051 instruction snippet`,insertText:`MOV A,P2`},{mode:`asm`,trigger:`inc_a`,label:`INC A`,description:`8051 instruction snippet`,insertText:`INC A`},{mode:`asm`,trigger:`dec_a`,label:`DEC A`,description:`8051 instruction snippet`,insertText:`DEC A`},{mode:`asm`,trigger:`inc_dptr`,label:`INC DPTR`,description:`8051 instruction snippet`,insertText:`INC DPTR`},{mode:`asm`,trigger:`inc_r0`,label:`INC R0`,description:`8051 instruction snippet`,insertText:`INC R0`},{mode:`asm`,trigger:`dec_r0`,label:`DEC R0`,description:`8051 instruction snippet`,insertText:`DEC R0`},{mode:`asm`,trigger:`add_a_r0`,label:`ADD A,R0`,description:`8051 instruction snippet`,insertText:`ADD A,R0`},{mode:`asm`,trigger:`add_a_direct`,label:`ADD A,direct`,description:`8051 instruction snippet`,insertText:`ADD A,0x20`},{mode:`asm`,trigger:`addc_a_imm`,label:`ADDC A,#imm`,description:`8051 instruction snippet`,insertText:`ADDC A,#0x00`},{mode:`asm`,trigger:`subb_a_direct`,label:`SUBB A,direct`,description:`8051 instruction snippet`,insertText:`SUBB A,0x20`},{mode:`asm`,trigger:`mul_ab`,label:`MUL AB`,description:`8051 instruction snippet`,insertText:`MUL AB`},{mode:`asm`,trigger:`div_ab`,label:`DIV AB`,description:`8051 instruction snippet`,insertText:`DIV AB`},{mode:`asm`,trigger:`da_a`,label:`DA A`,description:`8051 instruction snippet`,insertText:`DA A`},{mode:`asm`,trigger:`anl_direct_imm`,label:`ANL direct,#mask`,description:`8051 instruction snippet`,insertText:`ANL 0x20,#0x0F`},{mode:`asm`,trigger:`orl_direct_imm`,label:`ORL direct,#mask`,description:`8051 instruction snippet`,insertText:`ORL 0x20,#0x01`},{mode:`asm`,trigger:`xrl_direct_imm`,label:`XRL direct,#mask`,description:`8051 instruction snippet`,insertText:`XRL 0x20,#0xFF`},{mode:`asm`,trigger:`cpl_a`,label:`CPL A`,description:`8051 instruction snippet`,insertText:`CPL A`},{mode:`asm`,trigger:`cpl_c`,label:`CPL C`,description:`8051 instruction snippet`,insertText:`CPL C`},{mode:`asm`,trigger:`clr_c`,label:`CLR C`,description:`8051 instruction snippet`,insertText:`CLR C`},{mode:`asm`,trigger:`setb_c`,label:`SETB C`,description:`8051 instruction snippet`,insertText:`SETB C`},{mode:`asm`,trigger:`rlc_a`,label:`RLC A`,description:`8051 instruction snippet`,insertText:`RLC A`},{mode:`asm`,trigger:`rrc_a`,label:`RRC A`,description:`8051 instruction snippet`,insertText:`RRC A`},{mode:`asm`,trigger:`swap_a`,label:`SWAP A`,description:`8051 instruction snippet`,insertText:`SWAP A`},{mode:`asm`,trigger:`push_acc`,label:`PUSH ACC`,description:`8051 instruction snippet`,insertText:`PUSH ACC`},{mode:`asm`,trigger:`pop_acc`,label:`POP ACC`,description:`8051 instruction snippet`,insertText:`POP ACC`},{mode:`asm`,trigger:`push_psw`,label:`PUSH PSW`,description:`8051 instruction snippet`,insertText:`PUSH PSW`},{mode:`asm`,trigger:`pop_psw`,label:`POP PSW`,description:`8051 instruction snippet`,insertText:`POP PSW`},{mode:`asm`,trigger:`acall`,label:`ACALL label`,description:`8051 instruction snippet`,insertText:`ACALL LABEL`},{mode:`asm`,trigger:`lcall`,label:`LCALL label`,description:`8051 instruction snippet`,insertText:`LCALL LABEL`},{mode:`asm`,trigger:`ljmp`,label:`LJMP label`,description:`8051 instruction snippet`,insertText:`LJMP LABEL`},{mode:`asm`,trigger:`reti`,label:`RETI`,description:`8051 instruction snippet`,insertText:`RETI`},{mode:`asm`,trigger:`nop`,label:`NOP`,description:`8051 instruction snippet`,insertText:`NOP`},{mode:`asm`,trigger:`jc`,label:`JC label`,description:`8051 instruction snippet`,insertText:`JC LABEL`},{mode:`asm`,trigger:`jnc`,label:`JNC label`,description:`8051 instruction snippet`,insertText:`JNC LABEL`},{mode:`asm`,trigger:`jb_p36`,label:`JB P3.6,label`,description:`8051 instruction snippet`,insertText:`JB P3.6,LABEL`},{mode:`asm`,trigger:`jnb_p36`,label:`JNB P3.6,label`,description:`8051 instruction snippet`,insertText:`JNB P3.6,LABEL`},{mode:`asm`,trigger:`jbc`,label:`JBC bit,label`,description:`8051 instruction snippet`,insertText:`JBC 0x20,LABEL`},{mode:`asm`,trigger:`djnz_r0`,label:`DJNZ R0,label`,description:`8051 instruction snippet`,insertText:`DJNZ R0,LABEL`},{mode:`asm`,trigger:`djnz_direct`,label:`DJNZ direct,label`,description:`8051 instruction snippet`,insertText:`DJNZ 0x20,LABEL`},{mode:`asm`,trigger:`cjne_a_imm`,label:`CJNE A,#imm,label`,description:`8051 instruction snippet`,insertText:`CJNE A,#0x00,LABEL`},{mode:`asm`,trigger:`cjne_r0_imm`,label:`CJNE R0,#imm,label`,description:`8051 instruction snippet`,insertText:`CJNE R0,#0x00,LABEL`},{mode:`asm`,trigger:`cjne_a_direct`,label:`CJNE A,direct,label`,description:`8051 instruction snippet`,insertText:`CJNE A,0x20,LABEL`},{mode:`asm`,trigger:`movx_write_dptr`,label:`MOVX write @DPTR`,description:`8051 instruction snippet`,insertText:`MOV DPTR,#0x2000
MOV A,#0x55
MOVX @DPTR,A`},{mode:`asm`,trigger:`movx_read_dptr`,label:`MOVX read @DPTR`,description:`8051 instruction snippet`,insertText:`MOV DPTR,#0x2000
MOVX A,@DPTR`},{mode:`asm`,trigger:`movx_write_r0`,label:`MOVX write @R0`,description:`8051 instruction snippet`,insertText:`MOV R0,#0x20
MOV A,#0x55
MOVX @R0,A`},{mode:`asm`,trigger:`movx_read_r0`,label:`MOVX read @R0`,description:`8051 instruction snippet`,insertText:`MOV R0,#0x20
MOVX A,@R0`},{mode:`asm`,trigger:`asm_led1`,label:`LED 1 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11111110b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led2`,label:`LED 2 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11111101b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led3`,label:`LED 3 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11111011b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led4`,label:`LED 4 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11110111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led5`,label:`LED 5 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11101111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led6`,label:`LED 6 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11011111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led7`,label:`LED 7 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#10111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led8`,label:`LED 8 on`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#01111111b
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led_run`,label:`LED running demo`,description:`ST841 ready structure`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
MAIN:
    MOV P0,#11111110b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    MOV P0,#11111101b
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    JMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_7seg_0`,label:`7-seg digit 0 pos0`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#00111111b
MOV P2,#0x01
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_7seg_1`,label:`7-seg digit 1 pos0`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#00000110b
MOV P2,#0x01
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_7seg_2`,label:`7-seg digit 2 pos0`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#01011011b
MOV P2,#0x01
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_7seg_3`,label:`7-seg digit 3 pos0`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#01001111b
MOV P2,#0x01
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_7seg_clear`,label:`7-seg clear`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#0x00
MOV P2,#0x01
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_matrix_dot`,label:`Matrix single pattern`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#00000001b
MOV P2,#0x03
NOP
MOV P2,#0x00
MOV P0,#00000001b
MOV P2,#0x04
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_matrix_full`,label:`Matrix full`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#11111111b
MOV P2,#0x03
NOP
MOV P2,#0x00
MOV P0,#11111111b
MOV P2,#0x04
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_matrix_clear`,label:`Matrix clear`,description:`ST841 ready structure`,insertText:`SETB P3.6
MOV P0,#0x00
MOV P2,#0x03
NOP
MOV P2,#0x00
MOV P0,#0x00
MOV P2,#0x04
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_key_col1`,label:`Keypad read col1`,description:`ST841 ready structure`,insertText:`CLR P3.6
MOV P2,#0x60
NOP
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`asm_key_col2`,label:`Keypad read col2`,description:`ST841 ready structure`,insertText:`CLR P3.6
MOV P2,#0x50
NOP
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`asm_key_col3`,label:`Keypad read col3`,description:`ST841 ready structure`,insertText:`CLR P3.6
MOV P2,#0x30
NOP
MOV A,P0
ANL A,#0x0F`},{mode:`asm`,trigger:`asm_key_wait`,label:`Keypad wait any`,description:`ST841 ready structure`,insertText:`WAIT_KEY:
    CLR P3.6
    MOV P2,#0x60
    MOV A,P0
    ANL A,#0x0F
    CJNE A,#0x0F,KEY_FOUND
    MOV P2,#0x50
    MOV A,P0
    ANL A,#0x0F
    CJNE A,#0x0F,KEY_FOUND
    MOV P2,#0x30
    MOV A,P0
    ANL A,#0x0F
    CJNE A,#0x0F,KEY_FOUND
    JMP WAIT_KEY
KEY_FOUND:
    RET`},{mode:`asm`,trigger:`asm_adcregs`,label:`ADC registers`,description:`ST841 ready structure`,insertText:`ADCCON1 DATA 0EFH
ADCCON2 DATA 0D8H
ADCDATAL DATA 0D9H
ADCDATAH DATA 0DAH
ADCI BIT 0DFH
SCONV BIT 0DCH`},{mode:`asm`,trigger:`asm_adc6_read`,label:`Read ADC6 joystick X`,description:`ST841 ready structure`,insertText:`READ_ADC6:
    MOV ADCCON2,#6h
    CLR ADCI
    SETB SCONV
WAIT_ADC6:
    JNB ADCI,WAIT_ADC6
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`},{mode:`asm`,trigger:`asm_adc7_read`,label:`Read ADC7 joystick Y`,description:`ST841 ready structure`,insertText:`READ_ADC7:
    MOV ADCCON2,#7h
    CLR ADCI
    SETB SCONV
WAIT_ADC7:
    JNB ADCI,WAIT_ADC7
    MOV B,ADCDATAL
    MOV A,ADCDATAH
    ANL A,#00001111b
    RET`},{mode:`asm`,trigger:`asm_joy_led`,label:`Joystick X to LED`,description:`ST841 ready structure`,insertText:`ORG 0x0000
ADCCON1 DATA 0EFH
ADCCON2 DATA 0D8H
ADCDATAL DATA 0D9H
ADCDATAH DATA 0DAH
ADCI BIT 0DFH
SCONV BIT 0DCH
START:
    MOV ADCCON1,#10101100b
MAIN:
    MOV ADCCON2,#6h
    CLR ADCI
    SETB SCONV
WAIT:
    JNB ADCI,WAIT
    MOV A,ADCDATAH
    ANL A,#0x0F
    RL A
    CPL A
    MOV P0,A
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    JMP MAIN
END`},{mode:`asm`,trigger:`asm_lcd_regs`,label:`LCD aliases`,description:`ST841 ready structure`,insertText:`DAT EQU R2
ADR EQU R3`},{mode:`asm`,trigger:`asm_lcd_clear`,label:`LCD clear cmd`,description:`ST841 ready structure`,insertText:`MOV DAT,#0x01
MOV ADR,#0x08
CALL WRIT`},{mode:`asm`,trigger:`asm_lcd_home`,label:`LCD home cmd`,description:`ST841 ready structure`,insertText:`MOV DAT,#0x02
MOV ADR,#0x08
CALL WRIT`},{mode:`asm`,trigger:`asm_lcd_char_A`,label:`LCD char A`,description:`ST841 ready structure`,insertText:`MOV DAT,#0x41
MOV ADR,#0x08
CALL WRIT`},{mode:`asm`,trigger:`asm_lcd_print_hello`,label:`LCD print HELLO`,description:`ST841 ready structure`,insertText:`MOV DAT,#0x48
MOV ADR,#0x08
CALL WRIT
MOV DAT,#0x45
CALL WRIT
MOV DAT,#0x4C
CALL WRIT
MOV DAT,#0x4C
CALL WRIT
MOV DAT,#0x4F
CALL WRIT`},{mode:`asm`,trigger:`asm_led_pattern_096`,label:`LED pattern 96`,description:`ST841 LED line pattern`,insertText:`SETB P3.6
MOV P0,#0x7F
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led_pattern_097`,label:`LED pattern 97`,description:`ST841 LED line pattern`,insertText:`SETB P3.6
MOV P0,#0xFE
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led_pattern_098`,label:`LED pattern 98`,description:`ST841 LED line pattern`,insertText:`SETB P3.6
MOV P0,#0xFD
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led_pattern_099`,label:`LED pattern 99`,description:`ST841 LED line pattern`,insertText:`SETB P3.6
MOV P0,#0xFB
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`asm`,trigger:`asm_led_pattern_100`,label:`LED pattern 100`,description:`ST841 LED line pattern`,insertText:`SETB P3.6
MOV P0,#0xF7
MOV P2,#0x07
NOP
MOV P2,#0x00`},{mode:`c`,trigger:`c_main_loop`,label:`main while loop`,description:`C/ST841 ready structure`,insertText:`void main(){
  while(1){
  }
}`},{mode:`c`,trigger:`c_led_blink`,label:`LED blink`,description:`C/ST841 ready structure`,insertText:`void main(){
  while(1){
    led(0b11111110);
    delay();
    led_off();
    delay();
  }
}`},{mode:`c`,trigger:`c_led_run`,label:`LED running`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char i;
  while(1){
    for(i=0;i<8;i++){
      led_on(i+1);
      delay();
    }
  }
}`},{mode:`c`,trigger:`c_joy_led`,label:`Joystick X to LED`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char x;
  while(1){
    x=joystick_x();
    if(x<4){ led(0b11111110); }
    else if(x<8){ led(0b11110000); }
    else { led(0b01111111); }
  }
}`},{mode:`c`,trigger:`c_lcd_hello`,label:`LCD hello`,description:`C/ST841 ready structure`,insertText:`void main(){
  lcd_init();
  lcd_line(1);
  lcd_print("HELLO");
  while(1){}
}`},{mode:`c`,trigger:`c_key_led`,label:`Keypad to LED`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char k;
  while(1){
    k=keypad_col1();
    if(k!=0x0F){ led(0b11111110); } else { led_off(); }
  }
}`},{mode:`c`,trigger:`c_adc6`,label:`ADC6 read variable`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char x;
  while(1){
    x=adc_read(6);
  }
}`},{mode:`c`,trigger:`c_adc7`,label:`ADC7 read variable`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char y;
  while(1){
    y=adc_read(7);
  }
}`},{mode:`c`,trigger:`c_sevenseg_counter`,label:`7-seg counter`,description:`C/ST841 ready structure`,insertText:`void main(){
  unsigned char i;
  while(1){
    for(i=0;i<10;i++){
      seg_digit(1,i);
      delay();
    }
  }
}`},{mode:`c`,trigger:`c_matrix_demo`,label:`Matrix demo`,description:`C/ST841 ready structure`,insertText:`void main(){
  while(1){
    matrix(0xFF,0xFF);
    delay();
    matrix(0x00,0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_bus_write`,label:`bus write`,description:`C/ST841 ready structure`,insertText:`write(0x07,0b11111110);`},{mode:`c`,trigger:`c_delay_ms`,label:`delay ms`,description:`C/ST841 ready structure`,insertText:`delay_ms(10);`},{mode:`c`,trigger:`c_if_else`,label:`if else`,description:`C/ST841 ready structure`,insertText:`if(value==0){
  led_off();
}else{
  led_all();
}`},{mode:`c`,trigger:`c_for_loop`,label:`for loop`,description:`C/ST841 ready structure`,insertText:`for(i=0;i<10;i++){
  delay();
}`},{mode:`c`,trigger:`c_while_loop`,label:`while loop`,description:`C/ST841 ready structure`,insertText:`while(1){
  delay();
}`},{mode:`c`,trigger:`c_define_addr`,label:`define address`,description:`C/ST841 ready structure`,insertText:`#define LED_ADDR 0x07`},{mode:`c`,trigger:`c_sfr_adc`,label:`ADC SFR declarations`,description:`C/ST841 ready structure`,insertText:`sfr ADCCON1 = 0xEF;
sfr ADCCON2 = 0xD8;
sfr ADCDATAL = 0xD9;
sfr ADCDATAH = 0xDA;`},{mode:`c`,trigger:`c_sbit_adc`,label:`ADC bits`,description:`C/ST841 ready structure`,insertText:`sbit ADCI = 0xDF;
sbit SCONV = 0xDC;`},{mode:`c`,trigger:`c_led_all`,label:`led all`,description:`C/ST841 ready structure`,insertText:`led_all();`},{mode:`c`,trigger:`c_led_off`,label:`led off`,description:`C/ST841 ready structure`,insertText:`led_off();`},{mode:`c`,trigger:`c_lcd_clear`,label:`lcd clear`,description:`C/ST841 ready structure`,insertText:`lcd_clear();`},{mode:`c`,trigger:`c_lcd_line1`,label:`lcd line 1`,description:`C/ST841 ready structure`,insertText:`lcd_line(1);`},{mode:`c`,trigger:`c_lcd_line2`,label:`lcd line 2`,description:`C/ST841 ready structure`,insertText:`lcd_line(2);`},{mode:`c`,trigger:`c_lcd_putc`,label:`lcd put char`,description:`C/ST841 ready structure`,insertText:`lcd_putc('A');`},{mode:`c`,trigger:`c_lcd_print`,label:`lcd print`,description:`C/ST841 ready structure`,insertText:`lcd_print("TEXT");`},{mode:`c`,trigger:`c_joyx`,label:`joystick x`,description:`C/ST841 ready structure`,insertText:`joystick_x();`},{mode:`c`,trigger:`c_joyy`,label:`joystick y`,description:`C/ST841 ready structure`,insertText:`joystick_y();`},{mode:`c`,trigger:`c_key1`,label:`keypad col1`,description:`C/ST841 ready structure`,insertText:`keypad_col1();`},{mode:`c`,trigger:`c_key2`,label:`keypad col2`,description:`C/ST841 ready structure`,insertText:`keypad_col2();`},{mode:`c`,trigger:`c_key3`,label:`keypad col3`,description:`C/ST841 ready structure`,insertText:`keypad_col3();`},{mode:`c`,trigger:`c_seg0`,label:`seg digit 0`,description:`C/ST841 ready structure`,insertText:`seg_digit(1,0);`},{mode:`c`,trigger:`c_segclear`,label:`seg clear`,description:`C/ST841 ready structure`,insertText:`seg_clear();`},{mode:`c`,trigger:`c_matrixclear`,label:`matrix clear`,description:`C/ST841 ready structure`,insertText:`matrix(0x00,0x00);`},{mode:`c`,trigger:`c_matrixfull`,label:`matrix full`,description:`C/ST841 ready structure`,insertText:`matrix(0xFF,0xFF);`},{mode:`c`,trigger:`c_led_on_1`,label:`led_on(1)`,description:`turn one LED on`,insertText:`led_on(1);`},{mode:`c`,trigger:`c_led_on_2`,label:`led_on(2)`,description:`turn one LED on`,insertText:`led_on(2);`},{mode:`c`,trigger:`c_led_on_3`,label:`led_on(3)`,description:`turn one LED on`,insertText:`led_on(3);`},{mode:`c`,trigger:`c_led_on_4`,label:`led_on(4)`,description:`turn one LED on`,insertText:`led_on(4);`},{mode:`c`,trigger:`c_led_on_5`,label:`led_on(5)`,description:`turn one LED on`,insertText:`led_on(5);`},{mode:`c`,trigger:`c_led_on_6`,label:`led_on(6)`,description:`turn one LED on`,insertText:`led_on(6);`},{mode:`c`,trigger:`c_led_on_7`,label:`led_on(7)`,description:`turn one LED on`,insertText:`led_on(7);`},{mode:`c`,trigger:`c_led_on_8`,label:`led_on(8)`,description:`turn one LED on`,insertText:`led_on(8);`},{mode:`c`,trigger:`c_seg_digit_0`,label:`seg_digit 1,0`,description:`7-segment digit`,insertText:`seg_digit(1,0);`},{mode:`c`,trigger:`c_seg_digit_1`,label:`seg_digit 1,1`,description:`7-segment digit`,insertText:`seg_digit(1,1);`},{mode:`c`,trigger:`c_seg_digit_2`,label:`seg_digit 1,2`,description:`7-segment digit`,insertText:`seg_digit(1,2);`},{mode:`c`,trigger:`c_seg_digit_3`,label:`seg_digit 1,3`,description:`7-segment digit`,insertText:`seg_digit(1,3);`},{mode:`c`,trigger:`c_seg_digit_4`,label:`seg_digit 1,4`,description:`7-segment digit`,insertText:`seg_digit(1,4);`},{mode:`c`,trigger:`c_seg_digit_5`,label:`seg_digit 1,5`,description:`7-segment digit`,insertText:`seg_digit(1,5);`},{mode:`c`,trigger:`c_seg_digit_6`,label:`seg_digit 1,6`,description:`7-segment digit`,insertText:`seg_digit(1,6);`},{mode:`c`,trigger:`c_seg_digit_7`,label:`seg_digit 1,7`,description:`7-segment digit`,insertText:`seg_digit(1,7);`},{mode:`c`,trigger:`c_seg_digit_8`,label:`seg_digit 1,8`,description:`7-segment digit`,insertText:`seg_digit(1,8);`},{mode:`c`,trigger:`c_seg_digit_9`,label:`seg_digit 1,9`,description:`7-segment digit`,insertText:`seg_digit(1,9);`},{mode:`c`,trigger:`c_adc_read_0`,label:`adc_read(0)`,description:`read ADC channel`,insertText:`adc_read(0);`},{mode:`c`,trigger:`c_adc_read_1`,label:`adc_read(1)`,description:`read ADC channel`,insertText:`adc_read(1);`},{mode:`c`,trigger:`c_adc_read_2`,label:`adc_read(2)`,description:`read ADC channel`,insertText:`adc_read(2);`},{mode:`c`,trigger:`c_adc_read_3`,label:`adc_read(3)`,description:`read ADC channel`,insertText:`adc_read(3);`},{mode:`c`,trigger:`c_adc_read_4`,label:`adc_read(4)`,description:`read ADC channel`,insertText:`adc_read(4);`},{mode:`c`,trigger:`c_adc_read_5`,label:`adc_read(5)`,description:`read ADC channel`,insertText:`adc_read(5);`},{mode:`c`,trigger:`c_adc_read_6`,label:`adc_read(6)`,description:`read ADC channel`,insertText:`adc_read(6);`},{mode:`c`,trigger:`c_adc_read_7`,label:`adc_read(7)`,description:`read ADC channel`,insertText:`adc_read(7);`},{mode:`c`,trigger:`c_if_adc_lt_0`,label:`if adc < 0`,description:`ADC threshold block`,insertText:`if(adc_read(6)<0){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_1`,label:`if adc < 1`,description:`ADC threshold block`,insertText:`if(adc_read(6)<1){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_2`,label:`if adc < 2`,description:`ADC threshold block`,insertText:`if(adc_read(6)<2){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_3`,label:`if adc < 3`,description:`ADC threshold block`,insertText:`if(adc_read(6)<3){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_4`,label:`if adc < 4`,description:`ADC threshold block`,insertText:`if(adc_read(6)<4){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_5`,label:`if adc < 5`,description:`ADC threshold block`,insertText:`if(adc_read(6)<5){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_6`,label:`if adc < 6`,description:`ADC threshold block`,insertText:`if(adc_read(6)<6){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_7`,label:`if adc < 7`,description:`ADC threshold block`,insertText:`if(adc_read(6)<7){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_8`,label:`if adc < 8`,description:`ADC threshold block`,insertText:`if(adc_read(6)<8){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_9`,label:`if adc < 9`,description:`ADC threshold block`,insertText:`if(adc_read(6)<9){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_10`,label:`if adc < 10`,description:`ADC threshold block`,insertText:`if(adc_read(6)<10){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_11`,label:`if adc < 11`,description:`ADC threshold block`,insertText:`if(adc_read(6)<11){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_12`,label:`if adc < 12`,description:`ADC threshold block`,insertText:`if(adc_read(6)<12){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_13`,label:`if adc < 13`,description:`ADC threshold block`,insertText:`if(adc_read(6)<13){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_14`,label:`if adc < 14`,description:`ADC threshold block`,insertText:`if(adc_read(6)<14){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_if_adc_lt_15`,label:`if adc < 15`,description:`ADC threshold block`,insertText:`if(adc_read(6)<15){
  led(0b11111110);
}else{
  led_off();
}`},{mode:`c`,trigger:`c_led_pattern_077`,label:`led pattern 77`,description:`ST841 LED pattern`,insertText:`led(0b11101111);`},{mode:`c`,trigger:`c_led_pattern_078`,label:`led pattern 78`,description:`ST841 LED pattern`,insertText:`led(0b11011111);`},{mode:`c`,trigger:`c_led_pattern_079`,label:`led pattern 79`,description:`ST841 LED pattern`,insertText:`led(0b10111111);`},{mode:`c`,trigger:`c_led_pattern_080`,label:`led pattern 80`,description:`ST841 LED pattern`,insertText:`led(0b01111111);`},{mode:`c`,trigger:`c_led_pattern_081`,label:`led pattern 81`,description:`ST841 LED pattern`,insertText:`led(0b11111110);`},{mode:`c`,trigger:`c_led_pattern_082`,label:`led pattern 82`,description:`ST841 LED pattern`,insertText:`led(0b11111101);`},{mode:`c`,trigger:`c_led_pattern_083`,label:`led pattern 83`,description:`ST841 LED pattern`,insertText:`led(0b11111011);`},{mode:`c`,trigger:`c_led_pattern_084`,label:`led pattern 84`,description:`ST841 LED pattern`,insertText:`led(0b11110111);`},{mode:`c`,trigger:`c_led_pattern_085`,label:`led pattern 85`,description:`ST841 LED pattern`,insertText:`led(0b11101111);`},{mode:`c`,trigger:`c_led_pattern_086`,label:`led pattern 86`,description:`ST841 LED pattern`,insertText:`led(0b11011111);`},{mode:`c`,trigger:`c_led_pattern_087`,label:`led pattern 87`,description:`ST841 LED pattern`,insertText:`led(0b10111111);`},{mode:`c`,trigger:`c_led_pattern_088`,label:`led pattern 88`,description:`ST841 LED pattern`,insertText:`led(0b01111111);`},{mode:`c`,trigger:`c_led_pattern_089`,label:`led pattern 89`,description:`ST841 LED pattern`,insertText:`led(0b11111110);`},{mode:`c`,trigger:`c_led_pattern_090`,label:`led pattern 90`,description:`ST841 LED pattern`,insertText:`led(0b11111101);`},{mode:`c`,trigger:`c_led_pattern_091`,label:`led pattern 91`,description:`ST841 LED pattern`,insertText:`led(0b11111011);`},{mode:`c`,trigger:`c_led_pattern_092`,label:`led pattern 92`,description:`ST841 LED pattern`,insertText:`led(0b11110111);`},{mode:`c`,trigger:`c_led_pattern_093`,label:`led pattern 93`,description:`ST841 LED pattern`,insertText:`led(0b11101111);`},{mode:`c`,trigger:`c_led_pattern_094`,label:`led pattern 94`,description:`ST841 LED pattern`,insertText:`led(0b11011111);`},{mode:`c`,trigger:`c_led_pattern_095`,label:`led pattern 95`,description:`ST841 LED pattern`,insertText:`led(0b10111111);`},{mode:`c`,trigger:`c_led_pattern_096`,label:`led pattern 96`,description:`ST841 LED pattern`,insertText:`led(0b01111111);`},{mode:`c`,trigger:`c_led_pattern_097`,label:`led pattern 97`,description:`ST841 LED pattern`,insertText:`led(0b11111110);`},{mode:`c`,trigger:`c_led_pattern_098`,label:`led pattern 98`,description:`ST841 LED pattern`,insertText:`led(0b11111101);`},{mode:`c`,trigger:`c_led_pattern_099`,label:`led pattern 99`,description:`ST841 LED pattern`,insertText:`led(0b11111011);`},{mode:`c`,trigger:`c_led_pattern_100`,label:`led pattern 100`,description:`ST841 LED pattern`,insertText:`led(0b11110111);`},{mode:`c`,trigger:`c_ready_build_001`,label:`C ready build 001`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 001");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_002`,label:`C ready build 002`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 002");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_003`,label:`C ready build 003`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 003");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_004`,label:`C ready build 004`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 004");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_005`,label:`C ready build 005`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 005");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_006`,label:`C ready build 006`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 006");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_007`,label:`C ready build 007`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 007");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_008`,label:`C ready build 008`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 008");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_009`,label:`C ready build 009`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 009");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_010`,label:`C ready build 010`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 010");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_011`,label:`C ready build 011`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 011");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_012`,label:`C ready build 012`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 012");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_013`,label:`C ready build 013`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 013");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_014`,label:`C ready build 014`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 014");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_015`,label:`C ready build 015`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 015");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_016`,label:`C ready build 016`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 016");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_017`,label:`C ready build 017`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 017");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_018`,label:`C ready build 018`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 018");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_019`,label:`C ready build 019`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 019");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_020`,label:`C ready build 020`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 020");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_021`,label:`C ready build 021`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 021");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_022`,label:`C ready build 022`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 022");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_023`,label:`C ready build 023`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 023");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_024`,label:`C ready build 024`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 024");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_025`,label:`C ready build 025`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 025");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_026`,label:`C ready build 026`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 026");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_027`,label:`C ready build 027`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 027");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_028`,label:`C ready build 028`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 028");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_029`,label:`C ready build 029`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 029");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_030`,label:`C ready build 030`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 030");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_031`,label:`C ready build 031`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 031");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_032`,label:`C ready build 032`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 032");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_033`,label:`C ready build 033`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 033");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_034`,label:`C ready build 034`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 034");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_035`,label:`C ready build 035`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 035");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_036`,label:`C ready build 036`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 036");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_037`,label:`C ready build 037`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 037");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_038`,label:`C ready build 038`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 038");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_039`,label:`C ready build 039`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 039");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_040`,label:`C ready build 040`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 040");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_041`,label:`C ready build 041`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 041");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_042`,label:`C ready build 042`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 042");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_043`,label:`C ready build 043`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 043");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_044`,label:`C ready build 044`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 044");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_045`,label:`C ready build 045`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 045");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_046`,label:`C ready build 046`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 046");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_047`,label:`C ready build 047`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 047");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_048`,label:`C ready build 048`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 048");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_049`,label:`C ready build 049`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 049");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_050`,label:`C ready build 050`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 050");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_051`,label:`C ready build 051`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 051");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_052`,label:`C ready build 052`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 052");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_053`,label:`C ready build 053`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 053");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_054`,label:`C ready build 054`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 054");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_055`,label:`C ready build 055`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 055");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_056`,label:`C ready build 056`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 056");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_057`,label:`C ready build 057`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 057");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_058`,label:`C ready build 058`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 058");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_059`,label:`C ready build 059`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 059");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_060`,label:`C ready build 060`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 060");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_061`,label:`C ready build 061`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 061");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_062`,label:`C ready build 062`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 062");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_063`,label:`C ready build 063`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 063");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_064`,label:`C ready build 064`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 064");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_065`,label:`C ready build 065`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 065");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_066`,label:`C ready build 066`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 066");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_067`,label:`C ready build 067`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 067");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_068`,label:`C ready build 068`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 068");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_069`,label:`C ready build 069`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 069");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_070`,label:`C ready build 070`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 070");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_071`,label:`C ready build 071`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 071");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_072`,label:`C ready build 072`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 072");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_073`,label:`C ready build 073`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 073");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_074`,label:`C ready build 074`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 074");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_075`,label:`C ready build 075`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 075");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_076`,label:`C ready build 076`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 076");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_077`,label:`C ready build 077`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 077");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_078`,label:`C ready build 078`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 078");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_079`,label:`C ready build 079`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 079");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_080`,label:`C ready build 080`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 080");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_081`,label:`C ready build 081`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 081");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_082`,label:`C ready build 082`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 082");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_083`,label:`C ready build 083`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 083");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_084`,label:`C ready build 084`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 084");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_085`,label:`C ready build 085`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 085");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_086`,label:`C ready build 086`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 086");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_087`,label:`C ready build 087`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 087");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_088`,label:`C ready build 088`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 088");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_089`,label:`C ready build 089`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 089");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_090`,label:`C ready build 090`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 090");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_091`,label:`C ready build 091`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 091");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x00);
    seg(1, 0x00);
    seg(2, 0x00);
    seg(3, 0x00);
    seg(4, 0x00);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_092`,label:`C ready build 092`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 092");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFF);
    seg(1, 0x06);
    seg(2, 0x06);
    seg(3, 0x06);
    seg(4, 0x06);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_093`,label:`C ready build 093`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 093");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xAA);
    seg(1, 0x5B);
    seg(2, 0x5B);
    seg(3, 0x5B);
    seg(4, 0x5B);
    matrix(0x10, 0x0F);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_094`,label:`C ready build 094`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 094");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x55);
    seg(1, 0x4F);
    seg(2, 0x4F);
    seg(3, 0x4F);
    seg(4, 0x4F);
    matrix(0x20, 0xF0);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_095`,label:`C ready build 095`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 095");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF0);
    seg(1, 0x66);
    seg(2, 0x66);
    seg(3, 0x66);
    seg(4, 0x66);
    matrix(0x40, 0x33);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_096`,label:`C ready build 096`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 096");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0x0F);
    seg(1, 0x6D);
    seg(2, 0x6D);
    seg(3, 0x6D);
    seg(4, 0x6D);
    matrix(0x80, 0xCC);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_097`,label:`C ready build 097`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 097");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFE);
    seg(1, 0x7D);
    seg(2, 0x7D);
    seg(3, 0x7D);
    seg(4, 0x7D);
    matrix(0x01, 0x00);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_098`,label:`C ready build 098`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 098");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFD);
    seg(1, 0x07);
    seg(2, 0x07);
    seg(3, 0x07);
    seg(4, 0x07);
    matrix(0x02, 0xFF);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_099`,label:`C ready build 099`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 099");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xFB);
    seg(1, 0x7F);
    seg(2, 0x7F);
    seg(3, 0x7F);
    seg(4, 0x7F);
    matrix(0x04, 0xAA);
    delay();
  }
}`},{mode:`c`,trigger:`c_ready_build_100`,label:`C ready build 100`,description:`Full C program: LCD + LED + 7-seg + matrix`,insertText:`void main(){
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("READY BUILD 100");
  lcd_line(2);
  lcd_print("LED SEG MATRIX");

  while(1){
    write(0x07, 0xF7);
    seg(1, 0x6F);
    seg(2, 0x6F);
    seg(3, 0x6F);
    seg(4, 0x6F);
    matrix(0x08, 0x55);
    delay();
  }
}`},{mode:`asm`,trigger:`asm_ready_build_001`,label:`ASM ready build 001`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_002`,label:`ASM ready build 002`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_003`,label:`ASM ready build 003`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_004`,label:`ASM ready build 004`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_005`,label:`ASM ready build 005`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_006`,label:`ASM ready build 006`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_007`,label:`ASM ready build 007`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_008`,label:`ASM ready build 008`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_009`,label:`ASM ready build 009`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_010`,label:`ASM ready build 010`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_011`,label:`ASM ready build 011`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_012`,label:`ASM ready build 012`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_013`,label:`ASM ready build 013`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_014`,label:`ASM ready build 014`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_015`,label:`ASM ready build 015`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_016`,label:`ASM ready build 016`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_017`,label:`ASM ready build 017`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_018`,label:`ASM ready build 018`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_019`,label:`ASM ready build 019`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_020`,label:`ASM ready build 020`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_021`,label:`ASM ready build 021`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_022`,label:`ASM ready build 022`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_023`,label:`ASM ready build 023`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_024`,label:`ASM ready build 024`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_025`,label:`ASM ready build 025`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_026`,label:`ASM ready build 026`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_027`,label:`ASM ready build 027`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_028`,label:`ASM ready build 028`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_029`,label:`ASM ready build 029`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_030`,label:`ASM ready build 030`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_031`,label:`ASM ready build 031`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_032`,label:`ASM ready build 032`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_033`,label:`ASM ready build 033`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_034`,label:`ASM ready build 034`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_035`,label:`ASM ready build 035`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_036`,label:`ASM ready build 036`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_037`,label:`ASM ready build 037`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_038`,label:`ASM ready build 038`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_039`,label:`ASM ready build 039`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_040`,label:`ASM ready build 040`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_041`,label:`ASM ready build 041`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_042`,label:`ASM ready build 042`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_043`,label:`ASM ready build 043`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_044`,label:`ASM ready build 044`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_045`,label:`ASM ready build 045`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_046`,label:`ASM ready build 046`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_047`,label:`ASM ready build 047`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_048`,label:`ASM ready build 048`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_049`,label:`ASM ready build 049`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_050`,label:`ASM ready build 050`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_051`,label:`ASM ready build 051`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_052`,label:`ASM ready build 052`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_053`,label:`ASM ready build 053`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_054`,label:`ASM ready build 054`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_055`,label:`ASM ready build 055`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_056`,label:`ASM ready build 056`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_057`,label:`ASM ready build 057`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_058`,label:`ASM ready build 058`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_059`,label:`ASM ready build 059`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_060`,label:`ASM ready build 060`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_061`,label:`ASM ready build 061`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_062`,label:`ASM ready build 062`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_063`,label:`ASM ready build 063`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_064`,label:`ASM ready build 064`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_065`,label:`ASM ready build 065`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_066`,label:`ASM ready build 066`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_067`,label:`ASM ready build 067`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_068`,label:`ASM ready build 068`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_069`,label:`ASM ready build 069`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_070`,label:`ASM ready build 070`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_071`,label:`ASM ready build 071`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_072`,label:`ASM ready build 072`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_073`,label:`ASM ready build 073`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_074`,label:`ASM ready build 074`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_075`,label:`ASM ready build 075`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_076`,label:`ASM ready build 076`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_077`,label:`ASM ready build 077`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_078`,label:`ASM ready build 078`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_079`,label:`ASM ready build 079`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_080`,label:`ASM ready build 080`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_081`,label:`ASM ready build 081`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_082`,label:`ASM ready build 082`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_083`,label:`ASM ready build 083`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_084`,label:`ASM ready build 084`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_085`,label:`ASM ready build 085`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_086`,label:`ASM ready build 086`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_087`,label:`ASM ready build 087`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_088`,label:`ASM ready build 088`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_089`,label:`ASM ready build 089`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_090`,label:`ASM ready build 090`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_091`,label:`ASM ready build 091`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x00
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_092`,label:`ASM ready build 092`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFF
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_093`,label:`ASM ready build 093`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xAA
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_094`,label:`ASM ready build 094`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x55
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_095`,label:`ASM ready build 095`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF0
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_096`,label:`ASM ready build 096`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0x0F
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x10
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_097`,label:`ASM ready build 097`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFE
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x20
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_098`,label:`ASM ready build 098`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFD
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x30
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_099`,label:`ASM ready build 099`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xFB
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x40
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`asm`,trigger:`asm_ready_build_100`,label:`ASM ready build 100`,description:`Full ASM program: LED line loop through ST841 bus`,insertText:`ORG 0x0000
START:
    MOV SP,#0x2F
    SETB P3.6
MAIN:
    MOV P0,#0xF7
    MOV P2,#0x07
    NOP
    MOV P2,#0x00
    CALL DELAY
    SJMP MAIN

DELAY:
    MOV R5,#0x50
D1:
    MOV R6,#0xFF
D2:
    DJNZ R6,D2
    DJNZ R5,D1
    RET
END`},{mode:`c`,trigger:`m_c_lab2_write_led`,label:`Методичка 1: C Lab2 write + LED`,description:`write(), LED(), ClearLatches()`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat)
{
  WR = 1;
  P0 = Dat;
  P2 &= 0xF0;
  P2 |= (Addr & 0x0F);
  P2 &= 0xF0;
}
void LED(unsigned char Data)
{
  write(7, ~Data);
}
void ClearLatches()
{
  unsigned char i;
  for (i = 1; i != 9; i++)
    write(i, 0xFF);
}
void main()
{
  ClearLatches();
  LED(0xAA);
  while (1);
}
`},{mode:`c`,trigger:`m_c_lab3_static1234`,label:`Методичка 2: C Lab3 Static 0x1234`,description:`Hto7[] + Static(unsigned int)`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat)
{
  WR = 1;
  P0 = Dat;
  P2 &= 0xF0;
  P2 |= (Addr & 0x0F);
  P2 &= 0xF0;
}
const unsigned char code Hto7[16] = {
  0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,
  0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E
};
void Static(unsigned int A)
{
  write(1, Hto7[(A) & 0x0F]);
  write(2, Hto7[(A >> 4) & 0x0F]);
  write(3, Hto7[(A >> 8) & 0x0F]);
  write(4, Hto7[(A >> 12) & 0x0F]);
}
void main()
{
  Static(0x1234);
  while (1);
}
`},{mode:`c`,trigger:`m_c_lab4_keypad_static`,label:`Методичка 3: C Lab4 keypad to 7seg`,description:`readkey() + StaticL()`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat)
{
  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;
}
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void StaticL(unsigned char A)
{
  write(1, Hto7[A & 0x0F]);
  write(2, Hto7[(A >> 4) & 0x0F]);
}
unsigned char readkey()
{
  unsigned char Key;
  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xEF;
  Key = P0; Key = ~Key; Key &= 0x0F;
  switch (Key) { case 1: return 1; case 2: return 4; case 4: return 7; case 8: return 10; }
  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xDF;
  Key = P0; Key = ~Key; Key &= 0x0F;
  switch (Key) { case 1: return 2; case 2: return 5; case 4: return 8; case 8: return 0; }
  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xBF;
  Key = P0; Key = ~Key; Key &= 0x0F;
  switch (Key) { case 1: return 3; case 2: return 6; case 4: return 9; case 8: return 11; }
  return 255;
}
void main()
{
  unsigned char Key;
  while (1) {
    Key = readkey();
    if (Key != 255) StaticL(Key);
  }
}
`},{mode:`c`,trigger:`m_c_lab5_stepper`,label:`Методичка 4: C Lab5 stepper half-step`,description:`Step(bit Reverse) skeleton`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat)
{
  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;
}
void LED(unsigned char Data) { write(7, ~Data); }
void delay(unsigned int T)
{
  unsigned int i; unsigned char j;
  for (i = 0; i != T; i++) for (j = 0; j != 255; j++);
}
unsigned char Step(bit Reverse)
{
  static unsigned char Pos = 0;
  const unsigned char code Half[8] = {1,3,2,6,4,12,8,9};
  if (Reverse) Pos--; else Pos++;
  Pos &= 7;
  write(8, Half[Pos]);
  return Half[Pos];
}
void main()
{
  while (1) {
    LED(Step(0));
    delay(20);
  }
}
`},{mode:`c`,trigger:`m_c_lab6_adc_led`,label:`Методичка 5: C Lab6 ADC to LED/static`,description:`ADCCON/ADCDATA example`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat)
{
  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;
}
void LED(unsigned char Data) { write(7, ~Data); }
unsigned int GetADC(unsigned char Channel)
{
  unsigned int A;
  ADCCON1 = 0xAC;
  ADCCON2 = Channel & 0x0F;
  SCONV = 1;
  while (!ADCI);
  A = ADCDATAH & 0x0F;
  A = A << 8;
  A |= ADCDATAL;
  return A;
}
void main()
{
  unsigned int A;
  while (1) {
    A = GetADC(6);
    LED(A >> 4);
  }
}
`},{mode:`c`,trigger:`m_c_led_00`,label:`Методичка 6: C LED 0x00`,description:`LED() pattern 0x00`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x00); while (1); }
`},{mode:`c`,trigger:`m_c_led_01`,label:`Методичка 7: C LED 0x01`,description:`LED() pattern 0x01`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x01); while (1); }
`},{mode:`c`,trigger:`m_c_led_03`,label:`Методичка 8: C LED 0x03`,description:`LED() pattern 0x03`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x03); while (1); }
`},{mode:`c`,trigger:`m_c_led_05`,label:`Методичка 9: C LED 0x05`,description:`LED() pattern 0x05`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x05); while (1); }
`},{mode:`c`,trigger:`m_c_led_0f`,label:`Методичка 10: C LED 0x0F`,description:`LED() pattern 0x0F`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x0F); while (1); }
`},{mode:`c`,trigger:`m_c_led_33`,label:`Методичка 11: C LED 0x33`,description:`LED() pattern 0x33`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x33); while (1); }
`},{mode:`c`,trigger:`m_c_led_55`,label:`Методичка 12: C LED 0x55`,description:`LED() pattern 0x55`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x55); while (1); }
`},{mode:`c`,trigger:`m_c_led_aa`,label:`Методичка 13: C LED 0xAA`,description:`LED() pattern 0xAA`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0xAA); while (1); }
`},{mode:`c`,trigger:`m_c_led_f0`,label:`Методичка 14: C LED 0xF0`,description:`LED() pattern 0xF0`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0xF0); while (1); }
`},{mode:`c`,trigger:`m_c_led_ff`,label:`Методичка 15: C LED 0xFF`,description:`LED() pattern 0xFF`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0xFF); while (1); }
`},{mode:`c`,trigger:`m_c_led_7e`,label:`Методичка 16: C LED 0x7E`,description:`LED() pattern 0x7E`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x7E); while (1); }
`},{mode:`c`,trigger:`m_c_led_81`,label:`Методичка 17: C LED 0x81`,description:`LED() pattern 0x81`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x81); while (1); }
`},{mode:`c`,trigger:`m_c_led_18`,label:`Методичка 18: C LED 0x18`,description:`LED() pattern 0x18`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x18); while (1); }
`},{mode:`c`,trigger:`m_c_led_24`,label:`Методичка 19: C LED 0x24`,description:`LED() pattern 0x24`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x24); while (1); }
`},{mode:`c`,trigger:`m_c_led_42`,label:`Методичка 20: C LED 0x42`,description:`LED() pattern 0x42`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x42); while (1); }
`},{mode:`c`,trigger:`m_c_led_66`,label:`Методичка 21: C LED 0x66`,description:`LED() pattern 0x66`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x66); while (1); }
`},{mode:`c`,trigger:`m_c_led_99`,label:`Методичка 22: C LED 0x99`,description:`LED() pattern 0x99`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x99); while (1); }
`},{mode:`c`,trigger:`m_c_led_c3`,label:`Методичка 23: C LED 0xC3`,description:`LED() pattern 0xC3`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0xC3); while (1); }
`},{mode:`c`,trigger:`m_c_led_3c`,label:`Методичка 24: C LED 0x3C`,description:`LED() pattern 0x3C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0x3C); while (1); }
`},{mode:`c`,trigger:`m_c_led_a5`,label:`Методичка 25: C LED 0xA5`,description:`LED() pattern 0xA5`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void LED(unsigned char Data) { write(7, ~Data); }
void main() { LED(0xA5); while (1); }
`},{mode:`c`,trigger:`m_c_static_0000`,label:`Методичка 26: C Static 0x0000`,description:`Static(0x0000) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0000); while (1); }
`},{mode:`c`,trigger:`m_c_static_0001`,label:`Методичка 27: C Static 0x0001`,description:`Static(0x0001) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0001); while (1); }
`},{mode:`c`,trigger:`m_c_static_0012`,label:`Методичка 28: C Static 0x0012`,description:`Static(0x0012) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0012); while (1); }
`},{mode:`c`,trigger:`m_c_static_0034`,label:`Методичка 29: C Static 0x0034`,description:`Static(0x0034) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0034); while (1); }
`},{mode:`c`,trigger:`m_c_static_0101`,label:`Методичка 30: C Static 0x0101`,description:`Static(0x0101) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0101); while (1); }
`},{mode:`c`,trigger:`m_c_static_0123`,label:`Методичка 31: C Static 0x0123`,description:`Static(0x0123) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0123); while (1); }
`},{mode:`c`,trigger:`m_c_static_1234`,label:`Методичка 32: C Static 0x1234`,description:`Static(0x1234) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x1234); while (1); }
`},{mode:`c`,trigger:`m_c_static_4321`,label:`Методичка 33: C Static 0x4321`,description:`Static(0x4321) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x4321); while (1); }
`},{mode:`c`,trigger:`m_c_static_5555`,label:`Методичка 34: C Static 0x5555`,description:`Static(0x5555) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x5555); while (1); }
`},{mode:`c`,trigger:`m_c_static_aaaa`,label:`Методичка 35: C Static 0xAAAA`,description:`Static(0xAAAA) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xAAAA); while (1); }
`},{mode:`c`,trigger:`m_c_static_0f0f`,label:`Методичка 36: C Static 0x0F0F`,description:`Static(0x0F0F) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x0F0F); while (1); }
`},{mode:`c`,trigger:`m_c_static_f00d`,label:`Методичка 37: C Static 0xF00D`,description:`Static(0xF00D) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xF00D); while (1); }
`},{mode:`c`,trigger:`m_c_static_beef`,label:`Методичка 38: C Static 0xBEEF`,description:`Static(0xBEEF) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xBEEF); while (1); }
`},{mode:`c`,trigger:`m_c_static_cafe`,label:`Методичка 39: C Static 0xCAFE`,description:`Static(0xCAFE) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xCAFE); while (1); }
`},{mode:`c`,trigger:`m_c_static_2026`,label:`Методичка 40: C Static 0x2026`,description:`Static(0x2026) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x2026); while (1); }
`},{mode:`c`,trigger:`m_c_static_1760`,label:`Методичка 41: C Static 0x1760`,description:`Static(0x1760) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x1760); while (1); }
`},{mode:`c`,trigger:`m_c_static_8410`,label:`Методичка 42: C Static 0x8410`,description:`Static(0x8410) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x8410); while (1); }
`},{mode:`c`,trigger:`m_c_static_8051`,label:`Методичка 43: C Static 0x8051`,description:`Static(0x8051) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0x8051); while (1); }
`},{mode:`c`,trigger:`m_c_static_ad0c`,label:`Методичка 44: C Static 0xAD0C`,description:`Static(0xAD0C) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xAD0C); while (1); }
`},{mode:`c`,trigger:`m_c_static_ffff`,label:`Методичка 45: C Static 0xFFFF`,description:`Static(0xFFFF) via Hto7[]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main() { Static(0xFFFF); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg1_0`,label:`Методичка 46: C write addr 1`,description:`write(1,0x81) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(1, 0x81); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg2_0`,label:`Методичка 47: C write addr 2`,description:`write(2,0xA6) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(2, 0xA6); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg3_0`,label:`Методичка 48: C write addr 3`,description:`write(3,0xCB) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(3, 0xCB); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg4_0`,label:`Методичка 49: C write addr 4`,description:`write(4,0xF0) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(4, 0xF0); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_rows_0`,label:`Методичка 50: C write addr 5`,description:`write(5,0x15) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(5, 0x15); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_cols_0`,label:`Методичка 51: C write addr 6`,description:`write(6,0x3A) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(6, 0x3A); while (1); }
`},{mode:`c`,trigger:`m_c_write_led_0`,label:`Методичка 52: C write addr 7`,description:`write(7,0x5F) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(7, 0x5F); while (1); }
`},{mode:`c`,trigger:`m_c_write_lcd_or_step_0`,label:`Методичка 53: C write addr 8`,description:`write(8,0x84) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(8, 0x84); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg1_1`,label:`Методичка 54: C write addr 1`,description:`write(1,0xA9) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(1, 0xA9); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg2_1`,label:`Методичка 55: C write addr 2`,description:`write(2,0xCE) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(2, 0xCE); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg3_1`,label:`Методичка 56: C write addr 3`,description:`write(3,0xF3) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(3, 0xF3); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg4_1`,label:`Методичка 57: C write addr 4`,description:`write(4,0x18) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(4, 0x18); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_rows_1`,label:`Методичка 58: C write addr 5`,description:`write(5,0x3D) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(5, 0x3D); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_cols_1`,label:`Методичка 59: C write addr 6`,description:`write(6,0x62) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(6, 0x62); while (1); }
`},{mode:`c`,trigger:`m_c_write_led_1`,label:`Методичка 60: C write addr 7`,description:`write(7,0x87) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(7, 0x87); while (1); }
`},{mode:`c`,trigger:`m_c_write_lcd_or_step_1`,label:`Методичка 61: C write addr 8`,description:`write(8,0xAC) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(8, 0xAC); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg1_2`,label:`Методичка 62: C write addr 1`,description:`write(1,0xD1) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(1, 0xD1); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg2_2`,label:`Методичка 63: C write addr 2`,description:`write(2,0xF6) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(2, 0xF6); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg3_2`,label:`Методичка 64: C write addr 3`,description:`write(3,0x1B) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(3, 0x1B); while (1); }
`},{mode:`c`,trigger:`m_c_write_seg4_2`,label:`Методичка 65: C write addr 4`,description:`write(4,0x40) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(4, 0x40); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_rows_2`,label:`Методичка 66: C write addr 5`,description:`write(5,0x65) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(5, 0x65); while (1); }
`},{mode:`c`,trigger:`m_c_write_matrix_cols_2`,label:`Методичка 67: C write addr 6`,description:`write(6,0x8A) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(6, 0x8A); while (1); }
`},{mode:`c`,trigger:`m_c_write_led_2`,label:`Методичка 68: C write addr 7`,description:`write(7,0xAF) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(7, 0xAF); while (1); }
`},{mode:`c`,trigger:`m_c_write_lcd_or_step_2`,label:`Методичка 69: C write addr 8`,description:`write(8,0xD4) direct ST841 bus`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
void main() { write(8, 0xD4); while (1); }
`},{mode:`c`,trigger:`m_c_key_counter_1`,label:`Методичка 70: C keypad counter 1`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=0; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_2`,label:`Методичка 71: C keypad counter 2`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=1; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_3`,label:`Методичка 72: C keypad counter 3`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=2; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_4`,label:`Методичка 73: C keypad counter 4`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=3; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_5`,label:`Методичка 74: C keypad counter 5`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=4; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_6`,label:`Методичка 75: C keypad counter 6`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=5; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_7`,label:`Методичка 76: C keypad counter 7`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=6; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_8`,label:`Методичка 77: C keypad counter 8`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=7; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_9`,label:`Методичка 78: C keypad counter 9`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=8; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_10`,label:`Методичка 79: C keypad counter 10`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=9; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_11`,label:`Методичка 80: C keypad counter 11`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=10; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_12`,label:`Методичка 81: C keypad counter 12`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=11; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_13`,label:`Методичка 82: C keypad counter 13`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=12; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_14`,label:`Методичка 83: C keypad counter 14`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=13; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_15`,label:`Методичка 84: C keypad counter 15`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=14; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_16`,label:`Методичка 85: C keypad counter 16`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=15; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_17`,label:`Методичка 86: C keypad counter 17`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=16; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_18`,label:`Методичка 87: C keypad counter 18`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=17; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_19`,label:`Методичка 88: C keypad counter 19`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=18; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_20`,label:`Методичка 89: C keypad counter 20`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=19; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_21`,label:`Методичка 90: C keypad counter 21`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=20; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_22`,label:`Методичка 91: C keypad counter 22`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=21; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_23`,label:`Методичка 92: C keypad counter 23`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=22; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_24`,label:`Методичка 93: C keypad counter 24`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=23; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_25`,label:`Методичка 94: C keypad counter 25`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=24; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_26`,label:`Методичка 95: C keypad counter 26`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=25; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_27`,label:`Методичка 96: C keypad counter 27`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=26; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_28`,label:`Методичка 97: C keypad counter 28`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=27; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_29`,label:`Методичка 98: C keypad counter 29`,description:`case 10: Counter--`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=28; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_key_counter_30`,label:`Методичка 99: C keypad counter 30`,description:`case 11: Counter++`,insertText:`#include "ADUC841.h"
unsigned int Counter;
void write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }
const unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
unsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }
void main() { unsigned char Key; Counter=29; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }
`},{mode:`c`,trigger:`m_c_for_clear_1`,label:`Методичка 100: C for clear 1`,description:`for loop write 1..1`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_2`,label:`Методичка 101: C for clear 2`,description:`for loop write 1..2`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_3`,label:`Методичка 102: C for clear 3`,description:`for loop write 1..3`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_4`,label:`Методичка 103: C for clear 4`,description:`for loop write 1..4`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_5`,label:`Методичка 104: C for clear 5`,description:`for loop write 1..5`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_6`,label:`Методичка 105: C for clear 6`,description:`for loop write 1..6`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_7`,label:`Методичка 106: C for clear 7`,description:`for loop write 1..7`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_8`,label:`Методичка 107: C for clear 8`,description:`for loop write 1..8`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_9`,label:`Методичка 108: C for clear 1`,description:`for loop write 1..1`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_10`,label:`Методичка 109: C for clear 2`,description:`for loop write 1..2`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_11`,label:`Методичка 110: C for clear 3`,description:`for loop write 1..3`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_12`,label:`Методичка 111: C for clear 4`,description:`for loop write 1..4`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_13`,label:`Методичка 112: C for clear 5`,description:`for loop write 1..5`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_14`,label:`Методичка 113: C for clear 6`,description:`for loop write 1..6`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_15`,label:`Методичка 114: C for clear 7`,description:`for loop write 1..7`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_16`,label:`Методичка 115: C for clear 8`,description:`for loop write 1..8`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_17`,label:`Методичка 116: C for clear 1`,description:`for loop write 1..1`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_18`,label:`Методичка 117: C for clear 2`,description:`for loop write 1..2`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_19`,label:`Методичка 118: C for clear 3`,description:`for loop write 1..3`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_20`,label:`Методичка 119: C for clear 4`,description:`for loop write 1..4`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_21`,label:`Методичка 120: C for clear 5`,description:`for loop write 1..5`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_22`,label:`Методичка 121: C for clear 6`,description:`for loop write 1..6`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_23`,label:`Методичка 122: C for clear 7`,description:`for loop write 1..7`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_24`,label:`Методичка 123: C for clear 8`,description:`for loop write 1..8`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_25`,label:`Методичка 124: C for clear 1`,description:`for loop write 1..1`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_26`,label:`Методичка 125: C for clear 2`,description:`for loop write 1..2`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_27`,label:`Методичка 126: C for clear 3`,description:`for loop write 1..3`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_28`,label:`Методичка 127: C for clear 4`,description:`for loop write 1..4`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_29`,label:`Методичка 128: C for clear 5`,description:`for loop write 1..5`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_for_clear_30`,label:`Методичка 129: C for clear 6`,description:`for loop write 1..6`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }
`},{mode:`c`,trigger:`m_c_adc_0_high`,label:`Методичка 130: C ADC ch0 high`,description:`GetADC(0) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_0_low`,label:`Методичка 131: C ADC ch0 low`,description:`GetADC(0) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_0_led`,label:`Методичка 132: C ADC ch0 led`,description:`GetADC(0) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_1_high`,label:`Методичка 133: C ADC ch1 high`,description:`GetADC(1) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_1_low`,label:`Методичка 134: C ADC ch1 low`,description:`GetADC(1) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_1_led`,label:`Методичка 135: C ADC ch1 led`,description:`GetADC(1) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_2_high`,label:`Методичка 136: C ADC ch2 high`,description:`GetADC(2) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_2_low`,label:`Методичка 137: C ADC ch2 low`,description:`GetADC(2) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_2_led`,label:`Методичка 138: C ADC ch2 led`,description:`GetADC(2) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_3_high`,label:`Методичка 139: C ADC ch3 high`,description:`GetADC(3) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_3_low`,label:`Методичка 140: C ADC ch3 low`,description:`GetADC(3) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_3_led`,label:`Методичка 141: C ADC ch3 led`,description:`GetADC(3) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_4_high`,label:`Методичка 142: C ADC ch4 high`,description:`GetADC(4) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_4_low`,label:`Методичка 143: C ADC ch4 low`,description:`GetADC(4) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_4_led`,label:`Методичка 144: C ADC ch4 led`,description:`GetADC(4) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_5_high`,label:`Методичка 145: C ADC ch5 high`,description:`GetADC(5) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_5_low`,label:`Методичка 146: C ADC ch5 low`,description:`GetADC(5) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_5_led`,label:`Методичка 147: C ADC ch5 led`,description:`GetADC(5) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_6_high`,label:`Методичка 148: C ADC ch6 high`,description:`GetADC(6) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_6_low`,label:`Методичка 149: C ADC ch6 low`,description:`GetADC(6) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_6_led`,label:`Методичка 150: C ADC ch6 led`,description:`GetADC(6) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_7_high`,label:`Методичка 151: C ADC ch7 high`,description:`GetADC(7) high`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_adc_7_low`,label:`Методичка 152: C ADC ch7 low`,description:`GetADC(7) low`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 0); } }
`},{mode:`c`,trigger:`m_c_adc_7_led`,label:`Методичка 153: C ADC ch7 led`,description:`GetADC(7) led`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void LED(unsigned char Data) { write(7,~Data); }
unsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }
void main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 4); } }
`},{mode:`c`,trigger:`m_c_step_0_0_5`,label:`Методичка 154: C Stepper p0 r0 d5`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_0_0_20`,label:`Методичка 155: C Stepper p0 r0 d20`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_0_0_80`,label:`Методичка 156: C Stepper p0 r0 d80`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_0_0_150`,label:`Методичка 157: C Stepper p0 r0 d150`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_0_0_250`,label:`Методичка 158: C Stepper p0 r0 d250`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_step_0_1_5`,label:`Методичка 159: C Stepper p0 r1 d5`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_0_1_20`,label:`Методичка 160: C Stepper p0 r1 d20`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_0_1_80`,label:`Методичка 161: C Stepper p0 r1 d80`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_0_1_150`,label:`Методичка 162: C Stepper p0 r1 d150`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_0_1_250`,label:`Методичка 163: C Stepper p0 r1 d250`,description:`stepper pattern [1, 2, 4, 8]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_step_1_0_5`,label:`Методичка 164: C Stepper p1 r0 d5`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_1_0_20`,label:`Методичка 165: C Stepper p1 r0 d20`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_1_0_80`,label:`Методичка 166: C Stepper p1 r0 d80`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_1_0_150`,label:`Методичка 167: C Stepper p1 r0 d150`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_1_0_250`,label:`Методичка 168: C Stepper p1 r0 d250`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_step_1_1_5`,label:`Методичка 169: C Stepper p1 r1 d5`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_1_1_20`,label:`Методичка 170: C Stepper p1 r1 d20`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_1_1_80`,label:`Методичка 171: C Stepper p1 r1 d80`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_1_1_150`,label:`Методичка 172: C Stepper p1 r1 d150`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_1_1_250`,label:`Методичка 173: C Stepper p1 r1 d250`,description:`stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_step_2_0_5`,label:`Методичка 174: C Stepper p2 r0 d5`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_2_0_20`,label:`Методичка 175: C Stepper p2 r0 d20`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_2_0_80`,label:`Методичка 176: C Stepper p2 r0 d80`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_2_0_150`,label:`Методичка 177: C Stepper p2 r0 d150`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_2_0_250`,label:`Методичка 178: C Stepper p2 r0 d250`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_step_2_1_5`,label:`Методичка 179: C Stepper p2 r1 d5`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(5); } } }
`},{mode:`c`,trigger:`m_c_step_2_1_20`,label:`Методичка 180: C Stepper p2 r1 d20`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(20); } } }
`},{mode:`c`,trigger:`m_c_step_2_1_80`,label:`Методичка 181: C Stepper p2 r1 d80`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(80); } } }
`},{mode:`c`,trigger:`m_c_step_2_1_150`,label:`Методичка 182: C Stepper p2 r1 d150`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(150); } } }
`},{mode:`c`,trigger:`m_c_step_2_1_250`,label:`Методичка 183: C Stepper p2 r1 d250`,description:`stepper pattern [3, 6, 12, 9]`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
void delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }
const unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};
void main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(250); } } }
`},{mode:`c`,trigger:`m_c_lcd_text_1`,label:`Методичка 184: C LCD ST841`,description:`lcd_print "ST841"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("ST841");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_2`,label:`Методичка 185: C LCD ADUC841`,description:`lcd_print "ADUC841"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("ADUC841");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_3`,label:`Методичка 186: C LCD P0 DATA`,description:`lcd_print "P0 DATA"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("P0 DATA");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_4`,label:`Методичка 187: C LCD P2 ADDR`,description:`lcd_print "P2 ADDR"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("P2 ADDR");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_5`,label:`Методичка 188: C LCD WR P3.6`,description:`lcd_print "WR P3.6"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("WR P3.6");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_6`,label:`Методичка 189: C LCD KEYPAD`,description:`lcd_print "KEYPAD"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("KEYPAD");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_7`,label:`Методичка 190: C LCD ADC CH6`,description:`lcd_print "ADC CH6"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("ADC CH6");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_8`,label:`Методичка 191: C LCD STEP MOTOR`,description:`lcd_print "STEP MOTOR"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("STEP MOTOR");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_9`,label:`Методичка 192: C LCD STATIC 7SEG`,description:`lcd_print "STATIC 7SEG"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("STATIC 7SEG");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_10`,label:`Методичка 193: C LCD MATRIX`,description:`lcd_print "MATRIX"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("MATRIX");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_11`,label:`Методичка 194: C LCD HELLO`,description:`lcd_print "HELLO"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("HELLO");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_12`,label:`Методичка 195: C LCD MICROLAB`,description:`lcd_print "MICROLAB"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("MICROLAB");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_13`,label:`Методичка 196: C LCD C MODE`,description:`lcd_print "C MODE"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("C MODE");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_14`,label:`Методичка 197: C LCD KEIL STYLE`,description:`lcd_print "KEIL STYLE"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("KEIL STYLE");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_15`,label:`Методичка 198: C LCD METHODYCHKA`,description:`lcd_print "METHODYCHKA"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("METHODYCHKA");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_16`,label:`Методичка 199: C LCD LAB TEST`,description:`lcd_print "LAB TEST"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("LAB TEST");
  while(1) { }
}
`},{mode:`c`,trigger:`m_c_lcd_text_17`,label:`Методичка 200: C LCD INPUT OK`,description:`lcd_print "INPUT OK"`,insertText:`void main() {
  lcd_init();
  lcd_clear();
  lcd_line(1);
  lcd_print("INPUT OK");
  while(1) { }
}
`},{mode:`c`,trigger:`static`,label:`m3_static_hex_001`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1001); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_002`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1002); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_003`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1003); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_004`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1004); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_005`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1005); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_006`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1006); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_007`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1007); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_008`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1008); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_009`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1009); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_010`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_011`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_012`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_013`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_014`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_015`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x100F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_016`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1010); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_017`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1011); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_018`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1012); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_019`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1013); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_020`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1014); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_021`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1015); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_022`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1016); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_023`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1017); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_024`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1018); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_025`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1019); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_026`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_027`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_028`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_029`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_030`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_031`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x101F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_032`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1020); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_033`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1021); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_034`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1022); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_035`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1023); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_036`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1024); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_037`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1025); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_038`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1026); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_039`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1027); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_040`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1028); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_041`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1029); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_042`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_043`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_044`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_045`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_046`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_047`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x102F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_048`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1030); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_049`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1031); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_050`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1032); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_051`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1033); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_052`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1034); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_053`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1035); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_054`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1036); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_055`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1037); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_056`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1038); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_057`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1039); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_058`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_059`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_060`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_061`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_062`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_063`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x103F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_064`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1040); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_065`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1041); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_066`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1042); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_067`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1043); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_068`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1044); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_069`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1045); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_070`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1046); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_071`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1047); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_072`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1048); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_073`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1049); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_074`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_075`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_076`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_077`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_078`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_079`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x104F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_080`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1050); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_081`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1051); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_082`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1052); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_083`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1053); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_084`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1054); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_085`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1055); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_086`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1056); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_087`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1057); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_088`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1058); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_089`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1059); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_090`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105A); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_091`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105B); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_092`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105C); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_093`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105D); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_094`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105E); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_095`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x105F); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_096`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1060); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_097`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1061); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_098`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1062); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_099`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1063); while(1); }`},{mode:`c`,trigger:`static`,label:`m3_static_hex_100`,description:`Methodychka Lab3 Static/Hto7 technical C`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }
const unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};
void Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }
void main(){ Static(0x1064); while(1); }`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_001`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_002`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_003`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_004`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_005`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_006`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_007`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_008`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_009`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_010`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_011`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_012`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_013`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_014`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_015`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_016`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_017`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_018`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_019`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_020`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_021`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_022`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_023`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_024`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_025`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_026`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_027`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_028`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_029`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_030`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_031`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_032`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_033`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_034`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_035`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_036`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_037`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_038`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_039`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_040`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_041`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_042`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_043`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_044`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_045`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_046`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_047`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_048`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_049`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_050`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_051`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_052`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_053`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_054`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_055`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_056`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_057`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_058`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_059`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_060`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_061`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_062`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_063`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_064`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_065`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_066`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_067`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_068`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_069`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_070`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_071`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_072`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_073`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_074`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_075`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_076`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_077`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_078`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_079`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`readkey`,label:`m4_readkey_switch_080`,description:`Methodychka Lab4 keypad switch/case counter`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void LED(unsigned char Data){write(7,~Data);}
unsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}
void main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_001`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(11);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_002`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(12);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_003`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(13);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_004`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(14);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_005`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(15);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_006`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(16);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_007`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(17);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_008`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(18);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_009`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(19);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_010`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(20);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_011`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(21);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_012`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(22);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_013`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(23);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_014`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(24);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_015`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(25);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_016`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(26);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_017`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(27);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_018`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(28);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_019`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(29);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_020`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(30);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_021`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(31);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_022`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(32);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_023`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(33);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_024`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(34);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_025`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(35);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_026`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(36);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_027`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(37);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_028`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(38);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_029`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(39);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_030`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(40);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_031`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(41);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_032`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(42);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_033`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(43);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_034`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(44);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_035`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(45);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_036`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(46);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_037`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(47);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_038`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(48);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_039`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(49);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_040`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(50);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_041`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(51);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_042`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(52);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_043`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(53);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_044`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(54);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_045`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(55);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_046`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(56);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_047`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(57);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_048`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(58);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_049`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(59);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_050`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(60);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_051`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(61);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_052`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(62);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_053`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(63);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_054`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(64);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_055`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(65);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_056`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(66);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_057`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(67);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_058`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(68);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_059`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(69);}}`},{mode:`c`,trigger:`step`,label:`m5_stepper_halfstep_060`,description:`Methodychka Lab5 stepper motor technical pattern`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
void delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}
unsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}
void main(){while(1){Step(0);delay(70);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_001`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_002`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_003`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_004`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_005`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_006`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_007`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_008`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_009`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_010`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_011`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_012`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_013`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_014`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_015`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_016`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_017`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_018`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_019`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_020`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_021`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_022`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_023`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_024`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_025`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_026`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_027`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_028`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_029`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_030`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_031`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_032`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_033`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_034`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_035`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_036`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_037`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_038`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_039`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_040`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_041`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_042`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_043`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_044`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_045`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_046`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_047`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_048`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_049`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_050`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_051`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_052`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_053`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_054`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_055`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_056`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_057`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_058`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_059`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`},{mode:`c`,trigger:`adc`,label:`m6_adc_getadc_060`,description:`Methodychka Lab6 ADC technical registers`,insertText:`#include "ADUC841.h"
void write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}
unsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}
void main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}`}];function Q(e,t={}){let n=document.createElement(e);for(let[e,r]of Object.entries(t))n.setAttribute(e,r);return n}function Lt(e){let t=e.indexOf(`;`),n=t>=0?e.slice(0,t):e,r=t>=0?e.slice(t):``,i=new Set(`acall add addc ajmp anl cjne clr cpl da dec div djnz inc jb jbc jc jmp jnb jnc jnz jz
        lcall ljmp mov movc movx mul nop orl pop push ret reti rl rlc rr rrc setb sjmp subb swap xch xchd xrl`.split(/\s+/)),a=new Set(`org end equ data bit db dw ds cseg dseg xseg bseg using public extern name include segment rseg`.split(/\s+/)),o=new Set(`a acc ab b c dptr dpl dph psw sp p0 p1 p2 p3 r0 r1 r2 r3 r4 r5 r6 r7
        ie ip tcon tmod th0 tl0 th1 tl1 th2 tl2 scon sbuf pcon
        adccon1 adccon2 adccon3 adcdatal adcdatah dac0l dac0h dac1l dac1h pwmcon
        wr rd int0 int1 t0 t1 adci sconv`.split(/\s+/)),s=/([A-Za-z_.$?][\w.$?]*:)|#?0x[0-9a-fA-F]+\b|#?[0-9a-fA-F]+[hH]\b|#?[01]+[bB]\b|#?\d+\b|\b[A-Za-z_.$?][\w.$?]*\b|[,()#@:+\-*/&|^~=<>\[\].]/g,c=``,l=0;for(let e of n.matchAll(s)){let t=e[0],r=e.index??0;c+=Z(n.slice(l,r));let s=t.toLowerCase();/^[A-Za-z_.$?][\w.$?]*:$/.test(t)?c+=`<span class="tok-label">${Z(t)}</span>`:i.has(s)?c+=`<span class="tok-key">${Z(t)}</span>`:a.has(s)?c+=`<span class="tok-pre">${Z(t)}</span>`:o.has(s)||/^p[0-3]\.[0-7]$/i.test(t)?c+=`<span class="tok-reg">${Z(t)}</span>`:/^#?(?:0x[0-9a-f]+|[0-9a-f]+h|[01]+b|\d+)$/i.test(t)?c+=`<span class="tok-num">${Z(t)}</span>`:/^[,()#@:+\-*/&|^~=<>\[\].]$/.test(t)?c+=`<span class="tok-op">${Z(t)}</span>`:c+=`<span class="tok-ident">${Z(t)}</span>`,l=r+t.length}return c+=Z(n.slice(l)),r&&(c+=`<span class="tok-comment">${Z(r)}</span>`),c}function Rt(e){let t=e.replace(/\r/g,``),n=new Set(`auto break case continue default do else enum extern for goto if register return sizeof static struct switch typedef union volatile while
        interrupt using reentrant compact small large alien priority task _task`.split(/\s+/)),r=new Set(`void char short int long float double signed unsigned bit sbit sfr sfr16 __sfr __sbit __sfr16
        data idata bdata xdata pdata far code const uint8_t uint16_t uint32_t int8_t int16_t int32_t bool`.split(/\s+/)),i=new Set(`p0 p1 p2 p3 pcon tcon tmod tl0 tl1 th0 th1 scon sbuf ie ip psw acc b sp dpl dph dptr
        adccon1 adccon2 adccon3 adcdatal adcdatah dac0l dac0h dac1l dac1h pwmcon pwm0l pwm0h pwm1l pwm1h
        wr rd int0 int1 t0 t1 adci sconv`.split(/\s+/)),a=new Set(`write led static staticl statich clearstatic clearlatches readkey readkeycol readkeycolumn1 readkeycolumn2 readkeycolumn3
        getadc step stepv delay lcd_init lcd_clear lcd_line lcd_print lcd_cmd lcd_data seg_digit seg_clear matrix
        _nop_ nop abs min max`.split(/\s+/)),o=``,s=0;for(;s<t.length;){let e=t[s];if(e===`
`){o+=`
`,s++;continue}if(/\s/.test(e)){o+=Z(e),s++;continue}if(t.startsWith(`//`,s)){let e=t.indexOf(`
`,s),n=e===-1?t.slice(s):t.slice(s,e);o+=`<span class="tok-comment">${Z(n)}</span>`,s+=n.length;continue}if(t.startsWith(`/*`,s)){let e=t.indexOf(`*/`,s+2),n=e===-1?t.slice(s):t.slice(s,e+2);o+=`<span class="tok-comment">${Z(n)}</span>`,s+=n.length;continue}if(e===`"`||e===`'`){let n=e,r=s+1;for(;r<t.length;){if(t[r]===`\\`){r+=2;continue}if(t[r]===n){r++;break}r++}let i=t.slice(s,r);o+=`<span class="${n===`"`?`tok-str`:`tok-char`}">${Z(i)}</span>`,s=r;continue}if(e===`#`){let e=t.indexOf(`
`,s),n=e===-1?t.slice(s):t.slice(s,e),r=Z(n).replace(/(#[A-Za-z_][\w]*)/,`<span class="tok-pre">$1</span>`);o+=`<span class="tok-macro">${r}</span>`,s+=n.length;continue}let c=/^(?:0x[0-9a-fA-F]+|0b[01]+|[01]+[bB]|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\d+)(?:[uUlLfF]+)?/.exec(t.slice(s));if(c){o+=`<span class="tok-num">${Z(c[0])}</span>`,s+=c[0].length;continue}let l=/^[A-Za-z_][\w]*/.exec(t.slice(s));if(l){let e=l[0],c=e.toLowerCase(),u=s+e.length;for(;u<t.length&&/\s/.test(t[u]);)u++;let d=t[u]===`(`;n.has(c)?o+=`<span class="tok-key">${Z(e)}</span>`:r.has(c)?o+=`<span class="tok-type">${Z(e)}</span>`:i.has(c)?o+=`<span class="tok-reg">${Z(e)}</span>`:a.has(c)||d?o+=`<span class="tok-fn">${Z(e)}</span>`:o+=`<span class="tok-ident">${Z(e)}</span>`,s+=e.length;continue}let u=/^(?:>>=|<<=|\+\+|--|&&|\|\||==|!=|<=|>=|->|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|[{}()[\].,;:?~!+\-*/%&|^=<>])/.exec(t.slice(s));if(u){o+=`<span class="tok-op">${Z(u[0])}</span>`,s+=u[0].length;continue}o+=Z(e),s++}return o}var $=[{id:`lab1-led-scan`,title:`Lab1: LED line (addr 0x07)`,description:`Пише в адресу 0x07 (як у прикладі з методички) і ганяє біти (active-low).`,code:`export async function main({ board }) {
  let a = 0x01;
  while (true) {
    a = ((a >>> 1) | ((a & 1) << 7)) & 0xff; // RR A

    board.writeBit('P3', 6, 1); // TX
    board.writePort('P0', (~a) & 0xff); // active-low
    board.writePort('P2', 0x07);
    board.writePort('P2', 0x00); // latch pulse

    await board.delay(200);
  }
}
`},{id:`lab2-7seg-1988`,title:`Lab2: 7-seg static (addr 0x01..0x04)`,description:`Як у прикладі з методички: почергово '1','9','8','8' (active-low сегменти).`,code:`export async function main({ board }) {
  const digits = [
    { addr: 0x04, dat: 0b11001111 },
    { addr: 0x03, dat: 0b10010000 },
    { addr: 0x02, dat: 0b10000000 },
    { addr: 0x01, dat: 0b10000000 },
  ];

  board.writeBit('P3', 6, 1);
  for (const addr of [0x01, 0x02, 0x03, 0x04]) {
    board.writePort('P0', 0xff);
    board.writePort('P2', addr);
    board.writePort('P2', 0x00);
  }

  while (true) {
    for (const { addr, dat } of digits) {
      board.writeBit('P3', 6, 1);
      board.writePort('P0', dat);
      board.writePort('P2', addr);
      board.writePort('P2', 0x00);
      await board.delay(600);
    }
  }
}
`},{id:`lab3-matrix-s`,title:`Lab3: LED matrix 5x7 (addr 0x05/0x06)`,description:`DD17 addr 0x05 (rows, active-low), DD18 addr 0x06 (cols, active-high).`,code:`export async function main({ board }) {
  const frames = [
    { row: 0b10111110, col: 0b00001110 },
    { row: 0b11011101, col: 0b00010001 },
    { row: 0b11111011, col: 0b00010000 },
    { row: 0b11101111, col: 0b00000001 },
    { row: 0b11011101, col: 0b00010001 },
    { row: 0b10111110, col: 0b00001110 },
  ];

  while (true) {
    for (const f of frames) {
      board.writeBit('P3', 6, 1);
      board.writePort('P0', f.row);
      board.writePort('P2', 0x05);
      board.writePort('P2', 0x00);

      board.writePort('P0', f.col);
      board.writePort('P2', 0x06);
      board.writePort('P2', 0x00);

      await board.delay(30);

      // off
      board.writePort('P0', 0xff);
      board.writePort('P2', 0x05);
      board.writePort('P2', 0x00);
      board.writePort('P0', 0x00);
      board.writePort('P2', 0x06);
      board.writePort('P2', 0x00);
    }
  }
}
`},{id:`lab4-keypad-led`,title:`Lab4: Keypad scan → LED line`,description:`P2=0x60/0x50/0x30 (як у прикладі), P3.6=0 (RX), читаємо P0.0..P0.3 (0=натиснуто).`,code:`export async function main({ board }) {
  const colAddrs = [0x60, 0x50, 0x30];
  while (true) {
    for (let col = 0; col < 3; col++) {
      board.writePort('P2', colAddrs[col]);
      board.writeBit('P3', 6, 0);
      const p0 = board.readPort('P0');
      const rows = (~p0) & 0x0f;

      if (rows) {
        let row = 0;
        while (((rows >>> row) & 1) === 0) row++;

        const ledIndex = col * 3 + row;
        const mask = 1 << (ledIndex % 8);

        board.writeBit('P3', 6, 1);
        board.writePort('P0', (~mask) & 0xff);
        board.writePort('P2', 0x07);
        board.writePort('P2', 0x00);
      }

      await board.delay(60);
    }
  }
}
`},{id:`lab5-lcd-hello`,title:`Lab5: LCD (high-level placeholder)`,description:`В PDF (text layer) не витяглось як саме LCD адресовано через CPLD, тому поки показуємо LCD як окремий пристрій.`,code:`export async function main({ devices }) {
  devices.lcd.clear();
  devices.lcd.print(0, 0, 'TNTU ST841');
  devices.lcd.print(1, 0, 'LCD OK');
}
`},{id:`lab6-adc-joystick`,title:`Lab6: ADC joystick (high-level)`,description:`Поки high-level: читаємо X/Y і показуємо точку на матриці. Далі можна підʼєднати під ADCCON* регістри.`,code:`export async function main({ devices }) {
  while (true) {
    const { x, y } = devices.adc.read();
    const col = Math.min(4, Math.max(0, Math.round((x / 1023) * 4)));
    const row = Math.min(6, Math.max(0, Math.round((y / 1023) * 6)));
    devices.matrix.setPoint(row, col, true);
    await new Promise((r) => setTimeout(r, 40));
  }
}
`}];function zt(e){let t=new a,n=new c,r=new f,i=new m,o=new ee,s=new ie,l=new le;t.bus.registerDevice(b.ledBarAddr,n),t.bus.registerDevice(b.sevenSegAddrs[0],r.digit(3)),t.bus.registerDevice(b.sevenSegAddrs[1],r.digit(2)),t.bus.registerDevice(b.sevenSegAddrs[2],r.digit(1)),t.bus.registerDevice(b.sevenSegAddrs[3],r.digit(0)),t.bus.registerDevice(b.matrixRowsAddr,i.rowsDevice()),t.bus.registerDevice(b.matrixColsAddr,i.colsDevice()),t.bus.registerDevice(b.lcdAddr,s),t.bus.registerDevice(b.lcdAddr+1&255,{write(e){s.writeDataByte(e)}}),t.bus.registerReadProvider((e,t)=>o.read(e,t.keypadPressed??new Set)),t.extraDevices={lcd:s,adc:l,keypad:o,sevenSeg:r,matrix:i,ledBar:n},e.innerHTML=``,e.appendChild(St({board:t,exampleScripts:$}))}var Bt=document.querySelector(`#app`);if(!Bt)throw Error(`Missing #app root`);zt(Bt);