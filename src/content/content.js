import "../css/panel.css";

/* ── Init theme (load saved) ── */
// Load saved theme from localStorage
const savedTheme = localStorage.getItem("rpu-theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("rpu-dark");
}

/* ── Toggle theme ── */
function toggleTheme(btn) {
  // Toggle class on <html>
  document.documentElement.classList.toggle("rpu-dark");

  const isDark = document.documentElement.classList.contains("rpu-dark");

  // Persist theme
  localStorage.setItem("rpu-theme", isDark ? "dark" : "light");

  // Update button icon
  if (btn) {
    btn.textContent = isDark ? "☀️" : "🌙";
  }
}


const getImage = (p) => {
  // 1. preview (best)
  if (p.preview?.images?.[0]?.source?.url) {
    return p.preview.images[0].source.url.replace(/&amp;/g, "&");
  }

  // 2. direct image
  if (p.url && /\.(jpg|png|webp|gif)$/.test(p.url)) {
    return p.url;
  }

  // 3. thumbnail fallback
  if (p.thumbnail && p.thumbnail.startsWith("http")) {
    return p.thumbnail;
  }

  return null;
};


/* ── DOM hedefi ── */
function getTarget() {
  return (
    document.getElementById("empty-feed-content") ||
    document.querySelector("shreddit-feed") ||
    null
  );
}

/* ── Panel inject ── */
function injectPanel(posts, comments, section) {
  const target = getTarget();
  if (!target) return;

  target.innerHTML = "";
  document.getElementById("rpu-panel")?.remove();

  const mixedMode    = section === "";
  const showPosts    = mixedMode || section === "submitted";
  const showComments = mixedMode || section === "comments";

  const toDate = ts =>
    new Date(ts * 1000).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric",
    });

const makeRow = (date, sub, url, text, imageUrl) =>
  `<a href="${url}" target="_blank" class="rpu-row">

    <div class="rpu-top">
      <span class="rpu-sub">r/${sub}</span>
      <span class="rpu-date">${date}</span>
    </div>

    ${imageUrl ? `<img class="rpu-img" src="${imageUrl}" />` : ""}

    <div class="rpu-text">${text}</div>

  </a>`;

  const postRows = posts.map(p =>
    makeRow(
      toDate(p.created_utc),
      p.subreddit,
      `https://reddit.com${p.permalink}`,
      p.title ?? "",
      getImage(p) // <-- KRİTİK EKLEME
    )
  ).join("");

  const commentRows = comments.map(c =>
    makeRow(
      toDate(c.created_utc),
      c.subreddit,
      `https://reddit.com${c.permalink}`,
      c.body?.slice(0, 100) ?? ""
    )
  ).join("");

  const isDark = document.documentElement.classList.contains("rpu-dark");

  const panel = document.createElement("div");
  panel.id = "rpu-panel";

  panel.innerHTML = `
    <div class="rpu-header">
      <button id="rpu-theme-btn">
        ${isDark ? "☀️" : "🌙"}
      </button>
    </div>

    ${mixedMode ? `
      <div class="rpu-tabs">
        <button class="rpu-tab active" data-tab="posts">
          Postlar <span class="rpu-count">${posts.length}</span>
        </button>
        <button class="rpu-tab" data-tab="comments">
          Commentler <span class="rpu-count">${comments.length}</span>
        </button>
      </div>` : ""}

    ${showPosts ? `
      <div class="rpu-list ${showPosts && !showComments || mixedMode ? "visible" : ""}" id="rpu-posts">
        ${postRows || '<p class="rpu-empty">Post bulunamadı.</p>'}
      </div>` : ""}

    ${showComments ? `
      <div class="rpu-list ${showComments && !showPosts ? "visible" : ""}" id="rpu-comments">
        ${commentRows || '<p class="rpu-empty">Comment bulunamadı.</p>'}
      </div>` : ""}
  `;

  /* ── Theme button event ── */
  const themeBtn = panel.querySelector("#rpu-theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => toggleTheme(themeBtn));
  }

  /* ── Tab handler ── */
  panel.querySelectorAll(".rpu-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      panel.querySelectorAll(".rpu-tab").forEach(t => t.classList.remove("active"));
      panel.querySelectorAll(".rpu-list").forEach(l => l.classList.remove("visible"));
      btn.classList.add("active");
      panel.querySelector(`#rpu-${btn.dataset.tab}`)?.classList.add("visible");
    });
  });

  target.appendChild(panel);
}

/* ── URL parse & fetch ── */
function handleUser() {
  const match = location.pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
  if (!match) return;

  const username = match[1];
  const section  = (match[2] ?? "").trim();

  if (!["", "submitted", "comments"].includes(section)) return;

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, res => {
    if (chrome.runtime.lastError) return;
    if (!res?.ok) return;

    const tryInject = () => {
      if (getTarget()) {
        injectPanel(res.posts, res.comments, section);
      } else {
        setTimeout(tryInject, 300);
      }
    };
    tryInject();
  });
}

/* ── SPA navigation ── */
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  window.dispatchEvent(new Event("locationchange"));
};

window.addEventListener("locationchange", handleUser);
handleUser();