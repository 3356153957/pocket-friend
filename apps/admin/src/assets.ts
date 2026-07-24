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
        <div><strong id="online-count">--</strong><span>在线</span></div>
        <div><strong id="offline-count">--</strong><span>离线</span></div>
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
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.section-heading time { color: #69756f; font-size: 12px; }
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
.load-error { margin-top: 12px; padding: 12px 14px; color: #8f271f; background: #fff0ee; border-left: 4px solid #cf4437; font-size: 13px; }
footer { width: min(1040px, calc(100% - 32px)); margin: 0 auto 28px; color: #7a8580; font-size: 11px; text-align: right; }
@media (max-width: 760px) { .device-grid { grid-template-columns: 1fr; } .device-card { min-height: 0; } }
@media (max-width: 480px) { .topbar { padding-inline: 14px; } .live-indicator { font-size: 0; } main { width: min(100% - 24px, 1040px); margin-top: 18px; } .summary div { min-height: 74px; flex-direction: column; align-items: center; gap: 4px; padding: 14px 6px; } .summary strong { font-size: 26px; } .section-heading { align-items: flex-start; flex-direction: column; gap: 5px; } footer { width: calc(100% - 24px); } }
`;

export const adminJavaScript = `
const grid = document.querySelector("#device-grid");
const errorBox = document.querySelector("#load-error");
const onlineCount = document.querySelector("#online-count");
const offlineCount = document.querySelector("#offline-count");
const totalCount = document.querySelector("#total-count");
const updatedAt = document.querySelector("#updated-at");

function relativeTime(ageMs) {
  if (ageMs === null) return "从未连接";
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return seconds + " 秒前";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? minutes + " 分钟前" : Math.floor(minutes / 60) + " 小时前";
}

function detail(label, value) {
  const row = document.createElement("div");
  row.className = "detail";
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  row.append(term, description);
  return row;
}

function renderDevice(device) {
  const article = document.createElement("article");
  article.className = "device-card " + (device.online ? "online" : "offline");
  const head = document.createElement("div");
  head.className = "device-head";
  const identity = document.createElement("div");
  const kind = document.createElement("p");
  kind.className = "device-kind";
  kind.textContent = device.kind === "web" ? "WEB CLIENT" : "T5AI BOARD";
  const name = document.createElement("h3");
  name.className = "device-name";
  name.textContent = device.label;
  identity.append(kind, name);
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = device.online ? "在线" : "离线";
  head.append(identity, status);

  const details = document.createElement("dl");
  details.className = "device-details";
  details.append(detail("最近心跳", relativeTime(device.ageMs)));
  if (device.kind === "web") {
    details.append(detail("活跃页面", String(device.activeSessions ?? 0)));
  } else {
    details.append(detail("固件版本", device.firmwareVersion ?? "--"));
    details.append(detail("电量", device.batteryPercent === undefined ? "--" : device.batteryPercent + "%"));
  }
  article.append(head, details);
  return article;
}

async function refresh() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status " + response.status);
    const snapshot = await response.json();
    grid.replaceChildren(...snapshot.devices.map(renderDevice));
    onlineCount.textContent = String(snapshot.summary.online);
    offlineCount.textContent = String(snapshot.summary.total - snapshot.summary.online);
    totalCount.textContent = String(snapshot.summary.total);
    updatedAt.textContent = "更新于 " + new Date(snapshot.generatedAt).toLocaleTimeString("zh-CN", { hour12: false });
    errorBox.hidden = true;
  } catch {
    errorBox.hidden = false;
  }
}

refresh();
setInterval(refresh, 5000);
`;
