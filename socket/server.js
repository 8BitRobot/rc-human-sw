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
let cameraClientPingInterval;
let computerClient;
let computerClientPingInterval;

console.log(`WebSocket signaling server starting on port ${port}`);

// WebSocket server event listeners
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Listen for messages from this specific client
  ws.on('message', (message) => {
    message = JSON.parse(message);
    console.log('Message received from client:', message);

    // Check if the message is a connection request

    if (message.messageType === 'init') {
      if (message.origin === 'camera') {
        cameraClient = ws;
        console.log('Camera client connected');
        cameraClientPingInterval = setInterval(() => {
          console.log('Sending ping to camera client');
          if (cameraClient) {
            cameraClient.send(JSON.stringify({ type: 'ping' }));
          } else {
            console.log('No camera client connected');
          }
        }, 5000);
        return;
      } else if (message.origin === 'computer') {
        computerClient = ws;
        console.log('Computer client connected');
        computerClientPingInterval = setInterval(() => {
          console.log('Sending ping to computer client');
          if (computerClient) {
            computerClient.send(JSON.stringify({ type: 'ping' }));
          } else {
            console.log('No computer client connected');
          }
        }, 5000);
        return;
      }
    }

    if (message.messageType === 'close') {
      if (message.origin === 'camera') {
        cameraClient = null;
        console.log('Camera client disconnected');
        clearInterval(cameraClientPingInterval);
        return;
      } else if (message.origin === 'computer') {
        computerClient = null;
        console.log('Computer client disconnected');
        clearInterval(computerClientPingInterval);
        return;
      }
    }

    if (message.messageType === 'pong') {
      console.log(`Pong received from client ${message.origin}`);
      if (message.origin === 'camera') {
        cameraClient = ws;
        return;
      }
      if (message.origin === 'computer') {
        computerClient = ws;
        return;
      }
    }

    // If the message is from the camera, forward it to the computer
    if (cameraClient && computerClient) {
      if (message.origin === 'camera') {
        console.log('Forwarding message from camera to computer');
        computerClient.send(JSON.stringify(message));
      } else if (message.origin === 'computer') {
        console.log('Forwarding message from computer to camera');
        cameraClient.send(JSON.stringify(message));
      }
    } else {
      console.log('No clients connected to forward messages to');
    }
  });

  // Listen for when this client disconnects
  ws.on('close', () => {
    // Clear the ping interval for this client
    if (ws === cameraClient) {
      clearInterval(cameraClientPingInterval);
      cameraClient = null;
      console.log('Camera client disconnected');
    } else if (ws === computerClient) {
      clearInterval(computerClientPingInterval);
      computerClient = null;
      console.log('Computer client disconnected');
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