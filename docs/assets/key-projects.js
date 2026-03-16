const KEY_PROJECTS_SELECTOR = '[data-key-projects]';
const KEY_PROJECTS_DATA_PATH = 'data/key-projects.json';

function asText(value, fallback = ''){
  const text = String(value || '').trim();
  return text || fallback;
}

function asUrl(value){
  return String(value || '').trim();
}

function toProject(item){
  return {
    title: asText(item?.title, 'Untitled project'),
    description: asText(item?.description),
    urlGithub: asUrl(item?.['url-github']),
    urlPoster: asUrl(item?.['url-poster'])
  };
}

function getProjects(data){
  const items = Array.isArray(data?.projects) ? data.projects : [];
  return items
    .map(toProject)
    .filter((project) => project.title && project.description);
}

function makeProjectLink(url, label, iconClasses){
  if(!url) return null;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'key-projects-link-icon';
  link.setAttribute('aria-label', `Open project ${label}`);
  link.title = `Open project ${label}`;

  const icon = document.createElement('i');
  icon.className = iconClasses;
  icon.setAttribute('aria-hidden', 'true');
  link.appendChild(icon);

  return link;
}

function makeLinkCell(url, label, iconClasses){
  const cell = document.createElement('td');
  cell.className = 'key-projects-col-link';

  const link = makeProjectLink(url, label, iconClasses);
  if(link){
    cell.appendChild(link);
    return cell;
  }

  cell.classList.add('is-empty');
  cell.textContent = '-';
  return cell;
}

function makeProjectCell(project){
  const cell = document.createElement('td');
  cell.className = 'key-projects-col-project';

  const entry = document.createElement('div');
  entry.className = 'key-projects-entry';

  const marker = document.createElement('span');
  marker.className = 'key-projects-entry-marker';
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = '•';

  const content = document.createElement('div');
  content.className = 'key-projects-entry-copy';

  const title = document.createElement('div');
  title.className = 'key-projects-entry-title';
  title.textContent = project.title;

  const description = document.createElement('div');
  description.className = 'key-projects-entry-description';
  description.textContent = project.description;

  content.appendChild(title);
  content.appendChild(description);
  entry.appendChild(marker);
  entry.appendChild(content);
  cell.appendChild(entry);

  return cell;
}

function createProjectRow(project){
  const row = document.createElement('tr');

  row.appendChild(makeProjectCell(project));
  row.appendChild(makeLinkCell(project.urlGithub, 'GitHub repository', 'fa-brands fa-github'));
  row.appendChild(makeLinkCell(project.urlPoster, 'poster', 'fa-solid fa-image'));

  return row;
}

function createProjectsTable(projects){
  const table = document.createElement('table');
  table.className = 'key-projects-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');

  const projectHeader = document.createElement('th');
  projectHeader.textContent = 'Project';
  projectHeader.className = 'key-projects-col-project';
  headRow.appendChild(projectHeader);

  const repoHeader = document.createElement('th');
  repoHeader.textContent = 'Repo';
  repoHeader.className = 'key-projects-col-link';
  headRow.appendChild(repoHeader);

  const posterHeader = document.createElement('th');
  posterHeader.textContent = 'Poster';
  posterHeader.className = 'key-projects-col-link';
  headRow.appendChild(posterHeader);

  head.appendChild(headRow);

  const body = document.createElement('tbody');
  projects.forEach((project) => {
    body.appendChild(createProjectRow(project));
  });

  table.appendChild(head);
  table.appendChild(body);
  return table;
}

function renderEmptyState(container){
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap key-projects-box';

  const message = document.createElement('p');
  message.className = 'muted';
  message.textContent = 'No key projects available yet.';

  wrapper.appendChild(message);
  container.replaceChildren(wrapper);
}

function renderProjects(container, projects){
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap key-projects-box';
  wrapper.appendChild(createProjectsTable(projects));
  container.replaceChildren(wrapper);
}

async function initKeyProjects(){
  const containers = Array.from(document.querySelectorAll(KEY_PROJECTS_SELECTOR));
  if(!containers.length) return;

  try{
    const response = await fetch(KEY_PROJECTS_DATA_PATH);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const projects = getProjects(data);

    if(!projects.length){
      containers.forEach(renderEmptyState);
      return;
    }

    containers.forEach((container) => renderProjects(container, projects));
  }catch(error){
    console.error('Error loading key projects:', error);
    containers.forEach(renderEmptyState);
  }
}

document.addEventListener('DOMContentLoaded', initKeyProjects);
