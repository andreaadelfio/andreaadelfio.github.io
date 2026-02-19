async function loadInclude(selector, path){
  try{
    const res = await fetch(path);
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const html = await res.text();
    const el = document.querySelector(selector);
    if(el) el.innerHTML = html;
  }catch(e){
    console.error('Include error', path, e);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadInclude('#site-header','docs/includes/header.html');
  loadInclude('#site-footer','docs/includes/footer.html');
});

function setActiveNav(){
  const header = document.querySelector('#site-header');
  if(!header) return;
  const links = header.querySelectorAll('.main-nav a');
  const cur = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a=>{
    const href = a.getAttribute('href') || '';
    const hrefLast = href.split('/').pop();
    if(hrefLast === cur){
      a.classList.add('active');
      a.setAttribute('aria-current','page');
    }
  });
}

// run after a short delay to allow includes to be injected
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(setActiveNav, 120);
});
