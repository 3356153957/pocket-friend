export const AMAP_PUBLIC_ENV_NAMES = [
  "EXPO_PUBLIC_AMAP_KEY",
  "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
] as const;

type AmapEnvName = typeof AMAP_PUBLIC_ENV_NAMES[number];
type PublicEnvironment = Partial<Record<AmapEnvName, string | undefined>>;
type ViteEnvironment = Partial<Record<string, string | boolean | undefined>>;

export type AmapConfig =
  | {
      status: "ready";
      key: string;
      securityJsCode: string;
    }
  | {
      status: "missing";
      missing: AmapEnvName[];
    };

export function readAmapConfig(environment: PublicEnvironment): AmapConfig {
  const missing = AMAP_PUBLIC_ENV_NAMES.filter(
    (name) => !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    return { status: "missing", missing };
  }

  return {
    status: "ready",
    key: environment.EXPO_PUBLIC_AMAP_KEY!.trim(),
    securityJsCode: environment.EXPO_PUBLIC_AMAP_SECURITY_JS_CODE!.trim(),
  };
}

export function readAmapConfigFromViteEnv(
  environment: ViteEnvironment,
): AmapConfig {
  const value = (name: AmapEnvName): string | undefined => {
    const candidate = environment[name];
    return typeof candidate === "string" ? candidate : undefined;
  };

  return readAmapConfig({
    EXPO_PUBLIC_AMAP_KEY: value("EXPO_PUBLIC_AMAP_KEY"),
    EXPO_PUBLIC_AMAP_SECURITY_JS_CODE: value(
      "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
    ),
  });
}
