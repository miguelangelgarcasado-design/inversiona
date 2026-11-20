// Fase 52: revisión documental SEC bajo demanda. Devuelve fragmentos SIN interpretar
// como emisiones ejecutadas. No guarda datos, no cambia cartera ni reglas del radar.
const responder=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const MAX_BYTES=850000;
function entidades(s){return s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10);return c>=32&&c<=0x10ffff?String.fromCodePoint(c):' ';}).replace(/&(?:nbsp|amp|lt|gt|quot|apos|ndash|mdash);/gi,m=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&ndash;':'-','&mdash;':'-'}[m.toLowerCase()]||' '));}
function normalizar(html){return entidades(html.replace(/<(?:script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|noscript|svg|head)\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();}
async function textoAcotado(res){
 const size=Number(res.headers.get('content-length')||0);
 if(size>MAX_BYTES)return {error:'El documento excede el límite de lectura de 850 KB; abre el original.',status:413};
 let total=0;const trozos=[];const reader=res.body?.getReader();
 if(!reader)return {error:'No se ha podido leer el documento',status:502};
 let truncado=false;
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){truncado=true;break;}trozos.push(value);}}
 finally{if(truncado)await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(truncado)return {error:'El documento supera 850 KB; no se ha realizado análisis parcial engañoso. Abre el original.',status:413};
 const data=new Uint8Array(total);let pos=0;for(const b of trozos){data.set(b,pos);pos+=b.length;}
 return {texto:new TextDecoder('utf-8',{fatal:false}).decode(data),bytesAnalizados:total,truncado:false};
}
const TEMAS=[
 ['oferta / registro',/\b(?:shelf registration|registration statement|prospectus supplement|public offering|registered direct offering|securities purchase agreement|underwritten offering|offering price)\b/gi],
 ['ATM / ventas en mercado',/\b(?:at.the.market|sales agreement|equity distribution agreement|distribution agent|sales agent)\b/gi],
 ['warrants / convertibles',/\b(?:warrants?|convertible (?:notes?|debt|securities)|exercise price|conversion price)\b/gi],
 ['emisión / acciones',/\b(?:shares issued|shares sold|issuance of shares|common stock|gross proceeds|net proceeds|shares outstanding)\b/gi],
 ['liquidez / financiación',/\b(?:going concern|liquidity|cash runway|working capital|additional financing|capital requirements)\b/gi]
];
export async function onRequestGet({request,env}){
 const q=new URL(request.url).searchParams;
 const sym=(q.get('symbol')||'').trim().toUpperCase(),raw=q.get('url')||'';
 if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)||raw.length>350)return responder({error:'Parámetros no válidos.'},400);
 let u;try{u=new URL(raw);}catch{return responder({error:'Enlace SEC no válido.'},400);}
 const m=u.pathname.match(/^\/Archives\/edgar\/data\/([1-9]\d*)\/([0-9]{18})\/([A-Za-z0-9_.-]+)$/);
 if(u.protocol!=='https:'||u.hostname!=='www.sec.gov'||u.port||u.username||u.password||u.search||u.hash||!m||!/^.+\.(?:htm|html|txt)$/i.test(m[3]))return responder({error:'Solo se permiten documentos SEC HTML/TXT con ruta validada.'},400);
 const ua=String(env.SEC_USER_AGENT||'').trim();if(ua.length<12||!ua.includes('@'))return responder({error:'Falta configurar SEC_USER_AGENT en Cloudflare.'},503);
 try{
   const mapRes=await fetch('https://www.sec.gov/files/company_tickers.json',{headers:{'User-Agent':ua,'Accept':'application/json'},redirect:'error'});
   if(!mapRes.ok)return responder({error:'No se pudo validar el ticker frente a SEC.'},502);
   const mapa=await mapRes.json();const reg=Object.values(mapa).find(v=>String(v?.ticker||'').toUpperCase()===sym);
   if(!reg||String(Number(m[1]))!==String(reg.cik_str))return responder({error:'El documento no coincide con el emisor consultado.'},400);
   const res=await fetch(u.href,{headers:{'User-Agent':ua,'Accept':'text/html,text/plain;q=0.9'},redirect:'error'});
   if(!res.ok)return responder({error:'SEC no permite recuperar este documento ahora (HTTP '+res.status+'). Abrir enlace original.'},502);
   const ct=res.headers.get('content-type')||'';
   if(!/text\/|application\/octet-stream/i.test(ct))return responder({error:'El documento no es HTML ni texto; ábrelo en la SEC.'},415);
   const doc=await textoAcotado(res);if(doc.error)return responder({error:doc.error},doc.status);
   const texto=normalizar(doc.texto);const hallazgos=[];
   for(const [tema,exp] of TEMAS){let match,cnt=0;while((match=exp.exec(texto))&&cnt<3&&hallazgos.length<15){const start=Math.max(0,match.index-140),end=Math.min(texto.length,match.index+match[0].length+230);hallazgos.push({tema,extracto:(start?'…':'')+texto.slice(start,end)+(end<texto.length?'…':'')});cnt++;}}
   return responder({symbol:sym,url:u.href,formato:/\.txt$/i.test(m[3])?'TXT':'HTML',consultado:new Date().toISOString(),bytesAnalizados:doc.bytesAnalizados,truncado:false,hallazgos,advertencia:'Búsqueda literal de términos en un único documento SEC, sin interpretación financiera ni revisión de anexos. Un resultado positivo no confirma acciones emitidas; uno negativo no descarta dilución. Abrir y contrastar el original.'});
 }catch(e){return responder({error:'Lectura SEC no disponible: '+String(e?.message||'fallo de conexión')},502);}
}
