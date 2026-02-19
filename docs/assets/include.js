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
