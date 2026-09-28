export async function onRequestGet() {
  try {
    const url =
      "https://feeds.elpais.com/mrss-s/list/ep/site/cincodias.elpais.com/section/mercados-financieros";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error("Noticias HTTP " + response.status);
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const limpiar = (texto = "") =>
      texto
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

    const palabrasImportantes = [
      "bolsa",
      "bolsas",
      "mercado",
      "mercados",
      "acciones",
      "ibex",
      "nasdaq",
      "wall street",
      "dow jones",
      "economía",
      "inflación",
      "tipos",
      "interés",
      "bce",
      "fed",
      "petróleo",
      "bonos",
      "dólar",
      "euro",
      "bitcoin",
      "cripto",
      "inteligencia artificial",
      "ia",
      "apple",
      "tesla",
      "leonardo",
      "iren",
      "ohl",
      "audax",
      "edreams",
      "amper",
      "cellnex",
      "grifols",
      "monday",
      "mobileye",
      "uipath",
      "rocket lab",
      "ast spacemobile",
      "hims",
      "recursion",
      "red cat"
    ];

    const todas = items.map(item => {
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
        fecha
      };
    });

    const prioritarias = todas.filter(noticia => {
      const texto = noticia.titular.toLowerCase();

      return palabrasImportantes.some(palabra =>
        texto.includes(palabra)
      );
    });

    const noticias = [
      ...prioritarias,
      ...todas.filter(noticia => !prioritarias.includes(noticia))
    ].slice(0, 8);

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
