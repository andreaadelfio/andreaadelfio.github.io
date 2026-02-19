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
      await normalizeNavLinks(el);
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

async function normalizeNavLinks(root){
  const container = root || document;
  const links = Array.from(container.querySelectorAll('.main-nav a'));
  if(!links.length) return;
  for(const a of links){
    let href = a.getAttribute('href') || '';
    if(href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) continue;
    const candidates = [href, './' + href, '../' + href, 'docs/' + href, '/' + href, '/docs/' + href];
    for(const c of candidates){
      const ok = await testCandidate(c);
      if(ok){
        a.setAttribute('href', c);
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

document.addEventListener('DOMContentLoaded', ()=>{
  loadInclude('#site-header','docs/includes/header.html');
  loadInclude('#site-footer','docs/includes/footer.html');
});
