/* eslint-disable no-restricted-globals */

self.addEventListener('message', async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'CREATE_CIRCULAR_IMAGE':
      try {
        const circularImage = await createCircularImage(data.imageUrl);
        self.postMessage({ type: 'SUCCESS', data: circularImage });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'PROCESS_BATCH':
      try {
        const results = await Promise.all(
          data.images.map((url) => createCircularImage(url))
        );
        self.postMessage({ type: 'BATCH_SUCCESS', data: results });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
  }
});

async function createCircularImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const canvas = new OffscreenCanvas(50, 50);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(25, 25, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(25, 25, 23, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(img, 0, 0, 50, 50);

      canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    img.onerror = () => {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(25, 25, 25, 0, Math.PI * 2);
      ctx.fill();

      canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    };

    img.src = imageUrl;
  });
}
