/* ------------------------------------------------------------------
   injected.js  v1.5 – Entry Variable Automator
   - ?링크 열기: playentry.org 내부 링크 직접, 외부는 redirect
   - javascript:, data:, vbscript: 등 스크립트 URL 차단
   - SPA 탐색 지원 (iframe 교체 시 재초기화)
------------------------------------------------------------------ */

(function() {
  // URL 패턴 검사 함수
  function isAllowedURL() {
    const url = window.location.href;
    const patterns = [
      /^https:\/\/playentry\.org\/project\//,
      /^https:\/\/playentry\.org\/iframe\//,
      /^https:\/\/playentry\.org\/noframe\//,
      /^https:\/\/playentry\.org\/ws\//
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  // 허용되지 않는 URL이면 스크립트 실행 중단
  if (!isAllowedURL()) {
    return;
  }

  // project/* URL인지 확인 (iframe 체크가 필요한 경우)
  function shouldUseIframe() {
    return /^https:\/\/playentry\.org\/project\//.test(window.location.href);
  }

  let initializedIframe = null;
  let isUsingIframe = shouldUseIframe();
  const observers = []; // ResizeObserver, MutationObserver 등 정리용 배열
  const timers = []; // setInterval 등 타이머 ID 저장 배열

  // 모든 옵저버와 타이머를 정리하는 함수
  function cleanup() {
    observers.forEach(o => o.disconnect());
    observers.length = 0;
    timers.forEach(t => clearInterval(t));
    timers.length = 0;
  }

  function initialize() {
    if (isUsingIframe) {
      // project/* URL - iframe에서 Entry 찾기
      const iframe = document.querySelector('iframe');
      if (!iframe || iframe === initializedIframe) {
        return;
      }
      
      // 이전 리소스 정리
      cleanup();

      initializedIframe = iframe;
      watchAndSetEntryVar(iframe);
    } else {
      // 다른 URL - 호스트 페이지에서 Entry 찾기
      if (initializedIframe !== null) {
        return; // 이미 초기화됨
      }
      
      // 이전 리소스 정리
      cleanup();

      initializedIframe = true; // 초기화 완료 표시
      watchAndSetEntryVar(null); // null을 전달하여 호스트 페이지에서 Entry 찾기
    }
  }

  function watchAndSetEntryVar(iframe) {
    /* ───────── 0) Entry 대기 ────────────────────────── */
    const ed = iframe ? iframe.contentWindow : window;
    if (!ed.Entry || !ed.Entry.variableContainer) {
      setTimeout(() => watchAndSetEntryVar(iframe), 250);
      return;
    }

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
      const obs = new MutationObserver(upd);
      obs.observe(hostBody, { attributes: true, attributeFilter: ['class'] });
      observers.push(obs);
    }

    /* ───────── 3) ?마우스 커서 – 전역 적용 ────────────── */
    if (V.cursor) handleCursor(V.cursor, timers);

    /* ───────── 4) 캔버스 기능 (?스크롤/?우클릭/?해상도) ──────── */
    waitCanvas(iframe ? ed.document : document, canvas => {
      handleScroll(canvas, V.scroll);
      handleRightClick(canvas, V.rc);
      handleResolution(canvas, V.res, observers);
    });

    /* ───────── 5) 사용자 정보 변수들 설정 루프 ─────────────────────── */
    startUserInfoLoop(VC, timers);

    /* ───────── 6) ?링크 열기 오버레이 ───────────────────────── */
    handleLinkOverlay(VC, V, ed, timers);
  }

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
  function handleResolution(canvas, v, obsArray) {
    if (!v) return;
    const upd = () => (v.value_ = `${canvas.width}x${canvas.height}`);
    upd();
    const obs = new ResizeObserver(upd);
    obs.observe(canvas);
    if (obsArray) obsArray.push(obs);
  }

  /* ───────── 마우스 커서 – 전역 적용 ─────────────── */
  function handleCursor(varObj, timers) {
    let lastValue = varObj.value_;

    const apply = url => {
      // URL 유효성 검사 및 보정
      let finalUrl = url;
      if (!finalUrl || finalUrl === 'NONE' || !/\.(png|jpg|jpeg|gif|svg|cur)$/i.test(finalUrl)) {
        finalUrl = ''; // 유효하지 않으면 기본값으로
      } else if (finalUrl.startsWith('http:')) {
        finalUrl = finalUrl.replace('http:', 'https:');
      }

      const cursorStyle = finalUrl ? `url("${finalUrl}") 0 0, auto` : 'auto';
      
      // 페이지 전체(body)와 Entry iframe의 body에 커서 스타일 적용
      document.body.style.cursor = cursorStyle;
      if (initializedIframe && initializedIframe.contentDocument) {
        initializedIframe.contentDocument.body.style.cursor = cursorStyle;
      }
    };

    // 초기값 적용
    apply(lastValue);

    // 폴링으로 값 변경 감시
    const timerId = setInterval(() => {
      const currentValue = varObj.value_;
      if (currentValue !== lastValue) {
        lastValue = currentValue;
        apply(currentValue);
      }
    }, 250);
    timers.push(timerId);
  }

  /* ───────── 사용자 정보 변수들 설정 ─────────────────────────── */
  function startUserInfoLoop(VC, timers) {
    const userVar = VC.getVariableByName('?유저id');
    const createdVar = VC.getVariableByName('?계정생성일자');
    const roleVar = VC.getVariableByName('?계정유형');
    const profileIdVar = VC.getVariableByName('?프로필id');
    const emailAuthVar = VC.getVariableByName('?이메일 인증 여부');
    
    if (!userVar && !createdVar && !roleVar && !profileIdVar && !emailAuthVar) return;

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
      query FIND_PERSONAL_INFO {
        me {
          id
          username
          nickname
          role
          isEmailAuth
          isSnsAuth
          isPhoneAuth
          studentTerm
          status {
            userStatus
          }
          profileImage {
            id
            name
            label {
              ko
              en
              ja
              vn
            }
            filename
            imageType
            dimension {
              width
              height
            }
            trimmed {
              filename
              width
              height
            }
          }
          banned {
            username
            nickname
            reason
            bannedCount
            bannedType
            projectId
            startDate
            userReflect {
              status
              endDate
            }
          }
          isProfileBlocked
          created
        }
        personalInfo {
          mobile
          email
          grade
          gender
          isSnsJoinUser
          snsCd
        }
      }`.replace(/\s+/g, ' ');

    const fetchAndSet = async () => {
      const csrf = getCsrf();
      const xTok = getXToken();
      if (!csrf || !xTok) return;

      try {
        const res = await fetch('https://playentry.org/graphql/FIND_PERSONAL_INFO', {
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
            variables: {}
          })
        });
        const json = await res.json();
        const me = json?.data?.me;
        if (me) {
          // ?유저id 설정
          if (userVar && me.id) {
            userVar.value_ = me.id;
          }
          
          // ?계정생성일자 설정 (me.created)
          if (createdVar && me.created) {
            createdVar.value_ = me.created;
          }
          
          // ?계정유형 설정 (me.role)
          if (roleVar && me.role) {
            roleVar.value_ = me.role;
          }
          
          // ?프로필id 설정 (me.profileImage.id)
          if (profileIdVar && me.profileImage?.id) {
            profileIdVar.value_ = me.profileImage.id;
          }
          
          // ?이메일 인증 여부 설정 (me.isEmailAuth)
          if (emailAuthVar && typeof me.isEmailAuth === 'boolean') {
            emailAuthVar.value_ = me.isEmailAuth ? 'TRUE' : 'FALSE';
          }
        }
      } catch (e) {
        console.error('FIND_PERSONAL_INFO 실패:', e);
      }
    };

    fetchAndSet();
    const timerId = setInterval(fetchAndSet, 60_000);
    timers.push(timerId);
  }

  /* ───────── ?링크 열기 – 오버레이 처리 ───────────────── */
  function handleLinkOverlay(VC, V, ed, timers) {
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

    const timerId = setInterval(() => {
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
    timers.push(timerId);
  }

  // 초기 실행
  initialize();
  
  // SPA 네비게이션을 감지하기 위해 주기적으로 iframe 확인 (project/* URL만)
  if (isUsingIframe) {
    setInterval(initialize, 1000);
  }
})(); // 즉시 실행 함수 끝

