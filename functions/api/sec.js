// Cloudflare Pages Function. Consulta bajo demanda de información pública de la SEC.
// Requiere definir SEC_USER_AGENT en Cloudflare Pages como "NombreContacto correo@dominio" real.
// Fuente: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
const json = (obj, status=200) => new Response(JSON.stringify(obj), {
  status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}
});
async function obtener(url, ua, maxBytes=11000000){
  const res=await fetch(url,{headers:{'User-Agent':ua,'Accept':'application/json','Accept-Encoding':'gzip, deflate'},redirect:'follow'});
  if(!res.ok)throw new Error('SEC devolvió HTTP '+res.status);
  const size=Number(res.headers.get('content-length')||0);
  if(size>maxBytes)throw new Error('Respuesta SEC excede límite de tamaño');
  const raw=await res.text();
  if(raw.length>maxBytes)throw new Error('Respuesta SEC demasiado grande');
  return JSON.parse(raw);
}
function ultimoConcepto(facts,tags,units=['USD']){
  const us=facts?.facts?.['us-gaap']||{};
  for(const t of tags){
    const datos=us[t]?.units||{};
    for(const unit of units){
      const items=(datos[unit]||[]).filter(v=>v && Number.isFinite(v.val)&& /^20\d{2}-\d{2}-\d{2}$/.test(v.end||'') && /^(10-K|10-Q)$/.test(v.form||'') && v.filed);
      if(!items.length)continue;
      // Preferir el dato más reciente según fecha del periodo; en empate última presentación.
      items.sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
      const x=items[0];return {value:x.val,unit,end:x.end,filed:x.filed,form:x.form,tag:t};
    }
  }
  return null;
}

// Fase 44: únicamente hechos XBRL con "frame" explícito y la misma base temporal.
// Q=flujo de ~3 meses; FY=flujo anual; QI=saldo puntual a fin de trimestre.
// No comparar acumulados YTD como trimestrales. No derivar riesgo de dilución de solo dos saldos.
function comparacionHomogenea(companyfacts, tags, unidad, naturaleza){
  const gaap=companyfacts?.facts?.['us-gaap']||{};
  const prefijos=naturaleza==='saldo'?['I']:['Q','FY'];
  const candidatos=[];
  for(const tag of tags){
    const lista=gaap[tag]?.units?.[unidad]||[];
    for(const x of lista){
      if(!x||!Number.isFinite(x.val)||!x.filed||!x.end||!['10-K','10-Q'].includes(x.form))continue;
      const frame=String(x.frame||'');
      let tipo='',anio=0,trim=0;
      let m=frame.match(/^CY(20\d{2})Q([1-4])I$/);
      if(m && naturaleza==='saldo'){tipo='Q';anio=Number(m[1]);trim=Number(m[2]);}
      m=frame.match(/^CY(20\d{2})Q([1-4])$/);
      if(m && naturaleza==='flujo'){tipo='Q';anio=Number(m[1]);trim=Number(m[2]);
        const dias=x.start?(Date.parse(x.end)-Date.parse(x.start))/86400000:NaN;
        if(!Number.isFinite(dias)||dias<65||dias>105)continue;
      }
      m=frame.match(/^CY(20\d{2})$/);
      if(m && naturaleza==='flujo'){tipo='FY';anio=Number(m[1]);
        const dias=x.start?(Date.parse(x.end)-Date.parse(x.start))/86400000:NaN;
        if(!Number.isFinite(dias)||dias<330||dias>380)continue;
      }
      if(!tipo)continue;
      candidatos.push({value:x.val,frame,end:x.end,start:x.start||null,filed:x.filed,form:x.form,tag,tipo,anio,trim,accn:x.accn||''});
    }
  }
  // Mantener la misma definición XBRL para cada par; preferir observaciones recientes,
  // y revisiones publicadas más tarde SOLO si existen datos comparables del año previo.
  candidatos.sort((a,b)=>b.anio-a.anio||((b.tipo==='Q')-(a.tipo==='Q'))||b.trim-a.trim||b.filed.localeCompare(a.filed));
  for(const actual of candidatos){
    const anteriores=candidatos.filter(a=>a.tag===actual.tag&&a.tipo===actual.tipo&&a.trim===actual.trim&&a.anio===actual.anio-1);
    anteriores.sort((a,b)=>b.filed.localeCompare(a.filed));
    if(!anteriores.length)continue;
    const anterior=anteriores[0];
    return {unit:unidad,concept:actual.tag,kind:actual.tipo==='FY'?'anual':(naturaleza==='saldo'?'saldo trimestral':'trimestre'),current:actual,previous:anterior,
      change:actual.value-anterior.value,
      changePct:anterior.value!==0?((actual.value-anterior.value)/Math.abs(anterior.value))*100:null};
  }
  return null;
}
function crearComparaciones(f){
 const campos=[
  ['Efectivo y equivalentes',['CashAndCashEquivalentsAtCarryingValue'],'USD','saldo'],
  ['Deuda a largo plazo',['LongTermDebtNoncurrent','LongTermDebt'],'USD','saldo'],
  ['Parte corriente de deuda a largo plazo',['LongTermDebtCurrent'],'USD','saldo'],
  ['Ingresos',['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],'USD','flujo'],
  ['Beneficio o pérdida neta',['NetIncomeLoss'],'USD','flujo'],
  ['Acciones ordinarias en circulación',['CommonStockSharesOutstanding'],'shares','saldo']
 ];
 return campos.map(([label,tags,unit,kind])=>({label,comparison:comparacionHomogenea(f,tags,unit,kind)}));
}

export async function onRequestGet({request,env}){
  const sym=(new URL(request.url)).searchParams.get('symbol')?.toUpperCase().trim()||'';
  if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym))return json({error:'Símbolo no válido'},400);
  const ua=(env.SEC_USER_AGENT||'').trim();
  if(ua.length<12||!ua.includes('@'))return json({error:'Falta configurar SEC_USER_AGENT con un nombre y correo real en Cloudflare Pages (variable de entorno). No se ha consultado la SEC.'},503);
  try{
    const mapa=await obtener('https://www.sec.gov/files/company_tickers.json',ua,3000000);
    const registro=Object.values(mapa).find(v=>String(v?.ticker||'').toUpperCase()===sym);
    if(!registro)return json({error:'No se encontró correspondencia ticker/CIK en el listado SEC. No se presupone que carezca de informes.'},404);
    const cik=String(registro.cik_str).padStart(10,'0');
    const [s,f]=await Promise.all([
      obtener('https://data.sec.gov/submissions/CIK'+cik+'.json',ua,3500000),
      obtener('https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json',ua,11000000).catch(()=>null)
    ]);
    const recent=s?.filings?.recent||{};
    const filings=[];
    for(let i=0;i<Math.min(100,recent.form?.length||0)&&filings.length<8;i++){
      const form=recent.form[i];
      if(!['10-K','10-Q','8-K','S-3','S-1','424B5','424B3','424B2','424B4','424B7','DEF 14A'].includes(form))continue;
      const acc=recent.accessionNumber?.[i];const doc=recent.primaryDocument?.[i];
      // SEC archive link formed using identifiers from official JSON, sanitized.
      if(!/^[0-9]{10}-[0-9]{2}-[0-9]{6}$/.test(acc||'')||!/^[\w.\-]+$/.test(doc||''))continue;
      const url='https://www.sec.gov/Archives/edgar/data/'+Number(cik)+'/'+acc.replace(/-/g,'')+'/'+doc;
      filings.push({form,date:recent.filingDate[i],url});
    }
    const specs=[
      ['Efectivo y equivalentes',['CashAndCashEquivalentsAtCarryingValue']],
      ['Efectivo y equivalentes, incluyendo restringido',['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']],
      ['Deuda a largo plazo',['LongTermDebtNoncurrent','LongTermDebt']],
      ['Parte corriente de deuda a largo plazo',['LongTermDebtCurrent']],
      ['Ingresos (conceptos alternativos)',['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet']],
      ['Beneficio o pérdida neta',['NetIncomeLoss']],
      ['Acciones ordinarias en circulación',['CommonStockSharesOutstanding']]
    ];
    const financials=[];
    for(const [label,tags] of specs){
      const units=label.startsWith('Acciones')?['shares']:['USD'];
      const v=ultimoConcepto(f,tags,units);if(v)financials.push({label,...v});
    }
    return json({symbol:sym,cik,company:s?.name||registro.title,checkedAt:new Date().toISOString(),financials,comparisons:crearComparaciones(f),filings,source:'SEC EDGAR; conceptos XBRL de periodos heterogéneos; sin juicio automático de riesgo'},200);
  }catch(e){return json({error:'No se pudieron recuperar los registros oficiales SEC: '+(e?.message||'error')+'. No se mostrarán valores estimados.'},502);}
}
