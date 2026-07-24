export const adminHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>Pocket Friend 设备后台</title>
    <link rel="stylesheet" href="/assets/admin.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="brand-mark" aria-hidden="true">PF</div>
      <div>
        <p class="product">POCKET FRIEND</p>
        <h1>设备在线状态</h1>
      </div>
      <div class="live-indicator"><span></span>实时监控</div>
    </header>

    <main>
      <section class="summary" aria-label="在线概览">
        <div><strong id="online-count">--</strong><span>在线设备</span></div>
        <div><strong id="offline-count">--</strong><span>离线设备</span></div>
        <div><strong id="total-count">3</strong><span>设备总数</span></div>
      </section>

      <section class="device-section">
        <div class="section-heading">
          <h2>连接状态</h2>
          <time id="updated-at">正在读取</time>
        </div>
        <div id="device-grid" class="device-grid" aria-live="polite"></div>
        <div id="load-error" class="load-error" role="alert" hidden>状态读取失败，正在重试。</div>
      </section>

      <section class="photo-section">
        <div class="section-heading">
          <h2>最新拍照</h2>
          <span id="photo-updated-at">等待照片</span>
        </div>
        <div class="photo-grid" aria-live="polite">
          <article class="photo-card">
            <div class="photo-frame">
              <img id="photo-board-a" alt="开发板 A 最新照片" />
              <div id="photo-board-a-empty" class="photo-empty">暂无照片</div>
            </div>
            <p>开发板 A</p>
          </article>
          <article class="photo-card">
            <div class="photo-frame">
              <img id="photo-board-b" alt="开发板 B 最新照片" />
              <div id="photo-board-b-empty" class="photo-empty">暂无照片</div>
            </div>
            <p>开发板 B</p>
          </article>
        </div>
      </section>
    </main>

    <footer>管理端口 4311 · 自动刷新</footer>
    <script src="/assets/admin.js" defer></script>
  </body>
</html>`;

export const adminCss = `
:root {
  color: #18201d;
  background: #f4f6f4;
  font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: #f4f6f4; }
.topbar { min-height: 76px; padding: 14px clamp(18px, 4vw, 56px); display: flex; align-items: center; gap: 12px; color: #fff; background: #173d35; border-bottom: 4px solid #f2c94c; }
.brand-mark { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 42px; background: #f2c94c; color: #14211d; border: 2px solid #fff; font-size: 13px; font-weight: 900; }
.product { margin: 0 0 2px; color: #c7ddd6; font-size: 10px; font-weight: 800; }
h1 { margin: 0; font-size: 20px; line-height: 1.25; letter-spacing: 0; }
.live-indicator { margin-left: auto; display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; }
.live-indicator span { width: 9px; height: 9px; background: #58c978; box-shadow: 0 0 0 4px rgba(88, 201, 120, .16); }
main { width: min(1040px, calc(100% - 32px)); margin: 28px auto; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #cbd3cf; background: #fff; }
.summary div { min-height: 88px; display: flex; align-items: baseline; justify-content: center; gap: 10px; padding: 20px 12px; border-right: 1px solid #dfe4e1; }
.summary div:last-child { border-right: 0; }
.summary strong { font-size: 32px; line-height: 1; }
.summary span { color: #66736e; font-size: 13px; font-weight: 700; }
.device-section { margin-top: 30px; }
.photo-section { margin-top: 30px; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.section-heading time, .section-heading span { color: #69756f; font-size: 12px; }
.device-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.device-card { min-height: 184px; padding: 18px; background: #fff; border: 1px solid #ccd4d0; border-top: 4px solid #8a9690; border-radius: 6px; }
.device-card.online { border-top-color: #249a55; }
.device-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.device-kind { margin: 0 0 5px; color: #6c7872; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.device-name { margin: 0; font-size: 17px; letter-spacing: 0; }
.status { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; font-size: 12px; font-weight: 800; }
.status::before { content: ""; width: 9px; height: 9px; background: #aeb6b2; }
.online .status { color: #16733c; }
.online .status::before { background: #2eb764; box-shadow: 0 0 0 4px #e1f4e8; }
.device-details { margin: 24px 0 0; display: grid; gap: 10px; }
.detail { display: flex; justify-content: space-between; gap: 16px; padding-top: 10px; border-top: 1px solid #edf0ee; font-size: 12px; }
.detail dt { color: #737e79; }
.detail dd { margin: 0; min-width: 0; color: #2b3732; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.session-list { margin: 18px 0 0; }
.session-item { padding: 10px 0; border-top: 1px solid #edf0ee; display: flex; align-items: center; gap: 10px; font-size: 12px; }
.session-item:first-child { border-top: 0; padding-top: 0; }
.session-browser { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.session-browser-icon { flex: 0 0 auto; font-size: 15px; line-height: 1; }
.session-browser-name { font-weight: 700; color: #2b3732; }
.session-browser-os { color: #737e79; margin-left: 4px; }
.session-ip { flex: 0 0 auto; color: #737e79; font-family: "SF Mono", "Consolas", monospace; font-size: 11px; }
.session-time { flex: 0 0 auto; color: #737e79; }
.no-sessions { margin: 18px 0 0; padding: 14px; text-align: center; color: #8a9590; font-size: 12px; background: #f8f9f8; }
.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.photo-card { margin: 0; padding: 14px; background: #fff; border: 1px solid #ccd4d0; border-radius: 6px; }
.photo-card p { margin: 10px 0 0; color: #2b3732; font-size: 13px; font-weight: 800; }
.photo-frame { position: relative; display: grid; place-items: center; aspect-ratio: 4 / 3; background: #eef2ef; border: 1px solid #d9e0dc; overflow: hidden; }
.photo-frame img { width: 100%; height: 100%; object-fit: contain; display: none; background: #111; }
.photo-frame.has-photo img { display: block; }
.photo-frame.rotate-180 img { transform: rotate(180deg); }
.photo-empty { color: #87928d; font-size: 13px; font-weight: 700; }
.photo-frame.has-photo .photo-empty { display: none; }
.load-error { margin-top: 12px; padding: 12px 14px; color: #8f271f; background: #fff0ee; border-left: 4px solid #cf4437; font-size: 13px; }
footer { width: min(1040px, calc(100% - 32px)); margin: 0 auto 28px; color: #7a8580; font-size: 11px; text-align: right; }
@media (max-width: 760px) { .device-grid, .photo-grid { grid-template-columns: 1fr; } .device-card { min-height: 0; } }
@media (max-width: 480px) { .topbar { padding-inline: 14px; } .live-indicator { font-size: 0; } main { width: min(100% - 24px, 1040px); margin-top: 18px; } .summary div { min-height: 74px; flex-direction: column; align-items: center; gap: 4px; padding: 14px 6px; } .summary strong { font-size: 26px; } .section-heading { align-items: flex-start; flex-direction: column; gap: 5px; } footer { width: calc(100% - 24px); } }
`;

export const adminJavaScript = `
const grid = document.querySelector("#device-grid");
const errorBox = document.querySelector("#load-error");
const onlineCount = document.querySelector("#online-count");
const offlineCount = document.querySelector("#offline-count");
const totalCount = document.querySelector("#total-count");
const updatedAt = document.querySelector("#updated-at");
const photoUpdatedAt = document.querySelector("#photo-updated-at");
const photoViews = [
  { endpoint: "/api/photos/board-a/latest", img: document.querySelector("#photo-board-a"), empty: document.querySelector("#photo-board-a-empty"), className: "rotate-180" },
  { endpoint: "/api/photos/board-b/latest", img: document.querySelector("#photo-board-b"), empty: document.querySelector("#photo-board-b-empty") }
];

var browserIcons = { "Chrome": "\u{1F310}", "Firefox": "\u{1F525}", "Edge": "\u{1F310}", "Safari": "\u{1F34E}", "Unknown": "\u{1F310}" };

function relativeTime(ageMs) {
  if (ageMs === null) return "从未连接";
  var seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 5) return "\u521A\u521A";
  if (seconds < 60) return seconds + " \u79D2\u524D";
  var minutes = Math.floor(seconds / 60);
  return minutes < 60 ? minutes + " \u5206\u949F\u524D" : Math.floor(minutes / 60) + " \u5C0F\u65F6\u524D";
}

function detail(label, value) {
  var row = document.createElement("div");
  row.className = "detail";
  var term = document.createElement("dt");
  term.textContent = label;
  var desc = document.createElement("dd");
  desc.textContent = value;
  row.append(term, desc);
  return row;
}

function renderSessions(sessions) {
  var container = document.createElement("div");
  if (!sessions || sessions.length === 0) {
    container.className = "no-sessions";
    container.textContent = "\u65E0\u6D3B\u8DC3\u9875\u9762";
    return container;
  }
  container.className = "session-list";
  sessions.forEach(function(s) {
    var item = document.createElement("div");
    item.className = "session-item";

    var browserDiv = document.createElement("div");
    browserDiv.className = "session-browser";
    var icon = document.createElement("span");
    icon.className = "session-browser-icon";
    icon.textContent = browserIcons[s.browser] || browserIcons["Unknown"];
    var name = document.createElement("span");
    name.className = "session-browser-name";
    name.textContent = s.browser;
    var os = document.createElement("span");
    os.className = "session-browser-os";
    os.textContent = s.os;
    browserDiv.append(icon, name, os);

    var ip = document.createElement("span");
    ip.className = "session-ip";
    ip.textContent = s.ip;

    var time = document.createElement("span");
    time.className = "session-time";
    time.textContent = relativeTime(s.ageMs);

    item.append(browserDiv, ip, time);
    container.append(item);
  });
  return container;
}

function renderDevice(device) {
  var article = document.createElement("article");
  article.className = "device-card " + (device.online ? "online" : "offline");

  var head = document.createElement("div");
  head.className = "device-head";
  var identity = document.createElement("div");
  var kind = document.createElement("p");
  kind.className = "device-kind";
  kind.textContent = device.kind === "web" ? "WEB CLIENT" : "T5AI BOARD";
  var name = document.createElement("h3");
  name.className = "device-name";
  name.textContent = device.label;
  identity.append(kind, name);
  var status = document.createElement("span");
  status.className = "status";
  status.textContent = device.online ? "\u5728\u7EBF" : "\u79BB\u7EBF";
  head.append(identity, status);

  if (device.kind === "web") {
    article.append(head, renderSessions(device.sessions));
  } else {
    var details = document.createElement("dl");
    details.className = "device-details";
    details.append(detail("\u6700\u8FD1\u5FC3\u8DF3", relativeTime(device.ageMs)));
    details.append(detail("\u56FA\u4EF6\u7248\u672C", device.firmwareVersion ?? "--"));
    details.append(detail("\u7535\u91CF", device.batteryPercent === undefined ? "--" : device.batteryPercent + "%"));
    article.append(head, details);
  }
  return article;
}

function refreshPhoto(view, timestamp) {
  var frame = view.img.parentElement;
  if (view.className) frame.classList.add(view.className);
  view.img.onload = function() {
    frame.classList.add("has-photo");
  };
  view.img.onerror = function() {
    frame.classList.remove("has-photo");
    view.img.removeAttribute("src");
  };
  view.img.src = view.endpoint + "?t=" + timestamp;
}

function refreshPhotos() {
  var timestamp = Date.now();
  photoViews.forEach(function(view) { refreshPhoto(view, timestamp); });
  photoUpdatedAt.textContent = "\u5237\u65B0\u4E8E " + new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
}

async function refresh() {
  try {
    var response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status " + response.status);
    var snapshot = await response.json();
    grid.replaceChildren(...snapshot.devices.map(renderDevice));
    var online = snapshot.summary.online;
    onlineCount.textContent = String(online);
    offlineCount.textContent = String(snapshot.summary.total - online);
    totalCount.textContent = String(snapshot.summary.total);
    updatedAt.textContent = "\u66F4\u65B0\u4E8E " + new Date(snapshot.generatedAt).toLocaleTimeString("zh-CN", { hour12: false });
    refreshPhotos();
    errorBox.hidden = true;
  } catch {
    errorBox.hidden = false;
  }
}

refresh();
setInterval(refresh, 5000);
`;
