// Fase 61: lectura documental SEC bajo demanda (compatible con cronologia F61).
// La clasificacion prudente de ofertas y ventas se realiza en index.html.
// No confirma ejecuciones, no guarda datos ni cambia cartera o reglas del radar.
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

// Fase 53: pistas de frases literales, nunca un sumatorio ni confirmación
// de ejecución. Cada resultado pertenece SOLO al documento consultado.
function pistasFinanciacionF53(texto){
 const patrones=[
  ['Oferta de acciones anunciada', /(?:we are offering|we offered|offering of|public offering of)\s.{0,100}?(?:[\d,]+)\s+shares/gi],
  ['Acciones declaradas como vendidas', /(?:sale of|sold|sales of)\s+(?:[\d,]+)\s+shares/gi],
  ['Ventas mediante ATM', /(?:[\d,]+)\s+shares.{0,85}?(?:at.the.market|ATM program)/gi],
  ['Precio de oferta por acción', /(?:offering price|public offering price|price to public)\s.{0,50}?\$[\d,.]+/gi],
  ['Importes ATM o capacidad futura', /(?:up to an aggregate of|up to a total of|net proceeds of)\s+\$[\d,.]+\s*(?:million|billion)?/gi]
 ];
 const pistas=[],vistos=new Set();
 for(const [etiqueta,re] of patrones){
   let m,n=0;
   while((m=re.exec(texto))&&n<2&&pistas.length<10){
     const inicio=Math.max(0,m.index-100),fin=Math.min(texto.length,m.index+m[0].length+105);
     const extr=texto.slice(inicio,fin).trim();
     const clave=etiqueta+':'+m[0].toLowerCase().replace(/\s+/g,' ');
     if(vistos.has(clave))continue;
     vistos.add(clave);pistas.push({etiqueta,texto:(inicio?'…':'')+extr+(fin<texto.length?'…':'')});n++;
   }
 }
 return pistas;
}

// Fase 57: se extraen hasta 8 referencias cuantitativas POR DOCUMENTO. No se
// agregan ni convierten en una cifra de dilución. Los patrones son incompletos.
function cifrasF57(texto){
 const reglas=[
  {tipo:'Oferta anunciada',estado:'Presentación/oferta; ejecución no acreditada',re:/(?:we are offering|we propose to offer|public offering of)\s+([\d,]{3,})\s+shares\b/gi,valor:m=>m[1]+' acciones'},
  {tipo:'Venta declarada en texto',estado:'El texto afirma una venta; cotejar periodo, cierre y anexos',re:/(?:sold|sale of|sales of)\s+([\d,]{3,})\s+shares\b/gi,valor:m=>m[1]+' acciones'},
  {tipo:'Importe obtenido declarado',estado:'El texto menciona ingresos; verificar si son netos, brutos o estimados',re:/(?:net proceeds (?:from|of)|gross proceeds (?:from|of))\s+.{0,35}?\$([\d,.]+)\s*(million|billion)?\b/gi,valor:m=>'$'+m[1]+' '+(m[2]||'USD (escala no indicada)')},
  {tipo:'Capacidad o importe máximo',estado:'Límite o capacidad anunciada; no es financiación ejecutada',re:/up to (?:an aggregate of|a total of|approximately)\s+\$([\d,.]+)\s*(million|billion)?\b/gi,valor:m=>'$'+m[1]+' '+(m[2]||'USD (escala no indicada)')},
  {tipo:'Precio público de oferta',estado:'Precio citado; no valida suscripción ni ejecución',re:/(?:public offering price|offering price|price to public)\s*(?:of|at|:)??\s*\$([\d,.]+)/gi,valor:m=>'$'+m[1]+' / acción (contexto pendiente)'}
 ];
 const encontrados=[],vistos=new Set();
 for(const r of reglas){let m,n=0;while((m=r.re.exec(texto))&&n<2&&encontrados.length<8){
   const key=r.tipo+':'+m[0].toLowerCase().replace(/\s+/g,' ');
   if(vistos.has(key))continue;vistos.add(key);n++;
   const desde=Math.max(0,m.index-85),hasta=Math.min(texto.length,m.index+m[0].length+115);
   encontrados.push({tipo:r.tipo,estado:r.estado,valor:r.valor(m),fragmento:(desde?'…':'')+texto.slice(desde,hasta)+(hasta<texto.length?'…':'')});
 }}return encontrados;
}


// Fase 59: detecta coincidencias textuales de importes dentro del documento
// consultado. No compara documentos diferentes ni infiere identidad de operaciones.
function avisosRepeticionF58(cifras){
 const grupos=new Map();
 const claveValor=c=>String(c.valor||'').toLowerCase().replace(/\s+/g,' ').trim();
 for(let i=0;i<cifras.length;i++){
   const c=cifras[i];const v=claveValor(c);
   if(!v)continue;
   const unidades=/acciones/.test(v)?'acciones':/\//.test(v)?'precio':'importe';
   const k=unidades+'|'+v;
   if(!grupos.has(k))grupos.set(k,[]);
   grupos.get(k).push({indice:i+1,tipo:c.tipo});
 }
 const repetidos=[...grupos.entries()].filter(([,g])=>g.length>1).map(([k,g])=>({
   valor:k.split('|').slice(1).join('|'),apariciones:g.length,
   referencias:g.map(x=>x.indice),tipos:[...new Set(g.map(x=>x.tipo))],
   interpretacion:'Posible repetición de una cuantía en este documento. NO sumar ni suponer que sean operaciones diferentes o iguales.'
 }));
 return {repetidos,
   alcance:'Solo este documento SEC, con un máximo de ocho referencias extraídas; no identifica solapamientos entre documentos.',
   periodos:'No verificado: las fechas de operaciones y los periodos de venta no se validan automáticamente. La fecha de presentación NO equivale a la fecha de ejecución.',
   regla:'No agregar acciones ofrecidas, ventas declaradas ni capacidad financiera; comprobar expedientes originales y anexos.'};
}

// Fase 59: etiqueta DESCRIPTIVA del propio documento. No verifica ejecución
// ni enlaza automáticamente operaciones entre distintos expedientes SEC.
function revisionDocumentoF59(texto){
 const inicio=String(texto||'').slice(0,25000);
 const preliminar=/preliminary prospectus|subject to completion|not an offer to sell/i.test(inicio);
 const prospecto=/prospectus supplement/i.test(inicio);
 const etiqueta=preliminar?'Contiene indicios de folleto preliminar':prospecto?'Contiene un suplemento de folleto':'Tipo de documento pendiente de interpretación';
 return {etiqueta, advertencia:'Clasificación literal parcial: no prueba que el documento sea definitivo ni que se haya completado una emisión. Contrastar encabezado, anexos y comunicaciones posteriores.'};
}

export async function onRequestGet({request,env}){
 const q=new URL(request.url).searchParams;
 const sym=(q.get('symbol')||'').trim().toUpperCase(),raw=q.get('url')||'';
 if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)||raw.length>350)return responder({error:'Parámetros no válidos.'},400);
 let u;try{u=new URL(raw);}catch{return responder({error:'Enlace SEC no válido.'},400);}
 const m=u.pathname.match(/^\/Archives\/edgar\/data\/([1-9]\d*)\/([0-9]{18})\/([A-Za-z0-9_.-]+)$/);
 if(u.protocol!=='https:'||u.hostname!=='www.sec.gov'||u.port||u.username||u.password||u.search||u.hash||!m||!/^.+\.(?:htm|html|txt)$/i.test(m[3]))return responder({error:'Solo se permiten documentos SEC HTML/TXT con ruta validada.'},400);
 const ua=String(env.SEC_USER_AGENT||'').trim();if(ua.length<12||!ua.includes('@'))return responder({error:'Falta configurar SEC_USER_AGENT en Cloudflare.'},503);
 try{
   const mapRes=await fetch('https://www.sec.gov/files/company_tickers.json',{headers:{'User-Agent':ua,'Accept':'application/json'},redirect:'manual'});
   if(!mapRes.ok)return responder({error:'No se pudo validar el ticker frente a SEC.'},502);
   const mapa=await mapRes.json();const reg=Object.values(mapa).find(v=>String(v?.ticker||'').toUpperCase()===sym);
   if(!reg||String(Number(m[1]))!==String(reg.cik_str))return responder({error:'El documento no coincide con el emisor consultado.'},400);
   const res=await fetch(u.href,{headers:{'User-Agent':ua,'Accept':'text/html,text/plain;q=0.9'},redirect:'manual'});
   if(!res.ok)return responder({error:'SEC no permite recuperar este documento ahora (HTTP '+res.status+'). Abrir enlace original.'},502);
   const ct=res.headers.get('content-type')||'';
   if(!/text\/|application\/octet-stream/i.test(ct))return responder({error:'El documento no es HTML ni texto; ábrelo en la SEC.'},415);
   const doc=await textoAcotado(res);if(doc.error)return responder({error:doc.error},doc.status);
   const texto=normalizar(doc.texto);const hallazgos=[];
   for(const [tema,exp] of TEMAS){let match,cnt=0;while((match=exp.exec(texto))&&cnt<3&&hallazgos.length<15){const start=Math.max(0,match.index-140),end=Math.min(texto.length,match.index+match[0].length+230);hallazgos.push({tema,extracto:(start?'…':'')+texto.slice(start,end)+(end<texto.length?'…':'')});cnt++;}}
   return responder({symbol:sym,url:u.href,formato:/\.txt$/i.test(m[3])?'TXT':'HTML',consultado:new Date().toISOString(),bytesAnalizados:doc.bytesAnalizados,truncado:false,hallazgos,pistasF53:pistasFinanciacionF53(texto),cifrasF57:cifrasF57(texto),revisionF58:avisosRepeticionF58(cifrasF57(texto)),revisionF59:revisionDocumentoF59(texto),advertencia:'Búsqueda literal de términos en un único documento SEC, sin interpretación financiera ni revisión de anexos. Un resultado positivo no confirma acciones emitidas; uno negativo no descarta dilución. Abrir y contrastar el original.'});
 }catch(e){return responder({error:'Lectura SEC no disponible: '+String(e?.message||'fallo de conexión')},502);}
}
