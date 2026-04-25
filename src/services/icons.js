const subIconCache = {};

export async function fetchIconMap(subs) {
  const missing = [...new Set(subs)].filter(s => !(s in subIconCache));

  await Promise.all(
    missing.map(async sub => {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sub}/about.json`);
        const j = await r.json();
        const raw = j?.data?.community_icon || j?.data?.icon_img || "";
        subIconCache[sub] = raw.replace(/&amp;/g, "&").split("?")[0];
      } catch {
        subIconCache[sub] = "";
      }
    })
  );

  return Object.fromEntries(subs.map(s => [s, subIconCache[s] ?? ""]));
}