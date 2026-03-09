(function(){
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

  function toPositiveInt(value, fallback, max){
    const numeric = Number(value);
    if(!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.min(Math.floor(numeric), max);
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
    const clean = normalizeString(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
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
            message: result.value.message || ''
          });
          publications.push(...(result.value.items || []));
          return;
        }

        console.warn(`${source} source error:`, result.reason);
        statuses.push({
          source,
          level: 'error',
          message: normalizeString(result.reason?.message || result.reason) || 'Unexpected error.'
        });
      });

      const merged = sortPublications(mergePublications(publications)).slice(0, config.maxItems);
      renderPublications(root, merged, statuses);
    }catch(error){
      console.error('Error initializing publications aggregator:', error);
      renderPublicationError(root, error);
    }
  }

  document.addEventListener('DOMContentLoaded', initPublicationAggregator);
})();
