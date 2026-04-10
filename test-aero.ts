import fetch from 'node-fetch';

async function test() {
  try {
    console.log("Testing GET...");
    let res = await fetch('https://aero-scrape.vercel.app/api/scrape?ticker=PETR4');
    console.log("GET status:", res.status);
    
    console.log("Testing POST {ticker: 'PETR4'}...");
    res = await fetch('https://aero-scrape.vercel.app/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: 'PETR4' })
    });
    console.log("POST 1 status:", res.status);
    console.log("POST 1 body:", await res.text().then(t => t.slice(0, 200)));

    console.log("Testing POST {url: 'https://statusinvest.com.br/acoes/petr4'}...");
    res = await fetch('https://aero-scrape.vercel.app/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://statusinvest.com.br/acoes/petr4' })
    });
    console.log("POST 3 status:", res.status);
    console.log("POST 3 body:", await res.text().then(t => t.slice(0, 200)));

  } catch (e) {
    console.error(e);
  }
}
test();
