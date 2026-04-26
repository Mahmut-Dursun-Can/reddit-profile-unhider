import { createRoot } from "react-dom/client";
import Panel from "./Panel.jsx";

let currentRoot      = null;
let currentContainer = null;
let hiddenTarget     = null;
let targetObserver   = null;

export function mountPanel({ posts, comments, mode, username, iconMap }) {
  unmountPanel();

  tryMount({ posts, comments, mode, username, iconMap });
}

function tryMount(props, retries = 0) {
  const target = getTarget();

  if (!target?.parentElement) {
    if (retries >= 20) return;
    setTimeout(() => tryMount(props, retries + 1), 100);
    return;
  }

  const container = document.createElement("div");
  target.style.display = "none";
  hiddenTarget = target;
  target.parentElement.insertBefore(container, target);

  currentContainer = container;
  currentRoot = createRoot(container);
  currentRoot.render(
    <Panel
      initialPosts={props.posts}
      initialComments={props.comments}
      mode={props.mode}
      username={props.username}
      initialIconMap={props.iconMap}
    />
  );

  targetObserver = new MutationObserver(() => {
    if (hiddenTarget && !document.contains(hiddenTarget)) {
      targetObserver?.disconnect();
      targetObserver = null;
    }
  });
  targetObserver.observe(document.body, { childList: true, subtree: true });
}

export function unmountPanel() {
  targetObserver?.disconnect();
  targetObserver = null;

  if (currentRoot) {
    currentRoot.unmount();
    currentRoot = null;
  }
  if (currentContainer) {
    currentContainer.remove();
    currentContainer = null;
  }
  if (hiddenTarget) {
    if (document.contains(hiddenTarget)) {
      hiddenTarget.style.display = "";
    }
    hiddenTarget = null;
  }
}

function getTarget() {
  return (
    document.querySelector("shreddit-feed") ||
    document.getElementById("empty-feed-content") ||
    document.querySelector("[data-testid='post-container']")?.parentElement ||
    null
  );
}