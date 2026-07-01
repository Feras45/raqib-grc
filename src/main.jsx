import React from "react";
import { createRoot } from "react-dom/client";
import App, { PublicUploadPage } from "./App.jsx";
import "./index.css";

// /u/<token> is the minimal PUBLIC external-upload page (no login, no app
// shell). Everything else boots the authenticated app.
const pub = window.location.pathname.match(/^\/u\/([A-Za-z0-9_-]{20,100})\/?$/);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {pub ? <PublicUploadPage token={pub[1]} /> : <App />}
  </React.StrictMode>
);
