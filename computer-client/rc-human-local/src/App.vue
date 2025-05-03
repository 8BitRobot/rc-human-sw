<script setup lang="ts">
import { onMounted } from 'vue';

let signalingChannel: WebSocket;

async function receiveCall(data: {
  'messageType': string;
  'offer': RTCSessionDescriptionInit;
  'origin': string;
}) {
  const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
  const peerConnection = new RTCPeerConnection(configuration);

  const offer = data.offer;
  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  signalingChannel.send(JSON.stringify({'messageType': 'answer', 'answer': answer, 'origin': 'camera'}));
}


onMounted(() => {
  signalingChannel = new WebSocket('wss://rc-human-signal-p2p-env.eba-82fuxzdy.us-west-2.elasticbeanstalk.com/');
  signalingChannel.onopen = () => {
    console.log('WebSocket connection established');
    signalingChannel.send(JSON.stringify({ messageType: 'init', origin: 'computer' }));
  };
  signalingChannel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Message from server:', data);
    if (data.messageType === 'offer') {
      receiveCall(data);
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
});

window.onbeforeunload = () => {
  signalingChannel.send(JSON.stringify({ messageType: 'close', origin: 'computer' }));
  signalingChannel.close();
};

</script>

<template>
  <main>
    <h1> test </h1>
    <video id="gum-local" autoplay playsinline></video>
  </main>
</template>
