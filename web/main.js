import { createApp } from "./ui/app.js?v=mvoawuqj";
const root = document.querySelector("#app");
if (!root)
    throw new Error("Missing #app root");
createApp(root);
