const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Busy port');
});
server.listen(3001, () => {
  console.log('Temporary listener started on port 3001');
});
