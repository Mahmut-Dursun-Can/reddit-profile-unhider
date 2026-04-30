import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";

export default function Row({ item, iconMap }) {
  const isComment = item.type === "comment";
  const data = item.data;
  const url = `https://reddit.com${data.permalink}`;
  const iconUrl = iconMap?.[data.subreddit];

  const rawContent = isComment ? data.body : data.selftext;

  function getImage() {
    if (data.preview?.images?.[0]?.source?.url)
      return data.preview.images[0].source.url.replace(/&amp;/g, "&");

    if (data.url && /\.(jpg|png|webp|gif)$/i.test(data.url))
      return data.url;

    return null;
  }

  const image = isComment ? null : getImage();

  const date = new Date(data.created_utc * 1000).toLocaleDateString(
    navigator.language,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

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
        <span className="rpu-date">{date}</span>
      </div>

      {!isComment && data.title && (
        <div className="rpu-title">{data.title}</div>
      )}

      {rawContent && (
        <div className="rpu-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSanitize,
              [rehypeExternalLinks, { target: "_blank", rel: "nofollow noopener" }]
            ]}
          >
            {rawContent}
          </ReactMarkdown>
        </div>
      )}

      {image && (
        <img className="rpu-img" src={image} loading="lazy" alt="" />
      )}
    </a>
  );
}