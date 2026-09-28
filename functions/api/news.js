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

    // 1. NOTICIAS DE CINCO DÍAS
    const urlCincoDias =
      "https://feeds.elpais.com/mrss-s/list/ep/site/cincodias.elpais.com/section/mercados-financieros";

    const respuestaCincoDias = await fetch(urlCincoDias, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    let noticiasCincoDias = [];

    if (respuestaCincoDias.ok) {
      const xml = await respuestaCincoDias.text();
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

    // 2. NOTICIAS ESPECÍFICAS DE LA CARTERA
    const busquedas = [
      "IREN Leonardo Apple Tesla",
      "Rocket Lab AST SpaceMobile Hims monday.com",
      "OHL Audax eDreams Amper Cellnex Grifols",
      "Bitcoin Solana SUI PEPE"
    ];

    let noticiasCartera = [];

    for (const busqueda of busquedas) {
      try {
        const urlYahoo =
          "https://query2.finance.yahoo.com/v1/finance/search?q=" +
          encodeURIComponent(busqueda) +
          "&quotesCount=0&newsCount=6&enableFuzzyQuery=false&region=ES&lang=es-ES";

        const respuestaYahoo = await fetch(urlYahoo, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (!respuestaYahoo.ok) continue;

        const datos = await respuestaYahoo.json();

        const encontradas = (datos.news || []).map(noticia => ({
          titular: limpiar(noticia.title || ""),
          resumen: "",
          fuente: noticia.publisher || "Yahoo Finance",
          url: noticia.link || "",
          fecha: noticia.providerPublishTime || "",
          cartera: true
        }));

        noticiasCartera.push(...encontradas);

      } catch (error) {
        // Si una búsqueda falla, continúa con las demás.
      }
    }

    // 3. ELIMINAR DUPLICADOS
    const todas = [...noticiasCartera, ...noticiasCincoDias];

    const unicas = [];
    const vistos = new Set();

    for (const noticia of todas) {
      const clave = noticia.titular.toLowerCase().trim();

      if (
        clave &&
        noticia.url &&
        !vistos.has(clave)
      ) {
        vistos.add(clave);
        unicas.push(noticia);
      }
    }

    // 4. MOSTRAR PRIMERO CARTERA Y DESPUÉS MERCADO GENERAL
    const cartera = unicas
      .filter(noticia => noticia.cartera)
      .slice(0, 5);

    const mercado = unicas
      .filter(noticia => !noticia.cartera)
      .slice(0, 5);

    const noticias = [...cartera, ...mercado].slice(0, 10);

    return Response.json({
      ok: true,
      noticias
    });

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      noticias: []
    });
  }
}
