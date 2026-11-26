import fs from 'node:fs'
const created=await fetch('http://127.0.0.1:9222/json/new?about%3Ablank',{method:'PUT'})
const target=await created.json(); const ws=new WebSocket(target.webSocketDebuggerUrl)
const pending=new Map(); let seq=0
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej})
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id){const p=pending.get(m.id); if(p){pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params}))})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text); return r.result?.value}
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:'http://127.0.0.1:5173/'}); await sleep(3000)
await ev(`(()=>{const rows=[...document.querySelectorAll('div')].filter(d=>d.textContent.includes('ZSL-92B 30mm')); const r=rows[rows.length-1]; if(r)r.click(); return true})()`)
await sleep(500)
const h=await ev(`(()=>{const b=document.querySelector('button[title="Drag to rotate asset"]'); if(!b)return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
console.log('start',h)
if(h){
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x,y:h.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:h.x,y:h.y,button:'left',clickCount:1});
 await sleep(100)
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x+60,y:h.y+30,button:'left',buttons:1});
 await sleep(250)
 console.log('mid',await ev(`(()=>{const b=document.querySelector('button[title="Drag to rotate asset"]');const r=b.getBoundingClientRect();const p=JSON.parse(localStorage.getItem('prplanner.plan.v1'));const s=p.stages.find(x=>x.id===p.activeStageId);return {h:{x:r.x+r.width/2,y:r.y+r.height/2},moves:s.moves}})()`))
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x+120,y:h.y+60,button:'left',buttons:1});
 await sleep(250)
 console.log('mid2',await ev(`(()=>{const b=document.querySelector('button[title="Drag to rotate asset"]');const r=b.getBoundingClientRect();const p=JSON.parse(localStorage.getItem('prplanner.plan.v1'));const s=p.stages.find(x=>x.id===p.activeStageId);return {h:{x:r.x+r.width/2,y:r.y+r.height/2},moves:s.moves}})()`))
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:h.x+120,y:h.y+60,button:'left',clickCount:1});
}
ws.close(); await fetch(`http://127.0.0.1:9222/json/close/${target.id}`); process.exit(0)
