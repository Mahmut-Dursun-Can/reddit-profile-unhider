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

/* ── SUB ICON ── */
function subIconHTML(sub, iconMap) {
  const url = iconMap?.[sub];

  return url
    ? `<img class="rpu-sub-icon" src="${url}" />`
    : `<span class="rpu-sub-icon rpu-sub-icon--fallback">${sub[0].toUpperCase()}</span>`;
}

/* ── SELF TEXT ── */
function selftextHTML(p) {
  if (!p.selftext && !p.selftext_html) return "";

  return `
    <div class="rpu-selftext">
      ${
        p.selftext_html ??
        (p.selftext
          ? `<p>${p.selftext.slice(0, 1500)}${p.selftext.length > 1500 ? "…" : ""}</p>`
          : "")
      }
    </div>
  `;
}

/* ── ROW ── */
function makeRow(date, sub, url, title, body, image, iconMap, type = "post") {
  return `
    <div class="rpu-row rpu-${type}" data-url="${url}">

      <div class="rpu-top">
        <div class="rpu-sub-info">
          ${subIconHTML(sub, iconMap)}
          <span class="rpu-sub">r/${sub}</span>
        </div>
        <span class="rpu-date">${date}</span>
      </div>

      <div class="rpu-title">${title}</div>

      ${body ? `<div class="${type === "comment" ? "rpu-comment" : ""}">${body}</div>` : ""}

      ${image ? `<img class="rpu-img" src="${image}" />` : ""}
    </div>
  `;
}

/* ── BUILD ROWS ── */
function buildRows(posts, comments, mode, iconMap) {
  const toDate = ts =>
    new Date(ts * 1000).toLocaleDateString(navigator.language, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  const searchVal = document.getElementById("rpu-search")?.value.trim();

  if (searchVal) {
    return posts.map(p =>
      makeRow(
        toDate(p.created_utc),
        p.subreddit,
        `https://reddit.com${p.permalink}`,
        p.title,
        selftextHTML(p),
        getImage(p),
        iconMap,
        "post"
      )
    );
  }

  if (mode === "mixed") {
    return [...posts.map(p => ({
      type: "post",
      data: p
    })), ...comments.map(c => ({
      type: "comment",
      data: c
    }))].sort((a, b) => b.data.created_utc - a.data.created_utc)
      .map(item => {
        if (item.type === "post") {
          const p = item.data;

          return makeRow(
            toDate(p.created_utc),
            p.subreddit,
            `https://reddit.com${p.permalink}`,
            p.title,
            selftextHTML(p),
            getImage(p),
            iconMap,
            "post"
          );
        }

        const c = item.data;

        return makeRow(
          toDate(c.created_utc),
          c.subreddit,
          `https://reddit.com${c.permalink}`,
          "",
          c.body_html
            ? `<div class="rpu-md">${c.body_html}</div>`
            : (c.body?.slice(0, 500) ?? ""),
          null,
          iconMap,
          "comment"
        );
      });
  }

  if (mode === "posts") {
    return posts.map(p =>
      makeRow(
        toDate(p.created_utc),
        p.subreddit,
        `https://reddit.com${p.permalink}`,
        p.title,
        selftextHTML(p),
        getImage(p),
        iconMap,
        "post"
      )
    );
  }

  if (mode === "comments") {
    return comments.map(c =>
      makeRow(
        toDate(c.created_utc),
        c.subreddit,
        `https://reddit.com${c.permalink}`,
        "",
        c.body_html
          ? `<div class="rpu-md">${c.body_html}</div>`
          : (c.body?.slice(0, 500) ?? ""),
        null,
        iconMap,
        "comment"
      )
    );
  }

  return [];
}

/* ── PANEL ── */
function removePanel() {
  document.getElementById("rpu-panel")?.remove();
}

/* ── RENDER ── */
function injectPanel(posts, comments, mode, username, iconMap, requestId = 0) {
  if (requestId !== currentRequestId) return;

  removePanel();

  const target = getTarget();
  if (!target?.parentElement) return;

  const isDark = document.documentElement.classList.contains("rpu-dark");

  const panel = document.createElement("div");
  panel.id = "rpu-panel";

  panel.innerHTML = `
    <div class="rpu-header">
      <input id="rpu-search" placeholder="Search" />
      <button id="rpu-theme-btn">${isDark ? "☀️" : "🌙"}</button>
    </div>

    <div class="rpu-list visible">
      ${buildRows(posts, comments, mode, iconMap).join("")}
    </div>
  `;

  panel.querySelector("#rpu-theme-btn")
    ?.addEventListener("click", e => toggleTheme(e.currentTarget));

  panel.querySelector("#rpu-search")
    ?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;

      e.preventDefault();

      const q = e.target.value.trim();

      const requestId = ++currentRequestId;

      chrome.runtime.sendMessage(
        { type: "FETCH_USER", username, query: q || undefined },
        async res => {
          if (!res?.ok || requestId !== currentRequestId) return;

          const subs = [
            ...res.posts.map(p => p.subreddit),
            ...res.comments.map(c => c.subreddit)
          ];

          const iconMap = await fetchIconMap(subs);

          const list = panel.querySelector(".rpu-list");

          list.innerHTML = buildRows(
            res.posts,
            res.comments,
            mode,
            iconMap
          ).join("");
        }
      );
    });

panel.addEventListener("click", (e) => {
  const row = e.target.closest(".rpu-row");
  if (!row || !panel.contains(row)) return;

  const url = row.dataset.url;
  if (url) window.open(url, "_blank");
});

  target.style.display = "none";
  target.parentElement.insertBefore(panel, target);

    attachScrollPagination(mode, username, iconMap);
}

/* ── MAIN ── */
function handleUser() {
  clearTimeout(handleUserTimer);
  handleUserTimer = setTimeout(run, 150);
}

async function run() {
  const match = location.pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
  if (!match) return removePanel();

  const username = match[1];
  const section = match[2] || "";

  const mode = {
    "": "mixed",
    submitted: "posts",
    comments: "comments"
  }[section];

  if (!mode) return;

  const requestId = ++currentRequestId;

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, async res => {
    if (!res?.ok) return;

    const subs = [
      ...res.posts.map(p => p.subreddit),
      ...res.comments.map(c => c.subreddit)
    ];

    const iconMap = await fetchIconMap(subs);

    if (requestId !== currentRequestId) return;

    injectPanel(res.posts, res.comments, mode, username, iconMap, requestId);
  });
}

/* ── NAVIGATION ── */
const _push = history.pushState;
history.pushState = (...a) => {
  _push.apply(history, a);
  window.dispatchEvent(new Event("locationchange"));
};

const _replace = history.replaceState;
history.replaceState = (...a) => {
  _replace.apply(history, a);
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

/* ── SCROLL PAGINATION ── */
let scrollHandler = null;

function attachScrollPagination(mode, username, iconMap) {
  const panel = document.getElementById("rpu-panel");
  if (!panel) return;

  const list = panel.querySelector(".rpu-list");
  if (!list) return;

  let loading = false;
  let exhausted = false;

  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler);
    scrollHandler = null;
  }

  const onScroll = async () => {
    if (loading || exhausted) return;
    if (!panel.isConnected) return;

    const panelBottom = panel.getBoundingClientRect().bottom;
    if (panelBottom > window.innerHeight + 300) return;

    loading = true;
    const requestId = ++currentRequestId;
    const searchVal = panel.querySelector("#rpu-search")?.value.trim() ?? "";

    chrome.runtime.sendMessage(
      {
        type: "FETCH_USER",
        username,
        before: panel.__rpu_oldestTs,
        query: searchVal || undefined
      },
      async res => {
        if (!res?.ok || requestId !== currentRequestId) {
          loading = false;
          return;
        }

        const newPosts = res.posts ?? [];
        const newComments = res.comments ?? [];

        if (newPosts.length === 0 && newComments.length === 0) {
          exhausted = true;
          loading = false;
          return;
        }

        const subs = [
          ...newPosts.map(p => p.subreddit),
          ...newComments.map(c => c.subreddit)
        ];

        const newIconMap = await fetchIconMap(subs);
        Object.assign(iconMap, newIconMap);

        const allTs = [...newPosts, ...newComments].map(x => x.created_utc);
        panel.__rpu_oldestTs = Math.min(panel.__rpu_oldestTs ?? Infinity, ...allTs);

        const newRows = buildRows(newPosts, newComments, mode, iconMap);
        list.insertAdjacentHTML("beforeend", newRows.join(""));

        loading = false;
      }
    );
  };

  function removePanel() {
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }

    document.getElementById("rpu-panel")?.remove();
  }

  scrollHandler = onScroll;
  window.addEventListener("scroll", onScroll, { passive: true });
}

window.addEventListener("locationchange", handleUser);
handleUser();