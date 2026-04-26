const email = "test@example.com";
const password = "password123";

async function smokeTest() {
  try {
    // 1. Signup (just in case user doesn't exist)
    await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Tester", email, password })
    }).catch(() => {});

    // 2. Login
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const { accessToken } = await loginRes.json();

    // 3. Chat
    const chatRes = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ message: 'top 5 things happening in the world right now' })
    });
    const chatData = await chatRes.json();
    console.log(JSON.stringify(chatData, null, 2));
  } catch (err) {
    console.error(err);
  }
}
smokeTest();
