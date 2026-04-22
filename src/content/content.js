import "../css/panel.css";

/* ── GLOBAL STATE ── */
let currentRequestId = 0;
let handleUserTimer = null;
let searchTimer = null;

/* ── THEME ── */
if (localStorage.getItem("rpu-theme") === "dark") {
  document.documentElement.classList.add("rpu-dark");
}

function toggleTheme(btn) {
  document.documentElement.classList.toggle("rpu-dark");
  const isDark = document.documentElement.classList.contains("rpu-dark");
  localStorage.setItem("rpu-theme", isDark ? "dark" : "light");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
}

/* ── IMAGE ── */
function getImage(p) {
  if (p.preview?.images?.[0]?.source?.url)
    return p.preview.images[0].source.url.replace(/&amp;/g, "&");
  if (p.url && /\.(jpg|png|webp|gif)$/i.test(p.url))
    return p.url;
  if (p.thumbnail?.startsWith("http"))
    return p.thumbnail;
  return null;
}

/* ── TARGET ── */
function getTarget() {
  return (
    document.querySelector("shreddit-feed") ||
    document.getElementById("empty-feed-content") ||
    document.querySelector("[data-testid='post-container']")?.parentElement ||
    null
  );
}

/* ── WAIT FOR TARGET ── */
function waitForTarget(cb) {
  const isReady = () => {
    if (document.getElementById("empty-feed-content")?.isConnected) return true;
    const feed = document.querySelector("shreddit-feed");
    return feed?.isConnected && feed.querySelectorAll("article").length > 0;
  };

  const waitForIdle = () => {
    const feed = document.querySelector("shreddit-feed");
    if (!feed) { cb(); return; }

    let idleTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        observer.disconnect();
        cb();
      }, 300);
    });

    observer.observe(feed, { childList: true, subtree: true });
    idleTimer = setTimeout(() => {
      observer.disconnect();
      cb();
    }, 300);
  };

  if (isReady()) return waitForIdle();

  let fired = false;
  const observer = new MutationObserver(() => {
    if (fired || !isReady()) return;
    fired = true;
    observer.disconnect();
    waitForIdle();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/* ── MERGE ── */
function mergeFeed(posts, comments) {
  const p = posts.map(x => ({ type: "post", created_utc: x.created_utc, data: x }));
  const c = comments.map(x => ({ type: "comment", created_utc: x.created_utc, data: x }));
  return [...p, ...c].sort((a, b) => b.created_utc - a.created_utc);
}

/* ── ROW ── */
function makeRow(date, sub, url, text, image) {
  return `
    <a href="${url}" target="_blank" class="rpu-row">
      <div class="rpu-top">
        <span class="rpu-sub">r/${sub}</span>
        <span class="rpu-date">${date}</span>
      </div>
      ${image ? `<img class="rpu-img" src="${image}" />` : ""}
      <div class="rpu-text">${text}</div>
    </a>
  `;
}

/* ── BUILD ROWS ── */
function buildRows(posts, comments, mode) {
  const toDate = ts =>
    new Date(ts * 1000).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric",
    });

  const searchVal = document.getElementById("rpu-search")?.value.trim() ?? "";

  if (searchVal) {
    return posts.map(p =>
      makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p))
    );
  }

  if (mode === "mixed") {
    return mergeFeed(posts, comments).map(item => {
      if (item.type === "post") {
        const p = item.data;
        return makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p));
      } else {
        const c = item.data;
        return makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null);
      }
    });
  } else if (mode === "posts") {
    return posts.map(p =>
      makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p))
    );
  } else if (mode === "comments") {
    return comments.map(c =>
      makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null)
    );
  }

  return [];
}
/* ── PANEL TEMİZLE ── */
function removePanel() {
  const old = document.getElementById("rpu-panel");
  if (!old) return;
  const prev = old.__rpu_target;
  if (prev) prev.style.display = "";
  old.remove();
}

/* ── SCROLL PAGINATION ── */
function attachScrollPagination(mode, username) {
  const panel = document.getElementById("rpu-panel");
  if (!panel) return;

  const list = panel.querySelector(".rpu-list");
  let loading = false;
  let exhausted = false;

  const rows = list.querySelectorAll(".rpu-row");
  let oldestTs = Infinity;
  // oldestTs'i mevcut row'lardan değil, sonraki API cevabından takip edeceğiz
  // panel'e saklayalım
  panel.__rpu_oldestTs = panel.__rpu_oldestTs ?? Infinity;

  window.addEventListener("scroll", async function onScroll() {
    if (loading || exhausted) return;

    const panelBottom = panel.getBoundingClientRect().bottom;
    if (panelBottom > window.innerHeight + 300) return;

    loading = true;

    const requestId = ++currentRequestId;
    const searchVal = panel.querySelector("#rpu-search")?.value.trim() ?? "";

    chrome.runtime.sendMessage(
      { type: "FETCH_USER", username, before: panel.__rpu_oldestTs, query: searchVal || undefined },
      res => {
        if (!res?.ok || requestId !== currentRequestId) { loading = false; return; }

        const { posts: newPosts, comments: newComments } = res;

        if (newPosts.length === 0 && newComments.length === 0) {
          exhausted = true;
          window.removeEventListener("scroll", onScroll);
          loading = false;
          return;
        }

        // En eski timestamp güncelle
        const allTs = [...newPosts, ...newComments].map(x => x.created_utc);
        panel.__rpu_oldestTs = Math.min(...allTs, panel.__rpu_oldestTs);

        const newRows = buildRows(newPosts, newComments, mode);
        list.insertAdjacentHTML("beforeend", newRows.join(""));
        loading = false;
      }
    );
  });
}

/* ── RENDER ── */
function injectPanel(posts, comments, mode, username) {
  removePanel();

  const target = getTarget();
  if (!target?.isConnected) return;

  const isDark = document.documentElement.classList.contains("rpu-dark");
  const rows = buildRows(posts, comments, mode);

  const panel = document.createElement("div");
  panel.id = "rpu-panel";
  panel.__rpu_target = target;

  // En eski timestamp'i sakla
  const allTs = [...posts, ...comments].map(x => x.created_utc);
  panel.__rpu_oldestTs = allTs.length ? Math.min(...allTs) : Infinity;

  panel.innerHTML = `
    <div class="rpu-header">
      <input id="rpu-search" type="text" placeholder="Search only posts" />
      <button id="rpu-theme-btn">${isDark ? "☀️" : "🌙"}</button>
    </div>
    <div class="rpu-list visible">
      ${rows.join("") || '<p class="rpu-empty">İçerik bulunamadı.</p>'}
    </div>
  `;

  panel.querySelector("#rpu-theme-btn")
    ?.addEventListener("click", (e) => toggleTheme(e.currentTarget));

  panel.querySelector("#rpu-search")
    ?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();

      searchTimer = setTimeout(() => {
        const requestId = ++currentRequestId;

        chrome.runtime.sendMessage(
          { type: "FETCH_USER", username, query: q || undefined },
          res => {
            if (!res?.ok || requestId !== currentRequestId) return;

            const list = panel.querySelector(".rpu-list");
            const newRows = buildRows(res.posts, res.comments, mode);

            // En eski timestamp'i sıfırla
            const allTs = [...res.posts, ...res.comments].map(x => x.created_utc);
            panel.__rpu_oldestTs = allTs.length ? Math.min(...allTs) : Infinity;

            list.innerHTML = newRows.join("") || '<p class="rpu-empty">Sonuç bulunamadı.</p>';
          }
        );
      }, 400);
    });

  target.style.display = "none";
  target.parentElement.insertBefore(panel, target);
  attachScrollPagination(mode, username);
}

/* ── MAIN ── */
function handleUser() {
  clearTimeout(handleUserTimer);
  handleUserTimer = setTimeout(_handleUser, 150);
}

function _handleUser() {
  const match = location.pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
  if (!match) {
    removePanel();
    return;
  }

  const username = match[1];
  const section = (match[2] ?? "").trim();

  const modeMap = { "": "mixed", submitted: "posts", comments: "comments" };
  const mode = modeMap[section];
  if (!mode) return;

  const requestId = ++currentRequestId;

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, res => {
    if (!res?.ok) return;
    if (requestId !== currentRequestId) return;

    waitForTarget(() => {
      if (requestId !== currentRequestId) return;
      injectPanel(res.posts, res.comments, mode, username);
    });
  });
}

/* ── NAVIGATION ── */
const _push = history.pushState.bind(history);
history.pushState = function (...args) {
  _push(...args);
  window.dispatchEvent(new Event("locationchange"));
};

const _replace = history.replaceState.bind(history);
history.replaceState = function (...args) {
  _replace(...args);
  window.dispatchEvent(new Event("locationchange"));
};

window.addEventListener("popstate", () =>
  window.dispatchEvent(new Event("locationchange"))
);

let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    window.dispatchEvent(new Event("locationchange"));
  }
}, 500);

window.addEventListener("locationchange", handleUser);
handleUser();