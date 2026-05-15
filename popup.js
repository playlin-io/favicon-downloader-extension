let currentIconUrl = null;
let currentIconBlob = null;

let foundIcons = []; // [{ url, blob, width, height, objectUrl, pngBlob }]
let iconThumbObjectUrls = [];

document.getElementById('findBtn').addEventListener('click', findFavicon);
document.getElementById('downloadBtn').addEventListener('click', downloadIcon);
document.getElementById('slug').addEventListener('input', updateDownloadButton);

document.getElementById('slug').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('downloadBtn').disabled) {
    downloadIcon();
  }
});

async function findFavicon() {
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const downloadBtn = document.getElementById('downloadBtn');

  status.className = 'loading';
  status.textContent = 'Searching for favicon...';
  downloadBtn.disabled = true;
  clearIconList();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const domain = url.hostname;

    const candidates = [
      await getIconsFromPage(tab.id),
      `${url.origin}/favicon.ico`,
      `${url.origin}/favicon.png`,
      `${url.origin}/apple-touch-icon.png`,
      `${url.origin}/apple-touch-icon-precomposed.png`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
    ].flat();

    const icons = await findAllIcons(candidates);

    if (icons.length) {
      foundIcons = icons;
      renderIconList(foundIcons);
      await selectIcon(foundIcons[0]);

      status.className = 'success';
      status.textContent = `Found ${foundIcons.length} icon${foundIcons.length > 1 ? 's' : ''}`;
      updateDownloadButton();
    } else {
      throw new Error('No favicon found');
    }
  } catch (error) {
    status.className = 'error';
    status.textContent = error.message;
    currentIconUrl = null;
    currentIconBlob = null;
    clearIconList();
  }
}

async function getIconsFromPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        const icons = [];
        const selectors = [
          'link[rel="icon"]',
          'link[rel="shortcut icon"]',
          'link[rel="apple-touch-icon"]',
          'link[rel="apple-touch-icon-precomposed"]',
          'link[rel*="icon"]'
        ];
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(link => {
            if (link.href) {
              icons.push({ url: link.href });
            }
          });
        });
        const metaTags = document.querySelectorAll('meta[name="msapplication-TileImage"]');
        metaTags.forEach(meta => {
          if (meta.content) {
            icons.push({ url: new URL(meta.content, window.location.href).href });
          }
        });
        return icons;
      }
    });
    if (results && results[0] && results[0].result) {
      return results[0].result.map(icon => icon.url);
    }
  } catch (error) {
    console.error('Error getting icons from page:', error);
  }
  return [];
}

async function findAllIcons(urls) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  const iconPromises = uniqueUrls.map(url => loadIcon(url));
  const iconsSettled = await Promise.allSettled(iconPromises);

  const validIcons = iconsSettled
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .sort((a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height));

  validIcons.forEach(icon => {
    icon.objectUrl = URL.createObjectURL(icon.blob);
    iconThumbObjectUrls.push(icon.objectUrl);
  });

  return validIcons;
}

async function loadIcon(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob || blob.size === 0) return null;

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          url,
          blob,
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch (error) {
    return null;
  }
}

// UPDATED: convert to PNG at native size
async function convertToPng(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(resolve, 'image/png', 1.0);
    };

    img.onerror = () => resolve(null);
    img.src = objectUrl;
  });
}

function updateDownloadButton() {
  const slug = document.getElementById('slug').value.trim();
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = !currentIconBlob || !slug;
}

async function downloadIcon() {
  const slug = document.getElementById('slug').value.trim();
  if (!slug || !currentIconBlob) return;

  const status = document.getElementById('status');
  try {
    const url = URL.createObjectURL(currentIconBlob);
    await chrome.downloads.download({
      url: url,
      filename: `${slug}-favicon.png`,
      saveAs: false
    });
    status.className = 'success';
    status.textContent = `Downloaded as ${slug}-favicon.png`;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    status.className = 'error';
    status.textContent = 'Download failed: ' + error.message;
  }
}

function renderIconList(icons) {
  const container = document.getElementById('iconList');
  container.innerHTML = '';
  icons.forEach((icon, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'icon-item';
    item.setAttribute('data-index', String(idx));
    item.title = `${icon.width}x${icon.height}`;

    const img = document.createElement('img');
    img.src = icon.objectUrl;
    img.alt = `Icon ${idx + 1}: ${icon.width}x${icon.height}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${icon.width}×${icon.height}`;

    item.appendChild(img);
    item.appendChild(meta);

    item.addEventListener('click', async () => {
      await selectIcon(icon);
      container.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
    });

    container.appendChild(item);
  });

  const firstItem = container.querySelector('.icon-item');
  if (firstItem) firstItem.classList.add('selected');
}

function clearIconList() {
  const container = document.getElementById('iconList');
  if (container) container.innerHTML = '';
  iconThumbObjectUrls.forEach(u => URL.revokeObjectURL(u));
  iconThumbObjectUrls = [];
  foundIcons = [];
}

async function selectIcon(icon) {
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  try {
    if (!icon.pngBlob) {
      status.className = 'loading';
      status.textContent = `Preparing ${icon.width}x${icon.height} icon...`;
      icon.pngBlob = await convertToPng(icon.blob);
    }
    currentIconUrl = icon.url;
    currentIconBlob = icon.pngBlob || icon.blob;

    const reader = new FileReader();
    reader.onload = (e) => { preview.src = e.target.result; };
    reader.readAsDataURL(currentIconBlob);

    status.className = 'success';
    status.textContent = `Selected ${icon.width}x${icon.height}`;
    updateDownloadButton();
  } catch (e) {
    status.className = 'error';
    status.textContent = 'Could not select this icon.';
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    try {
      const url = new URL(tabs[0].url);
      const domain = url.hostname.replace(/^www\./, '');
      const slug = domain.split('.')[0];
      document.getElementById('slug').value = slug;
    } catch (e) {}
  }
  document.getElementById('slug').focus();
  document.getElementById('slug').select();
  findFavicon();
});
