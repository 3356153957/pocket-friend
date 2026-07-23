import type { BrowserLocationObject } from "./locationSampling.ts";

export const HIGH_ACCURACY_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

interface BrowserPositionError {
  code: number;
  message: string;
}

export interface BrowserGeolocation {
  watchPosition(
    success: (position: BrowserLocationObject) => void,
    error: (error: BrowserPositionError) => void,
    options: PositionOptions,
  ): number;
  clearWatch(watchId: number): void;
}

export interface BrowserLocationSubscription {
  remove(): void;
}

function browserLocationErrorMessage(error: BrowserPositionError): string {
  switch (error.code) {
    case 1:
      return "定位权限未开启";
    case 2:
      return "浏览器暂时无法确定位置";
    case 3:
      return "浏览器定位超时";
    default:
      return error.message || "浏览器定位失败";
  }
}

export function watchBrowserPosition(
  geolocation: BrowserGeolocation,
  onLocation: (position: BrowserLocationObject) => void,
  onError: (reason: string) => void,
): BrowserLocationSubscription {
  const watchId = geolocation.watchPosition(
    onLocation,
    (error) => onError(browserLocationErrorMessage(error)),
    HIGH_ACCURACY_POSITION_OPTIONS,
  );

  return {
    remove: () => geolocation.clearWatch(watchId),
  };
}
