// ==UserScript==
// @name         YouTube CPU Tamer – Hybrid Edition (Improved)
// @name:ja      YouTube CPU負荷軽減スクリプト – ハイブリッド方式（改良版）
// @name:en      YouTube CPU Tamer – Hybrid Edition (Improved)
// @name:zh-CN   YouTube CPU减负脚本 – 混合策略（改进版）
// @name:zh-TW   YouTube CPU負載減輕工具 – 混合策略（改良版）
// @name:ko      YouTube CPU 부하 감소 스크립트 – 하이브리드 방식(개선판)
// @name:fr      Réducteur de charge CPU YouTube – Édition Hybride (Améliorée)
// @name:es      Reductor de carga de CPU para YouTube – Edición Híbrida (Mejorada)
// @name:de      YouTube CPU-Last-Reduzierer – Hybrid-Edition (Verbessert)
// @name:pt-BR   Redutor de uso da CPU no YouTube – Edição Híbrida (Aprimorada)
// @name:ru      Снижение нагрузки на CPU в YouTube – Гибридная версия (Улучшенная)
// @version      4.01
// @description         Reduce CPU load on YouTube using hybrid DOMMutation + AnimationFrame strategy with dynamic switching and delay correction
// @description:ja      DOM変化とrequestAnimationFrameを組み合わせたハイブリッド戦略でYouTubeのCPU負荷を大幅軽減！遅延補正＆動的切替も搭載。
// @description:en      Reduce CPU load on YouTube using hybrid DOMMutation + AnimationFrame strategy with dynamic switching and delay correction
// @description:zh-CN   使用混合DOMMutation和requestAnimationFrame策略动态切换并校正延迟，降低YouTube的CPU负载
// @description:zh-TW   採用混合DOMMutation與requestAnimationFrame策略，動態切換並修正延遲，降低YouTube的CPU負載
// @description:ko      DOM 변화 감지 + 애니메이션 프레임 전략으로 YouTube CPU 부하 감소, 지연 보정 및 동적 전환 포함
// @description:fr      Réduisez la charge CPU de YouTube avec une stratégie hybride DOMMutation + AnimationFrame, avec commutation dynamique et correction du délai
// @description:es      Reduce la carga de CPU en YouTube mediante una estrategia híbrida de DOMMutation y AnimationFrame, con conmutación dinámica y corrección de retrasos
// @description:de      Reduzieren Sie die CPU-Last von YouTube mit einer hybriden DOMMutation + AnimationFrame-Strategie mit dynamischem Wechsel und Verzögerungskorrektur
// @description:pt-BR   Reduza o uso da CPU no YouTube com uma estratégia híbrida DOMMutation + AnimationFrame com troca dinâmica e correção de atraso
// @description:ru      Снижение нагрузки на CPU в YouTube с помощью гибридной стратегии DOMMutation + requestAnimationFrame с динамическим переключением и коррекцией задержки
// @namespace    https://github.com/koyasi777/youtube-cpu-tamer-hybrid
// @author       koyasi777
// @match        https://www.youtube.com/*
// @match        https://www.youtube.com/embed/*
// @match        https://www.youtube-nocookie.com/embed/*
// @match        https://music.youtube.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @homepageURL  https://github.com/koyasi777/youtube-cpu-tamer-hybrid
// @supportURL   https://github.com/koyasi777/youtube-cpu-tamer-hybrid/issues
// @downloadURL https://update.greasyfork.org/scripts/533807/YouTube%20CPU%20Tamer%20%E2%80%93%20Hybrid%20Edition%20%28Improved%29.user.js
// @updateURL https://update.greasyfork.org/scripts/533807/YouTube%20CPU%20Tamer%20%E2%80%93%20Hybrid%20Edition%20%28Improved%29.meta.js
// ==/UserScript==

(() => {
  "use strict";

  /**
   * Guard – avoid double‑instantiation on SPA navigation
   */
  const FLAG = "__yt_cpu_tamer_hybrid_running__";
  if (window[FLAG]) return;
  window[FLAG] = true;

  /*************************************************************************
   * Helpers
   *************************************************************************/
  const nextAnimationFrame = () => new Promise(r => requestAnimationFrame(r));

  const waitForDocReady = async () => {
    while (!document.documentElement || !document.head) {
      await nextAnimationFrame();
    }
  };

  /**
   * A thin extended‑Promise that exposes resolve()/reject() – convenient for
   * bridging observer + rAF based triggers without extra closures.
   */
  const PromiseExt = (() => {
    let _res, _rej;
    const shim = (r, j) => {
      _res = r;
      _rej = j;
    };
    return class extends Promise {
      constructor(cb = shim) {
        super(cb);
        if (cb === shim) {
          /** @type {(value?: unknown) => void} */
          // @ts-ignore – dynamically injected
          this.resolve = _res;
          /** @type {(reason?: any) => void} */
          // @ts-ignore
          this.reject = _rej;
        }
      }
    };
  })();

  /*************************************************************************
   * Main
   *************************************************************************/
  const setup = async () => {
    await waitForDocReady();

    /***** 1. Create helper iframe that owns lightweight timers *****/
    const FRAME_ID = "yt-cpu-tamer-timer-frame";
    let frame = document.getElementById(FRAME_ID);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = FRAME_ID;
      frame.style.display = "none";
      // Allow both same‑origin and script execution so that callbacks routed
      // through the iframe don’t hit the Chrome sandbox error.
      frame.sandbox = "allow-same-origin allow-scripts";
      // Use srcdoc to keep the iframe same‑origin (& blank) in all browsers.
      frame.srcdoc = "<!doctype html><title>yt-cpu-tamer</title>";
      document.documentElement.appendChild(frame);
    }
    // Wait until the inner window is ready.
    while (!frame.contentWindow) {
      await nextAnimationFrame();
    }

    const {
      requestAnimationFrame: frameRAF,
      setTimeout: frameSetTimeout,
      setInterval: frameSetInterval,
      clearTimeout: frameClearTimeout,
      clearInterval: frameClearInterval
    } = /** @type {Window & typeof globalThis} */ (frame.contentWindow);

    /***** 2. Trigger generator – rAF when visible, MutationObserver otherwise *****/
    const dummy = document.createElement("div");
    dummy.style.display = "none";
    document.documentElement.appendChild(dummy);

    /** @returns {(cb: () => void) => Promise<void>} */
    const makeHybridTrigger = () => {
      if (document.visibilityState === "visible") {
        return cb => {
          const p = new PromiseExt();
          requestAnimationFrame(p.resolve);
          return p.then(cb);
        };
      } else {
        return cb => {
          const p = new PromiseExt();
          const MO = new MutationObserver(() => {
            MO.disconnect();
            p.resolve();
          });
          MO.observe(dummy, { attributes: true });
          dummy.setAttribute("data-yt-cpu-tamer", Math.random().toString(36));
          return p.then(cb);
        };
      }
    };

    /** @type {(cb: () => void) => Promise<void>} */
    let currentTrigger = makeHybridTrigger();
    document.addEventListener("visibilitychange", () => {
      currentTrigger = makeHybridTrigger();
    });

    /***** 3. Timer patching *****/
    const activeTimeouts = new Set();
    const activeIntervals = new Set();

    /**
     * Wrap native timer so that:
     *   – scheduling is done with *iframe* timers (very cheap)
     *   – execution is throttled by currentTrigger
     *   – callback runs in the *main* window realm (fn.apply(window,…))
     */
    const makeTimer = (nativeTimer, pool) => {
      return function patchedTimer(fn, delay = 0, ...args) {
        if (typeof fn !== "function") return nativeTimer(fn, delay, ...args);
        const id = nativeTimer(() => {
          currentTrigger(() => fn.apply(window, args));
        }, delay);
        pool.add(id);
        return id;
      };
    };

    const makeClear = (nativeClear, pool) => id => {
      if (pool.has(id)) pool.delete(id);
      nativeClear(id);
    };

    /**
     * Apply / re‑apply the patches (re‑applied on yt‑navigate‑finish).
     */
    const patchTimers = () => {
      window.setTimeout = makeTimer(frameSetTimeout, activeTimeouts);
      window.setInterval = makeTimer(frameSetInterval, activeIntervals);
      window.clearTimeout = makeClear(frameClearTimeout, activeTimeouts);
      window.clearInterval = makeClear(frameClearInterval, activeIntervals);

      // Align Function.prototype.toString() so that devtools show native code
      const mirrorToString = (patched, native) => {
        try {
          patched.toString = native.toString.bind(native);
        } catch {/* ignore */}
      };
      mirrorToString(window.setTimeout, frameSetTimeout);
      mirrorToString(window.setInterval, frameSetInterval);
      mirrorToString(window.clearTimeout, frameClearTimeout);
      mirrorToString(window.clearInterval, frameClearInterval);

      console.log("[YouTube CPU Tamer – Hybrid Edition] Timers patched");
    };

    // Initial patch (DOMContentLoaded OR immediate if already interactive).
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", patchTimers, { once: true });
    } else {
      patchTimers();
    }

    /***** 4. Re‑patch on SPA navigations *****/
    window.addEventListener("yt-navigate-finish", () => {
      console.log("[YouTube CPU Tamer] yt-navigate-finish – re‑applying patch");
      patchTimers();
    });
  };

  setup().catch(err => console.error("[YouTube CPU Tamer] setup failed", err));
})();
