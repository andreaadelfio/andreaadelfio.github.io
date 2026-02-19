async function tryFetchText(path){
  try{
    const res = await fetch(path);
    if(!res.ok) throw res;
    return await res.text();
  }catch(e){
    throw e;
  }
}

async function loadInclude(selector, path){
  const el = document.querySelector(selector);
  const candidates = [path, path.replace(/^docs\//, ''), '../' + path, '/' + path, '/' + path.replace(/^docs\//, '')];
  for(const p of candidates){
    try{
      const html = await tryFetchText(p);
      if(el) el.innerHTML = html;
      normalizeNavLinks(el);
      return;
    }catch(e){
      // try next candidate
    }
  }
  console.error('Include error: could not load', path, 'tried', candidates);
}

function normalizeNavLinks(root){
  const container = root || document;
  const links = container.querySelectorAll('.main-nav a');
  if(!links) return;
  // If current URL path contains '/docs/' then page is served under /docs/,
  // otherwise assume pages might be inside the docs folder on disk and
  // published either with or without the 'docs/' prefix. We normalize
  // by ensuring links point to the right relative location for the current page.
  const inDocsPath = location.pathname.includes('/docs/');
  links.forEach(a => {
    let href = a.getAttribute('href') || '';
    if(href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    if(inDocsPath){
      // page URL contains /docs/, links should not include docs/ prefix
      href = href.replace(/^docs\//, '');
    }else{
      // page URL does not contain /docs/; ensure links point to docs/ when needed
      if(!href.startsWith('docs/') && !href.startsWith('/')){
        href = 'docs/' + href;
      }
    }
    a.setAttribute('href', href);
  });
}

function setActiveNav(){
  const header = document.querySelector('#site-header');
  if(!header) return;
  const links = header.querySelectorAll('.main-nav a');
  const cur = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a=>{
    const href = a.getAttribute('href') || '';
    const hrefLast = href.split('/').pop();
    if(hrefLast === cur || (cur === '' && hrefLast === 'index.html')){
      a.classList.add('active');
      a.setAttribute('aria-current','page');
    }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadInclude('#site-header','docs/includes/header.html');
  loadInclude('#site-footer','docs/includes/footer.html');
  // run after a short delay to allow includes to be injected
  setTimeout(setActiveNav, 200);
});
