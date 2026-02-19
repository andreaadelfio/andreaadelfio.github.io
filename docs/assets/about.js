function setupShortCvToggle(){
  const btn = document.querySelector('.cv-toggle');
  const win = document.getElementById('short-cv');
  const main = document.querySelector('main.wrap.two-col');
  if(!btn || !win || !main) return;

  btn.addEventListener('click', () => {
    const isOpen = main.classList.toggle('short-cv-open');
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

document.addEventListener('DOMContentLoaded', async () => {
  setupShortCvToggle();
  await populatePublicationsList({
    listId: 'publications-list',
    dataPath: 'data/publications.json',
    errorMessage: 'Error loading publications.'
  });
});
