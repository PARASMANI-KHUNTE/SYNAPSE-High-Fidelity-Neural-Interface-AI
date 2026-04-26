import http from 'http';
import app from './app.js';
const server = http.createServer(app);
server.listen(3002, () => {
  console.log('Test server running on 3002');
  const payload = JSON.stringify({ email: "test@example.com", password: "password123" });
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const token = JSON.parse(data).accessToken;
      const chatPayload = JSON.stringify({ message: "top 5 latest movie releases" });
      const chatOptions = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': chatPayload.length, 'Authorization': `Bearer ${token}` }
      };
      const chatReq = http.request(chatOptions, (chatRes) => {
        let chatData = '';
        chatRes.on('data', (chunk) => chatData += chunk);
        chatRes.on('end', () => {
           console.log('CHAT_RESPONSE_START');
           console.log(chatData);
           console.log('CHAT_RESPONSE_END');
           process.exit(0);
        });
      });
      chatReq.write(chatPayload);
      chatReq.end();
    });
  });
  req.write(payload);
  req.end();
});
