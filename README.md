# 🎯 YouTube CPU Tamer – Hybrid Edition (Improved)

## 🧩 概要

このユーザースクリプトは、YouTubeおよびYouTube Music再生ページでの**CPU負荷を削減**することを目的としています。  
従来の `setTimeout` / `setInterval` の動作を **DOMの変化**と**アニメーションフレーム**に連動して動的に制御し、無駄な処理を削減します。

- ⚙️ ハイブリッドトリガー（可視状態で `requestAnimationFrame`、非可視時は `MutationObserver`）
- 🧠 遅延補正付きのスマートタイマー制御
- 🔄 `visibilitychange` に応じて自動切替
- 💻 `iframe` を活用したセーフなコンテキスト生成

## 🚀 インストール方法

1. ブラウザに [Violentmonkey](https://violentmonkey.github.io/) または [Tampermonkey](https://www.tampermonkey.net/) を導入
2. 以下のリンクからスクリプトをインストール  
   👉 [このスクリプトをインストールする](https://raw.githubusercontent.com/koyasi777/youtube-cpu-tamer-hybrid/main/youtube-cpu-tamer-hybrid.user.js)

## 📌 対応サイト

- `https://www.youtube.com/`
- `https://music.youtube.com/`
- `https://www.youtube.com/embed/`
- `https://www.youtube-nocookie.com/embed/`

## 🔍 技術的なポイント

- `window.setTimeout` / `setInterval` をラップして動的に制御
- 背景タブでの不必要な処理を抑制
- 実行タイミングを精密に調整しCPU消費を抑える

## 🛠 開発者向けメモ

- ソースコードは純粋なES2020
- `iframe`経由でクリーンなAPIコンテキストを再生成
- `.toString()` も元関数と一致するよう上書き済み（検出対策）

## 📜 ライセンス

MIT License – 自由にご利用・改変可能です（ご自身の責任のもとでご利用ください）

---

> 🎥 あなたのYouTube体験を、静かに・軽やかに。CPUも一息つけます。
