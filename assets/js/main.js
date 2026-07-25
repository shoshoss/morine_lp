(() => {
  function initBookingClickTracking() {
    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('[data-ga-event="booking_click"]');

      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (typeof window.gtag !== "function") {
        return;
      }

      const ctaPosition = link.dataset.ctaPosition || "unknown";
      const linkText = (link.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      window.gtag("event", "booking_click", {
        cta_position: ctaPosition,
        link_url: link.href,
        link_text: linkText,
      });
    });
  }

  initBookingClickTracking();

  const stickyCta = document.querySelector(".js-sticky-cta");
  const firstViewCta = document.querySelector(".js-first-view-cta");

  if (!stickyCta || !firstViewCta || !("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      stickyCta.classList.toggle("is-hidden", entry.isIntersecting);
    },
    {
      threshold: 0.2,
    }
  );

  observer.observe(firstViewCta);
})();
