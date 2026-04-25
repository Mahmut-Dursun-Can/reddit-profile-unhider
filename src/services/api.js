export function fetchUser(username, opts = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "FETCH_USER", username, ...opts },
      res => {
        if (res?.ok) resolve(res);
        else reject(new Error(res?.error ?? "Unknown error"));
      }
    );
  });
}