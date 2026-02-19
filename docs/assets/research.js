document.addEventListener('DOMContentLoaded', async () => {
  await populatePublicationsList({
    listId: 'publications-list',
    dataPath: 'data/publications.json',
    errorMessage: 'Error loading publications.'
  });
});

