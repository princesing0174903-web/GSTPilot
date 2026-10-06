const apiKey = 'AIzaSyAcq3nU7qOhi7zn0_2gYqamnmk-BZNTP24';
const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'WrongPass123!', returnSecureToken: true })
}).then(r => r.json()).then(console.log).catch(console.error);
