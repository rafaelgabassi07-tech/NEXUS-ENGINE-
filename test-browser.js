import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.response()?.status());
  });
  page.on('response', response => {
    if (!response.ok()) {
      console.log('RESPONSE FAILED:', response.url(), response.status());
    }
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
