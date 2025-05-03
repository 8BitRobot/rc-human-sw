const WebSocket = require('ws');
const http = require('http');

// App Runner provides the port through the PORT environment variable
// Default to 8080 for local testing if PORT is not set
const port = process.env.PORT || 8080;

// Create a simple HTTP server. The WebSocket server will attach to this.
const server = http.createServer((req, res) => {
  // This HTTP server isn't strictly necessary for basic WS, but it's needed
  // as the base for the ws server. Could serve a simple status page if needed.
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signaling Server is running\n');
});

// Create a WebSocket server instance
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
let cameraClient;
let computerClient;

console.log(`WebSocket signaling server starting on port ${port}`);

// WebSocket server event listeners
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Listen for messages from this specific client
  ws.on('message', (message) => {
    // Check if the client is a camera or computer
    message = JSON.parse(message);
    // Check if the message is a connection request

    if (message.messageType === 'init') {
      if (message.origin === 'camera') {
        cameraClient = ws;
        console.log('Camera client connected');
        return;
      } else if (message === 'computer') {
        computerClient = ws;
        console.log('Computer client connected');
        return;
      }
    }

    console.log(message);
  });

  // Listen for when this client disconnects
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Listen for errors with this client's connection
  ws.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });

  // Send a confirmation back to the newly connected client (optional)
  if (ws.readyState === WebSocket.OPEN) {
     ws.send(JSON.stringify({ type: 'serverReady', message: 'Connected to signaling server' }));
  }
});

// Listen for errors with the WebSocket server itself
wss.on('error', (error) => {
    console.error(`WebSocket server error: ${error}`);
});

// Start the HTTP server (which the WebSocket server is attached to)
server.listen(port, () => {
  console.log(`HTTP and WebSocket server listening on port ${port}`);
});