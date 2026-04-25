export default function Row({ item, iconMap }) {
  const isComment = item.type === "comment";
  const data = item.data;

  const date = new Date(data.created_utc * 1000).toLocaleDateString(navigator.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const url = `https://reddit.com${data.permalink}`;
  const iconUrl = iconMap?.[data.subreddit];

  function getImage() {
    if (data.preview?.images?.[0]?.source?.url)
      return data.preview.images[0].source.url.replace(/&amp;/g, "&");
    if (data.url && /\.(jpg|png|webp|gif)$/i.test(data.url))
      return data.url;
    if (data.thumbnail?.startsWith("http"))
      return data.thumbnail;
    return null;
  }

  const image = isComment ? null : getImage();

  return (
    <div
      className={`rpu-row rpu-${isComment ? "comment-row" : "post"}`}
      onClick={() => window.open(url, "_blank")}
    >
      <div className="rpu-top">
        <div className="rpu-sub-info">
          {iconUrl ? (
            <img className="rpu-sub-icon" src={iconUrl} alt="" />
          ) : (
            <span className="rpu-sub-icon rpu-sub-icon--fallback">
              {data.subreddit[0].toUpperCase()}
            </span>
          )}
          <span className="rpu-sub">r/{data.subreddit}</span>
        </div>
        <span className="rpu-date">{date}</span>
      </div>

      {!isComment && data.title && (
        <div className="rpu-title">{data.title}</div>
      )}

      {!isComment && (data.selftext || data.selftext_html) && (
        <div className="rpu-selftext">
          {data.selftext_html ? (
            <div dangerouslySetInnerHTML={{ __html: data.selftext_html }} />
          ) : (
            <p>
              {data.selftext.slice(0, 1500)}
              {data.selftext.length > 1500 ? "…" : ""}
            </p>
          )}
        </div>
      )}

      {isComment && (
        <div className="rpu-comment">
          {data.body_html ? (
            <div
              className="rpu-md"
              dangerouslySetInnerHTML={{ __html: data.body_html }}
            />
          ) : (
            <span>{data.body?.slice(0, 500) ?? ""}</span>
          )}
        </div>
      )}

      {image && (
        <img className="rpu-img" src={image} alt="" />
      )}
    </div>
  );
}