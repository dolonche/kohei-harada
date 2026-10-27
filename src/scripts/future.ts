import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import { initializeProjectSlider, observeProjectVideo } from "./project-media";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
document.querySelectorAll<HTMLVideoElement>(".future-section video").forEach(observeProjectVideo);

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
          const track = section.querySelector<HTMLElement>("[data-future-slider]");
          if (track) initializeProjectSlider(track);
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
