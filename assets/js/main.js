(() => {
  function sendEvent(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  }

  // --- 既存: 予約CTAクリック計測（booking_click）。preventDefaultしない ---
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

      const ctaPosition = link.dataset.ctaPosition || "unknown";
      const linkText = (link.textContent || "").replace(/\s+/g, " ").trim();

      sendEvent("booking_click", {
        cta_position: ctaPosition,
        link_url: link.href,
        link_text: linkText,
      });
    });
  }

  // --- 予約確認モーダル ---
  function initBookingConfirmation() {
    const SS_KEY = "morineBookingConfirmationAccepted";
    const root = document.getElementById("booking-confirmation");
    if (!root) {
      return; // モーダルが無ければ何もしない（CTAは通常遷移）
    }

    const dialog = root.querySelector(".booking-confirmation__dialog");
    const closeBtn = root.querySelector(".booking-confirmation__close");
    const confirmLink = root.querySelector("[data-bc-confirm]");
    if (!dialog || !confirmLink) {
      return;
    }

    let lastTrigger = null;
    let ctaPosition = "unknown";
    let linkText = "";
    let linkUrl = null;
    let scrollY = 0;
    let isOpen = false;

    function isAccepted() {
      try {
        return sessionStorage.getItem(SS_KEY) === "true";
      } catch (_) {
        return false;
      }
    }

    function setBackgroundInert(on) {
      Array.from(document.body.children).forEach((el) => {
        if (el === root || el.tagName === "SCRIPT") {
          return;
        }
        if (on) {
          el.setAttribute("aria-hidden", "true");
          try {
            el.inert = true;
          } catch (_) {}
        } else {
          el.removeAttribute("aria-hidden");
          try {
            el.inert = false;
          } catch (_) {}
        }
      });
    }

    function getFocusable() {
      const selector =
        'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(dialog.querySelectorAll(selector)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      );
    }

    function trapFocus(event) {
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal("escape");
      } else if (event.key === "Tab") {
        trapFocus(event);
      }
    }

    function runAfterTransition(el, cb) {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        cb();
      };
      const onEnd = (event) => {
        if (event.target === el) {
          finish();
        }
      };
      el.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 400); // フォールバック（transition未発火/低減時）
    }

    function openModal(trigger) {
      if (isOpen) return;
      lastTrigger = trigger;
      linkUrl = trigger.href;
      ctaPosition = trigger.dataset.ctaPosition || "unknown";
      linkText = (trigger.textContent || "").replace(/\s+/g, " ").trim();
      confirmLink.href = linkUrl; // 防御的に同期（全CTA同一URL）

      scrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = "-" + scrollY + "px";
      document.body.classList.add("bc-scroll-locked");

      root.hidden = false;
      setBackgroundInert(true);
      // reflow を挟んでからアニメーション用クラスを付与
      window.requestAnimationFrame(() => {
        root.classList.add("is-open");
      });
      isOpen = true;

      if (closeBtn) {
        closeBtn.focus();
      } else {
        dialog.focus();
      }
      document.addEventListener("keydown", onKeydown);

      sendEvent("booking_disclaimer_open", {
        cta_position: ctaPosition,
        link_url: linkUrl,
        link_text: linkText,
      });
    }

    // method が指定された場合のみ cancel イベントを送信（confirm 時は null）
    function closeModal(method) {
      if (!isOpen) return;
      isOpen = false;
      document.removeEventListener("keydown", onKeydown);
      root.classList.remove("is-open");

      runAfterTransition(dialog, () => {
        root.hidden = true;
        setBackgroundInert(false);
        document.body.classList.remove("bc-scroll-locked");
        document.body.style.top = "";
        window.scrollTo(0, scrollY);
        if (lastTrigger && typeof lastTrigger.focus === "function") {
          lastTrigger.focus();
        }
      });

      if (method) {
        sendEvent("booking_disclaimer_cancel", {
          cta_position: ctaPosition,
          close_method: method,
        });
      }
      linkUrl = null;
    }

    // CTA クリックを横取りしてモーダルを表示（確認済みセッションはそのまま遷移）
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('[data-ga-event="booking_click"]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (isAccepted()) return; // 既に確認済み → 通常遷移（booking_click は別リスナーで送信済み）
      event.preventDefault();
      openModal(link);
    });

    // 閉じる操作（戻る・×・背景）
    root.querySelectorAll("[data-bc-close]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal(el.getAttribute("data-bc-close"));
      });
    });

    // 「確認して予約へ進む」: 確認済みを保存し confirm を送信、通常遷移（新規タブ）
    confirmLink.addEventListener("click", () => {
      try {
        sessionStorage.setItem(SS_KEY, "true");
      } catch (_) {}
      sendEvent("booking_disclaimer_confirm", {
        cta_position: ctaPosition,
        link_url: linkUrl || confirmLink.href,
        link_text: (confirmLink.textContent || "").replace(/\s+/g, " ").trim(),
      });
      // preventDefault しない → target=_blank で遷移。モーダルは静かに閉じる（cancel送信なし）
      closeModal(null);
    });
  }

  initBookingClickTracking();
  initBookingConfirmation();

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
