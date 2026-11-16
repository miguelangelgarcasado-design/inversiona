// Cloudflare Pages Function. Publicar EXACTAMENTE en functions/api/history.js
// Datos diarios de Yahoo Finance; servicio ajeno sujeto a disponibilidad.
// No guarda datos de usuario, no coloca órdenes ni actualiza carteras.
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const symbol = String(url.searchParams.get('symbol') || '').toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol))
    return Response.json({error:'Símbolo no válido'}, {status:400});
  let lastError = 'Proveedor temporalmente no disponible';
  for (const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']) {
    try {
      const endpoint = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&events=history`;
      const response = await fetch(endpoint, {headers:{'Accept':'application/json','User-Agent':'Mozilla/5.0 InversionIA/34'}});
      if (!response.ok) { lastError='Proveedor HTTP '+response.status; continue; }
      const body = await response.json();
      const result = body?.chart?.result?.[0];
      const q = result?.indicators?.quote?.[0];
      const timestamps=result?.timestamp;
      if (!Array.isArray(timestamps)||!q) {lastError='Datos incompletos';continue;}
      const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const candles=[];
      for(let i=0;i<timestamps.length;i++){
        const date = new Date(timestamps[i]*1000).toISOString().slice(0,10);
        // Omitir hoy: la vela diaria podría estar todavía abierta.
        if(date>=today)continue;
        const open=Number(q.open?.[i]), high=Number(q.high?.[i]), low=Number(q.low?.[i]), close=Number(q.close?.[i]), volume=Number(q.volume?.[i]);
        if(![open,high,low,close,volume].every(Number.isFinite)||Math.min(open,high,low,close)<=0||volume<0)continue;
        if(high<Math.max(open,close)||low>Math.min(open,close))continue;
        candles.push({date,open,high,low,close,volume});
      }
      if(candles.length<100){lastError='Menos de 100 velas válidas';continue;}
      const byDate=new Map(candles.map(x=>[x.date,x]));
      const sorted=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
      return Response.json({symbol,source:'Yahoo Finance chart (OHLCV sin ajustar)',candles:sorted}, {headers:{'Cache-Control':'no-store'}});
    } catch(e){lastError='No se pudo leer el proveedor';}
  }
  return Response.json({error:lastError,symbol}, {status:503,headers:{'Cache-Control':'no-store'}});
}
