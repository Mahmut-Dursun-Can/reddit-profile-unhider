import "../css/panel.css";

/* ── GLOBAL STATE ── */
let currentRequestId = 0;
let handleUserTimer = null;
let searchTimer = null;

/* ── SUB ICON CACHE ── */
const subIconCache = {};

async function fetchIconMap(subs) {
  const missing = [...new Set(subs)].filter(s => !(s in subIconCache));
  await Promise.all(
    missing.map(async sub => {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sub}/about.json`);
        const j = await r.json();
        const raw =
          j?.data?.community_icon ||
          j?.data?.icon_img ||
          "";
        subIconCache[sub] = raw.replace(/&amp;/g, "&").split("?")[0];
      } catch {
        subIconCache[sub] = "";
      }
    })
  );
  return Object.fromEntries(subs.map(s => [s, subIconCache[s] ?? ""]));
}

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
      idleTimer = setTimeout(() => { observer.disconnect(); cb(); }, 300);
    });

    observer.observe(feed, { childList: true, subtree: true });
    idleTimer = setTimeout(() => { observer.disconnect(); cb(); }, 300);
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

/* ── SUB ICON HTML ── */
function subIconHTML(sub, iconMap) {
  const url = iconMap?.[sub];
  if (url) {
    return `<img class="rpu-sub-icon" src="${url}" alt="r/${sub}" />`;
  }
  return `<span class="rpu-sub-icon rpu-sub-icon--fallback">${sub[0].toUpperCase()}</span>`;
}

/* ── ROW ── */
function makeRow(date, sub, url, text, image, iconMap) {
  return `
    <a href="${url}" target="_blank" class="rpu-row">
      <div class="rpu-top">
        <div class="rpu-sub-info">
          ${subIconHTML(sub, iconMap)}
          <span class="rpu-sub">r/${sub}</span>
        </div>
        <span class="rpu-date">${date}</span>
      </div>
      ${image ? `<img class="rpu-img" src="${image}" />` : ""}
      <div class="rpu-text">${text}</div>
    </a>
  `;
}

/* ── BUILD ROWS ── */
function buildRows(posts, comments, mode, iconMap = {}) {
  const toDate = ts => {
    const locale = navigator.language || "en-US"; // fallback

    return new Date(ts * 1000).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const searchVal = document.getElementById("rpu-search")?.value.trim() ?? "";

  if (searchVal) {
    return posts.map(p =>
      makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p), iconMap)
    );
  }

  if (mode === "mixed") {
    return mergeFeed(posts, comments).map(item => {
      if (item.type === "post") {
        const p = item.data;
        return makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p), iconMap);
      } else {
        const c = item.data;
        return makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 500) ?? "", null, iconMap);
      }
    });
  } else if (mode === "posts") {
    return posts.map(p =>
      makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p), iconMap)
    );
  } else if (mode === "comments") {
    return comments.map(c =>
      makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 500) ?? "", null, iconMap)
    );
  }

  return [];
}

function removePanel() {
  const old = document.getElementById("rpu-panel");
  if (!old) return;
  const prev = old.__rpu_target;
  if (prev) prev.style.display = "";
  old.remove();
}

/* ── SCROLL PAGINATION ── */
function attachScrollPagination(mode, username, iconMap) {
  const panel = document.getElementById("rpu-panel");
  if (!panel) return;

  const list = panel.querySelector(".rpu-list");
  let loading = false;
  let exhausted = false;

  window.addEventListener("scroll", async function onScroll() {
    if (loading || exhausted) return;

    const panelBottom = panel.getBoundingClientRect().bottom;
    if (panelBottom > window.innerHeight + 300) return;

    loading = true;
    const requestId = ++currentRequestId;
    const searchVal = panel.querySelector("#rpu-search")?.value.trim() ?? "";

    chrome.runtime.sendMessage(
      { type: "FETCH_USER", username, before: panel.__rpu_oldestTs, query: searchVal || undefined },
      async res => {
        if (!res?.ok || requestId !== currentRequestId) { loading = false; return; }

        const { posts: newPosts, comments: newComments } = res;

        if (newPosts.length === 0 && newComments.length === 0) {
          exhausted = true;
          window.removeEventListener("scroll", onScroll);
          loading = false;
          return;
        }

        const subs = [...newPosts.map(p => p.subreddit), ...newComments.map(c => c.subreddit)];
        const newIconMap = await fetchIconMap(subs);
        Object.assign(iconMap, newIconMap);

        const allTs = [...newPosts, ...newComments].map(x => x.created_utc);
        panel.__rpu_oldestTs = Math.min(...allTs, panel.__rpu_oldestTs);

        const newRows = buildRows(newPosts, newComments, mode, iconMap);
        list.insertAdjacentHTML("beforeend", newRows.join(""));
        loading = false;
      }
    );
  });
}

/* ── RENDER ── */
function injectPanel(posts, comments, mode, username, iconMap = {}) {
  removePanel();

  const target = getTarget();
  if (!target?.isConnected) return;

  const isDark = document.documentElement.classList.contains("rpu-dark");
  const rows = buildRows(posts, comments, mode, iconMap);

  const panel = document.createElement("div");
  panel.id = "rpu-panel";
  panel.__rpu_target = target;

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
    ?.addEventListener("input", async (e) => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();

      searchTimer = setTimeout(() => {
        const requestId = ++currentRequestId;

        chrome.runtime.sendMessage(
          { type: "FETCH_USER", username, query: q || undefined },
          async res => {
            if (!res?.ok || requestId !== currentRequestId) return;

            const subs = [...res.posts.map(p => p.subreddit), ...res.comments.map(c => c.subreddit)];
            const newIconMap = await fetchIconMap(subs);
            Object.assign(iconMap, newIconMap);

            const list = panel.querySelector(".rpu-list");
            const newRows = buildRows(res.posts, res.comments, mode, iconMap);

            const allTs = [...res.posts, ...res.comments].map(x => x.created_utc);
            panel.__rpu_oldestTs = allTs.length ? Math.min(...allTs) : Infinity;

            list.innerHTML = newRows.join("") || '<p class="rpu-empty">Sonuç bulunamadı.</p>';
          }
        );
      }, 400);
    });

  target.style.display = "none";
  target.parentElement.insertBefore(panel, target);
  attachScrollPagination(mode, username, iconMap);
}

/* ── MAIN ── */
function handleUser() {
  clearTimeout(handleUserTimer);
  handleUserTimer = setTimeout(_handleUser, 150);
}

async function _handleUser() {
  const match = location.pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
  if (!match) { removePanel(); return; }

  const username = match[1];
  const section = (match[2] ?? "").trim();
  const modeMap = { "": "mixed", submitted: "posts", comments: "comments" };
  const mode = modeMap[section];
  if (!mode) return;

  const requestId = ++currentRequestId;

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, async res => {
    if (!res?.ok || requestId !== currentRequestId) return;

    const subs = [
      ...res.posts.map(p => p.subreddit),
      ...res.comments.map(c => c.subreddit),
    ];
    const iconMap = await fetchIconMap(subs);

    waitForTarget(() => {
      if (requestId !== currentRequestId) return;
      injectPanel(res.posts, res.comments, mode, username, iconMap);
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