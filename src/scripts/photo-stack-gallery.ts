import { uiText } from "../i18n/runtime";
import type { PhotoStackPhoto } from "../lib/photo-stack-types";
import { initializeWorkPhotoDeck } from "./work-photo-deck";
import { cssTimeToMilliseconds } from "../lib/css-time";
import { playInterfaceSound } from "./sound";

function initializePhotoStacks() {
  document.querySelectorAll<HTMLElement>("[data-photo-stack-gallery]").forEach((root) => {
    if (root.dataset.ready) return;
    const trigger = root.querySelector<HTMLElement>("[data-stack-trigger]");
    const preview = root.querySelector<HTMLButtonElement>("[data-stack-preview]");
    const template = root.querySelector<HTMLTemplateElement>("[data-stack-template]");
    const data = root.querySelector<HTMLScriptElement>("[data-stack-data]");
    if (!trigger || !preview || !template || !data) return;
    const dialog = template.content.firstElementChild?.cloneNode(true) as HTMLDialogElement | undefined;
    if (!dialog) return;
    const photos = JSON.parse(data.textContent ?? "[]") as PhotoStackPhoto[];
    const isWorks = dialog.dataset.variant === "works";
    const galleryLabel = uiText("关闭作品收藏", "Close curated works");
    const titleLink = dialog.querySelector<HTMLAnchorElement>("[data-work-link]");
    const plainTitle = dialog.querySelector<HTMLElement>("[data-work-title]");
    const deckRoot = dialog.querySelector<HTMLElement>("[data-work-deck]");
    const stage = dialog.querySelector<HTMLElement>("[data-stack-stage]")!;
    const detail = dialog.querySelector<HTMLElement>("[data-stack-detail]")!;
    const media = dialog.querySelector<HTMLElement>("[data-stack-media]")!;
    const image = dialog.querySelector<HTMLImageElement>("[data-stack-image]")!;
    const orbitClock = media.querySelector<HTMLIFrameElement>("[data-orbit-clock]");
    const record = detail.querySelector<HTMLElement>("[data-julie-record]");
    const sleeve = record?.querySelector<HTMLImageElement>("[data-julie-sleeve]");
    const discFrame = record?.querySelector<HTMLElement>("[data-julie-disc-frame]");
    const disc = record?.querySelector<HTMLElement>("[data-julie-disc]");
    const recordCredit = detail.querySelector<HTMLElement>("[data-julie-credit]");
    const audio = detail.querySelector<HTMLAudioElement>("[data-julie-audio]");
    const caption = dialog.querySelector<HTMLElement>("[data-stack-caption]")!;
    const error = dialog.querySelector<HTMLElement>("[data-stack-error]")!;
    const control = dialog.querySelector<HTMLButtonElement>(".photo-stack-gallery__control")!;
    const controlLabel = dialog.querySelector<HTMLElement>("[data-stack-control-label]")!;
    const cards = [...dialog.querySelectorAll<HTMLButtonElement>("[data-stack-card]")];
    const frames = cards.map((card) => card.querySelector<HTMLElement>(".photo-stack-gallery__frame")!);
    const compacts = [...preview.querySelectorAll<HTMLElement>(".photo-stack-gallery__compact")];
    const compactIds = compacts.map((compact) => compact.dataset.previewPhoto);
    const compactSlots = photos.map((photo) => compactIds.indexOf(photo.id));
    const surface = dialog.querySelector<HTMLElement>(".photo-stack-gallery__surface")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    const { signal } = abort;
    const deck = deckRoot && initializeWorkPhotoDeck(deckRoot, reduced, signal);
    const animations = new Set<Animation>();
    const travelers = new Set<HTMLElement>();
    let view: "rest" | "preview" | "gallery" | "detail" = "rest";
    let busy = false;
    let queueDetail: ((index: number) => void) | undefined;
    let closing = false;
    let selected = -1;
    let motionEpoch = 0;
    let imageEpoch = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let coverTraveler: HTMLElement | undefined;
    let hiddenCover: HTMLImageElement | undefined;
    let audioContext: AudioContext | undefined;
    let audioGain: GainNode | undefined;
    let audioReady: Promise<boolean> | undefined;
    let discSpin: Animation | undefined;
    let returningRecord = false;
    let returningOrbit = false;
    const discTurnMs = 3600;
    let savedOverflow = "";
    let savedPadding = "";
    let scrollLocked = false;

    root.dataset.ready = "true";
    preview.setAttribute("aria-haspopup", "dialog");
    preview.setAttribute("aria-controls", dialog.id);
    if (isWorks) {
      trigger.setAttribute("aria-controls", dialog.id);
      dialog.setAttribute("aria-label", uiText("用心创作的事物", "Things made with care"));
      preview.setAttribute("aria-label", uiText("展开作品收藏", "Open curated works"));
    }
    preview.hidden = false;
    document.body.append(dialog);

    const timing = (token: string) => cssTimeToMilliseconds(getComputedStyle(root).getPropertyValue(token));
    const easing = () => getComputedStyle(root).getPropertyValue("--ease-smooth-out").trim();
    const animate = (element: HTMLElement, keys: Keyframe[], duration: number, delay = 0) => {
      const animation = element.animate(keys, { duration: reduced.matches ? 0 : duration, delay: reduced.matches ? 0 : delay, easing: easing(), fill: "both" });
      animations.add(animation);
      return animation;
    };
    const positionPreview = () => {
      const rect = trigger.getBoundingClientRect();
      const width = preview.offsetWidth;
      const ideal = rect.left + rect.width / 2 - width / 2;
      const safeGutter = Number.parseFloat(getComputedStyle(root).getPropertyValue("--space-3")) * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      // Keep the complete stack inside the viewport, including at a wrapped line's edge.
      const left = Math.max(safeGutter, Math.min(ideal, innerWidth - width - safeGutter));
      root.style.setProperty("--stack-offset", `${left - ideal}px`);
      root.dataset.placement = rect.top < preview.offsetHeight ? "below" : "above";
    };
    const showPreview = () => {
      clearTimeout(hideTimer);
      if (dialog.open || closing) return;
      positionPreview();
      view = "preview";
      root.dataset.preview = "true";

    };
    const hidePreview = () => {
      clearTimeout(hideTimer);
      if (dialog.open) return;
      root.dataset.fanned = "false";
      view = "rest";
      root.dataset.preview = "false";

    };
    const warmGallery = () => photos.forEach((photo) => { const warm = new Image(); warm.src = photo.previewSrc; });
    const orbitTheme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const revealOrbitClock = () => {
      if (busy || view !== "detail" || !orbitClock?.hasAttribute("data-ready") || orbitClock.hasAttribute("data-active")) return;
      orbitClock.setAttribute("data-active", "");
      orbitClock.contentWindow?.postMessage("smileo-orbit-clock-reveal", "*");
    };
    const clearMotion = () => {
      motionEpoch++;
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      travelers.forEach((traveler) => traveler.remove());
      travelers.clear();
      coverTraveler = undefined;
      hiddenCover?.style.removeProperty("visibility");
      hiddenCover = undefined;
      sleeve?.style.removeProperty("visibility");
      if (view === "gallery") {
        detail.hidden = true;
        if (deckRoot && !deckRoot.hidden) deck?.hide();
      }
      frames.forEach((frame, index) => {
        if (view === "detail" && index === selected) frame.style.visibility = "hidden";
        else frame.style.removeProperty("visibility");
      });
      media.style.removeProperty("visibility");
      preview.style.removeProperty("visibility");
      delete root.dataset.returning;
      busy = false;
      queueDetail = undefined;
      dialog.removeAttribute("data-moving");
      revealOrbitClock();
    };
    const beginMotion = () => {
      clearMotion();
      busy = true;
      dialog.dataset.moving = "true";
      return motionEpoch;
    };
    const finishMotion = async (epoch: number, done: () => void, cleanup = true) => {
      await Promise.allSettled([...animations].map((animation) => animation.finished));
      if (epoch !== motionEpoch || signal.aborted) return;
      if (cleanup) clearMotion();
      done();
    };
    const fly = (frame: HTMLElement, from: DOMRect, to: DOMRect, fromRotation: number, toRotation: number, duration: number, options: { fadeIn?: boolean; dissolve?: boolean; layer?: number; radii?: [number, number] } = {}) => {
      if (reduced.matches) return;
      const traveler = frame.cloneNode(true) as HTMLElement;
      const travelerImage = traveler instanceof HTMLImageElement ? traveler : traveler.querySelector("img");
      if (travelerImage) travelerImage.loading = "eager";
      traveler.classList.add("photo-stack-gallery__traveler");
      traveler.setAttribute("aria-hidden", "true");
      traveler.style.removeProperty("visibility");
      Object.assign(traveler.style, { left: `${to.left + to.width / 2}px`, top: `${to.top + to.height / 2}px`, width: `${to.width}px`, height: `${to.height}px`, zIndex: String(options.layer ?? 3) });
      travelers.add(traveler);
      dialog.append(traveler);
      const dx = from.left + from.width / 2 - to.left - to.width / 2;
      const dy = from.top + from.height / 2 - to.top - to.height / 2;
      const radiusRatio = Number.parseFloat(getComputedStyle(root).getPropertyValue("--photo-stack-radius-ratio"));
      // Resize the clipping window itself: the image keeps its natural ratio,
      // and the corner radius follows the shorter edge throughout the motion.
      const fromTransform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${fromRotation}deg)`;
      const endTransform = `translate(-50%, -50%) rotate(${toRotation}deg)`;
      animate(traveler, [
        { transform: fromTransform, width: `${from.width}px`, height: `${from.height}px`, borderRadius: `${options.radii?.[0] ?? Math.min(from.width, from.height) * radiusRatio}px`, opacity: options.fadeIn ? 0 : 1 },
        { transform: endTransform, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${options.radii?.[1] ?? Math.min(to.width, to.height) * radiusRatio}px`, opacity: 1 },
      ], duration);
      if (options.dissolve) {
        // Let the original three photos form the compact stack before dissolving together.
        const dissolveDuration = timing("--duration-quick");
        animate(traveler, [{ opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: `blur(${getComputedStyle(root).getPropertyValue("--space-1").trim()})` }], dissolveDuration, Math.max(0, duration - dissolveDuration));
      }
      return traveler;
    };
    const compactRotation = [-9, 1, 9];
    const rotation = (frame: HTMLElement) => { const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; };
    const measureFrame = (frame: HTMLElement) => {
      const bounds = frame.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform);
      const width = frame.offsetWidth * Math.hypot(matrix.a, matrix.b);
      const height = frame.offsetHeight * Math.hypot(matrix.c, matrix.d);
      // A rotated bounding box includes its corners; use the actual card size.
      return new DOMRect(bounds.left + (bounds.width - width) / 2, bounds.top + (bounds.height - height) / 2, width, height);
    };
    const measureCover = (cover: HTMLElement, angle: number) => {
      const bounds = cover.getBoundingClientRect();
      const radians = angle * Math.PI / 180;
      const size = bounds.width / (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)));
      return new DOMRect(bounds.left + (bounds.width - size) / 2, bounds.top + (bounds.height - size) / 2, size, size);
    };
    const flyCover = (cover: HTMLImageElement, from: DOMRect, to: DOMRect, fromAngle: number, toAngle: number, radii: [number, number]) => {
      // Clone the rendered cover so the traveler retains the Astro style scope.
      coverTraveler = fly(cover, from, to, fromAngle, toAngle, timing("--duration-photo-fan"), { radii });
      if (coverTraveler && sleeve) sleeve.style.visibility = "hidden";
    };
    const cardRotation = cards.map((card) => Number.parseFloat(card.style.getPropertyValue("--card-rotation")));
    const labelControl = (label: string) => { controlLabel.textContent = label; control.setAttribute("aria-label", label); };
    const lockScroll = () => {
      if (scrollLocked) return;
      savedOverflow = document.documentElement.style.overflow;
      savedPadding = document.documentElement.style.paddingRight;
      const scrollbar = innerWidth - document.documentElement.clientWidth;
      const existingPadding = Number.parseFloat(getComputedStyle(document.documentElement).paddingRight) || 0;
      document.documentElement.style.overflow = "hidden";
      if (scrollbar) document.documentElement.style.paddingRight = `${existingPadding + scrollbar}px`;
      scrollLocked = true;
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      document.documentElement.style.overflow = savedOverflow;
      document.documentElement.style.paddingRight = savedPadding;
      scrollLocked = false;
    };
    const fadeAudio = (volume: number, duration: number) => {
      if (!audioContext || !audioGain) return;
      const now = audioContext.currentTime;
      const gain = audioGain.gain;
      const current = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
      gain.linearRampToValueAtTime(volume, now + duration / 1000);
    };
    const prepareJulieAudio = () => {
      if (!audio) return;
      if (!audioContext && typeof AudioContext !== "undefined") {
        audioContext = new AudioContext();
        audioGain = audioContext.createGain();
        audioGain.gain.value = 0;
        audioContext.createMediaElementSource(audio).connect(audioGain).connect(audioContext.destination);
      }
      // Prime playback at zero gain inside the card click to preserve user activation.
      if (!audioGain) return;
      void audioContext?.resume().catch(() => {});
      audioReady = audio.play().then(() => true, () => false);
    };
    const stopJulie = () => {
      audioReady = undefined;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      if (audioContext && audioGain) {
        audioGain.gain.cancelScheduledValues(audioContext.currentTime);
        audioGain.gain.setValueAtTime(0, audioContext.currentTime);
      }
    };
    const resetDisc = () => {
      discSpin?.cancel();
      discSpin = undefined;
      disc?.style.removeProperty("transform");
      discFrame?.removeAttribute("data-extended");
    };
    const revealRecord = async () => {
      if (!discFrame || !disc) return;
      const playback = audioReady;
      const started = playback ? await playback : false;
      if (playback !== audioReady || view !== "detail" || signal.aborted) return;
      const epoch = beginMotion();
      const duration = timing("--duration-photo-fan");
      discFrame.setAttribute("data-extended", "");
      animate(discFrame, [{ transform: "translate(-44%, -50%)" }, { transform: "translate(0, -50%)" }], duration);
      const endAngle = 180 * duration / discTurnMs;
      if (!reduced.matches) {
        discSpin = disc.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${endAngle}deg)` }], { duration, easing: "ease-in", fill: "forwards" });
      }
      if (started) fadeAudio(1, duration);
      void finishMotion(epoch, () => {
        discSpin?.cancel();
        discSpin = reduced.matches ? undefined : disc.animate(
          [{ transform: `rotate(${endAngle}deg)` }, { transform: `rotate(${endAngle + 360}deg)` }],
          { duration: discTurnMs, iterations: Infinity },
        );
      });
    };
    const retractRecord = () => {
      if (!discFrame || !disc || returningRecord) return;
      returningRecord = true;
      const slideFrom = getComputedStyle(discFrame).transform;
      const angle = rotation(disc);
      const duration = timing("--duration-photo-fan");
      const spinProgress = discSpin?.effect?.getComputedTiming().progress ?? 0;
      const speed = busy ? spinProgress : 1;
      const epoch = beginMotion();
      discFrame.style.transform = slideFrom;
      discSpin?.cancel();
      discSpin = undefined;
      disc.style.transform = `rotate(${angle}deg)`;
      audioReady = undefined;
      fadeAudio(0, duration);
      if (reduced.matches) {
        window.setTimeout(() => {
          if (epoch !== motionEpoch || signal.aborted) return;
          stopJulie();
          returningRecord = false;
          discFrame.style.removeProperty("transform");
          resetDisc();
          returnToGallery();
        }, duration);
        return;
      }
      const stoppedAngle = angle + 180 * duration / discTurnMs * speed;
      animate(disc, [{ transform: disc.style.transform }, { transform: `rotate(${stoppedAngle}deg)` }], duration);
      void finishMotion(epoch, () => {
        stopJulie();
        disc.style.transform = `rotate(${stoppedAngle}deg)`;
        const retractEpoch = beginMotion();
        animate(discFrame, [{ transform: slideFrom }, { transform: "translate(-44%, -50%)" }], timing("--duration-fast"));
        void finishMotion(retractEpoch, () => {
          discFrame.style.removeProperty("transform");
          resetDisc();
          returningRecord = false;
          returnToGallery();
        });
      });
    };
    if (audio) window.addEventListener("pagehide", stopJulie, { signal });

    const unloadOrbitClock = () => {
      returningOrbit = false;
      if (!orbitClock || orbitClock.hidden) return;
      orbitClock.hidden = true;
      orbitClock.removeAttribute("data-ready");
      orbitClock.removeAttribute("data-active");
      orbitClock.removeAttribute("src");
    };
    if (orbitClock) {
      const syncOrbitTheme = () => {
        if (!orbitClock.hidden) orbitClock.contentWindow?.postMessage({ orbitTheme: orbitTheme() }, "*");
      };
      const observer = new MutationObserver(syncOrbitTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      signal.addEventListener("abort", () => observer.disconnect(), { once: true });
      window.addEventListener("message", (event) => {
        if (!orbitClock.hidden && event.source === orbitClock.contentWindow && event.data === "smileo-orbit-clock-ready") {
          orbitClock.setAttribute("data-ready", "");
          syncOrbitTheme();
          revealOrbitClock();
        }
      }, { signal });
    }

    const finishClose = (restoreFocus = true) => {
      unloadOrbitClock();
      stopJulie();
      resetDisc();
      discFrame?.style.removeProperty("transform");
      returningRecord = false;
      // Settle the concealed preview before releasing animation visibility.
      // Native dialog closing and focus restoration must not reveal it again.
      closing = true;
      root.dataset.returning = "true";
      root.dataset.preview = "false";
      root.dataset.fanned = "false";
      preview.getBoundingClientRect();
      clearMotion();
      imageEpoch++;
      if (dialog.open) dialog.close();
      unlockScroll();
      stage.hidden = false;
      stage.inert = false;
      detail.hidden = true;
      deck?.hide();
      dialog.dataset.view = "gallery";
      if (restoreFocus && root.isConnected) trigger.focus({ preventScroll: true });
      hidePreview();
      closing = false;
    };
    const openGallery = () => {
      if (dialog.open || busy) return;
      if (isWorks) playInterfaceSound("toggle");
      if (audio) audio.preload = "auto";
      photos.forEach((photo) => {
        const first = photo.work?.images?.[0];
        if (first) new Image().src = first.src;
      });
      showPreview();
      const sources = compacts.map((compact) => measureFrame(compact.firstElementChild as HTMLElement));
      const sourceRotations = compacts.map((compact) => rotation(compact.firstElementChild as HTMLElement));
      const epoch = beginMotion();
      view = "gallery";
      closing = false;
      stage.hidden = false;
      stage.inert = false;
      detail.hidden = true;
      deck?.hide();
      dialog.dataset.view = "gallery";
      labelControl(isWorks ? galleryLabel : uiText("关闭照片图库", "Close photo gallery"));
      lockScroll();
      dialog.showModal();
      control.focus({ preventScroll: true });
      animate(surface, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-project-attribute"));
      frames.forEach((frame, index) => {
        const slot = compactSlots[index];
        const sourceSlot = slot >= 0 ? slot : index % compacts.length;
        fly(frame, sources[sourceSlot], measureFrame(frame), sourceRotations[sourceSlot], cardRotation[index], timing("--duration-very-slow"), { fadeIn: slot < 0 });
        if (!reduced.matches) frame.style.visibility = "hidden";
      });
      void finishMotion(epoch, () => { root.dataset.preview = "false"; });
    };
    const showDetail = (index: number) => {
      if (view !== "gallery") return;
      if (busy) {
        queueDetail?.(index);
        return;
      }
      const photo = photos[index];
      if (!photo) return;
      if (isWorks) playInterfaceSound("toggle");
      const source = measureFrame(frames[index]);
      const sourceRotation = rotation(frames[index]);
      const cover = photo.id === "julie" ? frames[index].querySelector<HTMLImageElement>(":scope > img") : null;
      const coverSource = cover ? measureCover(cover, sourceRotation) : null;
      const epoch = beginMotion();
      const loadEpoch = ++imageEpoch;
      selected = index;
      view = "detail";
      dialog.dataset.view = "detail";
      const showRecord = cover && coverSource && sleeve && record && recordCredit;
      detail.toggleAttribute("data-julie", !!showRecord);
      media.hidden = !!showRecord;
      if (isWorks) media.dataset.workArt = photo.id;
      if (record && recordCredit) {
        record.hidden = !showRecord;
        recordCredit.hidden = !showRecord;
      }
      if (!showRecord) {
        media.style.setProperty("--photo-ratio", String(photo.width / photo.height));
        image.src = photo.previewSrc;
        image.alt = photo.alt;
      }
      const work = photo.work;
      caption.textContent = work ? work.summary ?? "" : photo.alt;
      caption.hidden = !caption.textContent;
      if (work && titleLink && plainTitle) {
        const title = work.title;
        titleLink.hidden = !work.href;
        plainTitle.hidden = !!work.href;
        if (work.href) {
          titleLink.href = work.href;
          titleLink.textContent = title;
        } else {
          titleLink.removeAttribute("href");
          plainTitle.textContent = title;
        }
      }
      const exhibit = work?.images;
      const hasDeck = !!deck && !!exhibit?.length;
      if (deck && exhibit?.length) deck.show(exhibit);
      error.hidden = true;
      detail.hidden = false;
      detail.inert = false;
      detail.scrollTop = 0;
      stage.hidden = false;
      stage.inert = true;
      labelControl(isWorks ? uiText("返回作品收藏", "Back to curated works") : uiText("关闭照片详情", "Close photo details"));
      control.focus({ preventScroll: true });
      if (showRecord && cover && coverSource && sleeve) {
        prepareJulieAudio();
        flyCover(cover, coverSource, measureCover(sleeve, 0), sourceRotation, 0, [
          Number.parseFloat(getComputedStyle(cover).borderRadius), 0,
        ]);
        frames[index].style.visibility = "hidden";
        animate(detail, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-project-attribute"));
        void finishMotion(epoch, revealRecord);
        return;
      }
      if (orbitClock && photo.id === "orbit") {
        orbitClock.hidden = false;
        orbitClock.src = `/assets/figma/curated-works/orbit-saturn.html#${orbitTheme()}`;
      }
      frames[index].style.visibility = "hidden";
      const [frontCard, ...rearCards] = hasDeck
        ? [...deckRoot!.querySelectorAll<HTMLElement>("[data-deck-card]")]
        : [];
      if (frontCard) {
        if (!reduced.matches) {
          const target = frontCard.getBoundingClientRect();
          const dx = source.left + source.width / 2 - target.left - target.width / 2;
          const dy = source.top + source.height / 2 - target.top - target.height / 2;
          const scale = Math.min(source.width / target.width, source.height / target.height);
          animate(frontCard, [
            { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${sourceRotation}deg) scale(${scale})` },
            { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
          ], timing("--duration-project-attribute"));
          const delay = timing("--duration-micro");
          rearCards.forEach((card) => animate(card, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-fast"), delay));
        }
        void finishMotion(epoch, () => {});
        return;
      }
      fly(frames[index], source, media.getBoundingClientRect(), sourceRotation, 0, timing("--duration-very-slow"));
      if (!reduced.matches) media.style.visibility = "hidden";
      animate(caption, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-project-attribute"));
      media.dataset.imageLoading = "true";
      media.setAttribute("aria-busy", "true");
      const full = new Image();
      full.src = photo.src;
      void full.decode().then(() => {
        if (loadEpoch === imageEpoch && view === "detail" && !signal.aborted) image.src = photo.src;
      }).catch(() => {
        if (loadEpoch === imageEpoch && view === "detail" && !signal.aborted) error.hidden = false;
      }).finally(() => {
        if (loadEpoch === imageEpoch && !signal.aborted) { delete media.dataset.imageLoading; media.setAttribute("aria-busy", "false"); }
      });
      void finishMotion(epoch, () => {});
    };
    const returnToGallery = () => {
      unloadOrbitClock();
      const isJulie = detail.hasAttribute("data-julie");
      const cover = isJulie ? frames[selected].querySelector<HTMLImageElement>(":scope > img") : null;
      const departingCover = coverTraveler ?? sleeve;
      const departingAngle = coverTraveler ? rotation(coverTraveler) : 0;
      const coverSource = cover && departingCover ? measureCover(departingCover, departingAngle) : null;
      const departingRadius = departingCover ? Number.parseFloat(getComputedStyle(departingCover).borderRadius) : 0;
      const panelOpacity = getComputedStyle(detail).opacity;
      const frontCard = deckRoot?.querySelector<HTMLElement>('[data-deck-card][aria-hidden="false"]');
      const source = isJulie ? null : frontCard?.getBoundingClientRect() ?? media.getBoundingClientRect();
      const fadeDeck = !!frontCard && !reduced.matches;
      const epoch = beginMotion();
      imageEpoch++;
      view = "gallery";
      dialog.dataset.view = "gallery";
      detail.hidden = reduced.matches || (!isJulie && !fadeDeck);
      if (fadeDeck) {
        // Keep the prints and their layout visible while the gallery cover takes over.
        detail.inert = true;
        animate(detail, [{ opacity: panelOpacity }, { opacity: 0 }], timing("--duration-project-attribute"));
      } else deck?.hide();
      stage.hidden = false;
      stage.inert = false;
      labelControl(isWorks ? galleryLabel : uiText("关闭照片图库", "Close photo gallery"));
      control.focus({ preventScroll: true });
      if (cover && coverSource) {
        stopJulie();
        frames[selected].style.removeProperty("visibility");
        const targetAngle = cardRotation[selected];
        flyCover(cover, coverSource, measureCover(cover, rotation(frames[selected])), departingAngle, targetAngle, [
          departingRadius, Number.parseFloat(getComputedStyle(cover).borderRadius),
        ]);
        if (coverTraveler) {
          cover.style.visibility = "hidden";
          hiddenCover = cover;
        }
        animate(detail, [{ opacity: panelOpacity }, { opacity: 0 }], timing("--duration-project-attribute"));
      } else if (source) {
        const detailFrame = frames[selected].cloneNode(true) as HTMLElement;
        const detailImage = detailFrame.querySelector("img");
        if (detailImage && !isWorks) detailImage.src = image.src;
        const duration = photos[selected].id === "orbit" ? "--duration-project-attribute" : "--duration-very-slow";
        const frame = frames[selected];
        const radii: [number, number] | undefined = frontCard ? [0, Number.parseFloat(getComputedStyle(frame).borderRadius)] : undefined;
        fly(detailFrame, source, measureFrame(frame), 0, cardRotation[selected], timing(duration), { radii, fadeIn: fadeDeck });
        if (!reduced.matches) frames[selected].style.visibility = "hidden";
      }
      let nextIndex: number | undefined;
      if (isWorks) queueDetail = (index) => { nextIndex = index; };
      void finishMotion(epoch, () => {
        if (nextIndex !== undefined) showDetail(nextIndex);
        else cards[selected].focus({ preventScroll: true });
      });
    };
    const closeGallery = () => {
      if (closing) { finishClose(); return; }
      if (isWorks) playInterfaceSound("toggle");
      const sources = frames.map(measureFrame);
      const sourceRotations = frames.map(rotation);
      const epoch = beginMotion();
      closing = true;
      root.dataset.returning = "true";
      root.dataset.fanned = "false";
      root.dataset.preview = "true";
      positionPreview();
      const targets = compacts.map((compact) => measureFrame(compact.firstElementChild as HTMLElement));
      preview.style.visibility = "hidden";
      frames.forEach((frame, index) => {
        const slot = compactSlots[index];
        if (slot >= 0) {
          fly(frame, sources[index], targets[slot], sourceRotations[index], compactRotation[slot], timing("--duration-photo-fan"), { dissolve: true, layer: [3, 5, 4][slot] });
          if (!reduced.matches) frame.style.visibility = "hidden";
        } else {
          animate(frame, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-quick"));
        }
      });
      animate(control, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-quick"));
      animate(surface, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-photo-fan"));
      void finishMotion(epoch, () => finishClose(), false);
    };
    const back = () => {
      if (returningRecord) return;
      if (view === "detail") {
        if (isWorks && !returningOrbit) playInterfaceSound("toggle");
        if (discFrame?.hasAttribute("data-extended")) retractRecord();
        else if (orbitClock?.hasAttribute("data-active") && !busy && !reduced.matches) {
          const opacity = getComputedStyle(orbitClock).opacity;
          const epoch = beginMotion();
          returningOrbit = true;
          orbitClock.removeAttribute("data-ready");
          orbitClock.removeAttribute("data-active");
          animate(orbitClock, [{ opacity }, { opacity: 0 }], timing("--duration-quick"));
          void finishMotion(epoch, returnToGallery);
        } else returnToGallery();
      } else if (dialog.open) closeGallery();
      else hidePreview();
    };

    preview.addEventListener("pointerenter", () => { root.dataset.fanned = "true"; warmGallery(); }, { signal });
    preview.addEventListener("pointerleave", () => { if (document.activeElement !== preview) root.dataset.fanned = "false"; }, { signal });
    preview.addEventListener("focus", () => { root.dataset.fanned = "true"; warmGallery(); }, { signal });
    preview.addEventListener("blur", () => { if (!preview.matches(":hover")) root.dataset.fanned = "false"; }, { signal });
    preview.addEventListener("click", openGallery, { signal });
    // Closing restores text focus with the preview hidden. Tab reveals the card
    // control again before the browser chooses the next focusable element.
    if (isWorks) trigger.addEventListener("click", openGallery, { signal });
    trigger.addEventListener("keydown", (event) => {
      if (isWorks && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openGallery();
        return;
      }
      if (event.key === "Tab" && !event.shiftKey && !dialog.open) {
        event.preventDefault();
        showPreview();
        // Resolve the visibility change before moving focus to a hidden control.
        preview.getBoundingClientRect();
        preview.focus({ preventScroll: true });
      }
    }, { signal });
    root.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && matchMedia("(hover: hover) and (pointer: fine)").matches) showPreview(); }, { signal });
    root.addEventListener("pointerleave", () => { if (!root.contains(document.activeElement) || !document.activeElement?.matches(":focus-visible")) hideTimer = setTimeout(hidePreview, timing("--duration-quick")); }, { signal });
    root.addEventListener("focusin", showPreview, { signal });
    root.addEventListener("focusout", (event) => { if (!root.contains(event.relatedTarget as Node | null)) hideTimer = setTimeout(hidePreview, timing("--duration-quick")); }, { signal });
    document.addEventListener("pointerdown", (event) => { if (!dialog.open && !root.contains(event.target as Node)) hidePreview(); }, { signal });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !dialog.open && view === "preview") { event.preventDefault(); hidePreview(); trigger.focus({ preventScroll: true }); hidePreview(); } }, { signal });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); if (isWorks || view !== "detail") back(); }, { signal });
    dialog.addEventListener("close", () => { if (!dialog.open && scrollLocked) finishClose(); }, { signal });
    control.addEventListener("click", back, { signal });
    cards.forEach((card, index) => card.addEventListener("click", () => showDetail(index), { signal }));
    window.addEventListener("scroll", () => { if (!dialog.open && !root.contains(document.activeElement)) hidePreview(); }, { passive: true, signal });
    window.addEventListener("resize", () => {
      if (closing) finishClose();
      else if (returningOrbit) returnToGallery();
      else if (dialog.open && (!busy || view !== "detail" || !detail.hasAttribute("data-julie"))) clearMotion();
      else if (view === "preview") positionPreview();
    }, { signal });
    reduced.addEventListener("change", () => {
      if (reduced.matches) discSpin?.cancel();
      if (closing) finishClose();
      else if (returningOrbit) returnToGallery();
      else if (!busy || view !== "detail" || !detail.hasAttribute("data-julie")) clearMotion();
    }, { signal });
    document.addEventListener("astro:before-swap", () => { finishClose(false); void audioContext?.close(); abort.abort(); dialog.remove(); }, { once: true, signal });
  });
}

initializePhotoStacks();
document.addEventListener("astro:page-load", initializePhotoStacks);
