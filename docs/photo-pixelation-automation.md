# Pocket Friend 拍照转像素化自动化接入说明

本文档给“图片转像素化”模块的开发同学使用。目标是：开发板 A 拍照上传到 4311 后，像素化程序能自动发现新照片、下载原图、调用已有像素化逻辑，不再手动上传照片。

## 一句话方案

像素化程序所在的设备/服务定时轮询 4311 照片历史接口；发现没处理过的新照片 ID 后下载原图，再调用现有图片转像素化程序。

```text
开发板 A 拍照上传
  -> 4311 服务器保存原图和历史记录
  -> 像素化服务轮询照片历史接口
  -> 发现新 photo.id
  -> 下载原图
  -> 调用图片转像素化逻辑
  -> 保存像素化结果
  -> 记录已处理 photo.id
```

## 角色分工

### 4311 服务器负责

- 接收开发板 A 上传的照片。
- 保存最新照片和历史照片。
- 提供只读照片下载 API。
- 不负责执行像素化算法。

### 像素化程序负责

- 持有照片只读下载 token。
- 定时拉取照片历史列表。
- 判断哪些照片还没处理过。
- 下载新照片。
- 调用已有图片转像素化逻辑。
- 记录已处理照片，避免重复处理。

## 安全说明

不要使用后台登录账号密码做自动化。自动化只使用照片只读下载 token。

照片只读下载 token 只能：

- 读取开发板 A 的照片列表。
- 下载开发板 A 的最新照片/历史照片。

不能：

- 登录后台页面。
- 访问设备在线状态接口。
- 上传照片。
- 修改任何服务端数据。

token 不要写进 Git 仓库。建议放到环境变量：

```bash
PF_PHOTO_TOKEN=这里填照片只读下载token
```

## 接口总览

服务器地址：

```text
http://117.72.82.29:4311
```

统一鉴权头：

```http
Authorization: Bearer <PF_PHOTO_TOKEN>
```

### 1. 获取历史照片列表

```http
GET /api/photos/board-a/history
Authorization: Bearer <PF_PHOTO_TOKEN>
```

示例：

```bash
curl \
  -H "Authorization: Bearer $PF_PHOTO_TOKEN" \
  http://117.72.82.29:4311/api/photos/board-a/history
```

返回示例：

```json
{
  "photos": [
    {
      "id": "2026-07-25T02-30-00-000Z.jpg",
      "capturedAt": "2026-07-25T02:30:00.000Z",
      "bytes": 123456,
      "url": "/api/photos/board-a/history/2026-07-25T02-30-00-000Z.jpg"
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 照片唯一 ID。自动化去重时用这个字段。 |
| `capturedAt` | 服务端接收到照片的时间，ISO 字符串。 |
| `bytes` | 原图大小，单位 byte。 |
| `url` | 下载该历史照片的相对路径。 |

### 2. 下载某张历史照片

```http
GET /api/photos/board-a/history/<photo.id>
Authorization: Bearer <PF_PHOTO_TOKEN>
```

示例：

```bash
curl \
  -H "Authorization: Bearer $PF_PHOTO_TOKEN" \
  -o input.jpg \
  "http://117.72.82.29:4311/api/photos/board-a/history/2026-07-25T02-30-00-000Z.jpg"
```

### 3. 下载最新照片

这个接口适合快速预览，不建议用它做自动化去重，因为最新照片会变化。

```http
GET /api/photos/board-a/latest
Authorization: Bearer <PF_PHOTO_TOKEN>
```

示例：

```bash
curl \
  -H "Authorization: Bearer $PF_PHOTO_TOKEN" \
  -o latest.jpg \
  http://117.72.82.29:4311/api/photos/board-a/latest
```

## 推荐自动化流程

建议像素化程序每 5 到 10 秒轮询一次历史照片列表。

### 本地状态文件

像素化程序本地维护一个 `processed-photos.json`：

```json
{
  "processedIds": [
    "2026-07-25T02-30-00-000Z.jpg"
  ]
}
```

### 处理流程

1. 读取本地 `processed-photos.json`。
2. 请求 `/api/photos/board-a/history`。
3. 遍历返回的 `photos`。
4. 如果 `photo.id` 已在 `processedIds` 里，跳过。
5. 如果是新照片：
   1. 下载 `photo.url` 到本地临时目录。
   2. 调用图片转像素化逻辑。
   3. 像素化成功后，把 `photo.id` 写入 `processedIds`。
6. 等待 5 到 10 秒，重复执行。

## Node.js 示例

下面是一个最小轮询脚本示例。把 `pixelateImage(inputPath, outputPath)` 替换成你们已有的像素化函数即可。

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE_URL = "http://117.72.82.29:4311";
const TOKEN = process.env.PF_PHOTO_TOKEN;
const STATE_FILE = "./processed-photos.json";
const INPUT_DIR = "./downloaded-photos";
const OUTPUT_DIR = "./pixelated-photos";

if (!TOKEN) {
  throw new Error("PF_PHOTO_TOKEN is required.");
}

async function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { processedIds: [] };
  }
  return JSON.parse(await readFile(STATE_FILE, "utf8"));
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function apiFetch(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response;
}

async function downloadPhoto(photo) {
  await mkdir(INPUT_DIR, { recursive: true });
  const response = await apiFetch(`${BASE_URL}${photo.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const inputPath = path.join(INPUT_DIR, photo.id);
  await writeFile(inputPath, bytes);
  return inputPath;
}

async function pixelateImage(inputPath, outputPath) {
  // TODO: 替换为你们现有的图片转像素化实现。
  // 例如：
  // await runPixelationCli(inputPath, outputPath);
  throw new Error("pixelateImage is not implemented.");
}

async function processOnce() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const state = await loadState();
  const processed = new Set(state.processedIds);

  const response = await apiFetch(`${BASE_URL}/api/photos/board-a/history`);
  const body = await response.json();
  const photos = Array.isArray(body.photos) ? body.photos : [];

  // 服务端返回一般是新照片在前。这里反过来处理，保证从旧到新。
  for (const photo of photos.toReversed()) {
    if (processed.has(photo.id)) continue;

    const inputPath = await downloadPhoto(photo);
    const outputPath = path.join(
      OUTPUT_DIR,
      photo.id.replace(/\.jpg$/i, ".pixel.png"),
    );

    await pixelateImage(inputPath, outputPath);

    processed.add(photo.id);
    state.processedIds = [...processed];
    await saveState(state);

    console.log(`Processed ${photo.id} -> ${outputPath}`);
  }
}

async function main() {
  while (true) {
    try {
      await processOnce();
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

await main();
```

## PowerShell 快速验证

设置 token：

```powershell
$env:PF_PHOTO_TOKEN = "这里填照片只读下载token"
```

查看历史列表：

```powershell
$headers = @{ Authorization = "Bearer $env:PF_PHOTO_TOKEN" }
$history = Invoke-RestMethod `
  -Uri "http://117.72.82.29:4311/api/photos/board-a/history" `
  -Headers $headers

$history.photos
```

下载第一张历史照片：

```powershell
$url = $history.photos[0].url
Invoke-WebRequest `
  -Uri "http://117.72.82.29:4311$url" `
  -Headers $headers `
  -OutFile ".\input.jpg"
```

## 错误处理建议

| 情况 | 处理方式 |
| --- | --- |
| `401 Unauthorized` | token 错误、缺失或已轮换。检查 `PF_PHOTO_TOKEN`。 |
| `404 PHOTO_NOT_FOUND` | 暂时没有照片，等待下一轮轮询即可。 |
| 网络超时 | 本轮跳过，下一轮重试。 |
| 像素化失败 | 不要写入 `processedIds`，下一轮继续重试。 |
| 下载成功但输出保存失败 | 不要写入 `processedIds`，避免漏处理。 |

## 为什么不用服务器主动推送

第一版不建议让 4311 服务器主动调用像素化服务，原因是：

- 轮询更简单，失败后自然重试。
- 像素化程序可以独立部署和调试。
- 4311 服务器保持“照片仓库”职责，不和具体算法耦合。
- token 权限可以控制得很小，只读照片即可。

后续如果轮询不够用，再升级成 Webhook 或队列。

## 对接检查清单

- [ ] 像素化设备已拿到 `PF_PHOTO_TOKEN`。
- [ ] 能请求 `/api/photos/board-a/history`。
- [ ] 能下载 `photo.url` 对应原图。
- [ ] 本地有 `processed-photos.json` 去重。
- [ ] 像素化成功后才写入 `processedIds`。
- [ ] token 没有提交进 Git。
- [ ] 日志不要打印完整 token。
