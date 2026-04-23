  <script>
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

document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('architecture'));

if (!verifyArchPassword()) {
  hideArchContent();
}
  </script>
