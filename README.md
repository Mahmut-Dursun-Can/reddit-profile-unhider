# Reddit Profile Unhider

## About
A browser extension that enables users to view hidden posts and comments on Reddit profiles
Some Reddit users hide their profiles via settings, assuming their content is no longer accessible. This extension retrieves publicly archived versions of that content via external services.


## 🧠 How It Works

The extension sends requests to the Arctic Photon API to fetch archived Reddit data.

It then injects the retrieved content into the /user/${username} endpoint page using DOM manipulation, making hidden or non-visible content accessible within the Reddit interface.

## 🔐 Privacy

This extension does not collect, store, or share any personal user data.

All requests are made directly to the Arctic Photon API to fetch publicly available archived Reddit content.

No authentication or sensitive information is required.

## ⚠️ Disclaimer

This project uses publicly available archived data.

It does not bypass Reddit authentication or access private data. All retrieved content is sourced from external archives.

This project is not affiliated with Reddit.


Special thanks to the Arctic Photon for providing this service.