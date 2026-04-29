import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Row({ item, iconMap }) {
  const isComment = item.type === "comment";
  const data = item.data;

  const url = `https://reddit.com${data.permalink}`;
  const iconUrl = iconMap?.[data.subreddit];

  function getImage() {
    if (data.preview?.images?.[0]?.source?.url)
      return data.preview.images[0].source.url.replace(/&amp;/g, "&");

    if (data.url && /\.(jpg|png|webp|gif)$/i.test(data.url))
      return data.url;

    return null;
  }

  const image = isComment ? null : getImage();

  const content = isComment ? data.body : data.selftext;

  return (
    <a
      className={`rpu-row rpu-${isComment ? "comment-row" : "post"}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="rpu-top">
        <div className="rpu-sub-info">
          {iconUrl ? (
            <img className="rpu-sub-icon" src={iconUrl} alt="" />
          ) : (
            <span className="rpu-sub-icon rpu-sub-icon--fallback">
              {data.subreddit?.[0]?.toUpperCase()}
            </span>
          )}
          <span className="rpu-sub">r/{data.subreddit}</span>
        </div>
      </div>

      {!isComment && data.title && (
        <div className="rpu-title">{data.title}</div>
      )}

      {content && (
        <div className="rpu-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      )}

      {image && (
        <img
          className="rpu-img"
          src={image}
          loading="lazy"
          alt=""
        />
      )}
    </a>
  );
}