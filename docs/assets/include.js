async function tryFetchText(path){
  try{
    const res = await fetch(path);
    if(!res.ok) throw res;
    return await res.text();
  }catch(e){
    throw e;
  }
}

function setupSpinner(){
  // Lo spinner è già nel HTML, non serve crearlo
  // Con questo approccio è sempre presente da subito
}

function hideSpinner(){
  // Nasconde lo spinner con animazione
  // Delay minimo per assicurarsi che sia sempre visibile per almeno 300ms
  setTimeout(() => {
    const spinner = document.querySelector('#page-spinner');
    if(spinner){
      spinner.classList.add('hidden');
      // Rimuovi dalla DOM dopo l'animazione
      setTimeout(()=>{
        spinner.remove();
      }, 300);
    }
  }, 300);
}

function setupFavicons(){
  // Aggiungi favicon.ico
  if(!document.querySelector('link[rel="icon"][type="image/x-icon"]')){
    const faviconIco = document.createElement('link');
    faviconIco.rel = 'icon';
    faviconIco.type = 'image/x-icon';
    // Prova diversi path per trovare il favicon
    const candidates = ['data/images/favicon.ico', 'docs/data/images/favicon.ico', '/data/images/favicon.ico', '/docs/data/images/favicon.ico'];
    faviconIco.href = candidates[0]; // Default
    // Scansioni asincrone possono fallire, ma il browser fallback a default è ok
    for(const c of candidates){
      testCandidate(c).then(ok => {
        if(ok) faviconIco.href = c;
      });
    }
    document.head.appendChild(faviconIco);
  }
  // Aggiungi favicon.png
  if(!document.querySelector('link[rel="icon"][type="image/png"]')){
    const faviconPng = document.createElement('link');
    faviconPng.rel = 'icon';
    faviconPng.type = 'image/png';
    const candidates = ['data/images/favicon.png', 'docs/data/images/favicon.png', '/data/images/favicon.png', '/docs/data/images/favicon.png'];
    faviconPng.href = candidates[0]; // Default
    for(const c of candidates){
      testCandidate(c).then(ok => {
        if(ok) faviconPng.href = c;
      });
    }
    document.head.appendChild(faviconPng);
  }
}

async function loadInclude(selector, path){
  const el = document.querySelector(selector);
  const candidates = [path, path.replace(/^docs\//, ''), '../' + path, '/' + path, '/' + path.replace(/^docs\//, '')];
  for(const p of candidates){
    try{
      const html = await tryFetchText(p);
      if(el) el.innerHTML = html;
      await normalizeNavLinks(el);
      await normalizeImages(el);
      setActiveNav();
      return;
    }catch(e){
      // try next candidate
    }
  }
  console.error('Include error: could not load', path, 'tried', candidates);
}

async function testCandidate(href){
  try{
    // Try a simple fetch; many servers disallow HEAD so use GET but don't read body
    const res = await fetch(href, {cache: 'no-cache'});
    return res && res.ok;
  }catch(e){
    return false;
  }
}

function getNavContextMode(){
  const includeScript = document.querySelector('script[src*="include.js"]');
  const rawSrc = includeScript ? (includeScript.getAttribute('src') || '') : '';
  const src = rawSrc.replace(/^\.\//, '');
  // Root wrapper page (`index.html`) references `docs/assets/include.js`
  // while pages inside `docs/` reference `assets/include.js`.
  return src.startsWith('docs/assets/') ? 'root-wrapper' : 'docs-pages';
}

function resolveInternalNavHref(href, mode){
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  const rawPath = match ? match[1] : href;
  const suffix = match && match[2] ? match[2] : '';
  let path = rawPath.replace(/^\.\//, '').replace(/^\/+/, '');

  if(!path || path.startsWith('../')) return href;

  if(mode === 'root-wrapper'){
    if(path.startsWith('docs/')) return path + suffix;
    if(path === 'index.html') return 'index.html' + suffix;
    return 'docs/' + path + suffix;
  }

  if(path.startsWith('docs/')) path = path.replace(/^docs\//, '');
  if(path === 'index.html' && location.pathname.includes('/docs/')){
    return '../index.html' + suffix;
  }
  return path + suffix;
}

function normalizeNavLinks(root){
  const container = root || document;
  const links = Array.from(container.querySelectorAll('.brand a, .main-nav a, .footer-nav a'));
  if(!links.length) return;
  const mode = getNavContextMode();

  for(const a of links){
    const href = a.getAttribute('href') || '';
    if(href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) continue;
    a.setAttribute('href', resolveInternalNavHref(href, mode));
  }
}

async function normalizeImages(root){
  const container = root || document;
  const images = Array.from(container.querySelectorAll('img[src]'));
  if(!images.length) return;
  for(const img of images){
    let src = img.getAttribute('src') || '';
    if(src.startsWith('http') || src.startsWith('#') || src.startsWith('data:')) continue;
    const candidates = [src, './' + src, '../' + src, 'docs/' + src, '/' + src, '/docs/' + src];
    for(const c of candidates){
      const ok = await testCandidate(c);
      if(ok){
        img.setAttribute('src', c);
        break;
      }
    }
  }
}

function setActiveNav(){
  const header = document.querySelector('#site-header');
  if(!header) return;
  const links = header.querySelectorAll('.main-nav a');
  const cur = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a=>{
    a.classList.remove('active');
    a.removeAttribute('aria-current');
    const href = a.getAttribute('href') || '';
    const hrefLast = href.split('/').pop();
    if(hrefLast === cur || (cur === '' && hrefLast === 'index.html')){
      a.classList.add('active');
      a.setAttribute('aria-current','page');
    }
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  setupSpinner();
  setupFavicons();
  await loadInclude('#site-header','docs/includes/header.html');
  await loadInclude('#site-footer','docs/includes/footer.html');
  setupDropdownMenus();
  hideSpinner();
});

function setupDropdownMenus(){
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  dropdowns.forEach(dropdown => {
    const menu = dropdown.querySelector('.nav-dropdown-menu');
    if(!menu) return;

    // Open on hover
    dropdown.addEventListener('mouseenter', ()=>{
      menu.classList.add('open');
    });

    dropdown.addEventListener('mouseleave', ()=>{
      menu.classList.remove('open');
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.nav-dropdown')){
      document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
    }
  });
}
