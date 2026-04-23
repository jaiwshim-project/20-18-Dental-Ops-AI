  <script>
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
