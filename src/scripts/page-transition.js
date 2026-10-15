const curtain = document.querySelector(".route-curtain");
const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const transitionKey = "kh-route-transition";
const duration = 650;
const easing = "cubic-bezier(0.65, 0, 0.35, 1)";

if (curtain) {
  let navigating = false;
  const canAnimate = typeof curtain.animate === "function";

  const animateCurtain = (from, to) =>
    curtain.animate(
      [{ transform: from }, { transform: to }],
      { duration, easing, fill: "forwards" }
    );

  if (!canAnimate) root.classList.remove("route-arriving");

  if (canAnimate && root.classList.contains("route-arriving")) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const reveal = animateCurtain("translateY(0)", "translateY(-100%)");
        const cleanup = () => {
          root.classList.remove("route-arriving");
          reveal.cancel();
        };
        reveal.finished.then(cleanup, cleanup);
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !canAnimate ||
      reducedMotion.matches
    ) return;

    const target = event.target;
    const link = target instanceof Element ? target.closest("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

    const destination = new URL(link.href, location.href);
    if (
      destination.origin !== location.origin ||
      !/^https?:$/.test(destination.protocol) ||
      (destination.pathname === location.pathname && destination.search === location.search) ||
      /\.[a-z0-9]+$/i.test(destination.pathname) && !destination.pathname.endsWith(".html")
    ) return;

    event.preventDefault();
    if (navigating) return;
    navigating = true;

    const cover = animateCurtain("translateY(100%)", "translateY(0)");
    const finish = () => {
      try {
        const path = destination.pathname.replace(/\/$/, "") || "/";
        sessionStorage.setItem(transitionKey, JSON.stringify({
          path: path + destination.search,
          time: Date.now(),
        }));
      } catch {}
      location.assign(destination.href);
    };

    let finished = false;
    const navigateOnce = () => {
      if (finished) return;
      finished = true;
      finish();
    };
    cover.finished.then(navigateOnce, navigateOnce);
    window.setTimeout(navigateOnce, duration + 300);
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    navigating = false;
    curtain.getAnimations().forEach((animation) => animation.cancel());
    root.classList.remove("route-arriving");
  });
}
