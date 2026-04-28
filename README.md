# Reddit Profile Unhider

## About
A browser extension that enables users to view hidden posts and comments on Reddit profiles
Some Reddit users hide their profiles via settings, assuming their content is no longer accessible. This extension retrieves publicly archived versions of that content via external services.


## 🧠 How It Works

The extension sends requests to the Arctic Photon API to fetch archived Reddit data.

It then injects the retrieved content into the /user/${username} endpoint page using DOM manipulation, making hidden or non-visible content accessible within the Reddit interface.

## 🛡️ Privacy

This extension does not collect, store, or process any personal user data.

All requests are made directly from the client (browser) to the Arctic Photon API. The extension only constructs request URLs and forwards them without intercepting or persisting any data.

No backend server is used, and no data is stored locally or remotely by this extension.

The extension does not use cookies, tracking scripts, or analytics

No authentication or sensitive information is required.

## ⚠️ Disclaimer

This project uses publicly available archived data.

It does not bypass Reddit authentication or access private data. All retrieved content is sourced from external archives.

This project is not affiliated with Reddit.

## 🤝 Acknowledgements
Special thanks to the Arctic Photon for providing this service.

## ⚙️ Requirements
```
Node.js 20.20.0
npm 10.8.2
Vite 8.0.9
```
## Build Instructions
```
cd reddit-profile-unhider
```

## Install dependencies
```
npm install
```
## Build the project (Vite bundler is used)
```
npm run build
```