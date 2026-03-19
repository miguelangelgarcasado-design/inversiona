exports.handler = async function () {
  try {
    const symbols = ["IDR.MC", "REP.MC", "TSLA", "AAPL", "BTC-USD"];

    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`);
        const data = await res.json();

        return {
          symbol,
          price: data.quoteResponse.result[0]?.regularMarketPrice || "N/A"
        };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error fetching data" }),
    };
  }
};
