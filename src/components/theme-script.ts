export const THEME_KEY = "proovd-theme";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Light is the default; "system" follows the OS and updates live.
 */
export const THEME_SCRIPT = `(function(){try{var k="${THEME_KEY}",p=localStorage.getItem(k)||"light",m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var t=p==="system"?(m.matches?"dark":"light"):p;document.documentElement.dataset.theme=t;}a();m.addEventListener("change",function(){p=localStorage.getItem(k)||"light";a();});}catch(e){document.documentElement.dataset.theme="light";}})();`;
