const ARCH_PASSWORD = '9663';

function verifyArchPassword() {
  const storedPass = sessionStorage.getItem('archPass');
  if (storedPass === ARCH_PASSWORD) return true;

  const pwd = prompt('🔐 아키텍처 페이지는 비밀번호가 필요합니다.\n\n비밀번호를 입력하세요:');
  if (pwd === ARCH_PASSWORD) {
    sessionStorage.setItem('archPass', ARCH_PASSWORD);
    return true;
  }
  return false;
}

function hideArchContent() {
  const app = document.getElementById('app');
  if (!app) return;
  const content = app.querySelector('.content');
  if (content) {
    content.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:400px;">
        <div style="text-align:center;">
          <div style="font-size:3rem; margin-bottom:16px;">&#x1F510;</div>
          <h2 style="margin-bottom:12px;">아키텍처 페이지 접근 제한</h2>
          <p style="color:var(--text-secondary); margin-bottom:24px;">비밀번호가 필요합니다.</p>
          <button class="btn btn-primary" onclick="location.reload()">다시 시도</button>
        </div>
      </div>`;
  }
}

// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('architecture'));

if (!verifyArchPassword()) {
  hideArchContent();
}
  </script>

// ===== 사이드바 렌더링 (DOMContentLoaded 대기) =====
document.addEventListener('DOMContentLoaded', function() {
  const appDiv = document.getElementById('app');
  const pageName = document.body.getAttribute('data-page') || 'consult';
  if (appDiv && !document.getElementById('sidebar')) {
    appDiv.insertAdjacentHTML('afterbegin', renderSidebar(pageName));
    console.log('[✅ Sidebar loaded]', pageName);
  }
});

// ===== 사이드바 렌더링 (setTimeout으로 지연) =====
(function initSidebar() {
  const maxAttempts = 50;
  let attempts = 0;
  
  function tryLoadSidebar() {
    const appDiv = document.getElementById('app');
    const renderFunc = window.renderSidebar;
    
    if (appDiv && renderFunc && !document.getElementById('sidebar')) {
      const pageName = document.body.getAttribute('data-page') || 'page';
      try {
        appDiv.insertAdjacentHTML('afterbegin', renderFunc(pageName));
        console.log('[✅ Sidebar loaded]', pageName);
        return true;
      } catch (e) {
        console.error('[❌ Sidebar load error]', e);
        return false;
      }
    }
    
    if (attempts < maxAttempts) {
      attempts++;
      setTimeout(tryLoadSidebar, 100);
    } else {
      console.warn('[⚠️ Sidebar load timeout]');
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryLoadSidebar);
  } else {
    setTimeout(tryLoadSidebar, 100);
  }
})();

// ===== 사이드바 지속적 유지 (강력한 방식) =====
(function maintainSidebar() {
  function ensureSidebar() {
    const appDiv = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const renderFunc = window.renderSidebar;
    
    // 사이드바가 없으면 추가
    if (appDiv && !sidebar && renderFunc) {
      const pageName = document.body.getAttribute('data-page') || 'page';
      try {
        appDiv.insertAdjacentHTML('afterbegin', renderFunc(pageName));
        console.log('[✅ Sidebar maintained]', pageName);
      } catch (e) {
        console.error('[Sidebar error]', e);
      }
    }
  }
  
  // 초기 로드
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSidebar);
  } else {
    setTimeout(ensureSidebar, 100);
  }
  
  // 주기적 확인 (1초마다 - 사이드바가 사라지면 다시 추가)
  setInterval(ensureSidebar, 1000);
})();
