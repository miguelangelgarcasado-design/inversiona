async function traducir(texto) {
  if (!texto) return "";

  try {
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(texto) +
      "&langpair=en|es";

    const res = await fetch(url);

    if (!res.ok) return texto;

    const data = await res.json();

    if (
      data &&
      data.responseData &&
      data.responseData.translatedText
    ) {
      return data.responseData.translatedText;
    }

    return texto;
  } catch (error) {
    return texto;
  }
}


export async function onRequestGet(context) {
  try {
    const apiKey = context.env.FINNHUB_API_KEY;

    const hoy = new Date();
    const hasta = hoy.toISOString().slice(0, 10);

    const desdeDate = new Date();
    desdeDate.setDate(hoy.getDate() - 3);
    const desde = desdeDate.toISOString().slice(0, 10);

    const url =
      `https://finnhub.io/api/v1/company-news?symbol=AAPL&from=${desde}&to=${hasta}&token=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    const seleccionadas = Array.isArray(data)
      ? data.slice(0, 5)
      : [];

    const noticias = await Promise.all(
      seleccionadas.map(async n => ({
        titular: await traducir(n.headline),
        resumen: await traducir(n.summary),
        fuente: n.source,
        url: n.url,
        fecha: n.datetime
      }))
    );

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

