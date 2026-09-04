export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return Response.json(
        { error: "Falta symbol" },
        { status: 400 }
      );
    }

    const cache = caches.default;
    const cacheKey = new Request(
      `${url.origin}/api/quote?symbol=${encodeURIComponent(symbol)}`
    );

    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    let price = null;
    let source = "";

    // ACCIONES EUROPEAS
const yahooSymbol =
  symbol === "BTC" ? "BTC-EUR" :
  symbol === "SOL" ? "SOL-EUR" :
  symbol;

if (
  symbol === "BTC" ||
  symbol === "SOL" ||
  symbol.endsWith(".MC") ||
  symbol.endsWith(".MI")
) {
       const yahooUrl =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoosymbol)}?interval=1d&range=1d`;

      const yahooRes = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      });

      if (!yahooRes.ok) {
        return Response.json(
          {
            error: "Error al consultar cotización europea",
            status: yahooRes.status
          },
          { status: 502 }
        );
      }

      const yahooData = await yahooRes.json();

      const result = yahooData?.chart?.result?.[0];

      price =
        result?.meta?.regularMarketPrice ??
        result?.meta?.previousClose ??
        null;

      source = "Yahoo";
    }

    // ACCIONES USA
    else {
      const apiKey = context.env.FINNHUB_API_KEY;

      if (!apiKey) {
        return Response.json(
          { error: "Falta la API Key de Finnhub" },
          { status: 500 }
        );
      }

      const finnhubUrl =
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;

      const res = await fetch(finnhubUrl, {
        headers: {
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        return Response.json(
          {
            error: "Error al consultar Finnhub",
            status: res.status
          },
          { status: 502 }
        );
      }

      const data = await res.json();

      price = data?.c;
      source = "Finnhub";
    }

    if (
      price === null ||
      price === undefined ||
      Number(price) === 0
    ) {
      return Response.json(
        {
          error: "Sin datos",
          symbol
        },
        { status: 404 }
      );
    }

    const response = Response.json(
      {
        symbol,
        price: Number(price),
        source
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60"
        }
      }
    );

    await cache.put(cacheKey, response.clone());

    return response;

  } catch (error) {
    return Response.json(
      {
        error: "Error interno",
        message: error?.message || "Error desconocido"
      },
      { status: 500 }
    );
  }
}
