const SCORE_KEY = 'biw_scores';

document.addEventListener('DOMContentLoaded', () => {
  renderLeaderboard();
  setupFilters();

  document.getElementById('back-gallery-lb').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  document.getElementById('play-game-lb').addEventListener('click', () => {
    window.location.href = 'game.html';
  });
});

function renderLeaderboard(filterArt = 'all', filterDiff = 'all') {
  const scores = getScores();
  const tbody = document.getElementById('scores-tbody');
  const emptyEl = document.getElementById('empty-scores');

  let filtered = scores.filter(s => {
    const artMatch = filterArt === 'all' || s.artworkId == filterArt;
    const diffMatch = filterDiff === 'all' || s.difficulty == filterDiff;
    return artMatch && diffMatch;
  });

  filtered.sort((a, b) => b.score - a.score);

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
    updateStats(scores);
    return;
  }

  emptyEl.style.display = 'none';
  tbody.innerHTML = filtered.map((s, i) => `
    <tr class="${i < 3 ? 'top-' + (i + 1) : ''}">
      <td class="rank-cell">${rankIcon(i + 1)}</td>
      <td class="player-cell">
        <span class="player-name">${escapeHtml(s.username)}</span>
      </td>
      <td class="artwork-cell">${escapeHtml(s.artworkTitle)}</td>
      <td><span class="diff-badge diff-${s.difficulty}">${s.difficulty}×${s.difficulty}</span></td>
      <td class="score-cell">${s.score.toLocaleString()}</td>
      <td>${formatTime(s.time)}</td>
      <td>${s.moves}</td>
      <td class="date-cell">${s.date}</td>
    </tr>
  `).join('');

  updateStats(scores);
}

function rankIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `<span class="rank-num">${rank}</span>`;
}

function updateStats(scores) {
  document.getElementById('stat-total').textContent = scores.length;
  document.getElementById('stat-players').textContent = new Set(scores.map(s => s.username)).size;
  const best = scores.length ? Math.max(...scores.map(s => s.score)) : 0;
  document.getElementById('stat-best').textContent = best.toLocaleString();
}

function setupFilters() {
  const artFilter = document.getElementById('filter-artwork');
  ARTWORKS.forEach(art => {
    const opt = document.createElement('option');
    opt.value = art.id;
    opt.textContent = art.title;
    artFilter.appendChild(opt);
  });

  artFilter.addEventListener('change', applyFilters);
  document.getElementById('filter-difficulty').addEventListener('change', applyFilters);
  document.getElementById('clear-scores').addEventListener('click', () => {
    if (confirm('ลบคะแนนทั้งหมด?')) {
      localStorage.removeItem(SCORE_KEY);
      renderLeaderboard();
    }
  });
}

function applyFilters() {
  const art = document.getElementById('filter-artwork').value;
  const diff = document.getElementById('filter-difficulty').value;
  renderLeaderboard(art, diff);
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getScores() {
  const data = localStorage.getItem('biw_scores');
  return data ? JSON.parse(data) : [];
}
