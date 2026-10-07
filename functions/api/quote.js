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
    let soporte = null;
    let resistencia = null;
    let macd = null;
    let macdSignal = null;
    let macdHistograma = null;
    let bollingerMedia = null;
let bollingerSuperior = null;
let bollingerInferior = null;
    let atr14 = null;
    let adx14 = null;
    let estocasticoK = null;
    let estocasticoD = null;
    let roc14 = null;

    let volumenActual = null;
    let volumenMedio20 = null;

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

// Soporte y resistencia de los últimos 20 días
if (minimos.length >= 20 && maximos.length >= 20) {
  soporte = Math.min(...minimos.slice(-20));
  resistencia = Math.max(...maximos.slice(-20));
}

    
     // RSI de 14 sesiones
   // Volumen actual y volumen medio de 20 sesiones
if (volumenes.length > 0) {
  volumenActual = volumenes[volumenes.length - 1];
}

if (volumenes.length >= 20) {
  const ultimos20Volumenes = volumenes.slice(-20);
  volumenMedio20 =
    ultimos20Volumenes.reduce((suma, valor) => suma + valor, 0) / 20;
}
   
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
 
// MACD (12, 26, 9)
if (cierres.length >= 35) {
  const ema = (datos, periodo) => {
    const k = 2 / (periodo + 1);
    let valor = datos[0];

    for (let i = 1; i < datos.length; i++) {
      valor = datos[i] * k + valor * (1 - k);
    }

    return valor;
  };

  const macdValores = [];

  for (let i = 25; i < cierres.length; i++) {
    const datosHastaHoy = cierres.slice(0, i + 1);
    const ema12 = ema(datosHastaHoy, 12);
    const ema26 = ema(datosHastaHoy, 26);

    macdValores.push(ema12 - ema26);
  }

  macd = macdValores[macdValores.length - 1];

  if (macdValores.length >= 9) {
    macdSignal = ema(macdValores.slice(-9), 9);
    macdHistograma = macd - macdSignal;
  }
}
// Bandas de Bollinger (20, 2)
if (cierres.length >= 20) {
  const ultimos20 = cierres.slice(-20);
  const mediaBollinger =
    ultimos20.reduce((suma, valor) => suma + valor, 0) / 20;

  const varianza =
    ultimos20.reduce(
      (suma, valor) => suma + Math.pow(valor - mediaBollinger, 2),
      0
    ) / 20;

  const desviacion = Math.sqrt(varianza);

  bollingerMedia = mediaBollinger;
  bollingerSuperior = mediaBollinger + (2 * desviacion);
  bollingerInferior = mediaBollinger - (2 * desviacion);
}
// ATR de 14 sesiones
if (maximos.length >= 15 && minimos.length >= 15 && cierres.length >= 15) {
  let sumaTR = 0;

  for (let i = cierres.length - 14; i < cierres.length; i++) {
    const maximo = maximos[i];
    const minimo = minimos[i];
    const cierreAnterior = cierres[i - 1];

    const trueRange = Math.max(
      maximo - minimo,
      Math.abs(maximo - cierreAnterior),
      Math.abs(minimo - cierreAnterior)
    );

    sumaTR += trueRange;
  }

  atr14 = sumaTR / 14;
}
// ADX de 14 sesiones
if (maximos.length >= 15 && minimos.length >= 15 && cierres.length >= 15) {
  let sumaTR = 0;
  let sumaDMPlus = 0;
  let sumaDMMinus = 0;

  for (let i = cierres.length - 14; i < cierres.length; i++) {
    const subida = maximos[i] - maximos[i - 1];
    const bajada = minimos[i - 1] - minimos[i];

    const dmPlus = subida > bajada && subida > 0 ? subida : 0;
    const dmMinus = bajada > subida && bajada > 0 ? bajada : 0;

    const tr = Math.max(
      maximos[i] - minimos[i],
      Math.abs(maximos[i] - cierres[i - 1]),
      Math.abs(minimos[i] - cierres[i - 1])
    );

    sumaTR += tr;
    sumaDMPlus += dmPlus;
    sumaDMMinus += dmMinus;
  }

  if (sumaTR > 0) {
    const diPlus = (sumaDMPlus / sumaTR) * 100;
    const diMinus = (sumaDMMinus / sumaTR) * 100;

    if (diPlus + diMinus > 0) {
      adx14 = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
    }
  }
}
      // Estocástico (14, 3, 3)
if (maximos.length >= 16 && minimos.length >= 16 && cierres.length >= 16) {
  const valoresK = [];

  for (let i = cierres.length - 3; i < cierres.length; i++) {
    const inicio = i - 13;
    const max14 = Math.max(...maximos.slice(inicio, i + 1));
    const min14 = Math.min(...minimos.slice(inicio, i + 1));

    if (max14 !== min14) {
      const k = ((cierres[i] - min14) / (max14 - min14)) * 100;
      valoresK.push(k);
    }
  }

  if (valoresK.length === 3) {
    estocasticoK = valoresK[valoresK.length - 1];
    estocasticoD =
      valoresK.reduce((suma, valor) => suma + valor, 0) / valoresK.length;
  }
}
     // ROC de 14 sesiones
if (cierres.length >= 15) {
  const cierreActual = cierres[cierres.length - 1];
  const cierreHace14 = cierres[cierres.length - 15];

  if (cierreHace14 !== 0) {
    roc14 = ((cierreActual - cierreHace14) / cierreHace14) * 100;
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
  tendencia,
  soporte,
  resistencia,
  volumenActual,
volumenMedio20,
  macd,
macdSignal,
macdHistograma,
 bollingerMedia,
bollingerSuperior,
bollingerInferior,
atr14,
adx14,
estocasticoK,
estocasticoD,
roc14       
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

