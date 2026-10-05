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
    let cierres = [];
    let maximos = [];
let minimos = [];
let volumenes = [];
let media20 = null;
let media50 = null;
    let rsi14 = null;
    let tendencia = "NEUTRAL";

    // Símbolos especiales de Yahoo Finance
    const yahooSymbol =
      symbol === "EURUSD" ? "EURUSD=X" :
      symbol === "BTC" ? "BTC-EUR" :
      symbol === "SOL" ? "SOL-EUR" :
     symbol === "PEPE" ? "PEPE24478-USD" :
      symbol === "SUI" ? "SUI20947-USD" :
      symbol === "MNDY" ? "MNDY" :
      symbol === "PGS.DE" ? "TPG0.DE" :
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
      symbol === "PGS.DE" ||
      symbol === "TPGO.DE" ||
      symbol.endsWith(".MC") ||
      symbol.endsWith(".MI");

    if (useYahoo) {
   const yahooUrl =
  `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo`;

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

// Datos históricos para análisis técnico
const resultado = yahooData?.chart?.result?.[0];

 cierres = (resultado?.indicators?.quote?.[0]?.close || [])
  .filter(valor => Number.isFinite(valor));
  maximos = (resultado?.indicators?.quote?.[0]?.high || [])
  .filter(valor => Number.isFinite(valor));

minimos = (resultado?.indicators?.quote?.[0]?.low || [])
  .filter(valor => Number.isFinite(valor));

volumenes = (resultado?.indicators?.quote?.[0]?.volume || [])
  .filter(valor => Number.isFinite(valor));
    

const media = (datos, periodos) => {
  if (datos.length < periodos) return null;

  const ultimos = datos.slice(-periodos);
  return ultimos.reduce((suma, valor) => suma + valor, 0) / periodos;
};

 media20 = media(cierres, 20);
 media50 = media(cierres, 50);
  // Tendencia según medias móviles
if (media20 !== null && media50 !== null) {
  if (media20 > media50) {
    tendencia = "ALCISTA";
  } else if (media20 < media50) {
    tendencia = "BAJISTA";
  } else {
    tendencia = "NEUTRAL";
  }
}    
     // RSI de 14 sesiones
if (cierres.length >= 15) {
  let ganancias = 0;
  let perdidas = 0;

  const inicio = cierres.length - 15;

  for (let i = inicio + 1; i < cierres.length; i++) {
    const cambio = cierres[i] - cierres[i - 1];

    if (cambio > 0) {
      ganancias += cambio;
    } else {
      perdidas += Math.abs(cambio);
    }
  }

  const mediaGanancias = ganancias / 14;
  const mediaPerdidas = perdidas / 14;

  if (mediaPerdidas === 0) {
    rsi14 = 100;
  } else {
    const rs = mediaGanancias / mediaPerdidas;
    rsi14 = 100 - (100 / (1 + rs));
  }
}
 

      price =
        yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice ??
        yahooData?.chart?.result?.[0]?.meta?.previousClose ??
        null;

      source = "Yahoo-v3";

      // SUI y monday.com llegan de Yahoo en USD.
      // Los convertimos a EUR porque en la cartera se muestran en euros.
    if ((symbol === "SUI" || symbol === "MNDY" || symbol === "PEPE") && price) {
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
  source,
  velas: cierres.length,
  media20,
  media50,
  rsi14,
  tendencia      
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

