# 🎯 YouTube CPU Tamer – Hybrid Edition (Improved)

## 🧩 Overview

This userscript dramatically **reduces CPU usage** on YouTube and YouTube Music. It dynamically switches between `requestAnimationFrame` and `MutationObserver` based on tab visibility to optimize the behavior of timer APIs like `setTimeout`. The script also intelligently handles YouTube's SPA (Single Page Application) transitions to ensure continued stability and avoid freezes.

* ⚙️ **Hybrid trigger strategy**: Automatically switches based on visibility state
* 🔄 **SPA-aware repatching**: Uses `yt-navigate-finish` events and DOM observation for automatic recovery
* 🧠 **Minimum delay threshold**: Prevents interference with critical player functions
* 🧼 **Native timers from iframe**: Ensures a clean and safe execution context

---

## 🚀 How to Install

1. Install **[Violentmonkey](https://violentmonkey.github.io/)** or **[Tampermonkey](https://www.tampermonkey.net/)** in your browser
2. Add the script using the link below:
   👉 [Install this script](https://raw.githubusercontent.com/koyasi777/youtube-cpu-tamer-hybrid/main/youtube-cpu-tamer-hybrid.user.js)

---

## 📌 Supported Sites

* `https://www.youtube.com/`
* `https://music.youtube.com/`
* `https://www.youtube.com/embed/`
* `https://www.youtube-nocookie.com/embed/`

---

## 🔍 Technical Highlights

* 🎛 Wraps `setTimeout`/`setInterval` with hybrid throttling logic
* 👁 Uses `MutationObserver` in background tabs to reduce unnecessary CPU cycles
* 🔧 Repatches after SPA navigation using DOM monitoring and timeout fallback
* 🧪 Preserves `.toString()` on patched functions to prevent detection
* 🧼 Utilizes native timers from sandboxed iframe to avoid contamination

---

## 👨‍💻 Developer Notes

* Written in modern ES2020 JavaScript
* No pollution of global namespace
* Uses `@inject-into: page` for seamless integration with YouTube internals

---

## 📜 License

MIT License
You are free to use, modify, and redistribute this script at your own risk.

---

> 🎥 Enjoy a smoother YouTube experience with a quieter CPU.
