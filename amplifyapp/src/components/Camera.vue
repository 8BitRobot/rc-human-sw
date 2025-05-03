<script setup lang="ts">
import '@/assets/main.css';
import { onMounted } from 'vue';

let signalingChannel: WebSocket;
let peerConnection: RTCPeerConnection;
let polling: any;
let localStream: MediaStream;

onMounted(() => {
  signalingChannel = new WebSocket('wss://rchumanws.org');
  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'camera' }));
    polling = setInterval(() => {
      signalingChannel.send(JSON.stringify({ messageType: 'poll', origin: 'camera' }));
    }, 5000);
  };
  signalingChannel.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Message from server:', data);

    if (data.messageType === 'answer') {
        await peerConnection.setRemoteDescription(data.answer);
        console.log('Answer received and set as remote description');
        // No more polling needed after getting answer and exchanging candidates
        // clearInterval(polling); // Ensure polling is cleared here if used
    } else if (data.messageType === 'ice-candidate') {
        // Handle incoming ICE candidates
        console.log('Received ICE candidate:', data.candidate);
        try {
            const candidate = new RTCIceCandidate(data.candidate);
            await peerConnection.addIceCandidate(candidate);
            console.log('ICE candidate successfully added');
        } catch (e) {
            console.error('Failed to add ICE candidate:', e);
        }
    }

    if (data.messageType === 'answer' && peerConnection) {
      await peerConnection.setRemoteDescription(data.answer);
      console.log(peerConnection);
      clearInterval(polling);
    } else {
      console.log('peer connection is undefined');
    }
  };
  signalingChannel.onclose = () => {
    clearInterval(polling);
    console.log('WebSocket connection closed');
  };
  signalingChannel.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  const video = document.querySelector('#gum-local') as HTMLVideoElement;
  const constraints = {
    audio: false,
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      localStream = stream; // Store the stream
      console.log('Local media stream obtained');
      // Now that we have media, we can create the peer connection and offer
      // You might trigger makeCall() after WebSocket is open and init message is sent/acknowledged
    })
    .catch((error) => {
      console.error('Error accessing media devices.', error);
    });
});

window.onbeforeunload = () => {
  signalingChannel.send(JSON.stringify({ messageType: 'close', origin: 'camera' }));
  signalingChannel.close();
};

async function makeCall() {
  const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
  peerConnection = new RTCPeerConnection(configuration);
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        console.log('Offerer Found ICE candidate:', event.candidate);
        signalingChannel.send(JSON.stringify({
            messageType: 'ice-candidate',
            candidate: event.candidate,
            origin: 'camera'
        }));
    } else {
        console.log('Offerer ICE gathering finished.');
    }
  };

  peerConnection.onconnectionstatechange = function () {
    try {
      console.log('PeerConnection state change:', this.connectionState);
    } catch (error) {
      console.error('No peer connection established');
    }
  };
  // Add local tracks *before* creating the offer
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      console.log('Added local track to PeerConnection:', track);
    });
  } else {
    console.error('Local stream not available when trying to make call!');
    return; // Cannot make call without stream
  }


  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('SDP Offer created and set as local description');

  // Send the offer via the signaling channel
  console.log('Sending offer to server:', offer);
  signalingChannel.send(JSON.stringify({'messageType': 'offer', 'offer': offer, 'origin': 'camera'}));
}

</script>

<style scoped>
#gum-local {
  width: 320;
  height: 180;
}
</style>

<template>
  <main>
    <button @click="makeCall">Make Call</button>
    <h1>Camera</h1>
    <video id="gum-local" autoplay playsinline></video>
  </main>
</template>
