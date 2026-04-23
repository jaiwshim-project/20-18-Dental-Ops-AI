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
document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('index'));
  </script>
