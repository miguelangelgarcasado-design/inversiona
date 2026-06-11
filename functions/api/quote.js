export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return Response.json({ error: "Falta symbol" }, { status: 400 });
    }

    const mapa = {
      AAPL: "aapl.us",
      MSFT: "msft.us",
      IBM: "ibm.us",
      TSLA: "tsla.us",
      AMZN: "amzn.us"
    };

    const stooqSymbol = mapa[symbol.toUpperCase()] || symbol.toLowerCase();

    const apiUrl = `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&h&e=csv`;

    const res = await fetch(apiUrl);
    const text = await res.text();

    const lines = text.trim().split("\n");
    const values = lines[1].split(",");

    const close = values[6];

    if (!close || close === "N/D") {
      return Response.json({ error: "Sin datos", raw: text }, { status: 404 });
    }

    return Response.json({
      symbol,
      price: close,
      change: "",
      changePercent: ""
    });

  } catch (e) {
    return Response.json({ error: "Error interno", message: String(e) }, { status: 500 });
  }
}
