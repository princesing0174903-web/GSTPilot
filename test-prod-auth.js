const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('requestfailed', req => console.log('FAILED REQUEST:', req.url(), req.failure()?.errorText));
  page.on('response', async response => {
    if (!response.ok()) {
      console.log('BAD RESPONSE:', response.url(), response.status());
      try {
        console.log('RESPONSE BODY:', await response.text());
      } catch (e) {}
    }
  });

  try {
    console.log('Navigating to https://gst-pilot-nu.vercel.app...');
    await page.goto('https://gst-pilot-nu.vercel.app', { waitUntil: 'networkidle2' });
    
    // Type into email and password
    console.log('Typing credentials...');
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'WrongPass123!');
    
    console.log('Clicking Sign In...');
    await page.click('button[type="submit"]'); // assuming the email button is submit
    
    // Wait for the error or navigation
    await page.waitForTimeout(3000);
    
    const pageContent = await page.content();
    if (pageContent.includes('Email or password is incorrect') || pageContent.includes('incorrect')) {
       console.log('Error message found in UI');
    }
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

run();
