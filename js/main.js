'use strict';
// Landing page — no heavy JS needed.
// Ensure card links work correctly when hosted at a sub-path.
// (GitHub Pages serves from repo root, paths in HTML are already relative.)

// Favorites System
document.addEventListener("DOMContentLoaded", () => {
  const favoriteBtns = document.querySelectorAll(".favorite-btn");
  
  // Load favorites from local storage
  const loadFavorites = () => {
    let favorites = JSON.parse(localStorage.getItem("fidget-favorites")) || [];
    favoriteBtns.forEach(btn => {
      if (favorites.includes(btn.dataset.id)) {
        btn.classList.add("is-favorite");
      }
    });
  };

  // Toggle favorite status
  const toggleFavorite = (e) => {
    e.preventDefault(); // Stop navigation if button is inside an anchor tag
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    let favorites = JSON.parse(localStorage.getItem("fidget-favorites")) || [];

    if (favorites.includes(id)) {
      favorites = favorites.filter(favId => favId !== id);
      btn.classList.remove("is-favorite");
    } else {
      favorites.push(id);
      btn.classList.add("is-favorite");
    }
    
    localStorage.setItem("fidget-favorites", JSON.stringify(favorites));
  };

  favoriteBtns.forEach(btn => {
    btn.addEventListener("click", toggleFavorite);
  });

  loadFavorites();
});

