import { useEffect, useMemo, useRef } from "react";

export interface IslandPal {
  id: string;
  name: string;
  label: string;
  spriteUrl?: string | undefined;
  realPhotoUrl?: string | undefined;
  spriteSource?: "seedream" | "local-fallback" | undefined;
  spriteRotation?: 0 | 180 | undefined;
  realPhotoRotation?: 0 | 180 | undefined;
  hair: string;
  body: string;
  tags: string[];
  bio: string;
  metAt: string;
  rx: number;
  ry: number;
}

export type IslandSceneId = "hackathon" | "alt";

export interface IslandSceneConfig {
  src: string;
  kind?: "lakeside" | "garden" | "lab" | "stage";
  label: string;
  walk: { x1: number; x2: number; y1: number; y2: number };
}

interface InteractiveIslandProps {
  scene?: IslandSceneId;
  sceneConfig?: IslandSceneConfig;
  pals: IslandPal[];
  selectedId: string;
  onSelect: (palId: string) => void;
  compact?: boolean;
}

interface SpriteState {
  pal: IslandPal;
  rx: number;
  ry: number;
  angle: number;
  speed: number;
  frame: number;
  clickScale: number;
  spawnAt: number;
  loadedSprite?: HTMLImageElement | undefined;
  loadedRealPhoto?: HTMLImageElement | undefined;
}

function loadOptionalImage(src?: string): HTMLImageElement | undefined {
  if (!src) return undefined;
  const image = new Image();
  image.src = src;
  return image;
}

function createSpriteState(pal: IslandPal, index: number, now: number): SpriteState {
  return {
    pal,
    rx: pal.rx,
    ry: pal.ry,
    angle: -0.6 + index * 0.7,
    speed: 0.00018 + index * 0.000035,
    frame: 0,
    clickScale: 1,
    spawnAt: now + index * 180,
    loadedSprite: loadOptionalImage(pal.spriteUrl),
    loadedRealPhoto: loadOptionalImage(pal.realPhotoUrl),
  };
}

function syncSpriteStates(states: Map<string, SpriteState>, pals: IslandPal[], now: number) {
  const nextIds = new Set(pals.map((pal) => pal.id));
  for (const id of states.keys()) {
    if (!nextIds.has(id)) states.delete(id);
  }

  pals.forEach((pal, index) => {
    const existing = states.get(pal.id);
    if (!existing) {
      states.set(pal.id, createSpriteState(pal, index, now));
      return;
    }

    if (existing.pal.spriteUrl !== pal.spriteUrl) existing.loadedSprite = loadOptionalImage(pal.spriteUrl);
    if (existing.pal.realPhotoUrl !== pal.realPhotoUrl) existing.loadedRealPhoto = loadOptionalImage(pal.realPhotoUrl);
    existing.pal = pal;
  });
}

const SCENES: Record<IslandSceneId, IslandSceneConfig> = {
  hackathon: {
    src: "/assets/scene-hackathon.png",
    label: "黑客松小岛",
    walk: { x1: 0.18, x2: 0.82, y1: 0.30, y2: 0.82 },
  },
  alt: {
    src: "/assets/scene-alt.png",
    label: "小岛近景",
    walk: { x1: 0.12, x2: 0.88, y1: 0.28, y2: 0.90 },
  },
};

const DIALOGS = [
  "先把主流程跑通！",
  "这个岛终于动起来了。",
  "点我可以看名片。",
  "演示日模式开启。",
  "刚从工位出来透气。",
  "把灵感先贴上墙。",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function coverRect(canvasW: number, canvasH: number, imageW: number, imageH: number) {
  const imageAspect = imageW / imageH;
  const canvasAspect = canvasW / canvasH;
  let w = canvasW;
  let h = canvasH;
  if (canvasAspect > imageAspect) h = canvasW / imageAspect;
  else w = canvasH * imageAspect;
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}

function fillPixelScene(ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[]) {
  ctx.fillStyle = palette[0] ?? "#0f172a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = palette[1] ?? "#1f2937";
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = palette[2] ?? "#334155";
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 97) % w;
    const y = h * 0.55 + ((i * 53) % (h * 0.4));
    ctx.fillRect(x, y, 3, 3);
  }
}

function drawPixelSceneLabel(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.fillStyle = "rgba(10,10,18,0.35)";
  ctx.fillRect(w * 0.5 - 70, h * 0.12, 140, 22);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, w * 0.5, h * 0.12 + 15);
}

function drawGardenScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillPixelScene(ctx, w, h, ["#2f6b3a", "#4a8f4a", "#8bc34a", "#c4a484", "#5d4037"]);
  ctx.fillStyle = "#a3e635";
  ctx.fillRect(0, 0, w, h * 0.55);
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = i % 2 ? "#d6c2a3" : "#b8956c";
    ctx.fillRect(w * 0.2 + i * w * 0.04, h * 0.62, w * 0.035, h * 0.2);
  }
  ctx.fillStyle = "#6d4c41";
  ctx.fillRect(w * 0.55, h * 0.38, w * 0.28, h * 0.28);
  ctx.fillStyle = "#f5f5f4";
  ctx.fillRect(w * 0.52, h * 0.32, w * 0.34, h * 0.08);
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(w * 0.58, h * 0.4, w * 0.22, h * 0.12);
  ctx.fillStyle = "#38bdf8";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(w * 0.6 + i * w * 0.05, h * 0.42, w * 0.035, h * 0.04);
  ctx.fillStyle = "#166534";
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.arc(w * (0.12 + i * 0.12), h * 0.5, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPixelSceneLabel(ctx, w, h, "GARDEN STALL");
}

function drawLabScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillPixelScene(ctx, w, h, ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483"]);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = "rgba(94,234,212,0.15)";
    ctx.fillRect(w * (0.12 + i * 0.16), 0, w * 0.08, h * 0.55);
    ctx.fillStyle = "#5eead4";
    ctx.fillRect(w * (0.14 + i * 0.16), h * 0.05, w * 0.04, 6);
  }
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 4; i += 1) {
      const x = w * (0.12 + i * 0.2);
      const y = h * (0.42 + row * 0.18);
      ctx.fillStyle = "#334155";
      ctx.fillRect(x, y, w * 0.14, h * 0.08);
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(x + 8, y - 18, w * 0.08, 16);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x + 10, y + h * 0.08, 10, h * 0.06);
      ctx.fillRect(x + w * 0.1, y + h * 0.08, 10, h * 0.06);
    }
  }
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = "#334155";
  for (let i = 0; i < 10; i += 1) ctx.fillRect(i * w * 0.1, h * 0.72, 2, h * 0.28);
  drawPixelSceneLabel(ctx, w, h, "ALL-NIGHT LAB");
}

function drawStageScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillPixelScene(ctx, w, h, ["#2b1055", "#7597de", "#ffd700", "#1a1a2e", "#ff6b6b"]);
  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(0, 0, w * 0.12, h * 0.7);
  ctx.fillRect(w * 0.88, 0, w * 0.12, h * 0.7);
  ctx.fillStyle = "#b91c1c";
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(i * w * 0.02, 0, w * 0.012, h * 0.7);
    ctx.fillRect(w * 0.88 + i * w * 0.02, 0, w * 0.012, h * 0.7);
  }
  ctx.fillStyle = "#312e81";
  ctx.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.45);
  ctx.fillStyle = "#fbbf24";
  ctx.font = `${Math.max(14, w * 0.04)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("DEMO DAY", w * 0.5, h * 0.3);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(0, h * 0.55, w, h * 0.12);
  ctx.fillStyle = "#92400e";
  ctx.fillRect(0, h * 0.67, w, h * 0.33);
  ctx.fillStyle = "rgba(254,240,138,0.12)";
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 0);
  ctx.lineTo(w * 0.15, h * 0.55);
  ctx.lineTo(w * 0.45, h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.7, 0);
  ctx.lineTo(w * 0.55, h * 0.55);
  ctx.lineTo(w * 0.85, h * 0.55);
  ctx.closePath();
  ctx.fill();
  drawPixelSceneLabel(ctx, w, h, "PITCH STAGE");
}

function drawLakesideScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillPixelScene(ctx, w, h, ["#1e3a5f", "#2d5a3d", "#3d7a4a", "#87ceeb", "#c4a574"]);
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.48, w * 0.18, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(147,197,253,0.45)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.46, w * 0.1, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c4a574";
  ctx.lineWidth = Math.max(6, w * 0.012);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.48, w * 0.28, h * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const x = w * (0.1 + i * 0.11);
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(x, h * 0.32, 6, h * 0.16);
    ctx.fillStyle = "#2d6a4f";
    ctx.beginPath();
    ctx.arc(x + 3, h * 0.3, 18 + (i % 3) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPixelSceneLabel(ctx, w, h, "LAKESIDE HACK");
}

function drawSceneBackdrop(ctx: CanvasRenderingContext2D, kind: IslandSceneConfig["kind"], w: number, h: number) {
  if (kind === "garden") drawGardenScene(ctx, w, h);
  else if (kind === "lab") drawLabScene(ctx, w, h);
  else if (kind === "stage") drawStageScene(ctx, w, h);
  else drawLakesideScene(ctx, w, h);
}

function isWalkable(sceneConfig: IslandSceneConfig, rx: number, ry: number) {
  const walk = sceneConfig.walk;
  return rx >= walk.x1 && rx <= walk.x2 && ry >= walk.y1 && ry <= walk.y2;
}

function drawBlockPerson(ctx: CanvasRenderingContext2D, sprite: SpriteState, size: number, now: number) {
  const s = size / 20;
  const bob = Math.sin(now * 0.008 + sprite.rx * 10) * s;
  const scale = sprite.clickScale;

  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(scale, scale);
  ctx.translate(-6 * s, -20 * s);

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  };

  px(2, 0, 8, 3, "#061627");
  px(2, 1, 8, 4, sprite.pal.hair);
  px(3, 4, 7, 5, "#ffd7b5");
  px(4, 6, 1, 1, "#061627");
  px(7, 6, 1, 1, "#061627");
  px(5, 8, 2, 1, "#f08aa8");
  px(3, 9, 7, 6, sprite.pal.body);
  px(2, 10, 1, 5, sprite.pal.body);
  px(10, 10, 1, 5, sprite.pal.body);
  if (sprite.frame === 0) {
    px(3, 15, 2, 4, "#24324f");
    px(8, 15, 2, 4, "#24324f");
  } else {
    px(4, 15, 5, 4, "#24324f");
  }
  px(3, 19, 3, 1, "#061627");
  px(7, 19, 3, 1, "#061627");
  ctx.restore();
}

function drawImageWithRotation(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: 0 | 180 | undefined,
) {
  if (rotation !== 180) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(Math.PI);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawGeneratedSprite(ctx: CanvasRenderingContext2D, sprite: SpriteState, size: number, now: number) {
  const image = sprite.loadedSprite;
  if (!image?.complete || image.naturalWidth <= 0) {
    drawBlockPerson(ctx, sprite, size, now);
    return;
  }

  const bob = Math.sin(now * 0.008 + sprite.rx * 10) * (size / 20);
  const width = size * 1.5 * sprite.clickScale;
  const height = size * 2.05 * sprite.clickScale;
  ctx.save();
  ctx.translate(0, bob);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "rgba(6,22,39,0.28)";
  ctx.fillRect(-width * 0.32, -4, width * 0.64, 5);
  drawImageWithRotation(ctx, image, -width / 2, -height, width, height, sprite.pal.spriteRotation);
  ctx.restore();
}

export default function InteractiveIsland({ scene = "hackathon", sceneConfig: customSceneConfig, pals, selectedId, onSelect, compact = false }: InteractiveIslandProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const palsRef = useRef(pals);
  const spriteStatesRef = useRef(new Map<string, SpriteState>());

  const sceneConfig = customSceneConfig ?? SCENES[scene];
  const image = useMemo(() => {
    const img = new Image();
    img.src = sceneConfig.src;
    return img;
  }, [sceneConfig.src]);

  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedIdRef.current = selectedId;
  }, [onSelect, selectedId]);

  useEffect(() => {
    palsRef.current = pals;
    syncSpriteStates(spriteStatesRef.current, pals, performance.now());
  }, [pals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const canvasEl = canvas;
    const ctx = context;
    let disposed = false;
    let animationId = 0;
    let dpr = window.devicePixelRatio || 1;
    let rect = { x: 0, y: 0, w: 1, h: 1 };
    let lastBubbleAt = 0;
    let bubble = "";
    let bubbleOwner = palsRef.current[0]?.id ?? "";
    spriteStatesRef.current.clear();
    syncSpriteStates(spriteStatesRef.current, palsRef.current, performance.now());

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const bounds = canvasEl.getBoundingClientRect();
      canvasEl.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvasEl.height = Math.max(1, Math.floor(bounds.height * dpr));
    }

    function drawBackground() {
      const kind = sceneConfig.kind;
      const shouldDrawCanvasScene = kind === "lakeside" || kind === "garden" || kind === "lab" || kind === "stage";
      rect = { x: 0, y: 0, w: canvasEl.width, h: canvasEl.height };

      if (shouldDrawCanvasScene) {
        drawSceneBackdrop(ctx, kind, canvasEl.width, canvasEl.height);
        return;
      }

      ctx.fillStyle = "#c8f3e7";
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      if (sceneConfig.src && image.complete && image.naturalWidth > 0) {
        rect = coverRect(canvasEl.width, canvasEl.height, image.naturalWidth, image.naturalHeight);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
        return;
      }

      if (kind) {
        drawSceneBackdrop(ctx, kind, canvasEl.width, canvasEl.height);
        return;
      }

      ctx.fillStyle = "#10bde8";
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height * 0.44);
      ctx.fillStyle = "#9fe94b";
      ctx.fillRect(0, canvasEl.height * 0.44, canvasEl.width, canvasEl.height * 0.56);
    }

    function updateSprite(sprite: SpriteState, now: number) {
      const settled = now - sprite.spawnAt > 900;
      sprite.frame = Math.floor(now / 220) % 2;
      if (sprite.clickScale > 1) sprite.clickScale += (1 - sprite.clickScale) * 0.2;

      if (!settled) return;
      const nx = sprite.rx + Math.cos(sprite.angle) * sprite.speed;
      const ny = sprite.ry + Math.sin(sprite.angle) * sprite.speed * 0.68;
      if (isWalkable(sceneConfig, nx, ny)) {
        sprite.rx = nx;
        sprite.ry = ny;
      } else {
        sprite.angle += Math.PI * 0.65;
      }
      sprite.angle += Math.sin(now * 0.0005 + sprite.rx * 8) * 0.006;
      sprite.rx = clamp(sprite.rx, 0.08, 0.92);
      sprite.ry = clamp(sprite.ry, 0.18, 0.92);
    }

    function screenPos(sprite: SpriteState, now: number) {
      const age = now - sprite.spawnAt;
      const t = clamp(age / 900, 0, 1);
      const arrival = easeOutBack(t);
      const targetX = rect.x + sprite.rx * rect.w;
      const targetY = rect.y + sprite.ry * rect.h;
      const startX = rect.x + 0.5 * rect.w;
      const startY = rect.y + 1.05 * rect.h;
      const jump = Math.sin(t * Math.PI) * rect.h * 0.08;
      return {
        x: startX + (targetX - startX) * arrival,
        y: startY + (targetY - startY) * arrival - jump,
      };
    }

    function drawLabel(sprite: SpriteState, x: number, y: number, charSize: number) {
      ctx.save();
      ctx.font = `${Math.max(8, charSize * 0.18)}px "Press Start 2P", monospace`;
      const width = ctx.measureText(sprite.pal.name).width;
      const pad = 5 * dpr;
      const boxH = 15 * dpr;
      ctx.fillStyle = selectedIdRef.current === sprite.pal.id ? "rgba(255,78,170,0.92)" : "rgba(6,22,39,0.78)";
      ctx.fillRect(x - width / 2 - pad, y - charSize - boxH - 3 * dpr, width + pad * 2, boxH);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(sprite.pal.name, x, y - charSize - 6 * dpr);
      ctx.restore();
    }

    function drawRealPhotoBadge(sprite: SpriteState, x: number, y: number, charSize: number) {
      if (!sprite.loadedRealPhoto?.complete || sprite.loadedRealPhoto.naturalWidth <= 0) return;
      const badge = (compact ? 24 : 30) * dpr;
      const badgeX = x - badge / 2;
      const badgeY = y - charSize - badge - 22 * dpr;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#061627";
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(badgeX, badgeY, badge, badge);
      ctx.strokeRect(badgeX, badgeY, badge, badge);
      drawImageWithRotation(
        ctx,
        sprite.loadedRealPhoto,
        badgeX + 3 * dpr,
        badgeY + 3 * dpr,
        badge - 6 * dpr,
        badge - 6 * dpr,
        sprite.pal.realPhotoRotation,
      );
      ctx.restore();
    }

    function drawBubble(owner: SpriteState, now: number) {
      if (!bubble || now - lastBubbleAt > 2400) return;
      const pos = screenPos(owner, now);
      const alpha = 1 - clamp((now - lastBubbleAt - 1600) / 800, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${compact ? 10 * dpr : 12 * dpr}px "VT323", monospace`;
      const width = Math.min(ctx.measureText(bubble).width + 18 * dpr, rect.w * 0.68);
      const height = 26 * dpr;
      const x = clamp(pos.x - width / 2, 6 * dpr, canvasEl.width - width - 6 * dpr);
      const y = clamp(pos.y - 70 * dpr, 8 * dpr, canvasEl.height - height - 8 * dpr);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.strokeStyle = "#061627";
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = "#061627";
      ctx.fillText(bubble, x + 9 * dpr, y + 17 * dpr);
      ctx.restore();
    }

    function loop(now: number) {
      if (disposed) return;
      drawBackground();

      const sprites = [...spriteStatesRef.current.values()];
      if (now - lastBubbleAt > 3200 && sprites.length > 0) {
        const index = Math.floor((now / 3200) % sprites.length);
        bubbleOwner = sprites[index]?.pal.id ?? "";
        bubble = DIALOGS[index % DIALOGS.length] ?? "Hello!";
        lastBubbleAt = now;
      }

      sprites.forEach((sprite) => updateSprite(sprite, now));
      const sorted = [...sprites].sort((a, b) => a.ry - b.ry);
      for (const sprite of sorted) {
        const pos = screenPos(sprite, now);
        const charSize = rect.h * (compact ? 0.08 : 0.075);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        drawGeneratedSprite(ctx, sprite, charSize, now);
        ctx.restore();
        drawLabel(sprite, pos.x, pos.y, charSize);
        drawRealPhotoBadge(sprite, pos.x, pos.y, charSize);
      }
      const owner = sprites.find((sprite) => sprite.pal.id === bubbleOwner);
      if (owner) drawBubble(owner, now);

      ctx.save();
      ctx.font = `${8 * dpr}px "Press Start 2P", monospace`;
      ctx.fillStyle = "rgba(6,22,39,0.58)";
      ctx.fillRect(8 * dpr, 8 * dpr, 142 * dpr, 19 * dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(sceneConfig.label, 14 * dpr, 21 * dpr);
      ctx.restore();

      animationId = requestAnimationFrame(loop);
    }

    function handleClick(event: MouseEvent) {
      const bounds = canvasEl.getBoundingClientRect();
      const mx = (event.clientX - bounds.left) * dpr;
      const my = (event.clientY - bounds.top) * dpr;
      const now = performance.now();
      const sprites = [...spriteStatesRef.current.values()];
      for (let index = sprites.length - 1; index >= 0; index--) {
        const sprite = sprites[index];
        if (!sprite) continue;
        const pos = screenPos(sprite, now);
        const charSize = rect.h * (compact ? 0.08 : 0.075);
        if (Math.hypot(mx - pos.x, my - (pos.y - charSize * 0.45)) < charSize * 0.95) {
          sprite.clickScale = 1.28;
          bubble = `${sprite.pal.name}: ${sprite.pal.bio.slice(0, 18)}`;
          bubbleOwner = sprite.pal.id;
          lastBubbleAt = now;
          onSelectRef.current(sprite.pal.id);
          return;
        }
      }
    }

    resize();
    image.onload = resize;
    canvasEl.addEventListener("click", handleClick);
    animationId = requestAnimationFrame(loop);
    const observer = new ResizeObserver(resize);
    observer.observe(canvasEl);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      canvasEl.removeEventListener("click", handleClick);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [compact, image, sceneConfig]);

  return <canvas ref={canvasRef} className="h-full w-full pixel-image" aria-label="pocket friend 互动小岛" />;
}
