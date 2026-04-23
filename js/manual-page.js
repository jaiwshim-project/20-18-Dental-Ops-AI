  <script>
// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('manual'));

function scrollTo2(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
