import { useState, useEffect } from "react";

export default function SearchBar({ onSearch }) {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("rpu-dark")
  );
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("rpu-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("rpu-dark");
      setIsDark(true);
    }
  }, []);

  function handleTheme() {
    document.documentElement.classList.toggle("rpu-dark");
    const dark = document.documentElement.classList.contains("rpu-dark");
    localStorage.setItem("rpu-theme", dark ? "dark" : "light");
    setIsDark(dark);
  }

  async function handleKeyDown(e) {
    if (e.key !== "Enter" || searching) return;
    e.preventDefault();

    setSearching(true);
    try {
      await onSearch(query.trim());
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rpu-header">
      <input
        id="rpu-search"
        placeholder={searching ? "Searching…" : "Search"}
        value={query}
        disabled={searching}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button id="rpu-theme-btn" onClick={handleTheme} disabled={searching}>
        {isDark ? "☀️" : "🌙"}
      </button>
    </div>
  );
}