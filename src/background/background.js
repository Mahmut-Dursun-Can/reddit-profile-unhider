chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "FETCH_USER") return;

  const base = "https://arctic-shift.photon-reddit.com/api/";
  const u = encodeURIComponent(msg.username);
  const before = msg.before ? `&before=${msg.before}` : "";
  const titleQ = msg.query ? `&title=${encodeURIComponent(msg.query)}` : "";

  Promise.all([
    fetch(base + "comments/search?author=" + u + "&limit=25" + before).then(r => r.json()),
    fetch(base + "posts/search?author=" + u + "&limit=25" + before + titleQ).then(r => r.json())
  ])
    .then(([comments, posts]) => sendResponse({
      ok: true,
      comments: comments?.data ?? [],
      posts: posts?.data ?? []
    }))
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true;
});