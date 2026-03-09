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
const PUBLICATION_AGGREGATOR_SELECTOR = '#publication-aggregator';
const ORCID_API_BASE_URL = 'https://pub.orcid.org/v3.0';
const ADS_API_BASE_URL = 'https://api.adsabs.harvard.edu/v1/search/query';
const ADS_ABSTRACT_BASE_URL = 'https://ui.adsabs.harvard.edu/abs';
const DEFAULT_PUBLICATIONS_MAX_ITEMS = 80;
const MAX_PUBLICATIONS_MAX_ITEMS = 300;
const SOURCE_ORDER = ['ORCID', 'ADS', 'ResearchGate'];

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

  const media = document.createElement('div');
  media.className = 'photo-preview-media';

  const caption = document.createElement('div');
  caption.className = 'photo-preview-caption';

  const captionTitle = document.createElement('p');
  captionTitle.className = 'photo-preview-title';

  const captionDescription = document.createElement('p');
  captionDescription.className = 'photo-preview-description';

  caption.appendChild(captionTitle);
  caption.appendChild(captionDescription);
  media.appendChild(image);
  media.appendChild(closeButton);
  panel.appendChild(media);
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

function splitList(value){
  return String(value || '')
    .split(/[\n,;|]+/)
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function toList(value){
  if(Array.isArray(value)){
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  return splitList(value);
}

function uniqueStrings(values){
  return [...new Set(values.filter(Boolean))];
}

function normalizeOrcidId(value){
  const clean = normalizeString(value)
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .replace(/[^0-9xX]/g, '')
    .toUpperCase();

  if(clean.length !== 16) return '';
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
}

function normalizeDoi(value){
  const clean = normalizeString(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  const match = clean.match(/10\.\d{4,9}\/\S+/i);
  if(!match) return '';
  return match[0].replace(/[.,;)\]]+$/, '').toLowerCase();
}

function ensureHttpUrl(value){
  const url = normalizeString(value);
  if(!url) return '';
  return /^https?:\/\//i.test(url) ? url : '';
}

function parsePublicationYear(value){
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function flattenStrings(value){
  if(Array.isArray(value)){
    return value.flatMap((entry) => flattenStrings(entry));
  }
  const text = normalizeString(value);
  return text ? [text] : [];
}

function getPrimaryText(value){
  const values = flattenStrings(value);
  return values[0] || '';
}

function normalizeForMatch(value){
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/orcid\.org\//g, '')
    .replace(/[^a-z0-9\s,./:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDoiUrl(doi){
  const normalized = normalizeDoi(doi);
  return normalized ? `https://doi.org/${normalized}` : '';
}

function safeLocalStorageGet(key){
  try{
    if(typeof window === 'undefined' || !window.localStorage){
      return '';
    }
    return normalizeString(window.localStorage.getItem(key));
  }catch(error){
    return '';
  }
}

function splitHumanName(name){
  const parts = normalizeString(name).split(/\s+/).filter(Boolean);
  if(parts.length <= 1){
    return {
      given: parts[0] || '',
      family: parts[0] || ''
    };
  }
  return {
    given: parts.slice(0, -1).join(' '),
    family: parts[parts.length - 1]
  };
}

function buildNameAliases(names){
  const aliases = new Set();

  names.forEach((name) => {
    const normalized = normalizeForMatch(name);
    if(normalized) aliases.add(normalized);

    const parts = normalizeString(name).split(/\s+/).filter(Boolean);
    if(parts.length < 2) return;

    const family = parts[parts.length - 1];
    const given = parts.slice(0, -1).join(' ');
    const firstGiven = parts[0];

    aliases.add(normalizeForMatch(`${family}, ${given}`));
    aliases.add(normalizeForMatch(`${firstGiven} ${family}`));
    aliases.add(normalizeForMatch(`${firstGiven}. ${family}`));
  });

  return [...aliases].filter(Boolean);
}

function getPublicationConfig(root){
  const globalConfig = (typeof window !== 'undefined' && window.PUBLICATIONS_FETCH_CONFIG)
    ? window.PUBLICATIONS_FETCH_CONFIG
    : {};

  const authorNames = uniqueStrings([
    ...toList(root?.dataset?.authorNames),
    ...toList(globalConfig?.authorNames)
  ]);
  const orcidIds = uniqueStrings([
    ...toList(root?.dataset?.orcidIds),
    ...toList(globalConfig?.orcidIds)
  ].map(normalizeOrcidId).filter(Boolean));
  const identifiers = uniqueStrings([
    ...toList(root?.dataset?.identifiers),
    ...toList(globalConfig?.identifiers)
  ]);

  const adsToken = normalizeString(root?.dataset?.adsToken)
    || normalizeString(globalConfig?.adsToken)
    || safeLocalStorageGet('adsApiToken');

  return {
    authorNames,
    orcidIds,
    identifiers,
    adsToken,
    adsQuery: normalizeString(root?.dataset?.adsQuery) || normalizeString(globalConfig?.adsQuery),
    researchGateProfile: normalizeString(root?.dataset?.researchgateProfile)
      || normalizeString(globalConfig?.researchGateProfile),
    researchGateJson: normalizeString(root?.dataset?.researchgateJson)
      || normalizeString(globalConfig?.researchGateJson),
    maxItems: toPositiveInt(
      root?.dataset?.maxItems || globalConfig?.maxItems,
      DEFAULT_PUBLICATIONS_MAX_ITEMS,
      MAX_PUBLICATIONS_MAX_ITEMS
    )
  };
}

function buildIdentity(config){
  return {
    authorNames: config.authorNames,
    aliases: buildNameAliases(config.authorNames),
    orcidIds: config.orcidIds,
    identifiers: config.identifiers,
    identifierMatchers: config.identifiers.map((value) => normalizeForMatch(value)).filter(Boolean)
  };
}

function matchesIdentity(publication, identity){
  const hasIdentityCriteria = Boolean(
    identity.aliases.length || identity.orcidIds.length || identity.identifierMatchers.length
  );
  if(!hasIdentityCriteria) return true;

  const publicationOrcids = (publication.orcidIds || []).map(normalizeOrcidId).filter(Boolean);
  if(identity.orcidIds.some((id) => publicationOrcids.includes(id))){
    return true;
  }

  const identifierText = normalizeForMatch([
    publication.doi,
    publication.url,
    ...(publication.identifiers || [])
  ].join(' '));
  if(identity.identifierMatchers.some((identifier) => identifierText.includes(identifier))){
    return true;
  }

  const authorsText = normalizeForMatch(publication.authors || '');
  if(identity.aliases.some((alias) => authorsText.includes(alias))){
    return true;
  }

  return false;
}

function asPublicationItem(item, source){
  const doi = normalizeDoi(item?.doi || item?.url || item?.identifier);
  const url = ensureHttpUrl(item?.url || item?.link) || toDoiUrl(doi);
  const title = getPrimaryText(item?.title) || 'Untitled publication';
  const authors = Array.isArray(item?.authors)
    ? item.authors.map((author) => normalizeString(author)).filter(Boolean).join(', ')
    : getPrimaryText(item?.authors || item?.author);
  const venue = getPrimaryText(item?.venue || item?.journal || item?.pub);
  const year = parsePublicationYear(item?.year || item?.date || item?.pubdate);
  const identifiers = uniqueStrings([
    ...flattenStrings(item?.identifiers),
    ...flattenStrings(item?.identifier),
    ...flattenStrings(item?.bibcode),
    doi
  ].map((value) => normalizeString(value)).filter(Boolean));
  const orcidIds = uniqueStrings([
    ...flattenStrings(item?.orcidIds),
    ...flattenStrings(item?.orcid_pub)
  ].map(normalizeOrcidId).filter(Boolean));

  return {
    title,
    authors,
    venue,
    year,
    doi,
    url,
    identifiers,
    orcidIds,
    sources: [source]
  };
}

async function searchOrcidIdsByName(name){
  const {given, family} = splitHumanName(name);
  const clauses = [];
  if(given) clauses.push(`given-names:"${given}"`);
  if(family) clauses.push(`family-name:"${family}"`);
  if(!clauses.length) return [];

  const url = `${ORCID_API_BASE_URL}/search/?q=${encodeURIComponent(clauses.join(' AND '))}`;
  const response = await fetch(url, {
    cache: 'no-cache',
    headers: {Accept: 'application/json'}
  });
  if(!response.ok) throw new Error(`ORCID search failed: HTTP ${response.status}`);

  const payload = await response.json();
  const rows = Array.isArray(payload?.result) ? payload.result : [];
  return rows
    .map((row) => normalizeOrcidId(
      row?.['orcid-identifier']?.path || row?.['orcid-identifier']?.uri
    ))
    .filter(Boolean);
}

function parseOrcidExternalIds(summary){
  const entries = Array.isArray(summary?.['external-ids']?.['external-id'])
    ? summary['external-ids']['external-id']
    : [];

  return entries
    .map((entry) => ({
      type: normalizeString(entry?.['external-id-type']).toLowerCase(),
      value: normalizeString(entry?.['external-id-value'])
    }))
    .filter((entry) => Boolean(entry.value));
}

async function fetchOrcidWorks(orcidId){
  const url = `${ORCID_API_BASE_URL}/${orcidId}/works`;
  const response = await fetch(url, {
    cache: 'no-cache',
    headers: {Accept: 'application/json'}
  });
  if(!response.ok) throw new Error(`ORCID works failed for ${orcidId}: HTTP ${response.status}`);

  const payload = await response.json();
  const groups = Array.isArray(payload?.group) ? payload.group : [];
  const publications = [];

  groups.forEach((group) => {
    const summaries = Array.isArray(group?.['work-summary']) ? group['work-summary'] : [];
    summaries.forEach((summary) => {
      const externalIds = parseOrcidExternalIds(summary);
      const doi = normalizeDoi(
        externalIds.find((entry) => entry.type === 'doi')?.value
          || externalIds.map((entry) => entry.value).join(' ')
      );
      const identifiers = uniqueStrings([
        ...externalIds.map((entry) => entry.value),
        normalizeString(summary?.['put-code']),
        doi
      ].filter(Boolean));

      const publication = asPublicationItem({
        title: summary?.title?.title?.value,
        venue: summary?.['journal-title']?.value || summary?.type,
        year: summary?.['publication-date']?.year?.value,
        url: ensureHttpUrl(summary?.url?.value) || toDoiUrl(doi) || `https://orcid.org/${orcidId}`,
        doi,
        identifiers,
        orcidIds: [orcidId]
      }, 'ORCID');

      publications.push(publication);
    });
  });

  return publications;
}

async function loadOrcidPublications(identity){
  const source = 'ORCID';
  const orcidIds = new Set(identity.orcidIds);

  if(!orcidIds.size && identity.authorNames.length){
    const searchResults = await Promise.allSettled(
      identity.authorNames.map((name) => searchOrcidIdsByName(name))
    );
    searchResults.forEach((result) => {
      if(result.status !== 'fulfilled') return;
      result.value.forEach((orcidId) => orcidIds.add(orcidId));
    });
  }

  if(!orcidIds.size){
    return {
      source,
      level: 'warning',
      message: 'No ORCID id available from configuration.',
      items: []
    };
  }

  const ids = [...orcidIds];
  const workResults = await Promise.allSettled(ids.map((orcidId) => fetchOrcidWorks(orcidId)));
  const items = [];
  let failed = 0;

  workResults.forEach((result) => {
    if(result.status === 'fulfilled'){
      items.push(...result.value);
      return;
    }
    failed += 1;
    console.warn('ORCID source error:', result.reason);
  });

  return {
    source,
    level: failed ? (items.length ? 'warning' : 'error') : 'ok',
    message: failed
      ? `Loaded ${items.length} publications from ORCID (${failed} profile request failed).`
      : `Loaded ${items.length} publications from ORCID.`,
    items
  };
}

function escapeAdsQueryValue(value){
  return normalizeString(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildAdsQuery(identity, customQuery){
  const clauses = new Set();

  identity.orcidIds.forEach((orcidId) => {
    clauses.add(`orcid:${orcidId}`);
  });

  identity.authorNames.forEach((name) => {
    const cleanName = escapeAdsQueryValue(name);
    if(cleanName) clauses.add(`author:"${cleanName}"`);

    const {given, family} = splitHumanName(name);
    if(given && family){
      clauses.add(`author:"${escapeAdsQueryValue(`${family}, ${given}`)}"`);
    }
  });

  identity.identifiers.forEach((identifier) => {
    const cleanIdentifier = escapeAdsQueryValue(identifier);
    if(cleanIdentifier) clauses.add(`identifier:"${cleanIdentifier}"`);
  });

  const custom = normalizeString(customQuery);
  if(custom) clauses.add(`(${custom})`);

  return [...clauses].join(' OR ');
}

function parseAdsPublication(doc){
  const doi = normalizeDoi(getPrimaryText(doc?.doi));
  const bibcode = getPrimaryText(doc?.bibcode);
  const url = toDoiUrl(doi) || (bibcode ? `${ADS_ABSTRACT_BASE_URL}/${encodeURIComponent(bibcode)}/abstract` : '');

  return asPublicationItem({
    title: doc?.title,
    authors: doc?.author,
    venue: doc?.pub,
    year: doc?.year || doc?.pubdate,
    doi,
    url,
    identifiers: [
      ...flattenStrings(doc?.identifier),
      bibcode,
      doi
    ],
    orcid_pub: doc?.orcid_pub
  }, 'ADS');
}

async function loadAdsPublications(identity, config){
  const source = 'ADS';
  if(!config.adsToken){
    return {
      source,
      level: 'warning',
      message: 'Skipped ADS (missing API token: set data-ads-token or localStorage.adsApiToken).',
      items: []
    };
  }

  const query = buildAdsQuery(identity, config.adsQuery);
  if(!query){
    return {
      source,
      level: 'warning',
      message: 'Skipped ADS (missing query terms: configure names, ORCID, or custom ADS query).',
      items: []
    };
  }

  const params = new URLSearchParams({
    q: query,
    rows: String(config.maxItems),
    sort: 'date desc',
    fl: 'bibcode,title,author,pub,year,doi,identifier,orcid_pub,pubdate'
  });

  const response = await fetch(`${ADS_API_BASE_URL}?${params.toString()}`, {
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.adsToken}`
    }
  });
  if(!response.ok) throw new Error(`ADS query failed: HTTP ${response.status}`);

  const payload = await response.json();
  const docs = Array.isArray(payload?.response?.docs) ? payload.response.docs : [];
  const parsed = docs.map((doc) => parseAdsPublication(doc));
  const filtered = parsed.filter((publication) => matchesIdentity(publication, identity));

  return {
    source,
    level: 'ok',
    message: `Loaded ${filtered.length} matching publication(s) from ADS.`,
    items: filtered
  };
}

function parseResearchGatePayload(payload){
  const entries = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.publications)
      ? payload.publications
      : (Array.isArray(payload?.items) ? payload.items : []));

  return entries.map((entry) => asPublicationItem(entry, 'ResearchGate'));
}

async function loadResearchGatePublications(identity, config){
  const source = 'ResearchGate';

  if(!config.researchGateJson){
    return {
      source,
      level: 'warning',
      message: config.researchGateProfile
        ? 'ResearchGate has no official public browser API; add data-researchgate-json for exported data.'
        : 'Skipped ResearchGate (missing profile or JSON export URL).',
      items: []
    };
  }

  const response = await fetch(config.researchGateJson, {cache: 'no-cache'});
  if(!response.ok){
    throw new Error(`ResearchGate export fetch failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  const parsed = parseResearchGatePayload(payload);
  const filtered = parsed.filter((publication) => matchesIdentity(publication, identity));

  return {
    source,
    level: 'ok',
    message: `Loaded ${filtered.length} publication(s) from ResearchGate export.`,
    items: filtered
  };
}

function getPublicationKey(publication){
  const doi = normalizeDoi(publication?.doi);
  if(doi) return `doi:${doi}`;

  const titleKey = normalizeForMatch(publication?.title);
  if(!titleKey) return '';

  return `title:${titleKey}|${parsePublicationYear(publication?.year)}`;
}

function mergePublications(publications){
  const map = new Map();

  publications.forEach((publication) => {
    const key = getPublicationKey(publication);
    if(!key) return;

    if(!map.has(key)){
      map.set(key, {
        ...publication,
        sources: uniqueStrings(publication.sources || []),
        identifiers: uniqueStrings(publication.identifiers || []),
        orcidIds: uniqueStrings((publication.orcidIds || []).map(normalizeOrcidId).filter(Boolean))
      });
      return;
    }

    const current = map.get(key);
    current.sources = uniqueStrings([...(current.sources || []), ...(publication.sources || [])]);
    current.identifiers = uniqueStrings([
      ...(current.identifiers || []),
      ...(publication.identifiers || [])
    ]);
    current.orcidIds = uniqueStrings([
      ...(current.orcidIds || []),
      ...((publication.orcidIds || []).map(normalizeOrcidId).filter(Boolean))
    ]);

    if(!current.url && publication.url) current.url = publication.url;
    if(!current.doi && publication.doi) current.doi = publication.doi;
    if(!current.authors && publication.authors) current.authors = publication.authors;
    if(!current.venue && publication.venue) current.venue = publication.venue;
    if((publication.year || 0) > (current.year || 0)) current.year = publication.year;
  });

  return [...map.values()];
}

function sortSources(sources){
  return [...sources].sort((left, right) => {
    const leftIndex = SOURCE_ORDER.indexOf(left);
    const rightIndex = SOURCE_ORDER.indexOf(right);

    if(leftIndex === -1 && rightIndex === -1){
      return left.localeCompare(right);
    }
    if(leftIndex === -1) return 1;
    if(rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function sortPublications(publications){
  return publications
    .map((publication) => ({
      ...publication,
      sources: sortSources(publication.sources || [])
    }))
    .sort((left, right) => {
      const yearDiff = (right.year || 0) - (left.year || 0);
      if(yearDiff !== 0) return yearDiff;
      return left.title.localeCompare(right.title);
    });
}

function createStatusList(statuses){
  const list = document.createElement('ul');
  list.className = 'pub-source-status-list';

  statuses.forEach((status) => {
    const item = document.createElement('li');
    item.className = `pub-source-status is-${status.level || 'warning'}`;

    const label = document.createElement('strong');
    label.className = 'pub-source-status-label';
    label.textContent = `${status.source}:`;

    const text = document.createElement('span');
    text.textContent = ` ${normalizeString(status.message) || 'No details.'}`;

    item.appendChild(label);
    item.appendChild(text);
    list.appendChild(item);
  });

  return list;
}

function createPublicationTitleNode(publication){
  if(!publication.url){
    const span = document.createElement('span');
    span.textContent = publication.title;
    return span;
  }

  const link = document.createElement('a');
  link.href = publication.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = publication.title;
  return link;
}

function fillPublicationLinkCell(cell, publication){
  if(publication.url){
    const link = document.createElement('a');
    link.href = publication.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open';
    link.className = 'pub-paper-link';
    link.setAttribute('aria-label', 'Open publication link');
    cell.replaceChildren(link);
    return;
  }

  cell.textContent = 'n/a';
  cell.classList.add('muted');
}

function renderPublicationTable(publications){
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap pub-table-wrap-compact';

  const table = document.createElement('table');
  table.className = 'pub-table pub-table-compact';

  const head = document.createElement('thead');
  head.innerHTML = `
    <tr>
      <th>Year</th>
      <th>Citation</th>
      <th>Sources</th>
      <th>Link</th>
    </tr>
  `;

  const body = document.createElement('tbody');
  publications.forEach((publication) => {
    const row = document.createElement('tr');

    const yearCell = document.createElement('td');
    yearCell.className = 'pub-col-year';
    yearCell.textContent = publication.year ? String(publication.year) : 'n/a';

    const citationCell = document.createElement('td');
    citationCell.className = 'pub-col-citation';
    const title = document.createElement('span');
    title.className = 'pub-citation-title';
    title.appendChild(createPublicationTitleNode(publication));
    citationCell.appendChild(title);
    citationCell.append('.');

    if(publication.authors || publication.venue){
      citationCell.appendChild(document.createElement('br'));
    }
    if(publication.authors){
      citationCell.append(`${publication.authors}. `);
    }
    if(publication.venue){
      const venue = document.createElement('em');
      venue.textContent = publication.venue;
      citationCell.appendChild(venue);
      citationCell.append('.');
    }

    const sourceCell = document.createElement('td');
    sourceCell.className = 'pub-col-source';
    publication.sources.forEach((source) => {
      const badge = document.createElement('span');
      badge.className = 'pub-source-badge';
      badge.textContent = source;
      sourceCell.appendChild(badge);
    });

    const linkCell = document.createElement('td');
    linkCell.className = 'pub-col-link';
    fillPublicationLinkCell(linkCell, publication);

    row.appendChild(yearCell);
    row.appendChild(citationCell);
    row.appendChild(sourceCell);
    row.appendChild(linkCell);
    body.appendChild(row);
  });

  table.appendChild(head);
  table.appendChild(body);
  wrap.appendChild(table);
  return wrap;
}

function renderPublications(root, publications, statuses){
  const summary = document.createElement('p');
  summary.className = 'muted';
  summary.textContent = publications.length
    ? `${publications.length} unique publication${publications.length === 1 ? '' : 's'} found.`
    : 'No matching publications found yet.';

  const nodes = [summary, createStatusList(statuses)];

  if(publications.length){
    nodes.push(renderPublicationTable(publications));
  }

  root.replaceChildren(...nodes);
}

function renderPublicationLoading(root){
  const line = document.createElement('p');
  line.className = 'muted';
  line.textContent = 'Loading publications...';
  root.replaceChildren(line);
}

function renderPublicationError(root, error){
  const line = document.createElement('p');
  line.className = 'muted';
  line.textContent = `Error loading publications: ${normalizeString(error?.message || error) || 'unknown error'}.`;
  root.replaceChildren(line);
}

async function initPublicationAggregator(){
  const root = document.querySelector(PUBLICATION_AGGREGATOR_SELECTOR);
  if(!root) return;

  renderPublicationLoading(root);

  try{
    const config = getPublicationConfig(root);
    const identity = buildIdentity(config);
    const loaders = [
      {source: 'ORCID', run: () => loadOrcidPublications(identity)},
      {source: 'ADS', run: () => loadAdsPublications(identity, config)},
      {source: 'ResearchGate', run: () => loadResearchGatePublications(identity, config)}
    ];

    const results = await Promise.allSettled(loaders.map((loader) => loader.run()));
    const statuses = [];
    const publications = [];

    results.forEach((result, index) => {
      const source = loaders[index].source;
      if(result.status === 'fulfilled'){
        statuses.push({
          source,
          level: result.value.level || 'warning',
          message: result.value.message || '',
          items: result.value.items || []
        });
        publications.push(...(result.value.items || []));
        return;
      }

      console.warn(`${source} source error:`, result.reason);
      statuses.push({
        source,
        level: 'error',
        message: normalizeString(result.reason?.message || result.reason) || 'Unexpected error.',
        items: []
      });
    });

    const merged = sortPublications(mergePublications(publications)).slice(0, config.maxItems);
    renderPublications(root, merged, statuses);
  }catch(error){
    console.error('Error initializing publications aggregator:', error);
    renderPublicationError(root, error);
  }
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

document.addEventListener('DOMContentLoaded', () => {
  initPhotography();
  initPublicationAggregator();
});
