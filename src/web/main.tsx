import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

const element = document.getElementById("root");
if (!element) throw new Error("Application root is missing.");

const app = <StrictMode><App /></StrictMode>;
(import.meta.hot.data.root ??= createRoot(element)).render(app);
