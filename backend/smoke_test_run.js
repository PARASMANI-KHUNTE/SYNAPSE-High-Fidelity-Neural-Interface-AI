import axios from 'axios';

const runTest = async () => {
    const baseUrl = 'http://localhost:3001/api';
    const email = `testuser_${Date.now()}@example.com`;
    
    try {
        console.log('Registering user...');
        await axios.post(`${baseUrl}/auth/register`, {
            email,
            password: 'password123',
            name: 'Smoke Test User'
        });

        console.log('Logging in...');
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email,
            password: 'password123'
        });
        const token = loginRes.data.accessToken;

        const queries = [
            "latest world news today",
            "current updates right now",
            "latest movie releases"
        ];

        for (const msg of queries) {
            console.log(`\nQuery: "${msg}"`);
            const chatRes = await axios.post(`${baseUrl}/chat`, { message: msg }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const reply = chatRes.data.response || '';
            console.log(`Status: ${chatRes.status}`);
            console.log(`Reply (first 300 chars): ${reply.substring(0, 300)}`);
            
            const containsCutoff = reply.toLowerCase().includes('knowledge cutoff');
            const containsDec2023 = reply.toLowerCase().includes('december 2023');
            console.log(`Contains 'knowledge cutoff': ${containsCutoff}`);
            console.log(`Contains 'December 2023': ${containsDec2023}`);
        }
    } catch (err) {
        console.error('Test failed:', err.response ? err.response.data : err.message);
    }
};

runTest();
