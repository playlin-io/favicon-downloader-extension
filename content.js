(function () {
  // Prevent double-injection
  if (document.getElementById('fde-capture-canvas')) return;

  const dpr = window.devicePixelRatio || 1;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;

  // ── Canvas overlay ────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'fde-capture-canvas';
  canvas.width  = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: vw + 'px', height: vh + 'px',
    zIndex: '2147483647', display: 'block',
    cursor: 'crosshair'
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.id = 'fde-capture-toolbar';
  Object.assign(toolbar.style, {
    position: 'fixed', zIndex: '2147483648',
    display: 'flex', gap: '8px', padding: '6px',
    background: 'rgba(0,0,0,0.72)', borderRadius: '8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
  });

  function makeBtn(label, bg) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      all: 'unset', padding: '6px 14px', borderRadius: '5px',
      background: bg, color: 'white', cursor: 'pointer',
      fontSize: '13px', fontWeight: '600', lineHeight: '1',
      userSelect: 'none'
    });
    return btn;
  }

  const confirmBtn = makeBtn('✓ Use this', '#48bb78');
  const cancelBtn  = makeBtn('✗ Cancel',   '#718096');
  toolbar.appendChild(confirmBtn);
  toolbar.appendChild(cancelBtn);

  // ── Instructions label ────────────────────────────────────────────────────
  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position: 'fixed', zIndex: '2147483648',
    color: 'rgba(255,255,255,0.85)', fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
    pointerEvents: 'none', userSelect: 'none'
  });
  hint.textContent = 'Drag to move · Corners to resize';

  // ── Mount ─────────────────────────────────────────────────────────────────
  const root = document.body || document.documentElement;
  root.appendChild(canvas);
  root.appendChild(toolbar);
  root.appendChild(hint);

  const ctx = canvas.getContext('2d');

  // ── Selection state ───────────────────────────────────────────────────────
  const MIN_SIZE = 32;
  const HANDLE_HIT = 12; // px hit radius for corner handles

  let sel = {
    x:    Math.round(vw / 2 - 100),
    y:    Math.round(vh / 2 - 100),
    size: 200
  };

  function clamp() {
    sel.size = Math.max(MIN_SIZE, sel.size);
    sel.x = Math.max(0, Math.min(vw - sel.size, sel.x));
    sel.y = Math.max(0, Math.min(vh - sel.size, sel.y));
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    // Dim the page
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, vw, vh);

    // Cut out selection (shows page beneath)
    ctx.clearRect(sel.x, sel.y, sel.size, sel.size);

    // Selection border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(sel.x, sel.y, sel.size, sel.size);

    // Corner handles (filled white squares)
    ctx.fillStyle = 'white';
    for (const [cx, cy] of corners()) {
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
    }

    // Size badge above selection
    const label = `${sel.size} × ${sel.size}`;
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    const bx = sel.x + sel.size / 2 - tw / 2;
    const by = sel.y - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, bx, by, tw, 18, 4);
    ctx.fillStyle = 'white';
    ctx.fillText(label, sel.x + sel.size / 2, by + 13);

    positionUI();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
    c.fill();
  }

  function corners() {
    return [
      [sel.x,            sel.y           ],  // TL
      [sel.x + sel.size, sel.y           ],  // TR
      [sel.x,            sel.y + sel.size],  // BL
      [sel.x + sel.size, sel.y + sel.size],  // BR
    ];
  }

  function positionUI() {
    // Toolbar: below selection if space, otherwise above
    const tY = sel.y + sel.size + 10;
    toolbar.style.left = sel.x + 'px';
    toolbar.style.top  = (tY + 44 < vh ? tY : sel.y - 50) + 'px';

    // Hint: above the size badge
    hint.style.left = (sel.x + sel.size / 2 - 110) + 'px';
    hint.style.top  = (sel.y - 52) + 'px';
  }

  // ── Hit testing ───────────────────────────────────────────────────────────
  const CORNER_IDS = ['TL', 'TR', 'BL', 'BR'];

  function hitTest(mx, my) {
    const pts = corners();
    for (let i = 0; i < pts.length; i++) {
      const [cx, cy] = pts[i];
      if (Math.abs(mx - cx) <= HANDLE_HIT && Math.abs(my - cy) <= HANDLE_HIT) {
        return CORNER_IDS[i];
      }
    }
    if (mx >= sel.x && mx <= sel.x + sel.size && my >= sel.y && my <= sel.y + sel.size) return 'MOVE';
    return null;
  }

  const CURSORS = { TL: 'nwse-resize', TR: 'nesw-resize', BL: 'nesw-resize', BR: 'nwse-resize', MOVE: 'move' };

  // ── Drag state ────────────────────────────────────────────────────────────
  let drag = null; // { type, startMx, startMy, startSel, fixedX?, fixedY? }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const mx = e.clientX, my = e.clientY;
    const hit = hitTest(mx, my);
    if (!hit) return;
    e.preventDefault();

    const startSel = { ...sel };
    if (hit === 'MOVE') {
      drag = { type: 'MOVE', startMx: mx, startMy: my, startSel };
    } else {
      // Anchor = opposite corner
      const cPts = corners();
      const oppIdx = { TL: 3, TR: 2, BL: 1, BR: 0 }[hit];
      const [fx, fy] = cPts[oppIdx];
      drag = { type: hit, startMx: mx, startMy: my, startSel, fixedX: fx, fixedY: fy };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const mx = e.clientX, my = e.clientY;

    if (drag) {
      if (drag.type === 'MOVE') {
        sel.x = drag.startSel.x + (mx - drag.startMx);
        sel.y = drag.startSel.y + (my - drag.startMy);
      } else {
        const rawW = Math.abs(mx - drag.fixedX);
        const rawH = Math.abs(my - drag.fixedY);
        const newSize = Math.max(MIN_SIZE, Math.max(rawW, rawH));
        sel.size = newSize;
        if (drag.type === 'BR') { sel.x = drag.fixedX;           sel.y = drag.fixedY; }
        if (drag.type === 'BL') { sel.x = drag.fixedX - newSize; sel.y = drag.fixedY; }
        if (drag.type === 'TR') { sel.x = drag.fixedX;           sel.y = drag.fixedY - newSize; }
        if (drag.type === 'TL') { sel.x = drag.fixedX - newSize; sel.y = drag.fixedY - newSize; }
      }
      clamp();
    }

    canvas.style.cursor = CURSORS[drag ? drag.type : hitTest(mx, my)] || 'default';
    render();
  });

  window.addEventListener('mouseup', () => { drag = null; }, true);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cleanup();
    if (e.key === 'Enter') confirm();
  }, true);

  // ── Confirm ───────────────────────────────────────────────────────────────
  async function confirm() {
    // Hide overlay so the screenshot is clean
    canvas.style.display  = 'none';
    toolbar.style.display = 'none';
    hint.style.display    = 'none';

    // Give the browser one frame to repaint before capturing
    await new Promise(r => setTimeout(r, 80));

    chrome.runtime.sendMessage(
      { action: 'capture_favicon', rect: { x: sel.x, y: sel.y, size: sel.size, devicePixelRatio: dpr } },
      (response) => {
        if (!response || response.error) {
          // Restore overlay and show error
          canvas.style.display  = 'block';
          toolbar.style.display = 'flex';
          hint.style.display    = 'block';
          hint.textContent = '⚠ Capture failed — try again';
          hint.style.color = '#fc8181';
        } else {
          cleanup();
        }
      }
    );
  }

  function cleanup() {
    canvas.remove();
    toolbar.remove();
    hint.remove();
    window.removeEventListener('mouseup', () => { drag = null; }, true);
  }

  confirmBtn.addEventListener('click', confirm);
  cancelBtn.addEventListener('click',  cleanup);

  // ── Initial render ────────────────────────────────────────────────────────
  clamp();
  render();
})();
