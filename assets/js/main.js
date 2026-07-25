(() => {
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
