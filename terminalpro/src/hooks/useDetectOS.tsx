type OperatingSystem = {
  isMacOS: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isIOS: boolean;
  isAndroid: boolean;
};

const useDetectOS = (): OperatingSystem => {
  // Use modern userAgentData API with fallback
  const userAgent = navigator.userAgent.toLowerCase();
  const userAgentData = (navigator as any).userAgentData;

  // Modern browsers
  if (userAgentData?.platform) {
    const platform = userAgentData.platform.toLowerCase();
    return {
      isMacOS: platform === "macos",
      isWindows: platform === "windows",
      isLinux: platform === "linux",
      isIOS: platform === "ios",
      isAndroid: platform === "android",
    };
  }

  // Fallback for older browsers
  return {
    isMacOS: /macintosh|mac os x/i.test(userAgent),
    isWindows: /windows/.test(userAgent),
    isLinux: /linux/.test(userAgent),
    isIOS:
      /iphone|ipad|ipod/i.test(userAgent) ||
      (navigator.maxTouchPoints > 0 && /macintosh/i.test(userAgent)), // iPad on iOS 13+
    isAndroid: /android/i.test(userAgent),
  };
};

export default useDetectOS;
