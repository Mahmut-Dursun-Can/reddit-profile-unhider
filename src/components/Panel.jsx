import { useState, useEffect, useRef, useCallback } from "react";
import Row from "./Row.jsx";
import SearchBar from "./SearchBar.jsx";
import { fetchUser } from "../services/api.js";
import { fetchIconMap } from "../services/icons.js";

function normalizeItems(posts, comments, mode) {
  if (mode === "posts") {
    return posts.map(p => ({ type: "post", data: p }));
  }
  if (mode === "comments") {
    return comments.map(c => ({ type: "comment", data: c }));
  }
  return [
    ...posts.map(p => ({ type: "post", data: p })),
    ...comments.map(c => ({ type: "comment", data: c })),
  ].sort((a, b) => b.data.created_utc - a.data.created_utc);
}

export default function Panel({ initialPosts, initialComments, mode, username, initialIconMap }) {
  const [items, setItems] = useState(() =>
    normalizeItems(initialPosts, initialComments, mode)
  );
  const [iconMap, setIconMap] = useState(initialIconMap);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const oldestTsRef = useRef(null);
  const loadingRef  = useRef(false);

  useEffect(() => {
    const all = [...initialPosts, ...initialComments];
    if (all.length) {
      oldestTsRef.current = Math.min(...all.map(x => x.created_utc));
    }
  }, []);

  async function handleSearch(query) {
    try {
      const res = await fetchUser(username, query ? { query } : {});
      const posts    = res.posts    ?? [];
      const comments = res.comments ?? [];

      const subs = [
        ...posts.map(p => p.subreddit),
        ...comments.map(c => c.subreddit),
      ];

      if (subs.length) {
        const newIconMap = await fetchIconMap(subs);
        setIconMap(prev => ({ ...prev, ...newIconMap }));
      }

      setItems(normalizeItems(posts, query ? [] : comments, query ? "posts" : mode));
      setExhausted(false);

      const allTs = [...posts, ...comments].map(x => x.created_utc);
      oldestTsRef.current = allTs.length ? Math.min(...allTs) : null;
    } catch (err) {
      console.error("[RPU] search error", err);
    }
  }

  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const searchVal = document.getElementById("rpu-search")?.value.trim() ?? "";
      const res = await fetchUser(username, {
        before: oldestTsRef.current ?? undefined,
        ...(searchVal && { query: searchVal }),
      });

      const newPosts    = res.posts    ?? [];
      const newComments = res.comments ?? [];

      if (!newPosts.length && !newComments.length) {
        setExhausted(true);
        return;
      }

      const subs = [
        ...newPosts.map(p => p.subreddit),
        ...newComments.map(c => c.subreddit),
      ];
      const newIconMap = await fetchIconMap(subs);
      setIconMap(prev => ({ ...prev, ...newIconMap }));

      const allTs = [...newPosts, ...newComments].map(x => x.created_utc);
      oldestTsRef.current = Math.min(oldestTsRef.current ?? Infinity, ...allTs);

      setItems(prev => [
        ...prev,
        ...normalizeItems(newPosts, newComments, mode),
      ]);
    } catch (err) {
      console.error("[RPU] pagination error", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [username, mode, exhausted]);

  useEffect(() => {
    const onScroll = () => {
      const panel = document.getElementById("rpu-panel");
      if (!panel) return;
      const bottom = panel.getBoundingClientRect().bottom;
      if (bottom <= window.innerHeight + 300) loadMore();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  return (
    <div id="rpu-panel">
      <SearchBar onSearch={handleSearch} />
      <div className="rpu-list visible">
        {items.map((item, i) => (
          <Row key={`${item.type}-${item.data.id ?? i}`} item={item} iconMap={iconMap} />
        ))}
        {loading && (
          <div className="rpu-empty">Loading…</div>
        )}
        {exhausted && !loading && (
          <div className="rpu-empty">There is no other content.</div>
        )}
      </div>
    </div>
  );
}