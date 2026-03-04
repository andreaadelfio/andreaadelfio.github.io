const TABLE_BODY_SELECTOR = '#publications-list tbody';
const DATA_PATH = 'data/publications.json';

function ensureSentence(text){
  const value = String(text || '').trim();
  if(!value) return '';
  return /[.!?;:]$/.test(value) ? value : `${value}.`;
}

function toPublication(item){
  return {
    title: String(item?.title || 'Untitled publication'),
    authors: String(item?.authors || 'Unknown authors'),
    venue: String(item?.venue || 'Unknown venue'),
    year: Number(item?.year) || 0,
    url: item?.url ? String(item.url) : '',
    status: item?.status === 'under review' ? 'under review' : 'published'
  };
}

function getPublications(data){
  const items = Array.isArray(data?.publications) ? data.publications : [];
  return items
    .map(toPublication)
    .sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title));
}

function makeTitleNode(publication){
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

function fillLinkCell(cell, publication){
  if(publication.status === 'published' && publication.url){
    const link = document.createElement('a');
    link.href = publication.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '↗';
    link.setAttribute('aria-label', 'Open publication link');
    link.title = 'Open publication link';
    link.className = 'pub-paper-link';
    cell.classList.remove('is-under-review');
    cell.replaceChildren(link);
    return;
  }

  cell.textContent = 'Under review';
  cell.classList.add('is-under-review');
}

function renderEmptyState(body){
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'muted';
  cell.textContent = 'No publications available yet.';
  row.appendChild(cell);
  body.replaceChildren(row);
}

function renderTable(body, publications){
  const fragment = document.createDocumentFragment();

  publications.forEach((publication) => {
    const row = document.createElement('tr');

    const yearCell = document.createElement('td');
    yearCell.className = 'pub-col-year';
    yearCell.textContent = String(publication.year);

    const citationCell = document.createElement('td');
    citationCell.className = 'pub-col-citation';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'pub-citation-title';
    titleSpan.appendChild(makeTitleNode(publication));

    citationCell.appendChild(titleSpan);
    citationCell.append('.');
    citationCell.appendChild(document.createElement('br'));
    citationCell.append(`${ensureSentence(publication.authors)} `);

    const venue = document.createElement('em');
    venue.textContent = publication.venue;
    citationCell.appendChild(venue);
    citationCell.append('.');

    const linkCell = document.createElement('td');
    linkCell.className = 'pub-col-link';
    fillLinkCell(linkCell, publication);

    row.appendChild(yearCell);
    row.appendChild(citationCell);
    row.appendChild(linkCell);
    fragment.appendChild(row);
  });

  body.replaceChildren(fragment);
}

async function initPublications(){
  const body = document.querySelector(TABLE_BODY_SELECTOR);
  if(!body) return;

  try{
    const response = await fetch(DATA_PATH);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const publications = getPublications(data);

    if(!publications.length){
      renderEmptyState(body);
      return;
    }

    renderTable(body, publications);
  }catch(error){
    console.error('Error loading publications:', error);
    renderEmptyState(body);
  }
}

document.addEventListener('DOMContentLoaded', initPublications);
