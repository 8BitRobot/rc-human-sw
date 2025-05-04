<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

let signalingChannel: WebSocket;
let serialChannel: WebSocket;
let peerConnection: RTCPeerConnection;
let polling: any;

let remoteVideo: HTMLVideoElement;

async function receiveCall(data: {
    'messageType': string;
    'offer': RTCSessionDescriptionInit;
    'origin': string;
}) {
    console.log('Received offer, creating PeerConnection and answer...');
    const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
    peerConnection = new RTCPeerConnection(configuration);
    console.log('RTCPeerConnection created');

    // Add event listeners to the new peerConnection
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Answerer Found ICE candidate:', event.candidate);
            signalingChannel.send(JSON.stringify({
                messageType: 'ice-candidate',
                candidate: event.candidate,
                origin: 'computer' // <-- This should be 'computer' for the answerer
            }));
        } else {
            console.log('Answerer ICE gathering finished.');
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Answerer PeerConnection state change:', peerConnection.connectionState);
    };

    // Handle receiving remote tracks
    peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track);
         // Attach the remote stream to a video element
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            console.log('Remote stream attached to video element');
        }
    };

    // Set the remote offer as the remote description
    const offer = data.offer;
    await peerConnection.setRemoteDescription(offer);
    console.log('Offer set as remote description');


    // Create the answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
     console.log('SDP Answer created and set as local description');

    // Send the answer via the signaling channel
    console.log('Sending answer to server:', answer);
    // IMPORTANT: Ensure the origin is 'computer' when sending from the computer
    signalingChannel.send(JSON.stringify({'messageType': 'answer', 'answer': answer, 'origin': 'computer'})); // <-- Fixed origin
    console.log(peerConnection);

    // No more polling needed after receiving offer and exchanging candidates
    clearInterval(polling); // Ensure polling is cleared here if used
}

onMounted(() => {
  remoteVideo = document.querySelector("#remoteVideo") as HTMLVideoElement; // Remote video element
  signalingChannel = new WebSocket('wss://rchumanws.org');
  serialChannel = new WebSocket('ws://localhost:8765');

  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'computer' }));

    polling = setInterval(() => {
      signalingChannel.send(JSON.stringify({ messageType: 'poll', origin: 'computer' }));
    }, 5000);
  };
  serialChannel.onopen = () => {
    console.log('Serial WebSocket connection established');
  };

  signalingChannel.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Message from server:', data);
    if (data.messageType === 'offer') {
        // Trigger the call receiving process when an offer arrives
        receiveCall(data);
          // No more polling needed after receiving offer and exchanging candidates
          // clearInterval(polling); // Ensure polling is cleared here if used
    } else if (data.messageType === 'ice-candidate') {
        // Handle incoming ICE candidates
        console.log('Received ICE candidate:', data.candidate);
        // Ensure peerConnection exists before adding candidate
        if (peerConnection) {
              try {
                  const candidate = new RTCIceCandidate(data.candidate);
                  await peerConnection.addIceCandidate(candidate);
                  console.log('ICE candidate successfully added');
              } catch (e) {
                  console.error('Failed to add ICE candidate:', e);
              }
        } else {
              console.warn('Received ICE candidate before PeerConnection was created');
              // You might need to queue candidates if they arrive before the PC is ready
        }
    }
  };
  serialChannel.onmessage = (event) => {
    console.log('Serial message from server:', event.data);
  };

  signalingChannel.onclose = () => {
    console.log('WebSocket connection closed');
  };
  serialChannel.onclose = () => {
    console.log('Serial WebSocket connection closed');
  };

  signalingChannel.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  serialChannel.onerror = (error) => {
    console.error('Serial WebSocket error:', error);
  };

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
});

function handleKeydown(event: any) {
  if (event.key === 'a') {
    document.getElementById('left-arrow-button')?.classList.add('clicked');
    serialChannel.send('1');
  } else if (event.key === 'd') {
    document.getElementById('right-arrow-button')?.classList.add('clicked');
    serialChannel.send('0');
  }
}

function handleKeyup(event: any) {
  if (event.key === 'a') {
    document.getElementById('left-arrow-button')?.classList.remove('clicked');
  } else if (event.key === 'd') {
    document.getElementById('right-arrow-button')?.classList.remove('clicked');
  } else if (event.key === 'Escape') {
    console.log('Resetting the connection');
    signalingChannel.send(JSON.stringify({ messageType: 'clear', origin: 'computer' }));
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleKeyup);
});

window.onbeforeunload = () => {
  signalingChannel.send(JSON.stringify({ messageType: 'close', origin: 'computer' }));
  signalingChannel.close();
};

</script>

<style scoped lang="scss">
main {
  width: 100vw;
  height: 100vh;
}
#controls-container {
  position:relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: row;
  justify-content: space-between;
  align-items: center;
}

.side-arrow-button {
  margin: 30px;
  background-color: #890a23;
  outline: none;
  border: none;
  padding: 100px 30px;
  border-radius: 12px;
  color: white;
  font-size: 24px;
  font-weight: bold;

  &.clicked {
    background-color: #dc8914;
  }
}

#remoteVideo {
  transform: rotate(-90deg);
}

</style>

<template>
  <main>
    <div id="controls-container">
      <div id="left-arrow-button-container">
        <button id="left-arrow-button" class="arrow-button side-arrow-button">&lt;</button>
      </div>
      <div id="remote-video-container">
        <video id="remoteVideo" autoplay playsinline></video>
      </div>
      <div id="right-arrow-button-container">
        <button id="right-arrow-button" class="arrow-button side-arrow-button">&gt;</button>
      </div>
    </div>
  </main>
</template>
