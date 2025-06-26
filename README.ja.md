# 🎯 YouTube CPU Tamer – Hybrid Edition (Improved)

## 🧩 概要（Overview）

このユーザースクリプトは、YouTube や YouTube Music 上での **CPU負荷を大幅に軽減** することを目的としています。タブの可視状態に応じて `requestAnimationFrame` と `MutationObserver` を動的に切り替え、タイマーAPI（`setTimeout`など）の挙動を最適化します。さらに、YouTubeのページ遷移（SPA）にもインテリジェントに対応し、フリーズや機能不全を防ぎます。

* ⚙️ **ハイブリッドトリガー方式**：可視状態に応じてトリガー方式を自動切替
* 🔄 **SPA遷移対応**：`yt-navigate-finish`イベントとDOM監視により再パッチを自動実行
* 🧠 **最小遅延しきい値設定**：重要機能への影響を回避
* 🧼 **iframe由来の純正タイマーAPI使用**：YouTube環境を汚染せず安全

---

## 🚀 インストール方法（How to Install）

1. ブラウザに **[Violentmonkey](https://violentmonkey.github.io/)** または **[Tampermonkey](https://www.tampermonkey.net/)** をインストール
2. 以下のリンクからスクリプトを追加：
   👉 [このスクリプトをインストール](https://raw.githubusercontent.com/koyasi777/youtube-cpu-tamer-hybrid/main/youtube-cpu-tamer-hybrid.user.js)

---

## 📌 対応サイト（Supported Sites）

* `https://www.youtube.com/`
* `https://music.youtube.com/`
* `https://www.youtube.com/embed/`
* `https://www.youtube-nocookie.com/embed/`

---

## 🔍 技術ハイライト（Technical Highlights）

* 🎛 `setTimeout`/`setInterval` をハイブリッド戦略で置き換え
* 👁 タブが非アクティブなときは `MutationObserver` による節電モード
* 🔧 再パッチ判定には DOM監視とタイムアウトを併用
* 🧪 タイマー関数の `.toString()` をネイティブ風に保護
* 🧼 iframe 由来のタイマーで副作用を回避

---

## 👨‍💻 開発者向け情報（Developer Notes）

* ES2020 に準拠したモダンな構成
* グローバル名前空間を汚染しない設計
* `@inject-into: page` によりYouTube本体への深い統合を実現

---

## 📜 ライセンス（License）

MIT License
改変・再配布は自由ですが、ご自身の責任でご利用ください。

---

> 🎥 CPUにやさしく、よりスムーズなYouTube体験を。
