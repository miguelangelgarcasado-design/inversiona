export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Falta symbol" }, { status: 400 });
  }

  const apiKey = env.ALPHA_VANTAGE_API_KEY;

  const apiUrl =
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

  const res = await fetch(apiUrl);
  const data = await res.json();

  const q = data["Global Quote"];

  if (!q || !q["05. price"]) {
    return Response.json({ error: "Sin datos" }, { status: 404 });
  }

  return Response.json({
    symbol: q["01. symbol"],
    price: q["05. price"],
    change: q["09. change"],
    changePercent: q["10. change percent"]
  });
}
