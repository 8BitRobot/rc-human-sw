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

console.log(`WebSocket signaling server starting on port ${port}`);

let offerMessages = [];
let answerMessages = [];

function clearMessages() {
  offerMessages = [];
  answerMessages = [];
}

// WebSocket server event listeners
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Listen for messages from this specific client
  ws.on('message', (message) => {
    message = JSON.parse(message);
    console.log('Message received from client:', message);

    if (message.messageType === 'clear') {
      // Clear the stored messages
      clearMessages();
      console.log('Stored messages cleared');
    }

    if (message.origin === 'camera' && (message.messageType === 'offer' || message.messageType === 'ice-candidate')) {
      // Store the offer from the client
      offerMessages.push(message);
      console.log('Offer received:', message);
    }
    if (message.origin === 'computer' && (message.messageType === 'answer' || message.messageType === 'ice-candidate')) {
      // Store the answer from the client
      answerMessages.push(message);
      console.log('Answer received:', message);
    }
    if (message.messageType === 'poll') {
      if (message.origin === 'computer') {
        for (const offer of offerMessages) {
          // Send the stored offer to the computer
          ws.send(JSON.stringify(offer));
        }
      }
      if (message.origin === 'camera') {
        for (const answer of answerMessages) {
          // Send the stored answer to the camera
          ws.send(JSON.stringify(answer));
        }
      }
    }
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