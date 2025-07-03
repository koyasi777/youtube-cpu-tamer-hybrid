// ==UserScript==
// @name              YouTube CPU Tamer – Hybrid Edition
// @name:ja           YouTube CPU負荷軽減スクリプト – ハイブリッド方式
// @name:en           YouTube CPU Tamer – Hybrid Edition
// @name:zh-CN        YouTube CPU减负脚本 – 混合策略
// @name:zh-TW        YouTube CPU負載減輕工具 – 混合策略
// @name:ko           YouTube CPU 부하 감소 스크립트 – 하이브리드 방식
// @name:fr           Réducteur de charge CPU YouTube – Édition Hybride
// @name:es           Reductor de carga de CPU para YouTube – Edición Híbrida
// @name:de           YouTube CPU-Last-Reduzierer – Hybrid-Edition
// @name:pt-BR        Redutor de uso da CPU no YouTube – Edição Híbrida
// @name:ru           Снижение нагрузки на CPU в YouTube – Гибридная версия
// @version           4.90
// @description       Dramatically reduces CPU usage on YouTube by intelligently throttling timers, while protecting critical player functions to prevent freezing.
// @description:ja    YouTubeのCPU負荷を劇的に削減します。動画プレイヤーの重要機能を保護し、無限ロードなどのフリーズ現象を防止する安定性重視の設計です。
// @description:en    Dramatically reduces CPU usage on YouTube by intelligently throttling timers, while protecting critical player functions to prevent freezing.
// @description:zh-CN 通过智能节流计时器，显著降低YouTube的CPU使用率，同时保护关键播放器功能以防冻结。
// @description:zh-TW 透過智慧節流計時器，顯著降低YouTube的CPU使用率，同時保護關鍵播放器功能以防凍結。
// @description:ko    타이머를 지능적으로 조절하여 YouTube의 CPU 사용량을 크게 줄이고, 중요한 플레이어 기능을 보호하여 멈춤 현상을 방지합니다.
// @description:fr    Réduit considérablement l'utilisation du CPU sur YouTube en régulant intelligemment les minuteurs, tout en protégeant les fonctions critiques du lecteur pour éviter les blocages.
// @description:es    Reduce drásticamente el uso de la CPU en YouTube al regular inteligentemente los temporizadores, protegiendo las funciones críticas del reproductor para evitar congelaciones.
// @description:de    Reduziert die CPU-Auslastung auf YouTube drastisch durch intelligentes Drosseln von Timern, während kritische Player-Funktionen geschützt werden, um ein Einfrieren zu verhindern.
// @description:pt-BR Reduz drasticamente o uso da CPU no YouTube ao limitar inteligentemente os temporizadores, protegendo as funções críticas do player para evitar congelamentos.
// @description:ru    Значительно снижает нагрузку на процессор на YouTube за счет интеллектуального регулирования таймеров, защищая при этом критически важные функции плеера для предотвращения зависаний.
// @namespace         https://github.com/koyasi777/youtube-cpu-tamer-hybrid
// @author            koyasi777
// @match             https://www.youtube.com/*
// @match             https://www.youtube.com/embed/*
// @match             https://www.youtube-nocookie.com/embed/*
// @match             https://music.youtube.com/*
// @run-at            document-start
// @grant             none
// @inject-into       page
// @license           MIT
// @icon              https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @homepageURL       https://github.com/koyasi777/youtube-cpu-tamer-hybrid
// @supportURL        https://github.com/koyasi777/youtube-cpu-tamer-hybrid/issues
// @downloadURL       https://update.greasyfork.org/scripts/533807/YouTube%20CPU%20Tamer%20%E2%80%93%20Hybrid%20Edition%20%28Improved%29.user.js
// @updateURL         https://update.greasyfork.org/scripts/533807/YouTube%20CPU%20Tamer%20%E2%80%93%20Hybrid%20Edition%20%28Improved%29.meta.js
// ==/UserScript==

(() => {
  "use strict";

  // --- 設定値 ---
  const MIN_DELAY_THRESHOLD = 250;
  const PLAYER_READY_SELECTOR = "#movie_player .ytp-chrome-bottom"; // プレイヤー準備完了を判断するためのDOMセレクタ
  const REPATCH_TIMEOUT = 10000; // プレイヤーを検出できなかった場合に再パッチするまでの最大待機時間(ms)

  // --- スクリプトの初期化と多重実行防止 ---
  const FLAG = "__yt_cpu_tamer_hybrid_running__";
  if (window[FLAG]) return;
  window[FLAG] = true;

  // --- 非同期ヘルパー関数 ---
  const nextAnimationFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitForDocReady = async () => {
    while (!document.documentElement || !document.head) {
      await nextAnimationFrame();
    }
  };

  const PromiseExt = (() => {
    let _res, _rej;
    const shim = (r, j) => { _res = r; _rej = j; };
    return class extends Promise {
      constructor(cb = shim) { super(cb); if (cb === shim) { this.resolve = _res; this.reject = _rej; } }
    };
  })();

  const setup = async () => {
    await waitForDocReady();

    // --- 1. ネイティブタイマーAPIの安全な取得 ---
    const FRAME_ID = "yt-cpu-tamer-timer-frame";
    let frame = document.getElementById(FRAME_ID);
    if (frame && (!frame.contentWindow || !frame.contentWindow.setTimeout)) {
      frame.remove();
      frame = null;
    }
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = FRAME_ID;
      frame.style.display = "none";
      frame.sandbox = "allow-same-origin allow-scripts";

      // --- Trusted Types対応 ---
      const frameHTML = "<!doctype html><title>yt-cpu-tamer-timer-provider</title>";
      if (window.trustedTypes && window.trustedTypes.createPolicy) {
          const policy = window.trustedTypes.createPolicy('youtube-cpu-tamer-policy', {
              createHTML: (input) => input
          });
          frame.srcdoc = policy.createHTML(frameHTML);
      } else {
          frame.srcdoc = frameHTML;
      }

      document.documentElement.appendChild(frame);
    }
    while (!frame.contentWindow || !frame.contentWindow.setTimeout) {
      await nextAnimationFrame();
    }

    const nativeTimers = {
      setTimeout: frame.contentWindow.setTimeout.bind(frame.contentWindow),
      setInterval: frame.contentWindow.setInterval.bind(frame.contentWindow),
      clearTimeout: frame.contentWindow.clearTimeout.bind(frame.contentWindow),
      clearInterval: frame.contentWindow.clearInterval.bind(frame.contentWindow),
    };

    // --- 2. バックグラウンド用トリガーの準備 ---
    const DUMMY_ID = "yt-cpu-tamer-trigger-node";
    let dummy = document.getElementById(DUMMY_ID);
    if (!dummy) {
      dummy = document.createElement("div");
      dummy.id = DUMMY_ID;
      dummy.style.display = "none";
      document.documentElement.appendChild(dummy);
    }

    // --- 3. ハイブリッド戦略の構築 ---
    let timersAreThrottled = document.visibilityState === "visible";

    const makeHybridTrigger = () => {
      if (document.visibilityState === "visible") {
        return (callback) => {
          const p = new PromiseExt();
          requestAnimationFrame(p.resolve);
          return p.then(callback);
        };
      } else {
        return (callback) => {
          const p = new PromiseExt();
          const MO = new MutationObserver(() => {
            MO.disconnect();
            p.resolve();
          });
          MO.observe(dummy, { attributes: true });
          dummy.setAttribute("data-yt-cpu-tamer-trigger", Math.random().toString(36));
          return p.then(callback);
        };
      }
    };

    let currentTrigger = makeHybridTrigger();

    const VC_LISTENER_FLAG = "__yt_cpu_tamer_visibility_listener__";
    if (!window[VC_LISTENER_FLAG]) {
      document.addEventListener("visibilitychange", () => {
        timersAreThrottled = document.visibilityState === "visible";
        currentTrigger = makeHybridTrigger();
        console.log(`[YouTube CPU Tamer] Visibility changed. Throttling is now ${timersAreThrottled ? 'ON' : 'OFF'}`);
      });
      window[VC_LISTENER_FLAG] = true;
    }

    // --- 4. タイマー関数のパッチ（モンキーパッチ） ---
    const activeTimeouts = new Set();

    const makeTimeoutPatcher = (nativeTimeout, pool) => {
      return function patchedSetTimeout(callback, delay = 0, ...args) {
        if (typeof callback !== "function" || !timersAreThrottled || delay < MIN_DELAY_THRESHOLD) {
          return nativeTimeout(callback, delay, ...args);
        }
        const id = nativeTimeout(() => {
          currentTrigger(() => callback.apply(window, args));
        }, delay);
        pool.add(id);
        return id;
      };
    };

    const makeClear = (nativeClear, pool) => (id) => {
      if (pool.has(id)) pool.delete(id);
      nativeClear(id);
    };

    const mirrorToString = (patched, native) => {
      try {
        patched.toString = native.toString.bind(native);
      } catch (e) { /* ignore */ }
    };

    const installPatches = () => {
      window.setTimeout = makeTimeoutPatcher(nativeTimers.setTimeout, activeTimeouts);
      window.clearTimeout = makeClear(nativeTimers.clearTimeout, activeTimeouts);
      window.setInterval = nativeTimers.setInterval;
      window.clearInterval = nativeTimers.clearInterval;
      mirrorToString(window.setTimeout, nativeTimers.setTimeout);
      mirrorToString(window.setInterval, nativeTimers.setInterval);
      mirrorToString(window.clearTimeout, nativeTimers.clearTimeout);
      mirrorToString(window.clearInterval, nativeTimers.clearInterval);
      console.log("[YouTube CPU Tamer] Patches installed.");
    };

    const uninstallPatches = () => {
        window.setTimeout = nativeTimers.setTimeout;
        window.clearTimeout = nativeTimers.clearTimeout;
        window.setInterval = nativeTimers.setInterval;
        window.clearInterval = nativeTimers.clearInterval;
        console.log("[YouTube CPU Tamer] Patches uninstalled. Timers are native.");
    };

    // --- 5. 初期パッチ適用 ---
    installPatches();

    // --- 6. YouTubeのSPA遷移への対応（v4.80: DOM監視によるインテリジェント方式） ---
    let navigationHandler = null;
    window.addEventListener("yt-navigate-finish", () => {
      if (navigationHandler) {
          navigationHandler.abort(); // 既に進行中のハンドラがあれば中止
      }

      // 新しいナビゲーションに対応するハンドラを生成
      navigationHandler = (function() {
          let aborted = false;
          let observer = null;
          let timeoutId = null;

          const cleanup = () => {
              if (observer) observer.disconnect();
              if (timeoutId) nativeTimers.clearTimeout(timeoutId);
              observer = null;
              timeoutId = null;
              navigationHandler = null;
          };

          const handleRepatch = (reason) => {
              if (aborted) return;
              console.log(`[YouTube CPU Tamer] ${reason}. Re-installing patches...`);
              installPatches();
              timersAreThrottled = document.visibilityState === "visible";
              console.log(`[YouTube CPU Tamer] Re-patching complete. Throttling is now ${timersAreThrottled ? 'ON' : 'OFF'}`);
              cleanup();
          };

          // --- メインロジック ---
          console.log("[YouTube CPU Tamer] 'yt-navigate-finish' detected. Uninstalling patches...");
          uninstallPatches();

          // プレイヤー要素を監視
          observer = new MutationObserver(() => {
              if (document.querySelector(PLAYER_READY_SELECTOR)) {
                  handleRepatch("Player element detected");
              }
          });

          if(document.body){
            observer.observe(document.body, { childList: true, subtree: true });
          }

          // タイムアウトを設定（安全装置）
          timeoutId = nativeTimers.setTimeout(() => {
              handleRepatch("Repatch timeout reached");
          }, REPATCH_TIMEOUT);

          // 既にプレイヤーが存在する場合に即時実行
          if (document.querySelector(PLAYER_READY_SELECTOR)) {
              nativeTimers.setTimeout(() => handleRepatch("Player element already exists"), 0);
          }

          return {
              abort: () => {
                  if (aborted) return;
                  console.log("[YouTube CPU Tamer] Aborting previous navigation handler.");
                  aborted = true;
                  cleanup();
              }
          };
      })();
    });
  };

  setup().catch(err => console.error("[YouTube CPU Tamer] A critical error occurred during setup:", err));

})();
