<script setup lang="ts">
import '@/assets/main.css';
import { onMounted } from 'vue';

let signalingChannel: WebSocket;
let peerConnection: RTCPeerConnection;
let localStream: MediaStream;
let remoteStream: MediaStream;

onMounted(() => {
  signalingChannel = new WebSocket('ws://ec2-35-94-57-69.us-west-2.compute.amazonaws.com:8080');
  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'camera' }));
  };
  signalingChannel.onmessage = (event) => {
    console.log('Message from server:', JSON.parse(event.data));
  };
  signalingChannel.onclose = () => {
    console.log('WebSocket connection closed');
  };
  signalingChannel.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  const video = document.querySelector('#gum-local') as HTMLVideoElement;
  const constraints = {
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((error) => {
      console.error('Error accessing media devices.', error);
    });
});


async function makeCall() {
  const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
  const peerConnection = new RTCPeerConnection(configuration);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingChannel.send(JSON.stringify({'messageType': 'offer', 'offer': offer, 'origin': 'camera'}));
}

</script>

<template>
  <main>
    <button @click="makeCall">Make Call</button>
    <h1>Camera</h1>
    <video id="gum-local" autoplay playsinline></video>
  </main>
</template>
