import { useEffect, useMemo, useRef } from "react";

export interface IslandPal {
  id: string;
  name: string;
  label: string;
  spriteUrl?: string | undefined;
  realPhotoUrl?: string | undefined;
  hair: string;
  body: string;
  tags: string[];
  bio: string;
  metAt: string;
  rx: number;
  ry: number;
}

export type IslandSceneId = "hackathon" | "alt";

interface InteractiveIslandProps {
  scene: IslandSceneId;
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

const SCENES: Record<IslandSceneId, { src: string; label: string; walk: { x1: number; x2: number; y1: number; y2: number } }> = {
  hackathon: {
    src: "/assets/scene-hackathon.png",
    label: "HACKATHON ISLAND",
    walk: { x1: 0.18, x2: 0.82, y1: 0.30, y2: 0.82 },
  },
  alt: {
    src: "/assets/scene-alt.png",
    label: "ISLAND CLOSE-UP",
    walk: { x1: 0.12, x2: 0.88, y1: 0.28, y2: 0.90 },
  },
};

const DIALOGS = [
  "先把主流程跑通！",
  "这个岛终于动起来了。",
  "点我可以看名片。",
  "Demo day mode on.",
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

function isWalkable(scene: IslandSceneId, rx: number, ry: number) {
  const walk = SCENES[scene].walk;
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
  ctx.drawImage(image, -width / 2, -height, width, height);
  ctx.restore();
}

export default function InteractiveIsland({ scene, pals, selectedId, onSelect, compact = false }: InteractiveIslandProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  const sceneConfig = SCENES[scene];
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
    let bubbleOwner = pals[0]?.id ?? "";

    const sprites: SpriteState[] = pals.map((pal, index) => {
      const loadedSprite = pal.spriteUrl ? new Image() : undefined;
      const loadedRealPhoto = pal.realPhotoUrl ? new Image() : undefined;
      if (loadedSprite && pal.spriteUrl) loadedSprite.src = pal.spriteUrl;
      if (loadedRealPhoto && pal.realPhotoUrl) loadedRealPhoto.src = pal.realPhotoUrl;
      return {
        pal,
        rx: pal.rx,
        ry: pal.ry,
        angle: -0.6 + index * 0.7,
        speed: 0.00018 + index * 0.000035,
        frame: 0,
        clickScale: 1,
        spawnAt: performance.now() + index * 180,
        loadedSprite,
        loadedRealPhoto,
      };
    });

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const bounds = canvasEl.getBoundingClientRect();
      canvasEl.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvasEl.height = Math.max(1, Math.floor(bounds.height * dpr));
    }

    function drawBackground() {
      ctx.fillStyle = "#c8f3e7";
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      if (image.complete && image.naturalWidth > 0) {
        rect = coverRect(canvasEl.width, canvasEl.height, image.naturalWidth, image.naturalHeight);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
      } else {
        rect = { x: 0, y: 0, w: canvasEl.width, h: canvasEl.height };
        ctx.fillStyle = "#10bde8";
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height * 0.44);
        ctx.fillStyle = "#9fe94b";
        ctx.fillRect(0, canvasEl.height * 0.44, canvasEl.width, canvasEl.height * 0.56);
      }
    }

    function updateSprite(sprite: SpriteState, now: number) {
      const settled = now - sprite.spawnAt > 900;
      sprite.frame = Math.floor(now / 220) % 2;
      if (sprite.clickScale > 1) sprite.clickScale += (1 - sprite.clickScale) * 0.2;

      if (!settled) return;
      const nx = sprite.rx + Math.cos(sprite.angle) * sprite.speed;
      const ny = sprite.ry + Math.sin(sprite.angle) * sprite.speed * 0.68;
      if (isWalkable(scene, nx, ny)) {
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
      ctx.drawImage(sprite.loadedRealPhoto, badgeX + 3 * dpr, badgeY + 3 * dpr, badge - 6 * dpr, badge - 6 * dpr);
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
  }, [compact, image, pals, scene, sceneConfig.label]);

  return <canvas ref={canvasRef} className="h-full w-full pixel-image" aria-label="Pocket Friend interactive island" />;
}
