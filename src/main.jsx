import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div style={{
      position: "fixed",
      top: "10px",
      right: "10px",
      background: "#000",
      color: "#fff",
      padding: "10px",
      zIndex: 999999
    }}>
      Extension enabled
    </div>
  );
}

createRoot(document.getElementById("extension-root")).render(<App />);