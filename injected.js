/* ------------------------------------------------------------------
   injected.js  v1.4 – Entry Variable Automator
   - ?링크 열기: playentry.org 내부 링크 직접, 외부는 redirect
   - javascript:, data:, vbscript: 등 스크립트 URL 차단
------------------------------------------------------------------ */

(function watchAndSetEntryVar() {
  /* ───────── 0) iframe & Entry 대기 ────────────────────────── */
  const iframe = document.querySelector('iframe');
  if (!iframe) return setTimeout(watchAndSetEntryVar, 500);

  const ed = iframe.contentWindow;
  if (!ed.Entry || !ed.Entry.variableContainer)
    return setTimeout(watchAndSetEntryVar, 500);

  const VC = ed.Entry.variableContainer;

  /* ───────── 1) 기본 변수 확보 ─────────────────────────────── */
  const V = {
    funksie:    VC.getVariableByName('?funksie'),
    fullscreen: VC.getVariableByName('?전체화면'),
    os:         VC.getVariableByName('?운영체제'),
    cursor:     VC.getVariableByName('?마우스 커서'),
    scroll:     VC.getVariableByName('?스크롤'),
    rc:         VC.getVariableByName('?우클릭'),
    res:        VC.getVariableByName('?화면 해상도')
  };

  if (V.funksie) V.funksie.value_ = 'TRUE';
  if (V.os)      V.os.value_      = detectOS(navigator.userAgent || '');

  /* ───────── 2) ?전체화면 – host body.modal_open 감시 ──────── */
  if (V.fullscreen) {
    const hostBody = document.body;
    const upd = () =>
      (V.fullscreen.value_ = hostBody.classList.contains('modal_open') ? 'TRUE' : 'FALSE');
    upd();
    new MutationObserver(upd)
      .observe(hostBody, { attributes: true, attributeFilter: ['class'] });
    setInterval(upd, 1000);
  }

  /* ───────── 3) ?마우스 커서 – 캔버스 내부 적용 ────────────── */
  if (V.cursor) handleCursor(V.cursor, ed);

  /* ───────── 4) 캔버스 기능 (?스크롤/?우클릭/?해상도) ──────── */
  waitCanvas(ed.document, canvas => {
    handleScroll(canvas, V.scroll);
    handleRightClick(canvas, V.rc);
    handleResolution(canvas, V.res);
  });

  /* ───────── 5) ?유저id 덮어쓰기 루프 ─────────────────────── */
  startUserIdLoop();

  /* ───────── 6) ?링크 열기 오버레이 ───────────────────────── */
  handleLinkOverlay();

  /* =================================================================
       HELPER FUNCTIONS
     ================================================================= */

  /* OS 문자열 */
  function detectOS(ua) {
    if (/windows/i.test(ua)) return 'Windows';
    if (/mac os/i.test(ua)) return 'macOS';
    if (/android/i.test(ua)) return 'Android';
    if (/linux/i.test(ua))   return 'Linux';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    return 'Unknown';
  }

  /* 캔버스 탐색 */
  function waitCanvas(doc, cb) {
    const sel = '#entryCanvas, canvas.entryCanvasWorkspace';
    const loop = () => {
      const c = doc.querySelector(sel);
      if (c) return cb(c);
      setTimeout(loop, 500);
    };
    loop();
  }

  /* 스크롤 변수 */
  function handleScroll(canvas, v) {
    if (!v) return;
    let over = false, timer = null;
    canvas.addEventListener('mouseenter', () => {
      over = true; v.value_ = 'NONE';
    });
    canvas.addEventListener('mouseleave', () => {
      over = false; v.value_ = 'NONE';
    });
    canvas.addEventListener('wheel', e => {
      if (!over) return;
      e.preventDefault();
      v.value_ = e.deltaY < 0 ? 'UP' : 'DOWN';
      clearTimeout(timer);
      timer = setTimeout(() => (v.value_ = 'NONE'), 250);
    }, { passive: false });
  }

  /* 우클릭 변수 (누르는 동안 TRUE/FALSE) */
  function handleRightClick(canvas, v) {
    if (!v) return;
    const down = e => {
      if (e.button === 2) { e.preventDefault(); v.value_ = 'TRUE'; }
    };
    const up = e => { if (e.button === 2) v.value_ = 'FALSE'; };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mouseup', up);
    canvas.addEventListener('mouseleave', up);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* 해상도 변수 */
  function handleResolution(canvas, v) {
    if (!v) return;
    const upd = () => (v.value_ = `${canvas.width}x${canvas.height}`);
    upd();
    new ResizeObserver(upd).observe(canvas);
  }

  /* ───────── 마우스 커서 – 캔버스 내부 적용 ─────────────── */
  function handleCursor(varObj, entryWin) {
    let last = '';

    /* 동일-출처 frame 내부 캔버스 수집 */
    const getCanvases = root => {
      const out = [];
      const dfs = w => {
        try {
          const doc = w.document;
          doc.querySelectorAll('#entryCanvas, canvas.entryCanvasWorkspace')
             .forEach(c => out.push(c));
          for (const f of w.frames) dfs(f);
        } catch (_) {}
      };
      dfs(root);
      return out;
    };

    const apply = url => {
      getCanvases(entryWin).forEach(c => {
        c.style.cursor = `url("${url}") 0 0, auto`;
      });
    };

    if (varObj.value_) { last = varObj.value_; apply(last); }
    setInterval(() => {
      const cur = varObj.value_;
      if (cur && cur !== last) { last = cur; apply(cur); }
    }, 300);
  }

  /* ───────── ?유저id 덮어쓰기 ─────────────────────────── */
  function startUserIdLoop() {
    const userVar = VC.getVariableByName('?유저id');
    if (!userVar) return;

    const getXToken = () => {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el) return null;
      try {
        const data = JSON.parse(el.textContent);
        const dfs = o => {
          if (o && typeof o === 'object') {
            if ('xToken' in o) return o.xToken;
            for (const k in o) { const v = dfs(o[k]); if (v) return v; }
          }
          return null;
        };
        return dfs(data);
      } catch { return null; }
    };
    const getCsrf = () =>
      document.querySelector('meta[name="csrf-token"]')?.content ||
      document.cookie.match(/csrfToken=([^;]+)/)?.[1] || '';

    const GQL = `
      query SELECT_TOPICS($pageParam: PageParam, $searchAfter: JSON){
        topicList(pageParam: $pageParam, searchAfter: $searchAfter){
          list { target }
        }
      }`.replace(/\s+/g, ' ');

    const fetchAndSet = async () => {
      const csrf = getCsrf();
      const xTok = getXToken();
      if (!csrf || !xTok) return;

      try {
        const res = await fetch('https://playentry.org/graphql/SELECT_TOPICS', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'csrf-token': csrf,
            'x-token': xTok,
            'x-client-type': 'Client'
          },
          body: JSON.stringify({
            query: GQL,
            variables: { pageParam: { display: 5 } }
          })
        });
        const json = await res.json();
        const target = json?.data?.topicList?.list?.[0]?.target;
        if (target) userVar.value_ = target;
      } catch (e) {
        console.error('SELECT_TOPICS 실패:', e);
      }
    };

    fetchAndSet();
    setInterval(fetchAndSet, 60_000);
  }

  /* ───────── ?링크 열기 – 오버레이 처리 ───────────────── */
  function handleLinkOverlay() {
    const linkVar = VC.getVariableByName('?링크 열기');
    if (!linkVar) return;

    /* ---------- 안전 URL 정규화 ---------- */
    const normalizeLink = raw => {
      if (!raw || raw === 'NONE') return null;
      try {
        const urlObj = new URL(raw, location.href);

        /* javascript:, data:, vbscript: 등 스킴 차단 */
        if (/^(javascript|vbscript|data):/i.test(urlObj.protocol)) return null;

        /* playentry.org (하위 포함) ⇒ 그대로 사용 */
        const host = urlObj.hostname.toLowerCase();
        const isInternal = host === 'playentry.org' || host.endsWith('.playentry.org');
        if (isInternal) return urlObj.href;

        /* 외부는 redirect 처리 */
        return `https://playentry.org/redirect?external=${encodeURIComponent(urlObj.href)}`;
      } catch {
        return null;
      }
    };

    let overlay = null;
    let ownerDoc = null;

    /* 현재 캔버스 + document 찾기 */
    const findCanvas = () => {
      const sel = '#entryCanvas, canvas.entryCanvasWorkspace';
      const topDoc   = document;
      const innerDoc = ed.document;
      const inTop   = topDoc.querySelector(sel);
      const inInner = innerDoc.querySelector(sel);
      if (inTop)   return { canvas: inTop,   doc: topDoc };
      if (inInner) return { canvas: inInner, doc: innerDoc };
      return { canvas: null, doc: topDoc };
    };

    /* 오버레이 제거 */
    const removeOverlay = () => {
      if (overlay) { overlay.remove(); overlay = null; ownerDoc = null; }
    };

    /* overlay (iframe+닫기) 생성 + 캔버스 동기화 */
    const buildOverlay = (docFor, url, canvasRef) => {
      const cont = docFor.createElement('div');
      Object.assign(cont.style, {
        position: 'absolute',
        zIndex: '9999',
        background: 'rgba(0,0,0,0.15)'
      });

      const iframe = docFor.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = 'width:100%;height:100%;border:none;';
      cont.appendChild(iframe);

      const btn = docFor.createElement('button');
      btn.textContent = '✕';
      Object.assign(btn.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '4px 8px',
        fontSize: '16px',
        cursor: 'pointer',
        zIndex: '10000'
      });
      btn.onclick = () => { removeOverlay(); linkVar.value_ = 'NONE'; };
      cont.appendChild(btn);

      /* 캔버스 크기/위치 동기화 */
      const resizeToCanvas = () => {
        if (!canvasRef.isConnected) return;
        const rect = canvasRef.getBoundingClientRect();
        Object.assign(cont.style, {
          width:  rect.width  + 'px',
          height: rect.height + 'px',
          left:   rect.left   + 'px',
          top:    rect.top    + 'px'
        });
      };
      resizeToCanvas();
      new ResizeObserver(resizeToCanvas).observe(canvasRef);
      window.addEventListener('resize', resizeToCanvas);

      return cont;
    };

    /* overlay 부착 */
    const attachOverlay = () => {
      if (!overlay) return;
      const { canvas, doc } = findCanvas();
      if (!canvas) { removeOverlay(); return; }

      /* document 이동 필요 시 재생성 */
      if (doc !== ownerDoc) {
        const url = overlay.querySelector('iframe')?.src || '';
        removeOverlay();
        overlay  = buildOverlay(doc, url, canvas);
        ownerDoc = doc;
      }

      /* 위치/크기 갱신 */
      const rect = canvas.getBoundingClientRect();
      Object.assign(overlay.style, {
        width:  rect.width  + 'px',
        height: rect.height + 'px',
        left:   rect.left   + 'px',
        top:    rect.top    + 'px'
      });

      doc.body.appendChild(overlay);
    };

    /* 변수 변화 감시 */
    let lastLink = linkVar.value_;
    let lastFull = V.fullscreen ? V.fullscreen.value_ : null;

    setInterval(() => {
      /* 1️⃣ 링크 값 변경 */
      const curRaw  = linkVar.value_;
      const safeURL = normalizeLink(curRaw);
      if (curRaw !== lastLink) {
        if (safeURL) {
          removeOverlay();
          const { canvas, doc } = findCanvas();
          if (canvas) {
            overlay  = buildOverlay(doc, safeURL, canvas);
            ownerDoc = doc;
            attachOverlay();
          }
        } else {
          /* 안전하지 않으면 변수 리셋 + 오버레이 제거 */
          removeOverlay();
          linkVar.value_ = 'NONE';
        }
        lastLink = curRaw;
      }

      /* 2️⃣ 전체화면 값 변경 → 위치 재부착 */
      if (V.fullscreen) {
        const curFull = V.fullscreen.value_;
        if (curFull !== lastFull && overlay) attachOverlay();
        lastFull = curFull;
      }
    }, 300);
  }
})(); // watchAndSetEntryVar 끝
