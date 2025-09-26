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
// @version           5.5.0
// @description       Reduces YouTube CPU usage by intelligently throttling timers and animation frames, while preserving critical player functions to help avoid freezes and infinite loading.
// @description:ja    タイマーとアニメーションフレームを賢く間引いて YouTube の CPU 負荷を低減。プレイヤーの重要機能は保護し、フリーズや無限読み込みの発生を抑制します。
// @description:en    Reduces YouTube CPU usage by intelligently throttling timers and animation frames, while preserving critical player functions to help avoid freezes and infinite loading.
// @description:zh-CN 通过智能节流计时器和动画帧，降低 YouTube 的 CPU 占用，同时保护关键播放器功能，帮助避免卡死和无限加载。
// @description:zh-TW 透過智慧節流計時器與動畫幀，降低 YouTube 的 CPU 使用，同時保護關鍵播放器功能，協助避免當機與無限載入。
// @description:ko    타이머와 애니메이션 프레임을 지능적으로 간소화해 YouTube의 CPU 사용을 낮추고, 중요한 플레이어 기능을 보존하여 프리징·무한 로딩을 방지하는 데 도움을 줍니다.
// @description:fr    Réduit l’utilisation CPU de YouTube en régulant intelligemment les temporisateurs et les images d’animation, tout en préservant les fonctions critiques du lecteur pour aider à éviter les blocages et les chargements infinis.
// @description:es    Reduce el uso de CPU en YouTube al regular inteligentemente temporizadores y fotogramas de animación, preservando funciones críticas del reproductor para ayudar a evitar congelamientos y cargas infinitas.
// @description:de    Senkt die CPU-Auslastung auf YouTube durch intelligentes Drosseln von Timern und Animations-Frames, wobei kritische Player-Funktionen erhalten bleiben und Freezes sowie endloses Laden vermieden werden können.
// @description:pt-BR Reduz o uso de CPU no YouTube ao limitar inteligentemente temporizadores e quadros de animação, preservando funções críticas do player para ajudar a evitar travamentos e carregamentos infinitos.
// @description:ru    Снижает нагрузку CPU на YouTube за счёт интеллектуального ограничения таймеров и кадров анимации, сохраняя критически важные функции плеера и помогая избегать зависаний и бесконечной загрузки.
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

  const FLAG = "__yt_cpu_tamer_hybrid_running__";
  if (window[FLAG]) return; window[FLAG] = true;

  // ========= Tunables =========
  const THROTTLE_WHEN_HIDDEN = false;
  const PATCH_INTERVALS = false;

  let ENABLE_THROTTLE_EVENTS = true;       // ← /shorts では動的に無効化
  const ENABLE_LIGHT_CSS       = true;
  const HIDE_SPINNER           = true;     // ← 常時非表示（消え残り予防）
  const ENABLE_RAF_DECIMATOR   = true;     // Idle かつ 非再生時のみ有効（Shortsは常に無効）
  const ADAPTIVE_MIN_DELAY_THRESHOLD = true;

  // Idle thresholds
  const QUIET_MS_BASE   = 6000;
  const QUIET_MS_SHORTS = 12000;
  const IDLE_MIN_DELAY_FLOOR = 220;
  const INTERACTIVE_MIN_DELAY_BASE = 150;

  // rAF
  const RAF_VISIBLE_FPS_IDLE = 24;
  const RAF_HIDDEN_FPS_IDLE  = 5;

  // Misc
  const PLAYER_READY_SELECTOR = "ytd-player,#movie_player,video.video-stream,ytmusic-player-bar";
  const REPATCH_TIMEOUT = 10000;
  const CSS_TOGGLE_ATTR = "data-yt-cpu-tamer-cv-off";
  const IDLE_ATTR = "data-yt-cpu-tamer-idle";

  // ========= Debug =========
  const DEBUG = false;
  const dlog = (...a)=>{ if (DEBUG) console.debug("[YouTube CPU Tamer]", ...a); };
  const isShorts = ()=> location.pathname.startsWith("/shorts");

  // ========= Globals =========
  const NativeMO = window.MutationObserver;  // ← グローバル上書きは行わない
  let baseMinDelay = INTERACTIVE_MIN_DELAY_BASE;
  let MIN_DELAY_THRESHOLD = baseMinDelay;
  let MO_FLUSH_MS = 50; // 内部用途の既定 flush
  let useDecimator = false; // Idle＋非再生時のみ true
  const getMOFlushMs = ()=> MO_FLUSH_MS;

  // 内部専用：バッチ付き MO（外界には影響しない）
  const createBatchedObserver = (cb)=>{
    let queued=[], scheduled=false, lastObs=null;
    const flush=()=>{ scheduled=false; const rec=queued; queued=[]; try{ cb(rec,lastObs); }catch(e){ console.error(e);} };
    const proxy=(records,obs)=>{ lastObs=obs; queued.push(...records); if(!scheduled){ scheduled=true; setTimeout(flush, getMOFlushMs()); } };
    return new NativeMO(proxy);
  };

  // ========= Utilities =========
  const ORIG_RAF = window.requestAnimationFrame.bind(window);
  const ORIG_CAF = window.cancelAnimationFrame.bind(window);
  const isGlobalTarget = (t)=> t===window||t===document||t===document.documentElement||t===document.body;
  const nextAnimationFrame = ()=> new Promise(r=>requestAnimationFrame(r));
  const waitForDocReady = async()=>{ while(!document.documentElement||!document.head){ await nextAnimationFrame(); } };

  // ========= Event throttler =========
  (function installEventThrottler(){
    try {
      const ORIG_ADD = EventTarget.prototype.addEventListener;
      const ORIG_REMOVE = EventTarget.prototype.removeEventListener;
      const wrapMap = new WeakMap();

      const RAF_EVENTS = new Set(["mousemove","pointermove","touchmove"]);
      const THROTTLED = new Map([["scroll",50],["wheel",50],["resize",100]]);

      const isPlayerCritical = (t)=>{
        if (t instanceof HTMLVideoElement) return true;
        if (typeof t.closest === "function") {
          if (t.closest(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar,.ytp-ad-progress,.ytp-settings-menu")) return true;
        }
        return false;
      };

      const rafThrottle = (fn, ctx)=>{
        let scheduled=false, lastArgs=null;
        return function(...args){
          lastArgs=args;
          if(!scheduled){
            scheduled=true;
            requestAnimationFrame(()=>{ scheduled=false; try{fn.apply(ctx,lastArgs);}catch(e){console.error(e);} });
          }
        };
      };
      const timerThrottle = (fn, ctx, delay)=>{
        let busy=false, lastArgs=null;
        return function(...args){
          lastArgs=args;
          if(!busy){
            busy=true;
            setTimeout(()=>{ busy=false; try{fn.apply(ctx,lastArgs);}catch(e){console.error(e);} }, delay);
          }
        };
      };
      const leadingTrailing = (fn, ctx, delay)=>{
        let leadingDone=false, tid=null, lastArgs=null;
        return function(...args){
          lastArgs=args;
          if(!leadingDone){ leadingDone=true; try{fn.apply(ctx,args);}catch(e){console.error(e);} }
          clearTimeout(tid);
          tid=setTimeout(()=>{ leadingDone=false; try{fn.apply(ctx,lastArgs);}catch(e){console.error(e);} }, delay);
        };
      };

      EventTarget.prototype.addEventListener = function(type, listener, options){
        // Shorts か、明示的に無効化された場合は完全素通し
        if (isShorts() || !ENABLE_THROTTLE_EVENTS) {
          return ORIG_ADD.call(this,type,listener,options);
        }

        if (typeof listener!=="function") return ORIG_ADD.call(this,type,listener,options);
        if (isPlayerCritical(this)) return ORIG_ADD.call(this,type,listener,options);
        if (isGlobalTarget(this) && (type==="wheel"||type==="scroll"||type==="resize"))
          return ORIG_ADD.call(this,type,listener,options);

        let wrapped = listener;
        if (RAF_EVENTS.has(type)) wrapped = rafThrottle(listener,this);
        else if (THROTTLED.has(type)) {
          if (type==="resize") {
            if (!isGlobalTarget(this)) wrapped = leadingTrailing(listener,this,THROTTLED.get(type));
          } else if (type==="wheel"||type==="scroll") {
            wrapped = timerThrottle(listener,this,THROTTLED.get(type));
          }
        }
        if (wrapped!==listener) wrapMap.set(listener,wrapped);
        return ORIG_ADD.call(this,type,wrapped,options);
      };

      EventTarget.prototype.removeEventListener = function(type, listener, options){
        const wrapped = wrapMap.get(listener)||listener;
        return ORIG_REMOVE.call(this,type,wrapped,options);
      };

      dlog("Event throttler installed.");
    } catch(e){ console.error("[YouTube CPU Tamer] Event throttler failed:", e); }
  })();

  // ========= CSS reductions =========
  if (ENABLE_LIGHT_CSS) {
    try {
      const styleId="yt-cpu-tamer-css";
      if(!document.getElementById(styleId)){
        const style=document.createElement("style"); style.id=styleId;
        style.textContent = `
          /* スケルトン等の常時アニメ抑制 */
          .ytd-ghost-grid-renderer *, .ytd-continuation-item-renderer * { animation: none !important; }

          /* 画面外の大領域は可視時のみ描画（必要時は [${CSS_TOGGLE_ATTR}] で解除） */
          html:not([${CSS_TOGGLE_ATTR}]) #comments,
          html:not([${CSS_TOGGLE_ATTR}]) #related,
          html:not([${CSS_TOGGLE_ATTR}]) ytd-watch-next-secondary-results-renderer {
            content-visibility: auto !important;
            contain-intrinsic-size: 800px 600px !important;
          }

          /* スムーススクロール無効（安定側） */
          html { scroll-behavior: auto !important; }

          /* Idle Boost 中の追加軽量化 */
          html[${IDLE_ATTR}] ytd-thumbnail *,
          html[${IDLE_ATTR}] .ytp-storyboard,
          html[${IDLE_ATTR}] .ytd-reel-shelf-renderer * {
            animation: none !important;
            transition-property: none !important;
          }

          /* --- Spinner kill switch (常時不可視) --- */
          ${HIDE_SPINNER ? `
          .ytp-spinner,
          .ytp-spinner * {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            animation: none !important;
            transition: none !important;
          }
          .ytp-spinner-message { display: none !important; }
          ` : ``}
        `;
        (document.head||document.documentElement).appendChild(style);
      }
    } catch(e){ console.error("[YouTube CPU Tamer] CSS reductions failed:", e); }
  }

  // ========= rAF decimator（Idle＋非再生時のみ。Shortsでは無効） =========
  if (ENABLE_RAF_DECIMATOR) {
    try {
      const DECIM_ID_BASE = 1e9;
      let seq = 1;
      const queued = new Map();
      let ticking=false, nextDue=performance.now();

      const budget = ()=> (document.visibilityState==="visible" ? 1000/RAF_VISIBLE_FPS_IDLE : 1000/RAF_HIDDEN_FPS_IDLE);

      const loop = ()=>{
        if (!useDecimator) { ticking=false; return; }
        const now = performance.now();
        if (now >= nextDue) {
          nextDue = now + budget();
          if (queued.size) {
            ORIG_RAF((ts)=>{
              const cbs = Array.from(queued.values());
              queued.clear();
              for (const cb of cbs) { try{ cb(ts); } catch(e){ console.error(e);} }
            });
          }
        }
        ORIG_RAF(loop);
      };

      window.requestAnimationFrame = (cb)=>{
        if (!useDecimator) return ORIG_RAF(cb);
        const id = DECIM_ID_BASE + (seq++);
        queued.set(id, cb);
        if (!ticking) { ticking=true; nextDue=performance.now(); ORIG_RAF(loop); }
        return id;
      };
      window.cancelAnimationFrame = (id)=>{
        if (typeof id==="number" && id>=DECIM_ID_BASE) queued.delete(id);
        else ORIG_CAF(id);
      };
      document.addEventListener("visibilitychange", ()=>{ nextDue = performance.now(); });
      dlog("rAF decimator ready (idle-controlled).");
    } catch(e){ console.error("[YouTube CPU Tamer] rAF decimator failed:", e); }
  }

  // ========= Adaptive timer threshold =========
  if (ADAPTIVE_MIN_DELAY_THRESHOLD) {
    try {
      let busy = 0;
      if (window.PerformanceObserver) {
        const po = new PerformanceObserver((list)=>{ for (const e of list.getEntries()) busy += e.duration; });
        try { po.observe({ entryTypes: ["longtask"] }); } catch {}
      }
      setInterval(()=>{
        const slice = busy; busy=0;
        const ratio = Math.max(0, Math.min(1, slice/1000));
        baseMinDelay = Math.round(80 + (200-80) * ratio);
        // Idle 状態での実値を更新
        if (!document.documentElement.hasAttribute(IDLE_ATTR)) {
          MIN_DELAY_THRESHOLD = baseMinDelay;
        } else {
          const playing = isPlaying();
          MIN_DELAY_THRESHOLD = playing ? Math.max(baseMinDelay, 120)
                                        : Math.max(baseMinDelay, IDLE_MIN_DELAY_FLOOR);
        }
        dlog("Adaptive baseMinDelay=", baseMinDelay, " MIN_DELAY_THRESHOLD=", MIN_DELAY_THRESHOLD);
      }, 1000);
    } catch(e){ console.error("[YouTube CPU Tamer] Adaptive threshold failed:", e); }
  }

  // ========= Layout kick =========
  const kickLayout = ()=>{
    try{
      document.documentElement.setAttribute(CSS_TOGGLE_ATTR,"1");
      void document.documentElement.offsetHeight;
      const fire=()=> window.dispatchEvent(new Event("resize"));
      fire(); setTimeout(fire,50); requestAnimationFrame(fire);
      requestAnimationFrame(()=> document.documentElement.removeAttribute(CSS_TOGGLE_ATTR));
    }catch(_){}
  };

  // ========= Idle detector =========
  let lastActive = performance.now();
  const markActive = ()=>{
    lastActive = performance.now();
    if (document.documentElement.hasAttribute(IDLE_ATTR)) exitIdle();
  };
  ["mousemove","mousedown","keydown","wheel","touchstart","pointerdown","focusin"].forEach(t=>{
    window.addEventListener(t, markActive, {capture:true, passive:true});
  });

  const isPlaying = ()=>{
    const v = document.querySelector("video.video-stream");
    return v && !v.paused && !v.ended;
  };

  const enterIdle = ()=>{
    if (document.documentElement.hasAttribute(IDLE_ATTR)) return;
    document.documentElement.setAttribute(IDLE_ATTR,"1");

    if (isShorts() || isPlaying()) {
      // Shorts/再生中はデシメータ無効・MOは短め
      useDecimator = false;
      MO_FLUSH_MS = 50;
      MIN_DELAY_THRESHOLD = Math.max(baseMinDelay, 120);
      dlog("Idle Boost ON (playing/shorts-safe: no rAF decimation, MO=50ms, minDelay>=120)");
    } else {
      // 非再生 Idle は強く絞る
      useDecimator = true;
      MO_FLUSH_MS = 80;
      MIN_DELAY_THRESHOLD = Math.max(baseMinDelay, IDLE_MIN_DELAY_FLOOR);
      dlog("Idle Boost ON (no video: rAF decimation active)");
    }
  };

  const exitIdle = ()=>{
    if (!document.documentElement.hasAttribute(IDLE_ATTR)) return;
    document.documentElement.removeAttribute(IDLE_ATTR);
    useDecimator = false;
    MO_FLUSH_MS = 50;
    MIN_DELAY_THRESHOLD = baseMinDelay;
    dlog("Idle Boost OFF");
  };

  setInterval(()=>{
    const now = performance.now();
    const quietMs = isShorts() ? QUIET_MS_SHORTS : QUIET_MS_BASE;
    if (document.visibilityState==="visible" && (now - lastActive) >= quietMs) enterIdle();
    else exitIdle();
  }, 1000);

  // ========= Core: hybrid timer patching =========
  const PromiseExt = (()=>{ let _r,_j; const shim=(r,j)=>{_r=r;_j=j;}; return class extends Promise{ constructor(cb=shim){ super(cb); if(cb===shim){ this.resolve=_r; this.reject=_j; } } }; })();

  const setup = async ()=>{
    await waitForDocReady();

    const mainTimers = {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
    };

    // sandboxed iframe からクリーンなタイマを供給
    const FRAME_ID="yt-cpu-tamer-timer-frame";
    let frame=document.getElementById(FRAME_ID);
    if(frame && (!frame.contentWindow||!frame.contentWindow.setTimeout)){ frame.remove(); frame=null; }
    if(!frame){
      frame=document.createElement("iframe");
      frame.id=FRAME_ID; frame.style.display="none"; frame.sandbox="allow-same-origin allow-scripts";
      const html="<!doctype html><title>yt-cpu-tamer-timer-provider</title>";
      if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try { const pol=trustedTypes.createPolicy("yt-cpu-tamer-policy",{createHTML:(s)=>s}); frame.srcdoc=pol.createHTML(html); }
        catch{ frame.srcdoc=html; }
      } else frame.srcdoc=html;
      document.documentElement.appendChild(frame);
    }
    while(!frame.contentWindow||!frame.contentWindow.setTimeout){ await nextAnimationFrame(); }

    const nativeTimers = {
      setTimeout: frame.contentWindow.setTimeout.bind(frame.contentWindow),
      setInterval: frame.contentWindow.setInterval.bind(frame.contentWindow),
      clearTimeout: frame.contentWindow.clearTimeout.bind(frame.contentWindow),
      clearInterval: frame.contentWindow.clearInterval.bind(frame.contentWindow),
    };

    const DUMMY_ID="yt-cpu-tamer-trigger-node";
    let dummy=document.getElementById(DUMMY_ID);
    if(!dummy){ dummy=document.createElement("div"); dummy.id=DUMMY_ID; dummy.style.display="none"; document.documentElement.appendChild(dummy); }

    // Shorts は「可視時スロットルなし」
    const shouldThrottleVisibleTimers = ()=> document.visibilityState==="visible" && !isShorts();

    let timersAreThrottled = shouldThrottleVisibleTimers();
    const makeHybridTrigger = ()=>{
      if (document.visibilityState==="visible" || THROTTLE_WHEN_HIDDEN) {
        return (cb)=>{ const p=new PromiseExt(); requestAnimationFrame(p.resolve); return p.then(cb); };
      } else {
        return (cb)=>{ const p=new PromiseExt(); const mo=new NativeMO(()=>{ mo.disconnect(); p.resolve(); });
          mo.observe(dummy,{attributes:true}); dummy.setAttribute("data-yt-cpu-tamer-trigger", Math.random().toString(36)); return p.then(cb); };
      }
    };
    let currentTrigger = makeHybridTrigger();

    const VC_FLAG="__yt_cpu_tamer_visibility_listener__";
    if(!window[VC_FLAG]){
      document.addEventListener("visibilitychange", ()=>{
        timersAreThrottled = shouldThrottleVisibleTimers();
        currentTrigger = makeHybridTrigger();
        if (document.visibilityState==="visible") kickLayout();
        dlog("Visibility:", document.visibilityState, " timers(throttled?)=", timersAreThrottled, " (shorts=", isShorts(),")");
      });
      window[VC_FLAG]=true;
    }

    const activeTimeouts = new Set();
    const mirrorToString=(patched,native)=>{ try{ patched.toString = native.toString.bind(native); }catch{} };

    const makeTimeoutPatcher = (cleanTimeout, pool)=>function patchedSetTimeout(cb, delay=0, ...args){
      const isFn = (typeof cb==="function");
      const runInMain = isFn ? ()=>cb.apply(window,args) : ()=>{ try{ (0,eval)(String(cb)); }catch(e){ console.error("[YT Tamer] eval error:",e);} };

      if (isShorts()) return mainTimers.setTimeout(runInMain, delay); // Shortsは常に素通し

      if (!timersAreThrottled || delay < MIN_DELAY_THRESHOLD) return mainTimers.setTimeout(runInMain, delay);
      let id = cleanTimeout(()=>{ if(pool.has(id)) pool.delete(id); currentTrigger(runInMain); }, delay);
      pool.add(id); return id;
    };
    const makeClearTimeout = (pool)=>(id)=>{ if(pool.has(id)){ pool.delete(id); nativeTimers.clearTimeout(id);} else { mainTimers.clearTimeout(id);} };
    const makeIntervalPatcher = (cleanInterval)=>function patchedSetInterval(cb, delay=0, ...args){
      if (isShorts()) return mainTimers.setInterval(()=>cb.apply(window,args), delay); // Shortsは素通し
      if (!PATCH_INTERVALS || typeof cb!=="function" || delay<MIN_DELAY_THRESHOLD || !timersAreThrottled)
        return mainTimers.setInterval(()=>cb.apply(window,args), delay);
      return cleanInterval(()=>{ currentTrigger(()=>cb.apply(window,args)); }, delay);
    };

    const installPatches = ()=>{
      window.setTimeout = makeTimeoutPatcher(nativeTimers.setTimeout, activeTimeouts);
      window.clearTimeout = makeClearTimeout(activeTimeouts);

      // PATCH_INTERVALS=false のときは常にネイティブ
      window.setInterval = PATCH_INTERVALS
        ? (isShorts() ? mainTimers.setInterval : makeIntervalPatcher(nativeTimers.setInterval))
        : mainTimers.setInterval;

      window.clearInterval = PATCH_INTERVALS ? nativeTimers.clearInterval : mainTimers.clearInterval;

      mirrorToString(window.setTimeout, mainTimers.setTimeout);
      mirrorToString(window.clearTimeout, mainTimers.clearTimeout);
      mirrorToString(window.setInterval, mainTimers.setInterval);
      mirrorToString(window.clearInterval, mainTimers.clearInterval);
      dlog("Timer patches installed.");
    };
    const uninstallPatches = ()=>{
      window.setTimeout=mainTimers.setTimeout;
      window.clearTimeout=mainTimers.clearTimeout;
      window.setInterval=mainTimers.setInterval;
      window.clearInterval=mainTimers.clearInterval;
      dlog("Timer patches uninstalled.");
    };

    installPatches();

    // SPA遷移：構築中はネイティブ、プレイヤー検出 or タイムアウトで再パッチ
    window.addEventListener("yt-navigate-start", ()=>{ try{ uninstallPatches(); }catch{} });

    let navigationHandler=null;
    window.addEventListener("yt-navigate-finish", ()=>{
      if (navigationHandler){ navigationHandler.abort(); }
      navigationHandler = (function(){
        let aborted=false, observer=null, tid=null;
        const cleanup=()=>{ if(observer) observer.disconnect(); if(tid) nativeTimers.clearTimeout(tid); observer=null; tid=null; navigationHandler=null; };
        const handleRepatch=(reason)=>{
          if (aborted) return;
          dlog(reason, "-> re-install timer patches");
          installPatches();
          timersAreThrottled = shouldThrottleVisibleTimers();
          kickLayout();
          cleanup();
        };
        dlog("navigate-finish: temporary native timers during rebuild");
        uninstallPatches();

        const tryRepatch=()=>{ if (document.querySelector(PLAYER_READY_SELECTOR)) handleRepatch("Player detected"); };

        // ✅ 修正: ネイティブMOのバッチ版を使用（大量挿入でも穏やか）
        observer = createBatchedObserver(tryRepatch);
        if (document.body) observer.observe(document.body,{childList:true,subtree:true});

        tid = nativeTimers.setTimeout(()=>handleRepatch("Repatch timeout"), REPATCH_TIMEOUT);
        if (document.querySelector(PLAYER_READY_SELECTOR)) nativeTimers.setTimeout(()=>handleRepatch("Player already exists"),0);

        return { abort: ()=>{ if (aborted) return; aborted=true; cleanup(); } };
      })();

      // ナビ直後は Idle タイマをリセット
      lastActive = performance.now();

      // /shorts に入ったら、イベントスロットルも rAF デシメータも完全停止
      if (isShorts()) {
        ENABLE_THROTTLE_EVENTS = false;
        dlog("Shorts Safe Mode enabled (no visible timer throttle, no event throttle, no rAF decimation).");
      } else {
        ENABLE_THROTTLE_EVENTS = true;
      }
    });

    // BFCache 復帰時
    window.addEventListener("pageshow",(e)=>{ if (e.persisted) { dlog("pageshow BFCache -> layout kick"); kickLayout(); } });
  };

  setup().catch(err=>console.error("[YouTube CPU Tamer] Setup error:", err));
})();
