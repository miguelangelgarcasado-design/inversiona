export async function onRequestGet() {
  try {
    const url =
    "https://feeds.bbci.co.uk/mundo/topics/c06gq9v4xp3t/rss.xml";

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

    const noticias = items.slice(0, 8).map(item => {
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
        fuente: "BBC Mundo",
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
      error: error.message,
      noticias: []
    });
  }
}
