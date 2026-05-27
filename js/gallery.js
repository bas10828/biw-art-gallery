document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
  setupModal();
  setupLoginModal();
  updateNavUser();
});

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  ARTWORKS.forEach((art, i) => {
    const card = document.createElement('div');
    card.className = 'art-card';
    card.style.animationDelay = `${i * 0.08}s`;
    card.innerHTML = `
      <div class="art-card-img">
        <img src="images/${art.file}" alt="${art.title}" loading="lazy">
        <div class="art-card-overlay">
          <span class="view-icon">✦</span>
        </div>
      </div>
      <div class="art-card-info">
        <h3>${art.title}</h3>
        <p class="art-subtitle">${art.titleEn} · ${art.year}</p>
      </div>
    `;
    card.addEventListener('click', () => openModal(art));
    grid.appendChild(card);
  });
}

function openModal(art) {
  const modal = document.getElementById('artwork-modal');
  document.getElementById('modal-img').src = `images/${art.file}`;
  document.getElementById('modal-img').alt = art.title;
  document.getElementById('modal-title').textContent = art.title;
  document.getElementById('modal-title-en').textContent = art.titleEn;
  document.getElementById('modal-meta').textContent = `${art.medium} · ${art.year}`;
  document.getElementById('modal-story').textContent = art.story;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function setupModal() {
  const modal = document.getElementById('artwork-modal');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function closeModal() {
  document.getElementById('artwork-modal').classList.remove('active');
  document.body.style.overflow = '';
}

function setupLoginModal() {
  const loginModal = document.getElementById('login-modal');
  const gameBtn = document.getElementById('game-btn');
  const loginForm = document.getElementById('login-form');
  const loginClose = document.getElementById('login-close');

  gameBtn.addEventListener('click', () => {
    if (Auth.isLoggedIn()) {
      window.location.href = 'game.html';
    } else {
      loginModal.classList.add('active');
      document.getElementById('username-input').focus();
    }
  });

  loginClose.addEventListener('click', () => {
    loginModal.classList.remove('active');
  });

  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.classList.remove('active');
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username-input').value;
    if (Auth.login(username)) {
      loginModal.classList.remove('active');
      updateNavUser();
      window.location.href = 'game.html';
    }
  });
}

function updateNavUser() {
  const userEl = document.getElementById('nav-user');
  const user = Auth.getUser();
  if (user) {
    userEl.innerHTML = `<span class="user-badge">✦ ${user.username}</span> <button onclick="handleLogout()" class="logout-btn">ออกจากระบบ</button>`;
  } else {
    userEl.innerHTML = '';
  }
}

function handleLogout() {
  Auth.logout();
  updateNavUser();
}
