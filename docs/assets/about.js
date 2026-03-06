function setupShortCvToggle(){
  const btn = document.querySelector('.cv-toggle');
  const win = document.getElementById('short-cv');
  const layout = document.querySelector('.about-two-col');
  if(!btn || !win || !layout) return;

  btn.addEventListener('click', () => {
    const isOpen = layout.classList.toggle('short-cv-open');
    if(isOpen){
      win.removeAttribute('hidden');
      btn.textContent = 'Hide Short CV';
      btn.setAttribute('aria-expanded', 'true');
    }else{
      win.setAttribute('hidden', '');
      btn.textContent = 'Show Short CV';
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupShortCvToggle();
});
