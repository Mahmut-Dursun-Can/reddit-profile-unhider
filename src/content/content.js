import "../css/panel.css";

function getTarget() {
  const empty = document.getElementById("empty-feed-content");
  if (empty) return empty;

  const feed = document.querySelector("shreddit-feed");
  if (feed) return feed;

  return null;
}

function injectPanel(username, posts, comments, section) {
  const target = getTarget();
  if (!target) return;

  target.innerHTML = "";
  document.getElementById("rpu-panel")?.remove();

  const showPosts    = section === "" || section === "submitted";
  const showComments = section === "" || section === "comments";
  const mixedMode    = section === "";

  const toDate = ts => new Date(ts * 1000).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric"
  });

  const makeRow = (date, sub, url, text) => `
    <a href="${url}" target="_blank" class="rpu-row">
      <span class="rpu-date">${date}</span>
      <span class="rpu-sub">r/${sub}</span>
      <span class="rpu-text">${text}</span>
    </a>`;

  const postRows = posts.map(p =>
    makeRow(toDate(p.created_utc), p.subreddit, `https://reddit.com${p.permalink}`, p.title ?? "")
  ).join("");

  const commentRows = comments.map(c =>
    makeRow(toDate(c.created_utc), c.subreddit, `https://reddit.com${c.permalink}`, c.body?.slice(0, 100) ?? "")
  ).join("");

  const panel = document.createElement("div");
  panel.id = "rpu-panel";
  panel.innerHTML = `
    ${mixedMode ? `
      <div class="rpu-tabs">
        <button class="rpu-tab active" data-tab="posts">Postlar (${posts.length})</button>
        <button class="rpu-tab" data-tab="comments">Commentler (${comments.length})</button>
      </div>` : ""}

    ${showPosts ? `
      <div class="rpu-list visible" id="rpu-posts">
        ${postRows || '<div class="rpu-empty">Post bulunamadı.</div>'}
      </div>` : ""}

    ${showComments ? `
      <div class="rpu-list ${mixedMode ? "" : "visible"}" id="rpu-comments">
        ${commentRows || '<div class="rpu-empty">Comment bulunamadı.</div>'}
      </div>` : ""}
  `;

  panel.querySelectorAll(".rpu-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      panel.querySelectorAll(".rpu-tab").forEach(t => t.classList.remove("active"));
      panel.querySelectorAll(".rpu-list").forEach(l => l.classList.remove("visible"));
      btn.classList.add("active");
      panel.querySelector(`#rpu-${btn.dataset.tab}`).classList.add("visible");
    });
  });

  target.appendChild(panel);
}

function handleUser() {
  const match = location.pathname.match(/^\/user\/([^/]+)\/?([^/]*)?/);
  if (!match) return;

  const username = match[1];
  const section = match[2] || "";

  if (!["", "submitted", "comments"].includes(section)) return;

  chrome.runtime.sendMessage({ type: "FETCH_USER", username }, (res) => {
    if (chrome.runtime.lastError) {
      console.warn("[RPU] Runtime error:", chrome.runtime.lastError.message);
      return;
    }
    if (!res?.ok) {
      console.warn("[RPU] API hatası:", res?.error);
      return;
    }

    const tryInject = () => {
      if (getTarget()) {
        injectPanel(username, res.posts, res.comments, section);
      } else {
        setTimeout(tryInject, 300);
      }
    };
    tryInject();
  });
}

let _pushState = history.pushState;
history.pushState = function () {
  _pushState.apply(this, arguments);
  window.dispatchEvent(new Event("locationchange"));
};

window.addEventListener("locationchange", handleUser);
handleUser();