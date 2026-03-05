const PHOTO_GALLERY_SELECTOR = '#photo-gallery';
const PHOTO_CONFIG_PATH = 'data/photography.json';
const DEFAULT_CLOUD_NAME = 'dvytw7jg4';
const DEFAULT_TAGS = ['photography'];
const DEFAULT_DEFAULT_TAG = 'top';
const DEFAULT_BATCH_SIZE = 9;
const MAX_BATCH_SIZE = 30;
const DEFAULT_INITIAL_VISIBLE_DEFAULT_TAG = 9;
const DEFAULT_INITIAL_VISIBLE_OTHER_TAGS = 3;
const MAX_INITIAL_VISIBLE = 30;
const COMPACT_VISIBLE_STEP = 12;
const MOBILE_BREAKPOINT_QUERY = '(max-width: 760px)';

function normalizeString(value){
  return String(value || '').trim();
}

function sanitizeTag(tag){
  return normalizeString(tag).replace(/[^a-zA-Z0-9_-]/g, '');
}

function toPositiveInt(value, fallback, max){
  const numeric = Number(value);
  if(!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.floor(numeric), max);
}

function uniqueTags(values){
  const tags = values.map(sanitizeTag).filter(Boolean);
  return [...new Set(tags)];
}

function getRequestedTags(config){
  const tagsFromArray = Array.isArray(config?.tags) ? config.tags : [];
  const legacyTag = normalizeString(config?.tag);
  const merged = legacyTag ? [...tagsFromArray, legacyTag] : tagsFromArray;
  const deduped = uniqueTags(merged);
  return deduped.length ? deduped : DEFAULT_TAGS;
}

function getBatchSize(config){
  return toPositiveInt(config?.batchSize, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
}

function getDefaultTag(config, tags){
  const configuredTag = sanitizeTag(config?.defaultTag);
  if(configuredTag && tags.includes(configuredTag)) return configuredTag;
  if(tags.includes(DEFAULT_DEFAULT_TAG)) return DEFAULT_DEFAULT_TAG;
  return tags[0] || DEFAULT_DEFAULT_TAG;
}

function getInitialVisibleDefaultTag(config){
  return toPositiveInt(
    config?.initialVisibleDefaultTag,
    DEFAULT_INITIAL_VISIBLE_DEFAULT_TAG,
    MAX_INITIAL_VISIBLE
  );
}

function getInitialVisibleOtherTags(config){
  return toPositiveInt(
    config?.initialVisibleOtherTags,
    DEFAULT_INITIAL_VISIBLE_OTHER_TAGS,
    MAX_INITIAL_VISIBLE
  );
}

function shouldStartCompact(){
  if(typeof window === 'undefined' || typeof window.matchMedia !== 'function'){
    return false;
  }
  return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
}

function humanizeTag(tag){
  return tag
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTagLabel(config, tag){
  const labels = config?.tagLabels;
  if(labels && typeof labels === 'object'){
    const custom = normalizeString(labels[tag]);
    if(custom) return custom;
  }
  return humanizeTag(tag);
}

function normalizePhoto(item){
  const title = normalizeString(item?.title);
  const description = normalizeString(item?.description);
  return {
    title,
    description,
    alt: normalizeString(item?.alt) || description || title || 'Photography image',
    url: normalizeString(item?.url),
    publicId: normalizeString(item?.publicId),
    version: normalizeString(item?.version),
    format: normalizeString(item?.format)
  };
}

function encodePublicId(publicId){
  return publicId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function withCloudinaryTransform(url, transform){
  const marker = '/image/upload/';
  if(!url.includes(marker)) return url;
  return url.replace(marker, `${marker}${transform}/`);
}

function buildCloudinaryUrl(cloudName, photo, transform){
  if(!cloudName || !photo.publicId) return '';
  const version = photo.version ? `v${photo.version.replace(/^v/, '')}/` : '';
  const extension = photo.format ? `.${photo.format.replace(/^\./, '')}` : '';
  const encodedPublicId = encodePublicId(photo.publicId);
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${version}${encodedPublicId}${extension}`;
}

function getPhotoUrls(cloudName, photo){
  const fullTransform = 'f_auto,q_auto,w_2200';
  const thumbTransform = 'f_auto,q_auto,w_900';

  if(photo.url){
    return {
      full: withCloudinaryTransform(photo.url, fullTransform),
      thumb: withCloudinaryTransform(photo.url, thumbTransform)
    };
  }

  return {
    full: buildCloudinaryUrl(cloudName, photo, fullTransform),
    thumb: buildCloudinaryUrl(cloudName, photo, thumbTransform)
  };
}

function renderEmptyState(root, message){
  const empty = document.createElement('p');
  empty.className = 'muted';
  empty.textContent = message;
  root.replaceChildren(empty);
}

function createPhotoPreviewController(){
  const modal = document.createElement('div');
  modal.className = 'photo-preview-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Photo preview');

  const panel = document.createElement('div');
  panel.className = 'photo-preview-panel';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'photo-preview-close';
  closeButton.setAttribute('aria-label', 'Close preview');
  closeButton.textContent = 'Close';

  const image = document.createElement('img');
  image.className = 'photo-preview-image';
  image.alt = '';

  const caption = document.createElement('div');
  caption.className = 'photo-preview-caption';

  const captionTitle = document.createElement('p');
  captionTitle.className = 'photo-preview-title';

  const captionDescription = document.createElement('p');
  captionDescription.className = 'photo-preview-description';

  caption.appendChild(captionTitle);
  caption.appendChild(captionDescription);
  panel.appendChild(closeButton);
  panel.appendChild(image);
  panel.appendChild(caption);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  let lastFocusedElement = null;

  function close(){
    if(modal.hidden) return;
    modal.hidden = true;
    image.removeAttribute('src');
    document.body.classList.remove('photo-preview-open');
    if(lastFocusedElement instanceof HTMLElement){
      lastFocusedElement.focus();
    }
  }

  function open(payload){
    const source = normalizeString(payload?.src);
    if(!source) return;

    const title = normalizeString(payload?.title);
    const description = normalizeString(payload?.description);
    const alt = normalizeString(payload?.alt) || title || description || 'Photo preview';

    lastFocusedElement = payload?.trigger instanceof HTMLElement
      ? payload.trigger
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    image.src = source;
    image.alt = alt;

    captionTitle.textContent = title;
    captionDescription.textContent = description;
    captionTitle.hidden = !title;
    captionDescription.hidden = !description;
    caption.hidden = !(title || description);

    modal.hidden = false;
    document.body.classList.add('photo-preview-open');
    closeButton.focus();
  }

  modal.addEventListener('click', (event) => {
    if(event.target === modal){
      close();
    }
  });

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if(event.key === 'Escape' && !modal.hidden){
      event.preventDefault();
      close();
    }
  });

  return {open, close};
}

function createPhotoCard(cloudName, photo, previewController){
  const {full, thumb} = getPhotoUrls(cloudName, photo);
  if(!thumb && !full) return null;

  const card = document.createElement('article');
  card.className = 'photo-card';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'photo-link';
  const labelText = normalizeString(photo.title) || normalizeString(photo.description) || 'Open photo preview';
  trigger.setAttribute('aria-label', `Open photo preview: ${labelText}`);

  const image = document.createElement('img');
  image.className = 'photo-image';
  image.src = thumb || full;
  image.alt = photo.alt;
  image.loading = 'lazy';
  image.decoding = 'async';

  trigger.appendChild(image);
  const hasTitle = Boolean(normalizeString(photo.title));
  const hasDescription = Boolean(normalizeString(photo.description));
  if(hasTitle || hasDescription){
    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';

    if(hasTitle){
      const title = document.createElement('h3');
      title.className = 'photo-overlay-title';
      title.textContent = photo.title;
      overlay.appendChild(title);
    }

    if(hasDescription){
      const description = document.createElement('p');
      description.className = 'photo-overlay-desc';
      description.textContent = photo.description;
      overlay.appendChild(description);
    }

    trigger.appendChild(overlay);
  }

  trigger.addEventListener('click', () => {
    previewController.open({
      src: full || thumb,
      alt: photo.alt,
      title: photo.title,
      description: photo.description,
      trigger
    });
  });

  card.appendChild(trigger);
  return card;
}

function fromCloudinaryResource(resource){
  const contextCustom = resource?.context?.custom || {};
  const captionAsTitle = normalizeString(contextCustom.caption);
  const altAsDescription = normalizeString(contextCustom.alt);
  const accessibleAlt = altAsDescription
    || captionAsTitle
    || normalizeString(resource?.display_name)
    || 'Photography image';

  return {
    title: captionAsTitle,
    description: altAsDescription,
    alt: accessibleAlt,
    url: normalizeString(resource?.secure_url) || normalizeString(resource?.url),
    publicId: normalizeString(resource?.public_id),
    version: String(resource?.version || ''),
    format: normalizeString(resource?.format)
  };
}

async function fetchJson(url){
  const response = await fetch(url, {cache: 'no-cache'});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadConfig(){
  try{
    return await fetchJson(PHOTO_CONFIG_PATH);
  }catch(error){
    console.warn('Photography config not found, using defaults.', error);
    return {};
  }
}

function buildCloudinaryListUrl(cloudName, tag){
  return `https://res.cloudinary.com/${cloudName}/image/list/${tag}.json`;
}

async function loadPhotosFromCloudinary(cloudName, tag){
  const listUrl = buildCloudinaryListUrl(cloudName, tag);
  const payload = await fetchJson(listUrl);
  const resources = Array.isArray(payload?.resources) ? payload.resources : [];
  return resources
    .map((resource) => fromCloudinaryResource(resource))
    .filter((photo) => Boolean(photo.url || photo.publicId));
}

function createTagSection(tag, label, total){
  const section = document.createElement('section');
  section.className = 'photo-tag-section';
  section.dataset.tag = tag;

  const header = document.createElement('div');
  header.className = 'photo-tag-header';

  const title = document.createElement('h3');
  title.className = 'photo-tag-title';
  title.textContent = label;

  const count = document.createElement('p');
  count.className = 'photo-tag-count muted';
  count.textContent = `${total} photo${total === 1 ? '' : 's'}`;

  const meta = document.createElement('div');
  meta.className = 'photo-tag-meta';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'photo-tag-toggle';
  toggleButton.setAttribute('aria-pressed', 'false');
  toggleButton.textContent = 'Compact';

  const grid = document.createElement('div');
  grid.className = 'photo-gallery';
  grid.id = `photo-gallery-${sanitizeTag(tag) || 'tag'}`;
  toggleButton.setAttribute('aria-controls', grid.id);

  const compactLoadMoreButton = document.createElement('button');
  compactLoadMoreButton.type = 'button';
  compactLoadMoreButton.className = 'photo-load-more-tile';
  compactLoadMoreButton.setAttribute('aria-label', `Load more photos in ${label}`);
  compactLoadMoreButton.textContent = '+';
  compactLoadMoreButton.hidden = true;
  grid.appendChild(compactLoadMoreButton);

  const status = document.createElement('p');
  status.className = 'photo-load-status muted';
  status.textContent = total ? 'Click the banner below to load more photos.' : 'No photos for this tag.';

  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'photo-load-more';
  loadMoreButton.textContent = 'Load more photos';
  loadMoreButton.hidden = total === 0;

  header.appendChild(title);
  meta.appendChild(count);
  meta.appendChild(toggleButton);
  header.appendChild(meta);
  section.appendChild(header);
  section.appendChild(grid);
  section.appendChild(status);
  section.appendChild(loadMoreButton);

  return {section, grid, status, loadMoreButton, toggleButton, compactLoadMoreButton};
}

function getLoadedCards(state){
  return state.grid.querySelectorAll('.photo-card');
}

function refreshCompactVisibility(state){
  const cards = getLoadedCards(state);
  cards.forEach((card, index) => {
    const hideInCompact = state.collapsed && index >= state.compactVisible;
    card.classList.toggle('is-compact-hidden', hideInCompact);
  });
}

function updateCompactLoadMoreButton(state){
  const loadedCards = getLoadedCards(state);
  const loadedCount = loadedCards.length;
  const hiddenLoadedCount = Math.max(0, loadedCount - state.compactVisible);
  const hasHiddenLoaded = state.collapsed && hiddenLoadedCount > 0;
  const canLoadMore = !state.complete;
  const shouldShow = state.collapsed && loadedCount > 0 && (hasHiddenLoaded || canLoadMore);

  state.compactLoadMoreButton.hidden = !shouldShow;
  if(!shouldShow) return;

  if(hasHiddenLoaded){
    state.compactLoadMoreButton.setAttribute(
      'aria-label',
      `Show ${Math.min(COMPACT_VISIBLE_STEP, hiddenLoadedCount)} more photos in ${state.label}`
    );
    return;
  }

  state.compactLoadMoreButton.setAttribute('aria-label', `Load more photos in ${state.label}`);
}

function updateSectionStatus(state){
  if(state.complete){
    const loaded = getLoadedCards(state).length;
    state.status.textContent = loaded ? `All ${loaded} photos loaded.` : 'No photos for this tag.';
    state.loadMoreButton.hidden = true;
    return;
  }
  state.loadMoreButton.hidden = false;
  state.loadMoreButton.textContent = `Load more photos`;
  state.status.textContent = `Showing ${state.offset} of ${state.items.length}.`;
}

function appendNextBatch(state, customSize){
  if(state.loading || state.complete) return;
  state.loading = true;

  const start = state.offset;
  const requestedSize = toPositiveInt(customSize, state.batchSize, MAX_INITIAL_VISIBLE);
  const end = Math.min(start + requestedSize, state.items.length);
  const batch = state.items.slice(start, end);
  const fragment = document.createDocumentFragment();

  batch.forEach((photo) => {
    const normalized = normalizePhoto(photo);
    const card = createPhotoCard(state.cloudName, normalized, state.previewController);
    if(card) fragment.appendChild(card);
  });

  if(fragment.childNodes.length){
    state.grid.insertBefore(fragment, state.compactLoadMoreButton);
  }

  state.offset = end;
  state.loading = false;

  if(state.offset >= state.items.length){
    state.complete = true;
  }

  updateSectionStatus(state);
  refreshCompactVisibility(state);
  updateCompactLoadMoreButton(state);
}

function handleCompactLoadMore(state){
  if(!state.collapsed){
    appendNextBatch(state);
    return;
  }

  const loadedCount = getLoadedCards(state).length;
  if(loadedCount > state.compactVisible){
    state.compactVisible += COMPACT_VISIBLE_STEP;
    refreshCompactVisibility(state);
    updateCompactLoadMoreButton(state);
    return;
  }

  if(!state.complete){
    appendNextBatch(state);
  }

  state.compactVisible += COMPACT_VISIBLE_STEP;
  refreshCompactVisibility(state);
  updateCompactLoadMoreButton(state);
}

function setSectionCollapsed(state, collapsed){
  state.collapsed = Boolean(collapsed);
  state.section.classList.toggle('is-collapsed', state.collapsed);
  state.toggleButton.setAttribute('aria-pressed', String(state.collapsed));
  state.toggleButton.setAttribute(
    'aria-label',
    state.collapsed ? `Expand ${state.label}` : `Compact ${state.label}`
  );
  state.toggleButton.textContent = state.collapsed ? 'Expand' : 'Compact';
  refreshCompactVisibility(state);
  updateCompactLoadMoreButton(state);
}

function createSectionStates(root, cloudName, batchSize, groups, previewController, initiallyCollapsed){
  const fragment = document.createDocumentFragment();
  const states = groups.map((group) => {
    const ui = createTagSection(group.tag, group.label, group.items.length);
    fragment.appendChild(ui.section);
    return {
      cloudName,
      batchSize,
      label: group.label,
      initialVisible: group.initialVisible,
      items: group.items,
      offset: 0,
      loading: false,
      collapsed: false,
      compactVisible: COMPACT_VISIBLE_STEP,
      complete: group.items.length === 0,
      previewController,
      ...ui
    };
  });

  root.replaceChildren(fragment);
  states.forEach((state) => {
    state.loadMoreButton.addEventListener('click', () => appendNextBatch(state));
    state.compactLoadMoreButton.addEventListener('click', () => handleCompactLoadMore(state));
    state.toggleButton.addEventListener('click', () => {
      setSectionCollapsed(state, !state.collapsed);
    });
    setSectionCollapsed(state, initiallyCollapsed);
    updateSectionStatus(state);
  });
  return states;
}

async function initPhotography(){
  const root = document.querySelector(PHOTO_GALLERY_SELECTOR);
  if(!root) return;

  const config = await loadConfig();
  const cloudName = normalizeString(config?.cloudName) || DEFAULT_CLOUD_NAME;
  const tags = getRequestedTags(config);
  const defaultTag = getDefaultTag(config, tags);
  const initialVisibleDefaultTag = getInitialVisibleDefaultTag(config);
  const initialVisibleOtherTags = getInitialVisibleOtherTags(config);
  const batchSize = getBatchSize(config);

  try{
    const results = await Promise.allSettled(
      tags.map((tag) => loadPhotosFromCloudinary(cloudName, tag))
    );

    const groups = [];
    let hadErrors = false;

    results.forEach((result, index) => {
      const tag = tags[index];
      if(result.status === 'fulfilled'){
        groups.push({
          tag,
          label: getTagLabel(config, tag),
          items: result.value
        });
        return;
      }

      hadErrors = true;
      console.warn(`Error loading tag "${tag}":`, result.reason);
    });

    if(!groups.length){
      renderEmptyState(
        root,
        hadErrors ? 'Error loading photos from Cloudinary.' : 'No photos available yet.'
      );
      return;
    }

    const orderedGroups = [
      ...groups.filter((group) => group.tag === defaultTag),
      ...groups.filter((group) => group.tag !== defaultTag)
    ].map((group) => ({
      ...group,
      initialVisible: group.tag === defaultTag ? initialVisibleDefaultTag : initialVisibleOtherTags
    }));

    const previewController = createPhotoPreviewController();
    const sectionStates = createSectionStates(
      root,
      cloudName,
      batchSize,
      orderedGroups,
      previewController,
      shouldStartCompact()
    );
    sectionStates.forEach((state) => {
      if(state.items.length){
        appendNextBatch(state, state.initialVisible);
      }
    });
  }catch(error){
    console.error('Error loading Cloudinary image lists:', error);
    renderEmptyState(root, 'Error loading photos from Cloudinary.');
  }
}

document.addEventListener('DOMContentLoaded', initPhotography);
