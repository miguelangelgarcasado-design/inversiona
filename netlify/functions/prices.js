
exports.handler = async function () {
  const results = [
    { symbol: "SOL.MC", price: 17.82 },
    { symbol: "REP.MC", price: 22.71 },
    { symbol: "ENG.MC", price: 15.48 },
    { symbol: "IDR.MC", price: 18.95 },
    { symbol: "AMP.MC", price: 0.118 },
    { symbol: "NAK", price: 0.31 },
    { symbol: "ETH-USD", price: 3450.25 },
    { symbol: "BTC-USD", price: 68250.40 }
  ];

  return {
    statusCode: 200,
    body: JSON.stringify(results)
  };
};
