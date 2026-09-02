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

    if (!data || data.c === undefined || data.c === null || data.c === 0) {
      return Response.json(
        {
          error: "Sin datos",
          symbol,
          raw: data
        },
        { status: 404 }
      );
    }
   const response = Response.json(
  {
    symbol,
    price: data.c
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
