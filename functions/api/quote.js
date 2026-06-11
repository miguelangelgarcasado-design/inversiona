export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Falta symbol" }, { status: 400 });
  }

  const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

  const res = await fetch(apiUrl);
  const data = await res.json();

  const result = data.chart?.result?.[0];

  if (!result) {
    return Response.json({ error: "Sin datos" }, { status: 404 });
  }

  return Response.json({
    symbol: symbol,
    price: result.meta.regularMarketPrice,
    change: result.meta.regularMarketPrice - result.meta.chartPreviousClose,
    changePercent: ""
  });
}
