export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const symbol = url.searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Falta symbol" }, { status: 400 });
  }

  const apiKey = context.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Falta la API Key de Finnhub" },
      { status: 500 }
    );
  }

  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  );

  const data = await res.json();

  if (!data || data.c === undefined) {
    return Response.json(
      { error: "Sin datos", raw: data },
      { status: 404 }
    );
  }

  return Response.json({
    symbol,
    price: data.c
  });
}
