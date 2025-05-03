<script setup lang="ts">
import '@/assets/main.css';
import { onMounted } from 'vue';

onMounted(() => {
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

</script>

<template>
  <main>
    <video id="gum-local" autoplay playsinline></video>
  </main>
</template>
