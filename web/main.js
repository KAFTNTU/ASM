import { createApp } from "./ui/app.js?v=mv1gqa5k";
const root = document.querySelector("#app");
if (!root)
    throw new Error("Missing #app root");
createApp(root);
