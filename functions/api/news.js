export async function onRequestGet() {
  try {
    const response = await fetch(
      "https://query1.finance.yahoo.com/v1/finance/search?q=bolsa%20mercados%20acciones&quotesCount=0&newsCount=20&lang=es-ES&region=ES",
          {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Error al obtener noticias");
    }

    const data = await response.json();

    const noticias = (data.news || []).slice(0, 5).map(n => ({
      titular: n.title || "",
      resumen: "",
      fuente: n.publisher || "Yahoo Finance",
      url: n.link || "",
      fecha: n.providerPublishTime || 0
    }));

    return Response.json({
      ok: true,
      noticias
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "No se pudieron cargar las noticias"
      },
      { status: 500 }
    );
  }
}
