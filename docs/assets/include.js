function getNavContextMode(){
  const includeScript = document.querySelector('script[src*="include.js"]');
  const rawSrc = includeScript ? (includeScript.getAttribute('src') || '') : '';
  const src = rawSrc.replace(/^\.\//, '');
  return src.startsWith('docs/assets/') ? 'root-wrapper' : 'docs-pages';
}

function ensureIcon(type, href){
  const selector = `link[rel="icon"][type="${type}"]`;
  let link = document.querySelector(selector);
  if(!link){
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = type;
    document.head.appendChild(link);
  }
  link.href = href;
}

function setupFavicons(mode){
  const base = mode === 'root-wrapper' ? 'docs/data/images' : 'data/images';
  ensureIcon('image/x-icon', `${base}/favicon.ico`);
  ensureIcon('image/png', `${base}/favicon.png`);
}

async function fetchText(path){
  const res = await fetch(path, {cache: 'no-cache'});
  if(!res.ok) throw new Error(`HTTP ${res.status} while loading ${path}`);
  return res.text();
}

function hideSpinner(){
  setTimeout(() => {
    const spinner = document.querySelector('#page-spinner');
    if(!spinner) return;
    spinner.classList.add('hidden');
    setTimeout(()=>{
      spinner.remove();
    }, 300);
  }, 300);
}

function isInternalPath(value){
  return Boolean(value)
    && !value.startsWith('http://')
    && !value.startsWith('https://')
    && !value.startsWith('//')
    && !value.startsWith('#')
    && !value.startsWith('mailto:')
    && !value.startsWith('tel:')
    && !value.startsWith('data:');
}

function splitUrl(url){
  const match = url.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match ? match[1] : url,
    suffix: match && match[2] ? match[2] : ''
  };
}

function normalizeRelativePath(path){
  return path.replace(/^\.\//, '').replace(/^\/+/, '');
}

function resolveInternalPath(path, mode, isHomeLink){
  if(!path || path.startsWith('../')) return path;

  if(mode === 'root-wrapper'){
    if(path.startsWith('docs/')) return path;
    if(isHomeLink && path === 'index.html') return 'index.html';
    return `docs/${path}`;
  }

  let resolved = path.startsWith('docs/') ? path.replace(/^docs\//, '') : path;
  if(isHomeLink && resolved === 'index.html' && location.pathname.includes('/docs/')){
    resolved = '../index.html';
  }
  return resolved;
}

function rewriteInternalUrl(url, mode, isHomeLink){
  const {path, suffix} = splitUrl(url);
  const normalizedPath = normalizeRelativePath(path);
  const resolvedPath = resolveInternalPath(normalizedPath, mode, isHomeLink);
  return `${resolvedPath}${suffix}`;
}

function normalizeNavLinks(root, mode){
  const container = root || document;
  const links = Array.from(container.querySelectorAll('.brand a, .main-nav a, .footer-nav a'));
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if(!isInternalPath(href)) return;
    a.setAttribute('href', rewriteInternalUrl(href, mode, true));
  });
}

function normalizeImages(root, mode){
  const container = root || document;
  const images = Array.from(container.querySelectorAll('img[src]'));
  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    if(!isInternalPath(src)) return;
    img.setAttribute('src', rewriteInternalUrl(src, mode, false));
  });
}

async function loadInclude(selector, includePath, mode){
  const el = document.querySelector(selector);
  if(!el) return;

  try{
    const html = await fetchText(includePath);
    el.innerHTML = html;
    normalizeNavLinks(el, mode);
    normalizeImages(el, mode);
  }catch(error){
    console.error('Include error:', includePath, error);
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

function setFooterYear(){
  const yearEl = document.getElementById('footer-year');
  if(!yearEl) return;
  yearEl.textContent = String(new Date().getFullYear());
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const mode = getNavContextMode();
  const includeBase = mode === 'root-wrapper' ? 'docs/includes' : 'includes';

  setupFavicons(mode);
  await Promise.all([
    loadInclude('#site-header', `${includeBase}/header.html`, mode),
    loadInclude('#site-footer', `${includeBase}/footer.html`, mode)
  ]);

  setActiveNav();
  setFooterYear();
  setupDropdownMenus();
  setupMobileMenu();
  hideSpinner();
});

function setupDropdownMenus(){
  const dropdowns = Array.from(document.querySelectorAll('.nav-dropdown'));
  if(!dropdowns.length) return;
  const closeTimers = new WeakMap();
  const hoverCloseDelayMs = 150;

  const setDropdownOpen = (dropdown, isOpen) => {
    const menu = dropdown.querySelector('.nav-dropdown-menu');
    const arrow = dropdown.querySelector('.nav-dropdown-arrow');
    if(!menu) return false;
    menu.classList.toggle('open', isOpen);
    dropdown.classList.toggle('open', isOpen);
    if(arrow){
      arrow.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    return true;
  };

  const clearCloseTimer = (dropdown) => {
    const timerId = closeTimers.get(dropdown);
    if(timerId){
      clearTimeout(timerId);
      closeTimers.delete(dropdown);
    }
  };

  const scheduleClose = (dropdown) => {
    clearCloseTimer(dropdown);
    const timerId = setTimeout(() => {
      setDropdownOpen(dropdown, false);
      closeTimers.delete(dropdown);
    }, hoverCloseDelayMs);
    closeTimers.set(dropdown, timerId);
  };

  const closeAllDropdowns = () => {
    dropdowns.forEach((dropdown) => {
      clearCloseTimer(dropdown);
      setDropdownOpen(dropdown, false);
    });
  };

  dropdowns.forEach(dropdown => {
    const menu = dropdown.querySelector('.nav-dropdown-menu');
    const arrow = dropdown.querySelector('.nav-dropdown-arrow');
    if(!menu) return;

    dropdown.addEventListener('mouseenter', ()=>{
      if(window.matchMedia('(hover: hover)').matches){
        clearCloseTimer(dropdown);
        setDropdownOpen(dropdown, true);
      }
    });

    dropdown.addEventListener('mouseleave', ()=>{
      if(window.matchMedia('(hover: hover)').matches){
        scheduleClose(dropdown);
      }
    });

    if(arrow){
      arrow.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        closeAllDropdowns();
        setDropdownOpen(dropdown, !isOpen);
      });
    }

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setDropdownOpen(dropdown, false));
    });
  });

  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.nav-dropdown')){
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      closeAllDropdowns();
    }
  });
}

function setupMobileMenu(){
  const toggle = document.querySelector('.mobile-menu-toggle');
  const nav = document.querySelector('#site-main-nav');
  const backdrop = document.querySelector('.mobile-nav-backdrop');
  if(!toggle || !nav || !backdrop) return;

  const mobileMq = window.matchMedia('(max-width: 760px)');

  const closeDropdownsInNav = () => {
    nav.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
      const menu = dropdown.querySelector('.nav-dropdown-menu');
      const arrow = dropdown.querySelector('.nav-dropdown-arrow');
      if(menu) menu.classList.remove('open');
      dropdown.classList.remove('open');
      if(arrow) arrow.setAttribute('aria-expanded', 'false');
    });
  };

  const setMenuOpen = (isOpen) => {
    nav.classList.toggle('mobile-open', isOpen);
    backdrop.classList.toggle('open', isOpen);
    document.body.classList.toggle('mobile-nav-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    if(!isOpen){
      closeDropdownsInNav();
    }
  };

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains('mobile-open');
    setMenuOpen(!isOpen);
  });

  backdrop.addEventListener('click', () => setMenuOpen(false));

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if(mobileMq.matches){
        setMenuOpen(false);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      setMenuOpen(false);
    }
  });

  const onViewportChange = () => {
    if(!mobileMq.matches){
      setMenuOpen(false);
    }
  };

  if(typeof mobileMq.addEventListener === 'function'){
    mobileMq.addEventListener('change', onViewportChange);
  }else{
    mobileMq.addListener(onViewportChange);
  }
}
