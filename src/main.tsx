import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SessionStoreProvider } from "./state/sessionStore";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionStoreProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </SessionStoreProvider>
  </React.StrictMode>
);
