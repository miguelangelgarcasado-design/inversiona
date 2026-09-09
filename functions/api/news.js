let colaTraduccion = [];
let temporizadorTraduccion = null;

async function procesarTraducciones() {
  const lote = colaTraduccion.splice(0);
  temporizadorTraduccion = null;

  if (!lote.length) return;

  const separador = "\n<<<INVERSIONIA_SEP>>>\n";
  const textoCompleto = lote.map(x => x.texto).join(separador);

  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body:
          "client=gtx&sl=en&tl=es&dt=t&q=" +
          encodeURIComponent(textoCompleto)
      }
    );

    if (!res.ok) {
      lote.forEach(x => x.resolve(x.texto));
      return;
    }

    const data = await res.json();

    const traducido = data[0]
      .map(parte => parte[0])
      .join("");

    const partes = traducido.split("<<<INVERSIONIA_SEP>>>");

    lote.forEach((x, i) => {
      x.resolve((partes[i] || x.texto).trim());
    });

  } catch (error) {
    lote.forEach(x => x.resolve(x.texto));
  }
}

function traducir(texto) {
  if (!texto) return Promise.resolve("");

  return new Promise(resolve => {
    colaTraduccion.push({ texto, resolve });

    if (!temporizadorTraduccion) {
      temporizadorTraduccion = setTimeout(procesarTraducciones, 100);
    }
  });
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

