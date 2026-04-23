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

/*
 * ── WAIT FOR STABLE TARGET ──
 *
 * Reddit SPA'nin iki aşamalı DOM'unu handle eder:
 *   Faz 1 – target Connected, ama parentElement henüz son haline gelmemiş.
 *   Faz 2 – target artık yerinde ve parentElement 500ms boyunca değişmedi.
 *
 * Eski hali: MutationObserver article varlığını görünce hemen callback'i tetikliyordu.
 * Yeni hali: target STABLE_MS boyunca aynı parentElement'e sahipken cb çağrılır.
 */
function waitForTarget(cb) {
  const STABLE_MS = 500;   // parentElement'in değişmeden beklenmesi gereken süre
  const TIMEOUT_MS = 5000; // maksimum toplam bekleme süresi
  let stableTimer = null;
  let totalTimer = null;
  let fired = false;

  function fire() {
    if (fired) return;
    fired = true;
    cleanup();
    cb();
  }

  function cleanup() {
    observer.disconnect();
    clearTimeout(stableTimer);
    clearTimeout(totalTimer);
  }

  function isReady() {
    if (document.getElementById("empty-feed-content")?.isConnected) return true;
    const feed = document.querySelector("shreddit-feed");
    return feed?.isConnected && feed.querySelectorAll("article").length > 0;
  }

  function checkStability() {
    if (!isReady()) return;

    const target = getTarget();
    if (!target?.parentElement) return;

    const snapshot = target.parentElement;

    clearTimeout(stableTimer);
    stableTimer = setTimeout(() => {
      // STABLE_MS sonra parentElement hâlâ aynı mı?
      if (getTarget()?.parentElement === snapshot) {
        fire();
      }
      // değiştiyse bir sonraki mutation tetikleyecek, beklemeye devam
    }, STABLE_MS);
  }

  const observer = new MutationObserver(checkStability);
  observer.observe(document.body, { childList: true, subtree: true });

  // Sayfa zaten hazırsa hemen stability check başlat
  checkStability();

  // Hard timeout – hiçbir şey olmazsa her halükârda dene
  totalTimer = setTimeout(() => {
    if (!fired) fire();
  }, TIMEOUT_MS);
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

/* ── POST SELFTEXT HTML ── */
function selftextHTML(p) {
  if (!p.selftext && !p.selftext_html) return "";
  return `
    <div class="rpu-selftext rpu-md">
      ${p.selftext_html ?? `<p>${p.selftext?.slice(0, 1500) ?? ""}${(p.selftext?.length ?? 0) > 1500 ? "…" : ""}</p>`}
    </div>
  `;
}

/* ── ROW ── */
function makeRow(date, sub, url, title, image, iconMap, post = null) {
  return `
    <div class="rpu-row" data-url="${url}">
      <div class="rpu-top">
        <div class="rpu-sub-info">
          ${subIconHTML(sub, iconMap)}
          <span class="rpu-sub">r/${sub}</span>
        </div>
        <span class="rpu-date">${date}</span>
      </div>

      <div class="rpu-title">${title}</div>

      ${post ? selftextHTML(post) : ""}

      ${image ? `<img class="rpu-img" src="${image}" />` : ""}
    </div>
  `;
}

/* ── BUILD ROWS ── */
function buildRows(posts, comments, mode, iconMap = {}) {
  const toDate = ts => {
    const locale = navigator.language || "en-US";
    return new Date(ts * 1000).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const searchVal = document.getElementById("rpu-search")?.value.trim() ?? "";

  if (searchVal) {
    return posts.map(p =>
      makeRow(
        toDate(p.created_utc), p.subreddit,
        `https://reddit.com${p.permalink}`,
        p.title ?? "", getImage(p), iconMap,
        p
      )
    );
  }

  if (mode === "mixed") {
    return mergeFeed(posts, comments).map(item => {
      if (item.type === "post") {
        const p = item.data;
        return makeRow(
          toDate(p.created_utc), p.subreddit,
          `https://reddit.com${p.permalink}`,
          p.title ?? "", getImage(p), iconMap,
          p
        );
      } else {
        const c = item.data;
        return makeRow(
          toDate(c.created_utc), c.subreddit,
          `https://reddit.com${c.permalink}`,
          c.body_html
            ? `<div class="rpu-md">${c.body_html}</div>`
            : (c.body?.slice(0, 500) ?? ""),
          null, iconMap, null
        );
      }
    });
  } else if (mode === "posts") {
    return posts.map(p =>
      makeRow(
        toDate(p.created_utc), p.subreddit,
        `https://reddit.com${p.permalink}`,
        p.title ?? "", getImage(p), iconMap,
        p
      )
    );
  } else if (mode === "comments") {
    return comments.map(c =>
      makeRow(
        toDate(c.created_utc), c.subreddit,
        `https://reddit.com${c.permalink}`,
        c.body_html
          ? `<div class="rpu-md">${c.body_html}</div>`
          : (c.body?.slice(0, 500) ?? ""),
        null, iconMap, null
      )
    );
  }

  return [];
}

/* ── REMOVE PANEL ── */
function removePanel() {
  const old = document.getElementById("rpu-panel");
  if (!old) return;

  // __rpu_target ref'i stale olabilir; önce DOM'dan bul, yoksa ref'e dön
  const hiddenTarget =
    (old.__rpu_target_id && document.getElementById(old.__rpu_target_id)) ||
    old.__rpu_target;

  if (hiddenTarget) hiddenTarget.style.display = "";
  old.remove();
}

/* ── SCROLL PAGINATION ── */
let scrollHandler = null;

function attachScrollPagination(mode, username, iconMap) {
  const panel = document.getElementById("rpu-panel");
  if (!panel) return;

  const list = panel.querySelector(".rpu-list");
  let loading = false;
  let exhausted = false;

  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler);
    scrollHandler = null;
  }

  const onScroll = async () => {
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
  };

  scrollHandler = onScroll;
  window.addEventListener("scroll", onScroll);
}

/* ── RENDER ── */
/*
 * scheduleRetry kaldırıldı.
 * waitForTarget zaten stability guarantee'si sağlıyor.
 * Kalan tek retry senaryosu: target connected ama parentElement null —
 * bu durumda waitForTarget'ın kendi TIMEOUT_MS fallback'i devreye girer.
 *
 * requestId kontrolü: injectPanel çağrısına giren requestId snapshot'ı
 * tüm async boundary'lerde korunuyor (closure + erken return).
 */
function injectPanel(posts, comments, mode, username, iconMap = {}, requestId = 0) {
  // Stale request kontrolü – waitForTarget callback dönmeden önce
  // yeni bir navigasyon olmuş olabilir
  if (requestId !== currentRequestId) return;

  removePanel();

  const target = getTarget();

  if (!target?.isConnected || !target.parentElement) {
    // Buraya düşmemeli (waitForTarget stability guarantee'si var)
    // ama son savunma hattı olarak yeniden bekle
    waitForTarget(() => {
      if (requestId !== currentRequestId) return;
      injectPanel(posts, comments, mode, username, iconMap, requestId);
    });
    return;
  }

  const isDark = document.documentElement.classList.contains("rpu-dark");
  const rows = buildRows(posts, comments, mode, iconMap);

  const panel = document.createElement("div");
  panel.id = "rpu-panel";
  panel.__rpu_target = target;
  // ID varsa hızlı DOM lookup için sakla, yoksa undefined kalır
  if (target.id) panel.__rpu_target_id = target.id;

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
        const searchRequestId = ++currentRequestId;

        chrome.runtime.sendMessage(
          { type: "FETCH_USER", username, query: q || undefined },
          async res => {
            if (!res?.ok || searchRequestId !== currentRequestId) return;

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

  if (!window.__rpu_click_bound) {
    window.__rpu_click_bound = true;

    document.addEventListener("click", (e) => {
      const row = e.target.closest(".rpu-row");
      if (!row) return;
      const url = row.dataset.url;
      if (url) window.open(url, "_blank");
    });
  }
}

/* ── MAIN ── */
function handleUser() {
  clearTimeout(handleUserTimer);
  handleUserTimer = setTimeout(_handleUser, 150);
}

async function _handleUser() {
  const match = location.pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
    console.log("[RPU] _handleUser", location.pathname, match);
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

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, async res => {
    if (!res?.ok || requestId !== currentRequestId) return;

    const subs = [
      ...res.posts.map(p => p.subreddit),
      ...res.comments.map(c => c.subreddit),
    ];

    const iconMap = await fetchIconMap(subs);

    waitForTarget(() => {
      // fetchIconMap async süresinde yeni nav geldiyse iptal et
      if (requestId !== currentRequestId) return;
      injectPanel(res.posts, res.comments, mode, username, iconMap, requestId);
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