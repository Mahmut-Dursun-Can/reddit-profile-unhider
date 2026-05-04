chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "FETCH_USER") return;

  const base = "https://arctic-shift.photon-reddit.com/api/";
  const u = encodeURIComponent(msg.username);

  const before = msg.before ? `&before=${msg.before}` : "";

  const query = msg.query ? encodeURIComponent(msg.query) : "";

  const titleQ = query ? `&title=${query}` : "";
  const selftextQ = query ? `&selftext=${query}` : "";
  const bodyQ = query ? `&body=${query}` : "";

  Promise.allSettled([
    fetch(`${base}comments/search?author=${u}&limit=25${before}${bodyQ}`).then(r => r.json()),
    fetch(`${base}posts/search?author=${u}&limit=25${before}${titleQ}&over_18=false`).then(r => r.json()),
    fetch(`${base}posts/search?author=${u}&limit=25${before}${selftextQ}&over_18=false`).then(r => r.json())
  ])
    .then(results => {
      const [comments, posts, selftext, body] = results.map(r =>
        r.status === "fulfilled" ? r.value?.data ?? [] : []
      );

      sendResponse({
        ok: true,
        comments,
        posts,
        selftext
      });
    })
    .catch(err => {
      sendResponse({ ok: false, error: err.message });
    });

  return true;
});