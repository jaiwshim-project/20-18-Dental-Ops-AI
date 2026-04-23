// 병원 목록 즉시 로드 (common.js 로드 후)
(async () => {
  window.allClinics = [];
  try {
    const res = await fetch('/api/clinics');
    if (res.ok) {
      const data = await res.json();
      window.allClinics = data.clinics || [];
      console.log('[init-clinics] ✅ 병원 목록 로드:', window.allClinics.length, '개');
    }
  } catch (e) {
    console.error('[init-clinics] ❌', e.message);
  }
})();
  </script>
  <script src="js/supabase.js"></script>
  <script src="js/qlrcq-framework.js"></script>
  <script src="js/dental-engines.js"></script>
  <script>
// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('index'));
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
