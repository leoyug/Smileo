import gsap from "gsap";
import { cssTimeToMilliseconds } from "../lib/css-time";
import { playInterfaceSound } from "./sound";

type Photo = {
  slug: string;
  src: string;
  alt: string;
  facts: Array<[string, string]>;
};

const initializePhotosPages = () => {
  document
    .querySelectorAll<HTMLElement>("[data-photos-page]")
    .forEach((photosPage) => {
      if (photosPage.dataset.ready === "true") return;
      photosPage.dataset.ready = "true";

      const data = photosPage.querySelector<HTMLScriptElement>(
        "[data-photos-data]",
      );
      const photos = JSON.parse(data?.textContent ?? "[]") as Photo[];
      const dialog = photosPage.querySelector<HTMLDialogElement>(
        "[data-photo-lightbox]",
      );
      const image = photosPage.querySelector<HTMLImageElement>(
        "[data-photo-lightbox-image]",
      );
      const facts = photosPage.querySelector<HTMLDListElement>(
        ".photo-lightbox__facts",
      );
      const stage = photosPage.querySelector<HTMLElement>(
        ".photo-lightbox__stage",
      );
      const frame = photosPage.querySelector<HTMLElement>(
        ".photo-lightbox__frame",
      );
      const links = [
        ...photosPage.querySelectorAll<HTMLAnchorElement>("[data-photo-link]"),
      ];
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      let transitionAnimation: ReturnType<typeof gsap.timeline> | null = null;
      let traveler: HTMLElement | null = null;
      let activeIndex = -1;
      let activeSourceLink: HTMLAnchorElement | null = null;
      let isClosing = false;
      let suppressPopstate = false;
      let resizeObserver: ResizeObserver | null = null;

      const fitPhotoFrame = (ratioOverride?: number) => {
        if (!dialog?.open || !stage || !frame) return;

        const ratio =
          ratioOverride ??
          (image?.naturalWidth && image.naturalHeight
            ? image.naturalWidth / image.naturalHeight
            : 0);
        if (!ratio) return;

        const frameInset = 24;
        const bounds = stage.getBoundingClientRect();
        const maxWidth = Math.max(0, bounds.width - frameInset);
        const maxHeight = Math.max(0, bounds.height - frameInset);

        let imageWidth = maxWidth;
        let imageHeight = imageWidth / ratio;
        if (imageHeight > maxHeight) {
          imageHeight = maxHeight;
          imageWidth = imageHeight * ratio;
        }

        frame.style.width = `${imageWidth + frameInset}px`;
        frame.style.height = `${imageHeight + frameInset}px`;
      };

      const renderPhoto = (index: number) => {
        const photo = photos[index];
        if (!photo || !image) return;
        dialog?.setAttribute("data-image-loading", "true");
        stage?.setAttribute("aria-busy", "true");
        image.src = photo.src;
        image.alt = photo.alt;
        facts?.replaceChildren(
          ...photo.facts.map(([label, value]) => {
            const row = document.createElement("div");
            const term = document.createElement("dt");
            const detail = document.createElement("dd");
            term.textContent = label;
            detail.textContent = value;
            row.append(term, detail);
            return row;
          }),
        );
        if (image.complete && image.naturalWidth > 0) {
          dialog?.removeAttribute("data-image-loading");
          stage?.setAttribute("aria-busy", "false");
          requestAnimationFrame(fitPhotoFrame);
        }
      };

      const clearTransition = () => {
        transitionAnimation?.kill();
        transitionAnimation = null;
        traveler?.remove();
        traveler = null;
        if (frame)
          gsap.set(frame, { clearProps: "opacity,visibility,transform" });
        dialog?.classList.remove(
          "is-opening",
          "is-fallback-opening",
          "is-closing",
          "is-settled",
        );
      };

      const createTraveler = (sourceImage: HTMLImageElement, rect: DOMRect) => {
        if (!dialog) return null;

        const element = document.createElement("div");
        element.className = "photo-lightbox__traveler";
        element.setAttribute("aria-hidden", "true");

        const travelerImage = sourceImage.cloneNode(false) as HTMLImageElement;
        travelerImage.className = "photo-lightbox__traveler-image";
        travelerImage.removeAttribute("loading");
        element.append(travelerImage);
        Object.assign(element.style, {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        dialog.append(element);
        traveler = element;
        return element;
      };

      const playSharedTransition = (
        sourceRect: DOMRect,
        sourceImage: HTMLImageElement,
        targetRect: DOMRect,
      ) => {
        if (!dialog || !frame) return;

        const durationValue = getComputedStyle(
          document.documentElement,
        ).getPropertyValue("--lightbox-photo-duration");
        const travelDuration = cssTimeToMilliseconds(durationValue, 560) / 1000;
        const element = createTraveler(sourceImage, sourceRect);
        if (!element) return;
        gsap.set(frame, { autoAlpha: 0 });

        transitionAnimation = gsap.timeline({
          onComplete: () => {
            dialog.classList.remove("is-fallback-opening");
            dialog.classList.add("is-settled");
            element.remove();
            traveler = null;
            gsap.set(frame, { clearProps: "opacity,visibility,transform" });
            transitionAnimation = null;
          },
        });
        transitionAnimation.fromTo(
          element,
          {
            left: sourceRect.left,
            top: sourceRect.top,
            width: sourceRect.width,
            height: sourceRect.height,
          },
          {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            duration: travelDuration,
            ease: "power3.inOut",
          },
          0,
        );
      };

      const openPhoto = (
        index: number,
        push = true,
        sourceLink?: HTMLAnchorElement,
      ) => {
        const photo = photos[index];
        if (!dialog || !photo) return;
        const sourceImage =
          sourceLink?.querySelector<HTMLImageElement>(".photo-hover-image");
        const sourceRect = sourceImage?.getBoundingClientRect();
        const sourceRatio =
          sourceImage?.naturalWidth && sourceImage.naturalHeight
            ? sourceImage.naturalWidth / sourceImage.naturalHeight
            : undefined;

        clearTransition();
        isClosing = false;
        activeIndex = index;
        activeSourceLink = sourceLink ?? null;
        renderPhoto(index);
        if (!dialog.open) dialog.showModal();
        document.documentElement.classList.add("has-photo-lightbox");
        dialog.focus();
        if (push) playInterfaceSound("loading", 0.8);
        requestAnimationFrame(() => {
          fitPhotoFrame(sourceRatio);
          dialog.classList.add("is-opening");
          if (reducedMotion.matches) {
            dialog.classList.add("is-settled");
          } else if (sourceRect && sourceImage && image) {
            playSharedTransition(
              sourceRect,
              sourceImage,
              image.getBoundingClientRect(),
            );
          } else {
            dialog.classList.add("is-fallback-opening");
          }
        });
        if (push)
          history.pushState(
            { photoOverlay: true, photoSlug: photo.slug },
            "",
            `/photos/${photo.slug}/`,
          );
      };

      type CloseHistoryMode = "back" | "replace" | "none";

      const finishClose = (historyMode: CloseHistoryMode) => {
        if (!dialog) return;
        transitionAnimation = null;
        traveler?.remove();
        traveler = null;
        gsap.set(frame, { clearProps: "opacity,visibility,transform" });
        dialog.close();
        dialog.classList.remove(
          "is-opening",
          "is-fallback-opening",
          "is-closing",
          "is-settled",
        );
        document.documentElement.classList.remove("has-photo-lightbox");
        isClosing = false;
        activeIndex = -1;
        activeSourceLink?.focus({ preventScroll: true });
        activeSourceLink = null;

        if (historyMode === "back") {
          suppressPopstate = true;
          history.back();
        } else if (historyMode === "replace") {
          history.replaceState({}, "", "/photos/");
        }
      };

      const getClosingSource = () => {
        const candidates = activeSourceLink
          ? [activeSourceLink, ...links]
          : links;
        return (
          candidates.find((link) => {
            if (
              Number(link.dataset.photoIndex) !== activeIndex ||
              link.getClientRects().length === 0
            )
              return false;
            const rect = link.getBoundingClientRect();
            return (
              rect.bottom > 0 &&
              rect.top < innerHeight &&
              rect.right > 0 &&
              rect.left < innerWidth
            );
          }) ?? null
        );
      };

      const closePhoto = (historyMode: CloseHistoryMode) => {
        if (!dialog?.open || !frame || !image || isClosing) return;
        isClosing = true;
        playInterfaceSound("loading", 0.8);

        const sourceLink = getClosingSource();
        const sourceImage =
          sourceLink?.querySelector<HTMLImageElement>(".photo-hover-image");
        if (reducedMotion.matches || !sourceLink || !sourceImage) {
          finishClose(historyMode);
          return;
        }

        const sourceRect = sourceImage.getBoundingClientRect();
        const targetRect = image.getBoundingClientRect();
        transitionAnimation?.kill();
        transitionAnimation = null;
        traveler?.remove();
        const element = createTraveler(sourceImage, targetRect);
        if (!element) {
          finishClose(historyMode);
          return;
        }
        dialog.classList.remove(
          "is-opening",
          "is-fallback-opening",
          "is-settled",
        );
        dialog.classList.add("is-closing");
        gsap.set(frame, { autoAlpha: 0 });

        const durationValue = getComputedStyle(
          document.documentElement,
        ).getPropertyValue("--lightbox-close-duration");
        const closeDuration = cssTimeToMilliseconds(durationValue, 400) / 1000;

        transitionAnimation = gsap.timeline({
          onComplete: () => finishClose(historyMode),
        });
        transitionAnimation.to(
          element,
          {
            left: sourceRect.left,
            top: sourceRect.top,
            width: sourceRect.width,
            height: sourceRect.height,
            duration: closeDuration,
            ease: "power3.inOut",
          },
          0,
        );
      };

      const requestClose = () => {
        // Keep the photo page in place when dismissing the overlay. A
        // history back() here asks Astro's client router to replace the whole
        // page, which causes a visible flash before the next photo can open.
        closePhoto("replace");
      };

      links.forEach((link) => {
        link.addEventListener("click", (event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          openPhoto(Number(link.dataset.photoIndex), true, link);
        });
      });

      dialog?.addEventListener("click", requestClose);
      image?.addEventListener("load", () => {
        dialog?.removeAttribute("data-image-loading");
        stage?.setAttribute("aria-busy", "false");
        fitPhotoFrame();
      });
      image?.addEventListener("error", () => {
        dialog?.removeAttribute("data-image-loading");
        stage?.setAttribute("aria-busy", "false");
      });
      if (stage) {
        resizeObserver = new ResizeObserver(() => fitPhotoFrame());
        resizeObserver.observe(stage);
      }
      dialog?.addEventListener("cancel", (event) => {
        event.preventDefault();
        requestClose();
      });

      const handlePopstate = () => {
        if (suppressPopstate) {
          suppressPopstate = false;
          return;
        }
        const match = location.pathname.match(/^\/photos\/([^/]+)\/?$/);
        const index = match
          ? photos.findIndex(
              (photo) => photo.slug === decodeURIComponent(match[1]),
            )
          : -1;
        if (index >= 0) openPhoto(index, false);
        else closePhoto("none");
      };

      const dispose = () => {
        removeEventListener("popstate", handlePopstate);
        resizeObserver?.disconnect();
        clearTransition();
      };

      addEventListener("popstate", handlePopstate);
      document.addEventListener("astro:before-swap", dispose, { once: true });

      const initialSlug = photosPage.dataset.initialSlug;
      const initialIndex = initialSlug
        ? photos.findIndex((photo) => photo.slug === initialSlug)
        : -1;
      if (initialIndex >= 0)
        requestAnimationFrame(() => openPhoto(initialIndex, false));
    });
};

initializePhotosPages();
document.addEventListener("astro:page-load", initializePhotosPages);
