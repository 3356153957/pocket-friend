interface PublicDemoEnvironment {
  MODE?: string;
}

export function isPublicDemoMode(environment?: PublicDemoEnvironment): boolean {
  return environment?.MODE === "public-demo";
}
