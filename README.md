# personal

Questo repository contiene una versione minima del sito personale.

Struttura rilevante:

- `docs/` — contiene la versione pubblicabile del sito (GitHub Pages può servire questa cartella come `Source`).
	- `index.html`, `about.html`, `projects.html`, `contact.html`
	- `assets/` — foglio di stile
	- `data/projects.csv` — elenchi di progetti usati dalla pagina `projects.html`

Per pubblicare con GitHub Pages: vai su GitHub → Settings → Pages e scegli `Branch: main` e `Folder: /docs`.

Esegui i comandi seguenti nella cartella del repo per commit e push:

```bash
git add docs README.md
git commit -m "Add docs site and projects CSV"
git push
```

