function parseCsvLine(line){
  const values = [];
  let current = '';
  let inQuotes = false;

  for(let i = 0; i < line.length; i++){
    const ch = line[i];
    const next = line[i + 1];
    if(ch === '"' && inQuotes && next === '"'){
      current += '"';
      i++;
      continue;
    }
    if(ch === '"'){
      inQuotes = !inQuotes;
      continue;
    }
    if(ch === ',' && !inQuotes){
      values.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  values.push(current);
  return values;
}

async function loadProjectsFromCsv(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  return txt
    .trim()
    .split('\n')
    .map((line) => parseCsvLine(line));
}

async function renderProjectsTable(){
  const tbody = document.querySelector('#projects-table tbody');
  if(!tbody) return;

  try{
    const rows = await loadProjectsFromCsv('data/projects.csv');
    tbody.innerHTML = '';

    for(let i = 1; i < rows.length; i++){
      const [name, desc, url] = rows[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><a href="${url}" target="_blank" rel="noopener">${name}</a></td><td>${desc}</td>`;
      tbody.appendChild(tr);
    }
  }catch(e){
    console.error('Error loading projects CSV:', e);
    tbody.innerHTML = '<tr><td colspan="2">Error loading projects CSV</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', renderProjectsTable);

