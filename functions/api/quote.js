export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return Response.json({ error: "Falta symbol" }, { status: 400 });
    }

    const token = env.ALPHA_VANTAGE_API_KEY;

    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`
    );

    const data = await response.json();

    return Response.json({
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp
    });

  } catch (e) {
    return Response.json({
      error: "Error interno",
      message: String(e)
    }, { status: 500 });
  }
}
