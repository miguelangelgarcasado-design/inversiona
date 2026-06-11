export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return Response.json({ error: "Falta symbol" }, { status: 400 });
    }

    const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;

    if (price === undefined || price === null) {
      return Response.json({ error: "Sin datos", data }, { status: 404 });
    }

    return Response.json({
      symbol,
      price,
      change: "",
      changePercent: ""
    });
  } catch (e) {
    return Response.json({ error: "Error interno", message: String(e) }, { status: 500 });
  }
}
