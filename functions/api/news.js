export async function onRequestGet() {
  try {
    const limpiar = (texto = "") =>
      String(texto)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

const esperar = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

const traducirTitulo = async (texto = "") => {
  texto = limpiar(texto);
  if (!texto) return "";

  // Si parece estar ya en español, no gastamos una petición
  const palabrasEspanol =
    /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|se|su|sus|tras|ante|mercado|bolsa|acciones)\b/i;

  if (palabrasEspanol.test(texto)) {
    return texto;
  }

  // PRIMER INTENTO: Google
  try {
    const urlGoogle =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=auto&tl=es&dt=t&q=" +
      encodeURIComponent(texto);

    const respuesta = await fetch(urlGoogle, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (respuesta.ok) {
      const datos = await respuesta.json();

      if (datos && datos[0]) {
        const traduccion = datos[0]
          .map(parte => parte[0])
          .join("");

        if (traduccion) {
          return limpiar(traduccion);
        }
      }
    }

    console.log("GOOGLE STATUS:", respuesta.status);

  } catch (error) {
    console.log("ERROR GOOGLE:", error.message);
  }

  // Evitamos lanzar inmediatamente otra petición
  await esperar(300);

  // SEGUNDO INTENTO: MyMemory
  try {
    const urlMyMemory =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(texto) +
      "&langpair=en|es";

    const respuesta = await fetch(urlMyMemory, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (respuesta.ok) {
      const datos = await respuesta.json();

      const traduccion =
        datos?.responseData?.translatedText;

      if (
        traduccion &&
        typeof traduccion === "string" &&
        traduccion.toUpperCase() !==
          "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"
      ) {
        return limpiar(traduccion);
      }
    }

    console.log("MYMEMORY STATUS:", respuesta.status);

  } catch (error) {
    console.log("ERROR MYMEMORY:", error.message);
  }

  // Si ambos servicios fallan, conservamos el titular original
  return texto;
};







    // 1. CINCO DÍAS: economía y mercados
    const urlCincoDias =
      "https://feeds.elpais.com/mrss-s/list/ep/site/cincodias.elpais.com/section/mercados-financieros";

    let noticiasCincoDias = [];

    try {
      const respuesta = await fetch(urlCincoDias, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (respuesta.ok) {
        const xml = await respuesta.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        noticiasCincoDias = items.map(item => {
          const bloque = item[1];

          const titulo =
            bloque.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";

          const enlace =
            bloque.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";

          const fecha =
            bloque.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";

          return {
            titular: limpiar(titulo),
            resumen: "",
            fuente: "Cinco Días",
            url: limpiar(enlace),
            fecha,
            cartera: false
          };
        });
      }
    } catch (error) {}

    // 2. TICKERS PRINCIPALES DE TU CARTERA
    const activos = [
      "IREN",
      "LDO.MI",
      "OHLA.MC",
      "ADX.MC",
      "NAMM",
      "RKLB",
      "ASTS",
      "EDR.MC",
      "AMP.MC",
      "AAPL",
      "PATH",
      "UAA",
      "MBLY",
      "HIMS",
      "TSLA",
      "SWKS",
      "RXRX",
      "RCAT",
      "CLNX.MC",
      "MNDY",
     "BTC-USD",
"SOL-USD",
"PGS.DE",

    ];

    let noticiasCartera = [];

    // Consultamos cada activo por separado
    for (const ticker of activos) {
      try {
        const urlYahoo =
          "https://query2.finance.yahoo.com/v1/finance/search?q=" +
          encodeURIComponent(ticker) +
          "&quotesCount=1&newsCount=2";

        const respuesta = await fetch(urlYahoo, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        });

        if (!respuesta.ok) continue;

        const datos = await respuesta.json();

        for (const noticia of (datos.news || [])) {
          if (!noticia.title || !noticia.link) continue;

          noticiasCartera.push({
     titular: await traducirTitulo(limpiar(noticia.title)),
            resumen: "",
            fuente: noticia.publisher || "Yahoo Finance",
            url: noticia.link,
            fecha: noticia.providerPublishTime || "",
            cartera: true,
            ticker
          });
        }
      } catch (error) {}
    }

    // 3. ELIMINAR DUPLICADOS
    const todas = [...noticiasCartera, ...noticiasCincoDias];

    const noticiasUnicas = [];
    const vistos = new Set();

    for (const noticia of todas) {
      const clave = noticia.titular.toLowerCase().trim();

      if (clave && noticia.url && !vistos.has(clave)) {
        vistos.add(clave);
        noticiasUnicas.push(noticia);
      }
    }

    // 4. Hasta 6 noticias de cartera + 4 de mercado
    const cartera = noticiasUnicas
      .filter(n => n.cartera)
      .slice(0, 6);

    const mercado = noticiasUnicas
      .filter(n => !n.cartera)
      .slice(0, 4);

    const noticias = [...cartera, ...mercado];

    return Response.json({
      ok: true,
      noticias,
      encontradasCartera: noticiasCartera.length
    });

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      noticias: []
    });
  }
}
