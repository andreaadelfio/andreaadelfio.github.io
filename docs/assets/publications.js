document.addEventListener('DOMContentLoaded', async () => {
  await populatePublicationsList({
    listId: 'publications-list',
    dataPath: 'data/publications.json',
    emptyMessage: 'No publications available yet.',
    errorMessage: 'Error loading publications.'
  });
});

