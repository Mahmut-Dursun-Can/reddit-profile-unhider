import { useState, useEffect, useRef, useCallback } from "react";
import Row from "./Row.jsx";
import SearchBar from "./SearchBar.jsx";
import { fetchUser } from "../services/api.js";
import { fetchIconMap } from "../services/icons.js";

function normalizeItems(posts, comments, mode) {
  if (mode === "posts") return posts.map(p => ({ type: "post", data: p }));
  if (mode === "comments") return comments.map(c => ({ type: "comment", data: c }));

  return [...posts, ...comments]
    .map(x => ({
      type: x.body ? "comment" : "post",
      data: x
    }))
    .sort((a, b) => b.data.created_utc - a.data.created_utc);
}

export default function Panel({ initialPosts, initialComments, mode, username, initialIconMap }) {
  const [items, setItems] = useState(() =>
    normalizeItems(initialPosts, initialComments, mode)
  );

  const [iconMap, setIconMap] = useState(initialIconMap);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [search, setSearch] = useState("");

  const oldestTsRef = useRef(null);
  const loadingRef = useRef(false);
  const seenRef = useRef(new Set()); // global dedupe

  useEffect(() => {
    const all = [...initialPosts, ...initialComments];

    if (all.length) {
      oldestTsRef.current = Math.min(...all.map(x => x.created_utc));
      all.forEach(x => seenRef.current.add(x.id));
    }
  }, [initialPosts, initialComments]);

  async function handleSearch(query) {
    setSearch(query);

    const res = await fetchUser(username, query ? { query } : {});
    const comments = res.comments ?? [];

    const posts = [...(res.posts ?? []), ...(res.selftext ?? []), ...(res.body ?? [])]
      .filter(p => {
        if (seenRef.current.has(p.id)) return false;
        seenRef.current.add(p.id);
        return true;
      });

    const subs = [...posts, ...comments].map(x => x.subreddit);

    if (subs.length) {
      const newIcons = await fetchIconMap(subs);
      setIconMap(prev => ({ ...prev, ...newIcons }));
    }

    setItems(normalizeItems(posts, comments, query ? "posts" : mode));
    setExhausted(false);

    const allTs = [...posts, ...comments].map(x => x.created_utc);
    oldestTsRef.current = allTs.length ? Math.min(...allTs) : null;
  }

  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const res = await fetchUser(username, {
        before: oldestTsRef.current ?? undefined,
        ...(search && { query: search })
      });

      const newPosts = [...(res.posts ?? []), ...(res.selftext ?? []), ...(res.body ?? [])]
        .filter(p => {
          if (seenRef.current.has(p.id)) return false;
          seenRef.current.add(p.id);
          return true;
        });

      const newComments = (res.comments ?? []).filter(c => {
        if (seenRef.current.has(c.id)) return false;
        seenRef.current.add(c.id);
        return true;
      });

      if (!newPosts.length && !newComments.length) {
        setExhausted(true);
        return;
      }

      const subs = [...newPosts, ...newComments].map(x => x.subreddit);
      const newIcons = await fetchIconMap(subs);
      setIconMap(prev => ({ ...prev, ...newIcons }));

      const allTs = [...newPosts, ...newComments].map(x => x.created_utc);
      if (allTs.length) {
        oldestTsRef.current = Math.min(oldestTsRef.current ?? Infinity, ...allTs);
      }

      setItems(prev => [
        ...prev,
        ...normalizeItems(newPosts, newComments, mode)
      ].slice(-500)); // prevent memory growth

    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [username, mode, exhausted, search]);

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
        {items.map(item => (
          <Row key={item.data.id} item={item} iconMap={iconMap} />
        ))}
        {loading && <div className="rpu-empty">Loading…</div>}
        {exhausted && !loading && <div className="rpu-empty">No more content</div>}
      </div>
    </div>
  );
}