import "../css/panel.css";

/* ── GLOBAL STATE ── */
let currentRequestId = 0;
let handleUserTimer = null;

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

function attachScrollPagination(posts, comments, mode, username) {
  const panel = document.getElementById("rpu-panel");
  if (!panel) return;

  const list = panel.querySelector(".rpu-list");
  let loading = false;
  let exhausted = false;

  // Mevcut en eski item'ın timestamp'i
  let oldestTs = [...posts, ...comments]
    .map(x => x.created_utc)
    .reduce((a, b) => Math.min(a, b), Infinity);

  window.addEventListener("scroll", async function onScroll() {
    if (loading || exhausted) return;

    const panelBottom = panel.getBoundingClientRect().bottom;
    if (panelBottom > window.innerHeight + 300) return;

    loading = true;

    const requestId = ++currentRequestId;

    chrome.runtime.sendMessage(
      { type: "FETCH_USER", username, before: oldestTs },
      res => {
        if (!res?.ok || requestId !== currentRequestId) { loading = false; return; }

        const newPosts = res.posts;
        const newComments = res.comments;

        if (newPosts.length === 0 && newComments.length === 0) {
          exhausted = true;
          window.removeEventListener("scroll", onScroll);
          loading = false;
          return;
        }

        // En eski timestamp'i güncelle
        oldestTs = [...newPosts, ...newComments]
          .map(x => x.created_utc)
          .reduce((a, b) => Math.min(a, b), oldestTs);

        // Yeni row'ları ekle
        const toDate = ts =>
          new Date(ts * 1000).toLocaleDateString("tr-TR", {
            day: "2-digit", month: "short", year: "numeric",
          });

        let newItems = [];

        if (mode === "mixed") {
          newItems = mergeFeed(newPosts, newComments).map(item => {
            if (item.type === "post") {
              const p = item.data;
              return makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p));
            } else {
              const c = item.data;
              return makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null);
            }
          });
        } else if (mode === "posts") {
          newItems = newPosts.map(p =>
            makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p))
          );
        } else if (mode === "comments") {
          newItems = newComments.map(c =>
            makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null)
          );
        }

        list.insertAdjacentHTML("beforeend", newItems.join(""));
        loading = false;
      }
    );
  });
}

function waitForTarget(cb) {
  const isReady = () => {
    // empty-feed-content varsa direkt hazır
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
function makeRow(date, sub, url, text, image, type) {
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

/* ── PANEL TEMİZLE ── */
function removePanel() {
  const old = document.getElementById("rpu-panel");
  if (!old) return;
  const prev = old.__rpu_target;
  if (prev) prev.style.display = "";
  old.remove();
}

/* ── RENDER ── */
function injectPanel(posts, comments, mode, username) {
  removePanel();

  const target = getTarget();
  if (!target?.isConnected) return;

  const toDate = ts =>
    new Date(ts * 1000).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric",
    });

  let items = [];

  if (mode === "mixed") {
    items = mergeFeed(posts, comments).map(item => {
      if (item.type === "post") {
        const p = item.data;
        return makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p), "post");
      } else {
        const c = item.data;
        return makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null, "comment");
      }
    });
  } else if (mode === "posts") {
    items = posts.map(p =>
      makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "", getImage(p), "post")
    );
  } else if (mode === "comments") {
    items = comments.map(c =>
      makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 120) ?? "", null, "comment")
    );
  }

  const isDark = document.documentElement.classList.contains("rpu-dark");

  const panel = document.createElement("div");
  panel.id = "rpu-panel";
  panel.__rpu_target = target;

  panel.innerHTML = `
    <div class="rpu-header">
      <button id="rpu-theme-btn">${isDark ? "☀️" : "🌙"}</button>
    </div>
    <div class="rpu-list visible">
      ${items.join("") || '<p class="rpu-empty">İçerik bulunamadı.</p>'}
    </div>
  `;

  panel.querySelector("#rpu-theme-btn")
    ?.addEventListener("click", (e) => toggleTheme(e.currentTarget));

  target.style.display = "none";
  target.parentElement.insertBefore(panel, target);
  attachScrollPagination(posts, comments, mode, username);
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
  window.dispatchEvent(new Event("locationchange"))
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