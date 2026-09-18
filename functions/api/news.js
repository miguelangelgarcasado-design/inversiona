export async function onRequestGet() {
  try {
    const rssUrl =
      "https://news.google.com/rss/search?q=bolsa%20OR%20IBEX%20OR%20Wall%20Street%20OR%20mercados%20financieros&hl=es&gl=ES&ceid=ES:es";

    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error("Error al obtener noticias");
    }

    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const limpiar = texto =>
      texto
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

    const noticias = items.slice(0, 8).map(item => {
      const bloque = item[1];

      const titulo =
        bloque.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";

      const enlace =
        bloque.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";

      const fecha =
        bloque.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";

      const fuente =
        bloque.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ||
        "Google News";

      return {
        titular: limpiar(titulo),
        resumen: "",
        fuente: limpiar(fuente),
        url: limpiar(enlace),
        fecha
      };
    });

    return Response.json({
      ok: true,
      noticias
    });

  } catch (error) {
    return Response.json({
      ok: false,
      error: "No se pudieron cargar las noticias",
      noticias: []
    });
  }
}
