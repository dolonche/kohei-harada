import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const SLIDER_SPEED = 60; // Pixels per second.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const visibleVideos = new Set<HTMLVideoElement>();
const videos = document.querySelectorAll<HTMLVideoElement>(".future-section video");

type SliderState = {
  tween?: gsap.core.Tween;
  visible: boolean;
};

const sliders = new Set<SliderState>();

function syncSlider(state: SliderState) {
  if (state.visible && !document.hidden && !reducedMotion.matches) {
    state.tween?.play();
  } else {
    state.tween?.pause();
  }
}

const sliderObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const state = (entry.target as HTMLElement & { sliderState?: SliderState }).sliderState;
      if (!state) return;
      state.visible = entry.isIntersecting;
      syncSlider(state);
    });
  },
  { threshold: 0 }
);

function playVisibleVideo(video: HTMLVideoElement) {
  if (document.hidden || !visibleVideos.has(video)) return;
  video.play().catch(() => {
    // Muted inline playback is normally allowed; keep the poster if it is blocked.
  });
}

const videoObserver = new IntersectionObserver(
  (entries) => {
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
  },
  { threshold: [0, 0.15] }
);

videos.forEach((video) => videoObserver.observe(video));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    videos.forEach((video) => video.pause());
  } else {
    visibleVideos.forEach(playVisibleVideo);
  }
  sliders.forEach(syncSlider);
});

reducedMotion.addEventListener("change", () => sliders.forEach(syncSlider));

function initializeSlider(section: HTMLElement) {
  const track = section.querySelector<HTMLElement>("[data-future-slider]");
  const viewport = track?.parentElement;
  if (!track || !viewport || track.dataset.sliderReady) return;

  const originals = Array.from(track.children) as HTMLElement[];
  if (!originals.length) return;
  track.dataset.sliderReady = "true";

  originals.forEach((slide) => {
    const duplicate = slide.cloneNode(true) as HTMLElement;
    duplicate.setAttribute("aria-hidden", "true");
    if (duplicate instanceof HTMLImageElement) duplicate.alt = "";
    track.appendChild(duplicate);
  });

  const state: SliderState = { visible: false };
  sliders.add(state);
  (viewport as HTMLElement & { sliderState?: SliderState }).sliderState = state;

  function rebuild() {
    const firstCopy = track.children[originals.length] as HTMLElement;
    // The gap before the copy is part of the cycle, so its first image meets the original seamlessly.
    const cycleWidth = firstCopy.offsetLeft - originals[0].offsetLeft;
    if (cycleWidth <= 0) return;

    const phase = state.tween?.progress() ?? 0;
    state.tween?.kill();
    state.tween = gsap.fromTo(
      track,
      { x: 0 },
      {
        x: -cycleWidth,
        duration: cycleWidth / SLIDER_SPEED,
        ease: "none",
        repeat: -1,
        paused: true,
        immediateRender: false,
      }
    );
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

document.querySelectorAll<HTMLButtonElement>(".future-section__preview").forEach((preview) => {
  preview.addEventListener("click", () => {
    const section = preview.closest<HTMLElement>(".future-section");
    const content = preview.nextElementSibling as HTMLElement | null;
    if (!section || !content || preview.disabled) return;

    preview.disabled = true;
    preview.setAttribute("aria-expanded", "true");

    const initialHeight = section.offsetHeight;
    gsap.set([preview, content], { flexShrink: 0 });
    gsap.set(content, { display: "block", opacity: 0 });
    gsap.set(section, { height: initialHeight, overflow: "hidden" });

    gsap.to(window, {
      duration: 1,
      ease: "power2.out",
      scrollTo: { y: preview, offsetY: window.innerWidth < 768 ? 62 : 0 },
    });

    const expansion = { progress: 0 };
    gsap
      .timeline({
        onComplete: () => {
          preview.hidden = true;
          preview.style.display = "none";
          gsap.set(preview, { clearProps: "height,opacity,flexShrink" });
          gsap.set(section, { clearProps: "height,overflow" });
          gsap.set(content, { clearProps: "opacity,flexShrink" });
          initializeSlider(section);
          ScrollTrigger.refresh();
          content.focus({ preventScroll: true });
        },
      })
      .to(preview, { height: 0, opacity: 0, duration: 2, ease: "power1.out" }, 0)
      .to(
        expansion,
        {
          progress: 1,
          duration: 2,
          ease: "power2.out",
          onUpdate: () => {
            // Read the actual height each frame so late media or a resize cannot create an end jump.
            const targetHeight = content.offsetHeight;
            section.style.height = `${initialHeight + (targetHeight - initialHeight) * expansion.progress}px`;
          },
        },
        0
      )
      .to(content, { opacity: 1, duration: 2, ease: "power2.out" }, 0);
  });
});
