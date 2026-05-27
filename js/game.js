const SCORE_KEY = 'biw_scores';

class JigsawGame {
  constructor(artwork, n) {
    this.artwork = artwork;
    this.n = n;
    this.total = n * n;
    this.pieces = Array.from({ length: this.total }, (_, i) => i);
    this.selected = null;
    this.moves = 0;
    this.solved = false;
    this.startTime = null;
    this.elapsed = 0;
    this.timerEl = document.getElementById('timer');
    this.movesEl = document.getElementById('moves-count');
    this._timerInterval = null;
  }

  start() {
    do { this._shuffle(); } while (this._isSolved());
    this.render();
    this.startTime = Date.now();
    this._timerInterval = setInterval(() => {
      this.elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.timerEl.textContent = this._formatTime(this.elapsed);
    }, 500);
  }

  _shuffle() {
    for (let i = this.pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
    }
  }

  _isSolved() {
    return this.pieces.every((p, i) => p === i);
  }

  _formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  render() {
    const board = document.getElementById('puzzle-board');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${this.n}, 1fr)`;

    const boardSize = Math.min(window.innerWidth * 0.85, 520);
    const pieceSize = Math.floor(boardSize / this.n);
    board.style.width = `${pieceSize * this.n}px`;
    board.style.height = `${pieceSize * this.n}px`;

    this.pieces.forEach((pieceIdx, slot) => {
      const row = Math.floor(pieceIdx / this.n);
      const col = pieceIdx % this.n;
      const div = document.createElement('div');
      div.className = 'puzzle-piece';
      div.style.width = `${pieceSize}px`;
      div.style.height = `${pieceSize}px`;
      div.style.backgroundImage = `url('images/${this.artwork.file}')`;
      div.style.backgroundSize = `${pieceSize * this.n}px ${pieceSize * this.n}px`;
      div.style.backgroundPosition = `-${col * pieceSize}px -${row * pieceSize}px`;
      if (slot === this.selected) div.classList.add('selected');
      div.addEventListener('click', () => this._click(slot));
      board.appendChild(div);
    });
  }

  _click(slot) {
    if (this.solved) return;
    if (this.selected === null) {
      this.selected = slot;
      this.render();
    } else {
      if (this.selected !== slot) {
        [this.pieces[this.selected], this.pieces[slot]] = [this.pieces[slot], this.pieces[this.selected]];
        this.moves++;
        this.movesEl.textContent = this.moves;
      }
      this.selected = null;
      this.render();
      if (this._isSolved()) this._onSolved();
    }
  }

  _onSolved() {
    this.solved = true;
    clearInterval(this._timerInterval);
    this.elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const score = this._calcScore();
    this._saveScore(score);
    setTimeout(() => showResult(this.artwork, this.n, this.elapsed, this.moves, score), 400);
  }

  _calcScore() {
    const base = { 3: 1000, 4: 3000, 5: 6000 }[this.n] || 1000;
    return Math.max(50, base - this.elapsed * 3 - this.moves * 5);
  }

  _saveScore(score) {
    const user = Auth.getUser();
    const scores = getScores();
    scores.push({
      username: user ? user.username : 'Guest',
      artworkId: this.artwork.id,
      artworkTitle: this.artwork.title,
      difficulty: this.n,
      score,
      time: this.elapsed,
      moves: this.moves,
      date: new Date().toLocaleDateString('th-TH')
    });
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
  }
}

function getScores() {
  const data = localStorage.getItem(SCORE_KEY);
  return data ? JSON.parse(data) : [];
}

let currentGame = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) {
    document.getElementById('game-username-display').style.display = 'none';
    showSection('select-artwork');
  } else {
    const user = Auth.getUser();
    document.getElementById('game-username-display').textContent = `✦ ${user.username}`;
    showSection('select-artwork');
  }

  renderArtworkSelect();
  setupLoginInGame();

  document.getElementById('back-gallery').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('view-leaderboard').addEventListener('click', () => {
    window.location.href = 'leaderboard.html';
  });

  document.getElementById('play-again').addEventListener('click', () => {
    showSection('select-artwork');
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.n);
      startGame(n);
    });
  });
});

function renderArtworkSelect() {
  const grid = document.getElementById('artwork-select-grid');
  ARTWORKS.forEach(art => {
    const div = document.createElement('div');
    div.className = 'select-card';
    div.innerHTML = `
      <img src="images/${art.file}" alt="${art.title}" loading="lazy">
      <div class="select-card-title">${art.title}</div>
    `;
    div.addEventListener('click', () => selectArtwork(art));
    grid.appendChild(div);
  });
}

let selectedArtwork = null;

function selectArtwork(art) {
  if (!Auth.isLoggedIn()) {
    document.getElementById('game-login-modal').classList.add('active');
    return;
  }
  selectedArtwork = art;
  document.getElementById('diff-artwork-preview').src = `images/${art.file}`;
  document.getElementById('diff-artwork-name').textContent = art.title;
  showSection('select-difficulty');
}

function startGame(n) {
  if (!selectedArtwork) return;
  document.getElementById('game-artwork-title').textContent = selectedArtwork.title;
  document.getElementById('game-diff-label').textContent = `${n}×${n}`;
  showSection('playing');
  currentGame = new JigsawGame(selectedArtwork, n);
  currentGame.start();
}

function showResult(art, n, time, moves, score) {
  document.getElementById('result-score').textContent = score.toLocaleString();
  document.getElementById('result-time').textContent = formatTime(time);
  document.getElementById('result-moves').textContent = moves;
  document.getElementById('result-diff').textContent = `${n}×${n}`;
  document.getElementById('result-artwork').textContent = art.title;
  showSection('result');
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function showSection(id) {
  document.querySelectorAll('.game-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${id}`).classList.add('active');
}

function setupLoginInGame() {
  const modal = document.getElementById('game-login-modal');
  const form = document.getElementById('game-login-form');
  document.getElementById('game-login-close').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('game-username-input').value;
    if (Auth.login(username)) {
      modal.classList.remove('active');
      document.getElementById('game-username-display').textContent = `✦ ${username}`;
      if (selectedArtwork) {
        document.getElementById('diff-artwork-preview').src = `images/${selectedArtwork.file}`;
        document.getElementById('diff-artwork-name').textContent = selectedArtwork.title;
        showSection('select-difficulty');
      }
    }
  });
}
