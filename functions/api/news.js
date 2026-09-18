export async function onRequestGet() {
  try {
    const consultas = [
      "bolsa mercados acciones",
      "economía mercados financieros",
      "Wall Street bolsa"
    ];

    let noticias = [];

    for (const consulta of consultas) {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(consulta)}&quotesCount=0&newsCount=10&lang=es-ES&region=ES`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      const nuevas = (data.news || []).map(n => ({
        titular: n.title || "",
        resumen: "",
        fuente: n.publisher || "Yahoo Finance",
        url: n.link || "",
        fecha: n.providerPublishTime || 0
      }));

      noticias.push(...nuevas);
    }

    // Eliminar noticias duplicadas
    noticias = noticias.filter(
      (noticia, index, self) =>
        noticia.url &&
        index === self.findIndex(n => n.url === noticia.url)
    );

    // Más recientes primero
    noticias.sort((a, b) => b.fecha - a.fecha);

    // Mostrar las 8 más recientes
    noticias = noticias.slice(0, 8);

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
