<script setup lang="ts">
import '@/assets/main.css';
import { onMounted } from 'vue';

let signalingChannel: WebSocket;
let peerConnection: RTCPeerConnection;
let localStream: MediaStream;
let remoteStream: MediaStream;

onMounted(() => {
  signalingChannel = new WebSocket('wss://rc-human-signal-p2p-env.eba-82fuxzdy.us-west-2.elasticbeanstalk.com/');
  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'camera' }));
  };
  signalingChannel.onmessage = async (event) => {
    console.log('Message from server:', JSON.parse(event.data));
    const data = JSON.parse(event.data);

    if (data.messageType === 'answer') {
      await peerConnection.setRemoteDescription(data.answer);
      console.log(peerConnection);
    }
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

window.onbeforeunload = () => {
  signalingChannel.send(JSON.stringify({ messageType: 'close', origin: 'camera' }));
  signalingChannel.close();
};

async function makeCall() {
  const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
  peerConnection = new RTCPeerConnection(configuration);

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
