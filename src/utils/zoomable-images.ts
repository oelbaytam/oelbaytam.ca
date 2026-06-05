declare global {
  interface Window {
    __navfolioZoomableImagesReady?: boolean;
  }
}

type LightboxElements = {
  root: HTMLDivElement;
  image: HTMLImageElement;
  closeButton: HTMLButtonElement;
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
};

let lightboxElements: LightboxElements | undefined;
let previousBodyOverflow = '';
let activeGallery: HTMLImageElement[] = [];
let activeGalleryIndex = -1;

const isPlainMarkdownImage = (target: HTMLImageElement) =>
  Boolean(target.closest('.article-content')) &&
  !target.closest('[data-zoomable-image]') &&
  !target.closest('a[href]') &&
  (target.parentElement?.matches('.article-content > p, .article-content figure') ?? false);

const getZoomTarget = (target: EventTarget | null): HTMLImageElement | undefined => {
  if (!(target instanceof Element)) {
    return undefined;
  }

  const wrappedImage = target
    .closest('[data-zoomable-image]')
    ?.querySelector('[data-zoomable-image-target]');

  if (wrappedImage instanceof HTMLImageElement && !wrappedImage.closest('a[href]')) {
    return wrappedImage;
  }

  if (target instanceof HTMLImageElement && isPlainMarkdownImage(target)) {
    return target;
  }

  return undefined;
};

const getCarouselGallery = (sourceImage: HTMLImageElement) => {
  const carousel = sourceImage.closest('astro-carousel');

  if (!carousel) {
    return { images: [sourceImage], index: 0 };
  }

  const images = Array.from(
    carousel.querySelectorAll<HTMLImageElement>('[data-carousel-slide] img'),
  )
    .filter((image) => !image.closest('a[href]'))
    .filter((image) => image.currentSrc || image.src);
  const index = images.indexOf(sourceImage);

  if (index === -1) {
    return { images: [sourceImage], index: 0 };
  }

  return { images, index };
};

const syncGalleryControls = () => {
  if (!lightboxElements) {
    return;
  }

  const hasGalleryControls = activeGallery.length > 1;

  lightboxElements.root.dataset.hasGallery = hasGalleryControls ? 'true' : 'false';
  lightboxElements.prevButton.hidden = !hasGalleryControls;
  lightboxElements.nextButton.hidden = !hasGalleryControls;
};

const setPreviewImage = (sourceImage: HTMLImageElement) => {
  if (!lightboxElements) {
    return;
  }

  lightboxElements.image.src = sourceImage.currentSrc || sourceImage.src;
  lightboxElements.image.alt = sourceImage.alt || '';

  if (sourceImage.title) {
    lightboxElements.image.title = sourceImage.title;
  } else {
    lightboxElements.image.removeAttribute('title');
  }
};

const movePreview = (offset: number) => {
  if (!lightboxElements || activeGallery.length <= 1) {
    return;
  }

  activeGalleryIndex = (activeGalleryIndex + offset + activeGallery.length) % activeGallery.length;
  setPreviewImage(activeGallery[activeGalleryIndex]);
};

const closePreview = () => {
  if (!lightboxElements) {
    return;
  }

  lightboxElements.root.classList.remove('is-open');
  lightboxElements.root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = previousBodyOverflow;
  lightboxElements.image.removeAttribute('src');
  lightboxElements.image.alt = '';
  lightboxElements.image.removeAttribute('title');
  activeGallery = [];
  activeGalleryIndex = -1;
  syncGalleryControls();
};

const createLightbox = (): LightboxElements => {
  const root = document.createElement('div');
  root.className = 'zoomable-image-lightbox';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <button class="zoomable-image-lightbox__close" type="button" aria-label="Close image preview">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
        <path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
      </svg>
    </button>
    <button class="zoomable-image-lightbox__nav zoomable-image-lightbox__nav--prev" type="button" aria-label="Previous image" hidden>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
        <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
      </svg>
    </button>
    <img class="zoomable-image-lightbox__image" alt="" />
    <button class="zoomable-image-lightbox__nav zoomable-image-lightbox__nav--next" type="button" aria-label="Next image" hidden>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
        <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
      </svg>
    </button>
  `;
  document.body.append(root);

  const image = root.querySelector('.zoomable-image-lightbox__image');
  const closeButton = root.querySelector('.zoomable-image-lightbox__close');
  const prevButton = root.querySelector('.zoomable-image-lightbox__nav--prev');
  const nextButton = root.querySelector('.zoomable-image-lightbox__nav--next');

  if (
    !(image instanceof HTMLImageElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(prevButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    throw new Error('Failed to initialize zoomable image lightbox.');
  }

  root.addEventListener('click', (event) => {
    if (event.target === root) {
      closePreview();
    }
  });

  closeButton.addEventListener('click', closePreview);
  prevButton.addEventListener('click', () => movePreview(-1));
  nextButton.addEventListener('click', () => movePreview(1));

  return { root, image, closeButton, prevButton, nextButton };
};

const getLightbox = (): LightboxElements => {
  lightboxElements ??= createLightbox();
  return lightboxElements;
};

const openPreview = (sourceImage: HTMLImageElement) => {
  const { root, closeButton } = getLightbox();
  const gallery = getCarouselGallery(sourceImage);

  previousBodyOverflow = document.body.style.overflow;
  activeGallery = gallery.images;
  activeGalleryIndex = gallery.index;
  setPreviewImage(sourceImage);
  syncGalleryControls();

  document.body.style.overflow = 'hidden';
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  closeButton.focus({ preventScroll: true });
};

export const initZoomableImages = () => {
  if (window.__navfolioZoomableImagesReady) {
    return;
  }

  window.__navfolioZoomableImagesReady = true;

  document.addEventListener('click', (event) => {
    const image = getZoomTarget(event.target);

    if (image) {
      openPreview(image);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightboxElements?.root.classList.contains('is-open')) {
      closePreview();
      return;
    }

    if (lightboxElements?.root.classList.contains('is-open')) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePreview(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePreview(1);
        return;
      }
    }

    const image = getZoomTarget(event.target);

    if (!image || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    openPreview(image);
  });
};

export {};
