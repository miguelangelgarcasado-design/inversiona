export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) return Response.json({ error: "Falta symbol" }, { status: 400 });

    const token = env.ALPHA_VANTAGE_API_KEY;

    const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;

    const response = await fetch(apiUrl, {
      headers: { "Accept": "application/json" }
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json({ error: "Respuesta no JSON", status: response.status, text }, { status: 500 });
    }

    if (data.c === 0 || data.c === null || data.c === undefined) {
      return Response.json({ error: "Sin datos", data }, { status: 404 });
    }

    return Response.json({
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp
    });

  } catch (e) {
    return Response.json({ error: "Error interno", message: String(e) }, { status: 500 });
  }
}
