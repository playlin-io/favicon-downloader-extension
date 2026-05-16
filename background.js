chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'capture_favicon') {
    handleCapture(msg.rect, sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  }
});

async function handleCapture(rect, tab) {
  try {
    // Capture the visible tab (overlay is already hidden by content script)
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    const dpr = rect.devicePixelRatio || 1;
    const sx   = Math.round(rect.x    * dpr);
    const sy   = Math.round(rect.y    * dpr);
    const size = Math.round(rect.size * dpr);

    // Crop using createImageBitmap + OffscreenCanvas (no DOM required)
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, sx, sy, size, size);

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

    // Convert to base64 data URL for cross-context storage
    const ab = await croppedBlob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pngDataUrl = 'data:image/png;base64,' + btoa(binary);

    await chrome.storage.session.set({ pendingCapture: { dataUrl: pngDataUrl, size } });

    // Try to reopen the popup (Chrome 127+; silently fails on older versions)
    try { await chrome.action.openPopup(); } catch (_) {}

    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}
