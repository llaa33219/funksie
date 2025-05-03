/* ------------------------------------------------------------------
   contentScript.js – CSP-safe  외부 스크립트 주입
------------------------------------------------------------------ */
(function () {
    // 확장 프로그램 내부 파일 URL
    const src = chrome.runtime.getURL('injected.js');
  
    // 페이지 컨텍스트로 <script> 삽입
    const s = document.createElement('script');
    s.setAttribute('src', src);
    s.setAttribute('type', 'text/javascript');
    (document.head || document.documentElement).appendChild(s);
    // 클린업 (로드 후 제거)
    s.addEventListener('load', () => s.remove());
  })();
  