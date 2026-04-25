import "../css/panel.css";
import { fetchUser } from "../services/api.js";
import { fetchIconMap } from "../services/icons.js";
import { parseRoute, initRouter } from "../services/router.js";
import { mountPanel, unmountPanel } from "../components/PanelMount.jsx";

let debounceTimer = null;
let currentRunId  = 0;

function handleLocationChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 300);
}

async function run() {
  const runId = ++currentRunId;

  const route = parseRoute(location.pathname);

  if (!route) {
    unmountPanel();
    return;
  }

  const { username, mode } = route;

  try {
    const res = await fetchUser(username);
    if (runId !== currentRunId) return;

    const subs = [
      ...res.posts.map(p => p.subreddit),
      ...res.comments.map(c => c.subreddit),
    ];
    const iconMap = await fetchIconMap(subs);
    if (runId !== currentRunId) return;

    mountPanel({ posts: res.posts, comments: res.comments, mode, username, iconMap });
  } catch (err) {
    if (runId !== currentRunId) return;
    console.error("[RPU] fetch error", err);
  }
}

initRouter(handleLocationChange);
handleLocationChange();