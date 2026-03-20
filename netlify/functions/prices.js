exports.handler = async function () {
  try {
    const symbols = [
      "SOL.MC",
      "REP.MC",
      "ENG.MC",
      "IDR.MC",
      "AMP.MC",
      "NAK",
      "ETH-USD",
      "BTC-USD"
    ];

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0"
              }
            }
          );

          const data = await res.json();

          return {
            symbol,
            price:
              data?.quoteResponse?.result?.[0]?.regularMarketPrice ?? "N/A"
          };
        } catch (e) {
          return { symbol, price: "Error" };
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(results)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error fetching data" })
    };
  }
};
