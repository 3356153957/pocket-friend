import type { ReactNode } from "react";

const colorClasses = {
  card: "bg-card",
  cyan: "bg-cyan",
  ghost: "bg-card",
  lime: "bg-lime",
  mint: "bg-mint",
  pink: "bg-pink",
} as const;

export function pixelColorClass(color: "cyan" | "lime" | "pink") {
  return colorClasses[color];
}

export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/favicon.svg"
      alt="Pocket Friend"
      width={size}
      height={size}
      className="pixel-image"
    />
  );
}

export function PixelButton({
  children,
  onClick,
  variant = "cyan",
  fullWidth = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "cyan" | "pink" | "lime" | "ghost";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`pixel-button ${colorClasses[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function PixelCard({
  children,
  className = "",
  color = "card",
}: {
  children: ReactNode;
  className?: string;
  color?: "card" | "mint" | "lime" | "cyan" | "pink";
}) {
  return <div className={`pixel-border-sm ${colorClasses[color]} p-3 ${className}`}>{children}</div>;
}

export function PixelLabel({ children }: { children: ReactNode }) {
  return <div className="font-pixel text-[9px] uppercase text-ink">{children}</div>;
}

export function StepPips({ active, total }: { active: number; total: number }) {
  return (
    <div className="flex gap-1" aria-label={`第 ${active} 步，共 ${total} 步`}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`h-2 w-4 border-2 border-ink ${index < active ? "bg-pink" : "bg-card"}`}
        />
      ))}
    </div>
  );
}
