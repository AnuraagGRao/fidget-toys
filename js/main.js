'use strict';

/* ============================================================
   Fidget Toys · Portal Logic, Filtering, Search & Random Launcher
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const toyCards     = document.querySelectorAll('.toy-card');
  const favoriteBtns = document.querySelectorAll('.favorite-btn');
  const filterPills  = document.querySelectorAll('.filter-pill');
  const searchInput  = document.getElementById('toySearch');
  const randomToyBtn = document.getElementById('randomToyBtn');
  const noResultsEl  = document.getElementById('noResults');
  const countAllEl   = document.getElementById('countAll');
  const countFavsEl  = document.getElementById('countFavs');

  let activeCategory = 'all';
  let searchQuery    = '';
  let audioCtx       = null;

  // ── Web Audio subtle click feedback ─────────────────────────
  function playClick() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {}
  }

  // ── Favorites Management ────────────────────────────────────
  const getFavorites = () => {
    try {
      return JSON.parse(localStorage.getItem('fidget-favorites')) || [];
    } catch {
      return [];
    }
  };

  const updateFavoritesUI = () => {
    const favs = getFavorites();
    favoriteBtns.forEach(btn => {
      const isFav = favs.includes(btn.dataset.id);
      btn.classList.toggle('is-favorite', isFav);
    });
    if (countFavsEl) countFavsEl.textContent = favs.length;
  };

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    playClick();

    const btn = e.currentTarget;
    const id = btn.dataset.id;
    let favs = getFavorites();

    if (favs.includes(id)) {
      favs = favs.filter(favId => favId !== id);
    } else {
      favs.push(id);
    }

    localStorage.setItem('fidget-favorites', JSON.stringify(favs));
    updateFavoritesUI();

    // If currently on favorites tab, re-filter
    if (activeCategory === 'favorites') {
      applyFilters();
    }
  };

  favoriteBtns.forEach(btn => {
    btn.addEventListener('click', toggleFavorite);
  });

  // ── Card Filtering Engine ───────────────────────────────────
  const applyFilters = () => {
    const favs = getFavorites();
    const query = searchQuery.toLowerCase().trim();
    let visibleCount = 0;

    toyCards.forEach(card => {
      const name = card.querySelector('.toy-name')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('.toy-desc')?.textContent.toLowerCase() || '';
      const cat  = card.dataset.category || '';
      const btnId = card.querySelector('.favorite-btn')?.dataset.id;

      // Category check
      let matchesCategory = false;
      if (activeCategory === 'all') {
        matchesCategory = true;
      } else if (activeCategory === 'favorites') {
        matchesCategory = favs.includes(btnId);
      } else {
        matchesCategory = (cat === activeCategory);
      }

      // Search query check
      const matchesSearch = !query || name.includes(query) || desc.includes(query);

      const show = matchesCategory && matchesSearch;
      card.style.display = show ? 'flex' : 'none';
      if (show) visibleCount++;
    });

    if (noResultsEl) {
      noResultsEl.hidden = (visibleCount > 0);
    }
  };

  // ── Category Pills ──────────────────────────────────────────
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      playClick();
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      activeCategory = pill.dataset.category;
      applyFilters();
    });
  });

  // ── Search Input ────────────────────────────────────────────
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      applyFilters();
    });
  }

  // ── Random Toy Launcher ("Surprise Me") ──────────────────────
  if (randomToyBtn) {
    randomToyBtn.addEventListener('click', () => {
      playClick();
      const allUrls = Array.from(toyCards).map(c => c.getAttribute('href')).filter(Boolean);
      if (allUrls.length > 0) {
        const pick = allUrls[Math.floor(Math.random() * allUrls.length)];
        window.location.href = pick;
      }
    });
  }

  // ── Init ────────────────────────────────────────────────────
  if (countAllEl) countAllEl.textContent = toyCards.length;
  updateFavoritesUI();
  applyFilters();
});
