const ACCESS_PASSWORD = 'limetky'; // Change this value to your desired password
const STORAGE_KEY = 'fitlime.password.ok';

const overlayStyle = `
.pw-lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at 20% 20%, rgba(84, 255, 154, 0.15), transparent 45%),
              radial-gradient(circle at 80% 30%, rgba(41, 182, 246, 0.15), transparent 40%),
              #0b1324e6;
  backdrop-filter: blur(6px);
}

.pw-lock-card {
  width: min(420px, 100%);
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.35);
  border: 1px solid #1f2937;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}

.pw-lock-card h2 {
  margin: 0 0 8px;
  font-size: 1.15rem;
  color: #f1f5f9;
}

.pw-lock-card p {
  margin: 0 0 14px;
  color: #cbd5e1;
  line-height: 1.5;
}

.pw-lock-form {
  display: flex;
  gap: 10px;
}

.pw-lock-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #1f2937;
  background: #0b1220;
  color: #e2e8f0;
  font-size: 0.95rem;
}

.pw-lock-input:focus {
  outline: 2px solid #22c55e;
  outline-offset: 1px;
}

.pw-lock-button {
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(120deg, #22c55e, #16a34a);
  color: #04100a;
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.pw-lock-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(34, 197, 94, 0.35);
}

.pw-lock-error {
  margin-top: 10px;
  color: #f87171;
  font-size: 0.9rem;
}

body.pw-locked {
  overflow: hidden;
}
`;

function buildOverlay() {
  const style = document.createElement('style');
  style.textContent = overlayStyle;

  const overlay = document.createElement('div');
  overlay.className = 'pw-lock-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Uzamcena stranka');

  overlay.innerHTML = `
    <div class="pw-lock-card">
      <h2>FitLime web je chranen heslem</h2>
      <p>Zadej heslo, ktere jsi dostal/a od autora.</p>
      <form class="pw-lock-form" aria-label="Formular pro odemknuti">
        <input class="pw-lock-input" type="password" name="password" autocomplete="current-password" placeholder="Zadej heslo" aria-label="Heslo" required />
        <button type="submit" class="pw-lock-button">Odemknout</button>
      </form>
      <div class="pw-lock-error" role="alert" aria-live="polite" hidden>Heslo nesedi, zkus to znovu.</div>
    </div>
  `;

  return { overlay, style };
}

function lockPage() {
  if (sessionStorage.getItem(STORAGE_KEY) === '1') return;

  const { overlay, style } = buildOverlay();
  const form = overlay.querySelector('.pw-lock-form');
  const input = overlay.querySelector('.pw-lock-input');
  const error = overlay.querySelector('.pw-lock-error');

  const unlock = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    document.body.classList.remove('pw-locked');
    overlay.remove();
    style.remove();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (input.value || '').trim();

    if (value === ACCESS_PASSWORD) {
      unlock();
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  });

  document.head.appendChild(style);
  document.body.appendChild(overlay);
  document.body.classList.add('pw-locked');
  input.focus();
}

window.addEventListener('DOMContentLoaded', lockPage);
