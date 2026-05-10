import "./style.css";
import { createApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");

createApp(root);

