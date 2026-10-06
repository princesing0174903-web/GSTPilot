const https = require('https');

async function testGitHubFlow() {
  console.log('1. Hitting /authorize to get state...');
  const res1 = await fetch('https://gst-pilot-nu.vercel.app/api/auth/github/authorize');
  const data = await res1.json();
  
  const location = data.authUrl;
  console.log('Redirect location:', location);
  
  const url = new URL(location);
  const state = url.searchParams.get('state');
  console.log('Got state:', state);
  
  console.log('\n2. Hitting /callback with fake code and real state...');
  const callbackUrl = `https://gst-pilot-nu.vercel.app/api/auth/github/callback?code=bad_code_123&state=${state}`;
  console.log('Callback URL:', callbackUrl);
  
  const res2 = await fetch(callbackUrl, { redirect: 'manual' });
  console.log('Callback status:', res2.status);
  
  if (res2.status === 302 || res2.status === 307) {
    const cbLoc = res2.headers.get('location');
    console.log('Callback redirected to:', cbLoc);
  } else {
    console.log('Callback body:', await res2.text());
  }
}

testGitHubFlow().catch(console.error);
