async function traducir(texto) {
  if (!texto) return "";

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=" +
      encodeURIComponent(texto);

    const res = await fetch(url);

    if (!res.ok) return texto;

    const data = await res.json();

    return data[0]
      .map(parte => parte[0])
      .join("");
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

