<script setup lang="ts">
import { onMounted } from 'vue';

let signalingChannel: WebSocket;
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
  signalingChannel = new WebSocket('wss://rc-human-signal-p2p-env.eba-82fuxzdy.us-west-2.elasticbeanstalk.com/');
  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'computer' }));

    polling = setInterval(() => {
      signalingChannel.send(JSON.stringify({ messageType: 'poll', origin: 'computer' }));
    }, 5000);
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

  signalingChannel.onclose = () => {
    console.log('WebSocket connection closed');
  };
  signalingChannel.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
});

window.onbeforeunload = () => {
  signalingChannel.send(JSON.stringify({ messageType: 'close', origin: 'computer' }));
  signalingChannel.close();
};

</script>

<template>
  <main>
    <h1> test </h1>
    <video id="remoteVideo" autoplay playsinline></video>
  </main>
</template>
