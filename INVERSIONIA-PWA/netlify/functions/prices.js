exports.handler = async function () {
  const activos = [
    { symbol: "IDR.MC" },
    { symbol: "REP.MC" },
    { symbol: "TSLA" },
    { symbol: "AAPL" },
    { symbol: "BTC-USD" }
  ];

  const resultados = [];

  for (let activo of activos) {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${activo.symbol}`;
      const res = await fetch(url);
      const data = await res.json();

      const precio = data.quoteResponse.result[0].regularMarketPrice;

      resultados.push({
        symbol: activo.symbol,
        price: precio
      });

    } catch (e) {
      resultados.push({
        symbol: activo.symbol,
        price: "error"
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(resultados)
  };
};