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
// @version      3.95
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
  'use strict';

  const key = '__yt_cpu_tamer_hybrid_running__';
  if (window[key]) return;
  window[key] = true;

  const waitForDocumentReady = async () => {
    while (!document.documentElement || !document.head) {
      await new Promise(r => requestAnimationFrame(r));
    }
  };

  const PromiseExt = (() => {
    let _resolve, _reject;
    const h = (res, rej) => { _resolve = res; _reject = rej; };
    return class extends Promise {
      constructor(cb = h) {
        super(cb);
        if (cb === h) {
          this.resolve = _resolve;
          this.reject = _reject;
        }
      }
    };
  })();

  const setup = async () => {
    await waitForDocumentReady();

    const frameId = 'yt-cpu-tamer-frame';
    let iframe = document.getElementById(frameId);
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.id = frameId;
      iframe.sandbox = 'allow-same-origin';
      document.documentElement.appendChild(iframe);
    }
    while (!iframe.contentWindow) await new Promise(r => requestAnimationFrame(r));

    const {
      requestAnimationFrame: iframeRAF,
      setTimeout: iframeSetTimeout,
      setInterval: iframeSetInterval,
      clearTimeout: iframeClearTimeout,
      clearInterval: iframeClearInterval
    } = iframe.contentWindow;

    const dummyDiv = document.createElement('div');
    dummyDiv.style.display = 'none';
    document.documentElement.appendChild(dummyDiv);

    let currentTrigger = () => new Promise(r => iframeRAF(r));

    const createHybridTriggerBase = () => {
      if (document.visibilityState === 'visible') {
        return (callback) => {
          const p = new PromiseExt();
          requestAnimationFrame(() => p.resolve());
          return p.then(callback);
        };
      } else {
        return (callback) => {
          const attr = 'data-yt-cpu-tamer';
          dummyDiv.setAttribute(attr, Math.random().toString(36));
          const p = new PromiseExt();
          const obs = new MutationObserver(() => {
            obs.disconnect();
            p.resolve();
          });
          obs.observe(dummyDiv, { attributes: true });
          return p.then(callback);
        };
      }
    };

    currentTrigger = createHybridTriggerBase();
    document.addEventListener('visibilitychange', () => {
      currentTrigger = createHybridTriggerBase();
    });

    const activeTimeouts = new Set();
    const activeIntervals = new Set();

    const overrideTimer = (timerFn, clearFn, activeSet) => {
      return (fn, delay = 0, ...args) => {
        if (typeof fn !== 'function') return timerFn(fn, delay, ...args);
        let isActive = true;
        const handler = () => {
          currentTrigger(() => {
            if (isActive) fn(...args);
          });
        };
        const nativeId = timerFn(handler, delay);
        activeSet.add(nativeId);
        return nativeId;
      };
    };

    const overrideClear = (clearFn, activeSet) => {
      return (id) => {
        if (activeSet.has(id)) activeSet.delete(id);
        clearFn(id);
      };
    };

    window.addEventListener('DOMContentLoaded', () => {
      window.setTimeout = overrideTimer(iframeSetTimeout, iframeClearTimeout, activeTimeouts);
      window.setInterval = overrideTimer(iframeSetInterval, iframeClearInterval, activeIntervals);
      window.clearTimeout = overrideClear(iframeClearTimeout, activeTimeouts);
      window.clearInterval = overrideClear(iframeClearInterval, activeIntervals);

      const patchToString = (target, source) => {
        try {
          target.toString = source.toString.bind(source);
        } catch {}
      };

      patchToString(window.setTimeout, iframeSetTimeout);
      patchToString(window.setInterval, iframeSetInterval);
      patchToString(window.clearTimeout, iframeClearTimeout);
      patchToString(window.clearInterval, iframeClearInterval);

      console.log('[YouTube CPU Tamer – Hybrid Edition (Patched)] Active');
    });
  };

  setup();
})();
