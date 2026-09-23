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

    let price = null;
   let source = "v2";

    // Símbolos especiales de Yahoo Finance
    const yahooSymbol =
      symbol === "EURUSD" ? "EURUSD=X" :
      symbol === "BTC" ? "BTC-EUR" :
      symbol === "SOL" ? "SOL-EUR" :
      symbol === "PEPE" ? "PEPE-EUR" :
      symbol === "SUI" ? "SUI20947-USD" :
      symbol === "MNDY" ? "MNDY" :
      symbol;

    // Activos que consultamos mediante Yahoo Finance
    const useYahoo =
      symbol === "BTC" ||
      symbol === "EURUSD" ||
      symbol === "SOL" ||
      symbol === "PEPE" ||
      symbol === "SUI" ||
      symbol === "MBLY" ||
      symbol === "HIMS" ||
      symbol === "TSLA" ||
      symbol === "SWKS" ||
      symbol === "AAPL" ||
      symbol === "ASTS" ||
      symbol === "RXRX" ||
      symbol === "PATH" ||
      symbol === "UAA" ||
      symbol === "NAMM" ||
      symbol === "RKLB" ||
      symbol === "RCAT" ||
      symbol === "MNDY" ||
      symbol === "IREN" ||
      symbol.endsWith(".MC") ||
      symbol.endsWith(".MI");

    if (useYahoo) {
      const yahooUrl =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

      const yahooRes = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      });

      if (!yahooRes.ok) {
        return Response.json(
          {
            error: "Error al consultar Yahoo Finance",
            status: yahooRes.status,
            symbol
          },
          {
            status: 502,
            headers: { "Cache-Control": "no-store" }
          }
        );
      }

      const yahooData = await yahooRes.json();

      price =
        yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice ??
        yahooData?.chart?.result?.[0]?.meta?.previousClose ??
        null;

      source = "Yahoo-v3";

      // SUI y monday.com llegan de Yahoo en USD.
      // Los convertimos a EUR porque en la cartera se muestran en euros.
      if ((symbol === "SUI" || symbol === "MNDY") && price) {
        const cambioRes = await fetch(
          "https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d",
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json"
            }
          }
        );

        if (cambioRes.ok) {
          const cambioData = await cambioRes.json();

          const eurUsd =
            cambioData?.chart?.result?.[0]?.meta?.regularMarketPrice ??
            cambioData?.chart?.result?.[0]?.meta?.previousClose;

          if (eurUsd) {
            price = Number(price) / Number(eurUsd);
            source = "Yahoo-v4-EUR";
          }
        }
      }
    } else {
      // Resto de acciones estadounidenses: Finnhub
      const apiKey = context.env.FINNHUB_API_KEY;

      if (!apiKey) {
        return Response.json(
          { error: "Falta FINNHUB_API_KEY" },
          {
            status: 500,
            headers: { "Cache-Control": "no-store" }
          }
        );
      }

      const finnhubUrl =
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;

      const finnhubRes = await fetch(finnhubUrl);

      if (!finnhubRes.ok) {
        return Response.json(
          {
            error: "Error al consultar Finnhub",
            status: finnhubRes.status,
            symbol
          },
          {
            status: 502,
            headers: { "Cache-Control": "no-store" }
          }
        );
      }

      const finnhubData = await finnhubRes.json();

      price = finnhubData?.c || null;
      source = "Finnhub";
    }

    if (price === null || price === undefined || Number(price) <= 0) {
      return Response.json(
        {
          error: "Sin cotización disponible",
          symbol
        },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    return Response.json(
      {
        symbol,
        price: Number(price),
        source
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    return Response.json(
      {
        error: "Error interno",
        detail: String(error)
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}

