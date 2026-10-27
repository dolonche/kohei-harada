import gsap from "gsap";

const SLIDER_SPEED = 60;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const visibleVideos = new Set<HTMLVideoElement>();
const observedVideos = new Set<HTMLVideoElement>();
type SliderState = { tween?: gsap.core.Tween; visible: boolean };
const sliders = new Set<SliderState>();

function syncSlider(state: SliderState) {
  if (state.visible && !document.hidden && !reducedMotion.matches) state.tween?.play();
  else state.tween?.pause();
}

function playVisibleVideo(video: HTMLVideoElement) {
  if (document.hidden || !visibleVideos.has(video)) return;
  video.play().catch(() => {
    // Keep the poster when the browser blocks muted playback.
  });
}

const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const video = entry.target as HTMLVideoElement;
    if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
      visibleVideos.add(video);
      playVisibleVideo(video);
    } else {
      visibleVideos.delete(video);
      video.pause();
    }
  });
}, { threshold: [0, 0.15] });

/** Play muted project videos only while they are visible in the active tab. */
export function observeProjectVideo(video: HTMLVideoElement) {
  if (observedVideos.has(video)) return;
  observedVideos.add(video);
  videoObserver.observe(video);
}

const sliderObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const state = (entry.target as HTMLElement & { sliderState?: SliderState }).sliderState;
    if (!state) return;
    state.visible = entry.isIntersecting;
    syncSlider(state);
  });
}, { threshold: 0 });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) observedVideos.forEach((video) => video.pause());
  else visibleVideos.forEach(playVisibleVideo);
  sliders.forEach(syncSlider);
});
reducedMotion.addEventListener("change", () => sliders.forEach(syncSlider));

/** Initialize the shared continuous gallery after its content is displayed. */
export function initializeProjectSlider(track: HTMLElement) {
  const viewport = track.parentElement;
  if (!viewport || track.dataset.sliderReady) return;
  const originals = Array.from(track.children) as HTMLElement[];
  if (!originals.length) return;
  track.dataset.sliderReady = "true";

  let cycleCount = 1;
  function appendCycle() {
    originals.forEach((slide) => {
      const duplicate = slide.cloneNode(true) as HTMLElement;
      duplicate.setAttribute("aria-hidden", "true");
      if (duplicate instanceof HTMLImageElement) duplicate.alt = "";
      track.appendChild(duplicate);
    });
    cycleCount += 1;
  }
  appendCycle();

  const state: SliderState = { visible: false };
  sliders.add(state);
  (viewport as HTMLElement & { sliderState?: SliderState }).sliderState = state;

  function rebuild() {
    const firstCopy = track.children[originals.length] as HTMLElement;
    const cycleWidth = firstCopy.offsetLeft - originals[0].offsetLeft;
    if (cycleWidth <= 0) return;
    const trackStyle = getComputedStyle(track);
    const gap = parseFloat(trackStyle.columnGap) || 0;
    // Cover the viewport even after the track has moved an entire original cycle.
    const requiredCycles = Math.max(2, Math.ceil((viewport.clientWidth + gap) / cycleWidth) + 1);
    while (cycleCount < requiredCycles) appendCycle();
    while (cycleCount > requiredCycles) {
      for (let index = 0; index < originals.length; index += 1) track.lastElementChild?.remove();
      cycleCount -= 1;
    }

    const initialOffset = parseFloat(trackStyle.getPropertyValue("--slider-start-offset")) || 0;
    const phase = state.tween?.progress() ?? initialOffset / cycleWidth;
    state.tween?.kill();
    state.tween = gsap.fromTo(track, { x: 0 }, {
      x: -cycleWidth,
      duration: cycleWidth / SLIDER_SPEED,
      ease: "none",
      repeat: -1,
      paused: true,
      immediateRender: false,
    });
    state.tween.progress(phase);
    syncSlider(state);
  }

  rebuild();
  const resizeObserver = new ResizeObserver(rebuild);
  resizeObserver.observe(viewport);
  resizeObserver.observe(track);
  originals.forEach((slide) => {
    if (slide instanceof HTMLImageElement && !slide.complete) {
      slide.addEventListener("load", rebuild, { once: true });
    }
  });
  sliderObserver.observe(viewport);
}
