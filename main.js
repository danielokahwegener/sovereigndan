// ---------------------------------------------------------
// Scroll reveal: fade/slide in any .reveal element once it
// enters the viewport. Unobserve after reveal so it doesn't
// re-trigger on scroll-up.
// ---------------------------------------------------------
(function scrollReveal() {
  const revealEls = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || revealEls.length === 0) {
    revealEls.forEach((el) => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  revealEls.forEach((el) => observer.observe(el));
})();

// ---------------------------------------------------------
// VSL video unmute toggle (video starts muted so it can autoplay)
// ---------------------------------------------------------
(function vslVideo() {
  const video = document.querySelector(".vsl-video");
  const btn = document.getElementById("videoUnmuteBtn");
  if (!video || !btn) return;

  btn.addEventListener("click", () => {
    video.muted = !video.muted;
    btn.classList.toggle("is-unmuted", !video.muted);
    btn.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
  });
})();

// ---------------------------------------------------------
// VSL video play/pause toggle
// ---------------------------------------------------------
(function vslPlayPause() {
  const video = document.querySelector(".vsl-video");
  const btn = document.getElementById("videoPlayPauseBtn");
  if (!video || !btn) return;

  function syncState() {
    const isPaused = video.paused;
    btn.classList.toggle("is-paused", isPaused);
    btn.setAttribute("aria-label", isPaused ? "Play video" : "Pause video");
  }

  btn.addEventListener("click", () => {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", syncState);
  video.addEventListener("pause", syncState);
  syncState();
})();

// ---------------------------------------------------------
// VSL video scrub bar (elapsed / remaining time, click + drag to seek)
// ---------------------------------------------------------
(function vslProgress() {
  const video = document.querySelector(".vsl-video");
  const progress = document.getElementById("videoProgress");
  const fill = document.getElementById("videoProgressFill");
  const thumb = document.getElementById("videoProgressThumb");
  const elapsedEl = document.getElementById("videoTimeElapsed");
  const remainingEl = document.getElementById("videoTimeRemaining");
  if (!video || !progress || !fill || !elapsedEl || !remainingEl) return;

  function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateProgress() {
    const duration = video.duration || 0;
    const current = video.currentTime || 0;
    const pct = duration ? (current / duration) * 100 : 0;
    fill.style.width = pct + "%";
    if (thumb) thumb.style.left = pct + "%";
    elapsedEl.textContent = formatTime(current);
    remainingEl.textContent = duration ? "-" + formatTime(duration - current) : "0:00";
  }

  function seekToClientX(clientX) {
    if (!isFinite(video.duration)) return;
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }

  let dragging = false;

  progress.addEventListener("pointerdown", (e) => {
    dragging = true;
    progress.classList.add("is-dragging");
    seekToClientX(e.clientX);
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    seekToClientX(e.clientX);
  });

  window.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    progress.classList.remove("is-dragging");
  });

  video.addEventListener("timeupdate", updateProgress);
  video.addEventListener("loadedmetadata", updateProgress);
  updateProgress();
})();

// ---------------------------------------------------------
// VSL video quality selector — swaps the source while preserving
// the current playback position and play/pause state.
// ---------------------------------------------------------
(function vslQuality() {
  const video = document.querySelector(".vsl-video");
  const wrapper = document.getElementById("videoQuality");
  const btn = document.getElementById("videoQualityBtn");
  const menu = document.getElementById("videoQualityMenu");
  if (!video || !wrapper || !btn || !menu) return;

  // AV1 files are smaller but older iPhones and some browsers cannot play
  // them. Those devices get H.264 files instead (720p and 480p only).
  const AV1 = 'video/mp4; codecs="av01.0.08M.08, mp4a.40.2"';
  const H264 = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
  const canAV1 = video.canPlayType('video/mp4; codecs="av01.0.08M.08"') !== "";
  const qualitySources = canAV1
    ? {
        "1080p": { src: "assets/vsl-1080p.mp4", type: AV1 },
        "720p": { src: "assets/vsl-720p.mp4", type: AV1 },
        "480p": { src: "assets/vsl-480p.mp4", type: AV1 },
      }
    : {
        "720p": { src: "assets/vsl-720p-h264.mp4", type: H264 },
        "480p": { src: "assets/vsl-480p-h264.mp4", type: H264 },
      };

  if (!canAV1) {
    const opt1080 = menu.querySelector('[data-quality="1080p"]');
    if (opt1080) opt1080.remove();
    menu.querySelectorAll(".video-quality-option").forEach((o) =>
      o.classList.toggle("is-active", o.dataset.quality === "720p")
    );
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", wrapper.classList.contains("is-open"));
  });

  document.addEventListener("click", () => {
    wrapper.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  });

  menu.querySelectorAll(".video-quality-option").forEach((option) => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      const quality = option.dataset.quality;
      const choice = qualitySources[quality];
      if (!choice) return;

      const resumeTime = video.currentTime;
      const wasPlaying = !video.paused;

      const onLoaded = () => {
        video.currentTime = resumeTime;
        if (wasPlaying) video.play().catch(() => {});
        video.removeEventListener("loadedmetadata", onLoaded);
      };
      video.addEventListener("loadedmetadata", onLoaded);

      video.querySelectorAll("source").forEach((el) => el.remove());
      const srcEl = document.createElement("source");
      srcEl.src = choice.src;
      srcEl.type = choice.type;
      video.appendChild(srcEl);
      video.load();

      menu.querySelectorAll(".video-quality-option").forEach((o) => o.classList.remove("is-active"));
      option.classList.add("is-active");
      wrapper.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });
  });
})();

// ---------------------------------------------------------
// VSL video fullscreen toggle
// ---------------------------------------------------------
(function vslFullscreen() {
  const frame = document.querySelector(".video-frame");
  const btn = document.getElementById("videoFullscreenBtn");
  if (!frame || !btn) return;

  btn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      frame.requestFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === frame;
    btn.classList.toggle("is-fullscreen", isFullscreen);
    btn.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  });
})();

// ---------------------------------------------------------
// Proof strip photo carousels (before / after). The two live inside
// one .proof-images group and are kept in lockstep: a control on
// either one — arrow, dot, swipe, or hover-pause — drives both off a
// single shared index and a single shared autoplay timer, rather than
// each carousel running its own independent state.
// ---------------------------------------------------------
(function proofCarousels() {
  document.querySelectorAll(".proof-images").forEach((group) => {
    const instances = Array.from(group.querySelectorAll("[data-carousel]"))
      .map((carousel) => ({
        carousel,
        track: carousel.querySelector(".proof-carousel-track"),
        slides: Array.from(carousel.querySelectorAll(".proof-carousel-slide")),
        dots: Array.from(carousel.querySelectorAll(".proof-carousel-dot")),
        prevBtn: carousel.querySelector(".proof-carousel-prev"),
        nextBtn: carousel.querySelector(".proof-carousel-next"),
      }))
      .filter((inst) => inst.track && inst.slides.length > 0);
    if (instances.length === 0) return;

    const slideCount = Math.min(...instances.map((inst) => inst.slides.length));
    let index = 0;

    function goTo(newIndex) {
      index = (newIndex + slideCount) % slideCount;
      instances.forEach(({ track, slides, dots }) => {
        track.style.transform = `translateX(-${index * 100}%)`;
        slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
        dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
      });
    }

    // Auto-advance every 2s. Paused on hover/touch of EITHER carousel so
    // it doesn't fight a visitor mid-swipe on one while the other keeps
    // moving, and skipped entirely for reduced-motion — this is exactly
    // the kind of auto-moving content that preference exists to suppress.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let autoplayTimer = null;

    function startAutoplay() {
      if (prefersReducedMotion || slideCount <= 1) return;
      stopAutoplay();
      autoplayTimer = setInterval(() => goTo(index + 1), 2000);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    instances.forEach(({ carousel, dots, prevBtn, nextBtn }) => {
      prevBtn?.addEventListener("click", () => {
        goTo(index - 1);
        startAutoplay();
      });
      nextBtn?.addEventListener("click", () => {
        goTo(index + 1);
        startAutoplay();
      });
      dots.forEach((dot, i) => {
        dot.addEventListener("click", () => {
          goTo(i);
          startAutoplay();
        });
      });

      carousel.addEventListener("pointerenter", stopAutoplay);
      carousel.addEventListener("pointerleave", startAutoplay);

      // swipe: track horizontal drag distance, change slide on release
      let dragStartX = null;

      carousel.addEventListener("pointerdown", (e) => {
        dragStartX = e.clientX;
        stopAutoplay();
      });

      carousel.addEventListener("pointerup", (e) => {
        if (dragStartX === null) return;
        const delta = e.clientX - dragStartX;
        dragStartX = null;
        if (Math.abs(delta) >= 40) goTo(delta < 0 ? index + 1 : index - 1);
        startAutoplay();
      });

      if (slideCount <= 1) {
        prevBtn?.style.setProperty("display", "none");
        nextBtn?.style.setProperty("display", "none");
        carousel.querySelector(".proof-carousel-dots")?.style.setProperty("display", "none");
      }
    });

    startAutoplay();
  });
})();

// ---------------------------------------------------------
// Analytics — pushes to window.dataLayer so any tag manager
// can pick these up. track() is the single dispatch point.
// ---------------------------------------------------------
window.dataLayer = window.dataLayer || [];

function track(name, payload) {
  window.dataLayer.push({ event: name, ...payload });
}

// ---------------------------------------------------------
// APPLY_URL — declared once, written into every CTA's href so
// the destination can be changed in a single place. The apply
// flow lives on this same page (the embedded form in the hero),
// so every CTA just scrolls there.
// ---------------------------------------------------------
const APPLY_URL = "#apply";

// ---------------------------------------------------------
// SHEET_WEBHOOK_URL — the deployed Google Apps Script Web App
// URL that appends each application as a row in a Google Sheet.
// Leave blank to disable (the form still works, it just won't
// log anywhere). See project notes for the Apps Script source
// and deployment steps.
// ---------------------------------------------------------
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwk8JQRcgps_qlzmCU03cumgIB-i_rbaN_ld44x84Mf-ahHw7NhV0OkG-sfhYt7XYRw/exec";

document.querySelectorAll("[data-cta-location]").forEach((el) => {
  el.setAttribute("href", APPLY_URL);
  el.addEventListener("click", () => {
    track("cta_click", { location: el.dataset.ctaLocation });
  });
});

// ---------------------------------------------------------
// FAQ — native <details>/<summary>, no JS needed for the
// toggle itself. Only fires the analytics event on open.
// ---------------------------------------------------------
(function faqAnalytics() {
  const items = document.querySelectorAll(".faq-item");

  items.forEach((item, index) => {
    item.addEventListener("toggle", () => {
      if (item.open) track("faq_open", { index });
    });
  });
})();

// ---------------------------------------------------------
// Sticky mobile CTA bar — appears once the hero application
// form has scrolled out of view. IntersectionObserver, not a
// scroll listener. Keeps it out of the tab order while hidden.
// ---------------------------------------------------------
(function stickyCta() {
  const bar = document.getElementById("stickyCta");
  const heroCta = document.getElementById("applyForm");
  if (!bar || !heroCta || !("IntersectionObserver" in window)) return;

  function setBodyPadding(visible) {
    document.body.style.paddingBottom = visible ? bar.offsetHeight + "px" : "";
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const isHeroCtaVisible = entries[0].isIntersecting;
      const showBar = !isHeroCtaVisible;
      bar.classList.toggle("is-visible", showBar);
      bar.setAttribute("aria-hidden", String(!showBar));
      setBodyPadding(showBar);
    },
    { threshold: 0 }
  );

  observer.observe(heroCta);
})();

// ---------------------------------------------------------
// Video analytics — play (fired once) and 25/50/75/100%
// progress milestones, read directly from the video element.
// ---------------------------------------------------------
(function vslAnalytics() {
  const video = document.querySelector(".vsl-video");
  if (!video) return;

  let playTracked = false;
  const firedMilestones = new Set();
  const milestones = [25, 50, 75, 100];

  video.addEventListener("play", () => {
    if (playTracked) return;
    playTracked = true;
    track("video_play", {});
  });

  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    milestones.forEach((m) => {
      if (pct >= m && !firedMilestones.has(m)) {
        firedMilestones.add(m);
        track("video_progress", { percent: m });
      }
    });
  });
})();

// ---------------------------------------------------------
// Scroll depth — 25/50/75/100% of page height, each once.
// ---------------------------------------------------------
(function scrollDepth() {
  const milestones = [25, 50, 75, 100];
  const fired = new Set();
  let ticking = false;

  function checkDepth() {
    ticking = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const pct = (window.scrollY / scrollable) * 100;
    milestones.forEach((m) => {
      if (pct >= m && !fired.has(m)) {
        fired.add(m);
        track("scroll_depth", { percent: m });
      }
    });
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(checkDepth);
    },
    { passive: true }
  );
})();

// ---------------------------------------------------------
// Free profile review submission: 4 steps (what's not working,
// about you, screenshots, details and consent). Screenshots are
// shrunk in the browser, then everything is posted as JSON to the
// Apps Script, which saves the images to Google Drive, logs a row
// in the "Profile Submissions" tab and sends a Telegram alert.
// ---------------------------------------------------------
(function profileSubmission() {
  const wrapper = document.getElementById("applyForm");
  if (!wrapper) return;

  const form = wrapper.querySelector("form");
  const dataSteps = Array.from(wrapper.querySelectorAll(".form-step[data-step]"));
  const totalSteps = dataSteps.length;

  const progressFill = document.getElementById("formProgressFill");
  const stepLabel = document.getElementById("formStepLabel");
  const backBtn = document.getElementById("formBack");
  const nextBtn = document.getElementById("formNext");
  const submitBtn = document.getElementById("formSubmit");
  const formAnchor = document.getElementById("apply");

  const fileInput = document.getElementById("q_files");
  const uploadGrid = document.getElementById("uploadGrid");
  const uploadError = document.getElementById("uploadError");
  const submitError = document.getElementById("submitError");

  const MIN_FILES = 2;
  const MAX_FILES = 10;
  const MAX_SIDE = 1800; // px, keeps prompt text readable on tall phone screenshots
  const JPEG_QUALITY = 0.82;

  const KEYBOARD_INPUT_TYPES = ["text", "email", "tel", "number", "password", "search", "url"];
  function opensKeyboard(field) {
    return !!field && (field.tagName === "TEXTAREA" || KEYBOARD_INPUT_TYPES.includes(field.type));
  }

  let currentIndex = 0;
  let autoAdvanceTimer = null;
  let files = []; // { file, url }

  function showStep(index, options) {
    options = options || {};
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    dataSteps.forEach((step, i) => step.classList.toggle("is-active", i === index));
    progressFill.style.width = ((index + 1) / totalSteps) * 100 + "%";
    stepLabel.textContent = `Step ${index + 1} of ${totalSteps}`;

    backBtn.classList.toggle("is-visible", index > 0);
    const isLastStep = index === totalSteps - 1;
    nextBtn.style.display = isLastStep ? "none" : "inline-flex";
    submitBtn.classList.toggle("is-visible", isLastStep);

    const firstField = dataSteps[index].querySelector("input:not([type=file]), select, textarea");
    if (firstField && !opensKeyboard(firstField)) firstField.focus({ preventScroll: true });

    if (options.scrollToTop && formAnchor) formAnchor.scrollIntoView({ block: "start", behavior: "smooth" });

    track("form_step_view", {
      step: index + 1,
      step_name: dataSteps[index].querySelector(".form-step-title")?.textContent || "",
      total_steps: totalSteps,
    });
  }

  function isRadioOnlyStep(stepEl) {
    const fields = stepEl.querySelectorAll("input, select, textarea");
    return fields.length > 0 && Array.from(fields).every((f) => f.type === "radio");
  }

  function validateCurrentStep() {
    const stepEl = dataSteps[currentIndex];
    const fields = Array.from(stepEl.querySelectorAll("input, select, textarea"));
    let valid = true;
    const seenRadioGroups = new Set();

    fields.forEach((field) => {
      if (field.type === "file") return;
      if (field.type === "radio") {
        if (seenRadioGroups.has(field.name)) return;
        seenRadioGroups.add(field.name);
        const group = fields.filter((f) => f.name === field.name);
        const holder = field.closest(".form-field");
        const missing = field.required && !group.some((f) => f.checked);
        holder.classList.toggle("touched", missing);
        if (missing) valid = false;
        return;
      }
      field.classList.add("touched");
      if (field.type === "checkbox") {
        field.closest(".form-field").classList.toggle("touched", field.required && !field.checked);
      }
      if (field.required && !field.checkValidity()) valid = false;
    });

    if (stepEl.contains(fileInput)) {
      if (files.length < MIN_FILES) {
        uploadError.textContent = `Add at least ${MIN_FILES} screenshots of your profile.`;
        valid = false;
      } else {
        uploadError.textContent = "";
      }
    }
    return valid;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (currentIndex < totalSteps - 1) {
      currentIndex += 1;
      showStep(currentIndex, { scrollToTop: true });
    }
  }

  nextBtn.addEventListener("click", goNext);
  backBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      showStep(currentIndex, { scrollToTop: true });
    }
  });

  form.addEventListener("change", (e) => {
    if (e.target.type !== "radio") return;
    if (!isRadioOnlyStep(dataSteps[currentIndex])) return;
    if (!validateCurrentStep()) return;
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(goNext, 400);
  });

  // ---------- screenshots ----------
  function renderGrid() {
    uploadGrid.textContent = "";
    files.forEach((item, i) => {
      const tile = document.createElement("div");
      tile.className = "upload-tile";
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = `Screenshot ${i + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "upload-remove";
      remove.setAttribute("aria-label", `Remove screenshot ${i + 1}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(item.url);
        files.splice(i, 1);
        renderGrid();
      });
      tile.append(img, remove);
      uploadGrid.append(tile);
    });
    const drop = wrapper.querySelector(".upload-drop-sub");
    if (drop) drop.textContent = files.length ? `${files.length} added, ${MAX_FILES - files.length} more allowed` : `${MIN_FILES} to ${MAX_FILES} images`;
    if (files.length >= MIN_FILES) uploadError.textContent = "";
  }

  fileInput.addEventListener("change", () => {
    const picked = Array.from(fileInput.files || []).filter((f) => f.type.startsWith("image/"));
    const room = MAX_FILES - files.length;
    picked.slice(0, room).forEach((file) => files.push({ file, url: URL.createObjectURL(file) }));
    uploadError.textContent = picked.length > room ? `That's the maximum of ${MAX_FILES} screenshots. Remove one to add another.` : "";
    fileInput.value = ""; // lets the same file be picked again after removing it
    renderGrid();
    track("screenshots_added", { count: files.length });
  });

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable image"));
      };
      img.src = url;
    });
  }

  // Shrinks one screenshot to a JPEG at most MAX_SIDE px on its longest
  // side and returns it as base64 (no data: prefix).
  async function compress(file) {
    const { img, url } = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];
  }

  // ---------- submit ----------
  const val = (sel) => (form.querySelector(sel)?.value || "").trim();
  const picked = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";

  function showSuccess(name, email) {
    form.hidden = true;
    wrapper.querySelector(".form-progress").hidden = true;
    const success = document.getElementById("submitSuccess");
    success.hidden = false;
    document.getElementById("successHeading").textContent = name ? `You're in, ${name}.` : "You're in.";
    document.getElementById("successText").textContent =
      `Your profile is in my review queue. When your review goes live, I'll email the link to ${email}.`;
    success.querySelectorAll("[data-social]").forEach((a) =>
      a.addEventListener("click", () => track("success_social_click", { platform: a.dataset.social }))
    );
    if (formAnchor) formAnchor.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function send(payload) {
    const body = JSON.stringify(payload);
    try {
      // A plain string body is sent as text/plain, which Apps Script
      // accepts without a CORS preflight and answers with readable JSON.
      const res = await fetch(SHEET_WEBHOOK_URL, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      return data.result === "success";
    } catch (err) {
      // Some browsers block reading the reply. Send once more without
      // reading it; the Telegram alert confirms it arrived.
      await fetch(SHEET_WEBHOOK_URL, { method: "POST", body, mode: "no-cors" });
      return true;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentIndex < totalSteps - 1) {
      goNext();
      return;
    }
    if (!validateCurrentStep()) return;

    const name = val("#q1");
    const email = val("#q2");
    submitError.textContent = "";
    submitBtn.disabled = true;
    backBtn.disabled = true;
    const label = submitBtn.textContent;

    try {
      const images = [];
      for (let i = 0; i < files.length; i++) {
        submitBtn.textContent = `Preparing ${i + 1} of ${files.length}...`;
        images.push({ name: `screenshot-${String(i + 1).padStart(2, "0")}.jpg`, mime: "image/jpeg", data: await compress(files[i].file) });
      }
      submitBtn.textContent = "Sending...";

      const payload = {
        type: "profile",
        source: "sovereigndan",
        name,
        email,
        age: val("#q_age"),
        job: val("#q_job"),
        problem: picked("problem"),
        words: val("#q_words").slice(0, 500),
        blur: picked("blur"),
        feature: form.querySelector("#q_feature")?.checked ? "Yes" : "No",
        tips: form.querySelector("#q_tips")?.checked ? "Yes" : "No",
        files: images,
      };

      const ok = SHEET_WEBHOOK_URL ? await send(payload) : true;
      if (!ok) throw new Error("server said no");

      track("form_submitted", { screenshots: images.length, blur: payload.blur, tips: payload.tips });
      showSuccess(name, email);
    } catch (err) {
      submitError.textContent = "Your profile didn't send. Check your connection and try again, or DM me on Instagram.";
      track("form_submit_error", { message: String(err && err.message) });
    } finally {
      submitBtn.textContent = label;
      submitBtn.disabled = false;
      backBtn.disabled = false;
    }
  });

  if (window.visualViewport && formAnchor) {
    window.visualViewport.addEventListener("resize", () => {
      const active = document.activeElement;
      if (!active || !form.contains(active) || !opensKeyboard(active)) return;
      formAnchor.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  showStep(currentIndex);
})();
