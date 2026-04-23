  <script>
document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('manual'));

function scrollTo2(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
  </script>
