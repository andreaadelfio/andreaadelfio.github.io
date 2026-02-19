function formatPublicationItem(pub){
  let text = `${pub.authors}: <strong>${pub.title}</strong>. <em>${pub.venue} ${pub.year}</em>`;
  if(pub.status === 'under review') text += ' (under review)';
  return text;
}

async function populatePublicationsList(options = {}){
  const listId = options.listId || 'publications-list';
  const dataPath = options.dataPath || 'data/publications.json';
  const emptyMessage = options.emptyMessage || '';
  const errorMessage = options.errorMessage || 'Error loading publications.';
  const list = document.getElementById(listId);
  if(!list) return;

  try{
    const res = await fetch(dataPath);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const publications = Array.isArray(data.publications) ? data.publications : [];
    list.innerHTML = '';

    if(publications.length === 0){
      if(emptyMessage){
        list.innerHTML = `<li>${emptyMessage}</li>`;
      }
      return;
    }

    publications.forEach((pub) => {
      const li = document.createElement('li');
      const html = formatPublicationItem(pub);
      if(pub.url) li.innerHTML = `<a href="${pub.url}" target="_blank" rel="noopener">${html}</a>`;
      else li.innerHTML = html;
      list.appendChild(li);
    });
  }catch(e){
    console.error('Error loading publications:', e);
    list.innerHTML = `<li>${errorMessage}</li>`;
  }
}

