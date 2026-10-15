import { createApp } from "./ui/app.js?v=mv1gzha8";
const root = document.querySelector("#app");
if (!root)
    throw new Error("Missing #app root");
createApp(root);
