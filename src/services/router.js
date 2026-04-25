export function parseRoute(pathname) {
  const match = pathname.match(/^\/user\/([^/]+)(?:\/([^/]*))?/);
  if (!match) return null;

  const section = match[2] || "";
  const mode = { "": "mixed", submitted: "posts", comments: "comments" }[section];
  if (!mode) return null;

  return { username: match[1], mode };
}

export function initRouter(onChange) {
  const patch = fn => function (...a) {
    fn.apply(history, a);
    window.dispatchEvent(new Event("locationchange"));
  };

  history.pushState    = patch(history.pushState);
  history.replaceState = patch(history.replaceState);

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

  window.addEventListener("locationchange", onChange);
}