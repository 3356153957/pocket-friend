const LOCAL_PORTRAIT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%2369f0ae'/%3E%3Crect x='20' y='22' width='56' height='52' fill='%23fff9ed' stroke='%23263f3e' stroke-width='6'/%3E%3Ccircle cx='38' cy='46' r='5' fill='%23263f3e'/%3E%3Ccircle cx='58' cy='46' r='5' fill='%23263f3e'/%3E%3Cpath d='M34 61h28' stroke='%23ff7f72' stroke-width='6'/%3E%3C/svg%3E";

interface PublicDemoPhotoCandidate {
  name?: string;
}

export async function createDemoDownloadedPhoto(warning = "公开演示版使用本地形象。") {
  return {
    id: `demo-${Date.now()}`,
    name: "演示居民",
    capturedAt: new Date().toISOString(),
    originalDataUrl: LOCAL_PORTRAIT,
    pixelPortraitUrl: LOCAL_PORTRAIT,
    source: "demo",
    spriteSource: "local-fallback",
    warning,
  };
}

export async function fetchLatestHardwarePhoto() {
  return createDemoDownloadedPhoto();
}

export async function fetchHardwarePhotoCandidates() {
  return [];
}

export async function fetchLatestHardwarePhotoCandidate() {
  throw new Error("公开演示版未连接照片服务。");
}

export async function processHardwarePhotoCandidate(candidate: PublicDemoPhotoCandidate) {
  return createDemoDownloadedPhoto(`公开演示版不会处理照片：${candidate?.name ?? "本地演示"}`);
}

export function makePhotoApiUrl() {
  return "";
}
