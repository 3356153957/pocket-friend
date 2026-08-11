interface PublicDemoEnvironment {
  MODE?: string;
}

export function isPublicDemoMode(environment?: PublicDemoEnvironment): boolean {
  return environment?.MODE === "public-demo";
}

const viteEnvironment = typeof import.meta.env === "object"
  ? import.meta.env
  : undefined;

export const PUBLIC_DEMO_MODE = isPublicDemoMode(viteEnvironment);
