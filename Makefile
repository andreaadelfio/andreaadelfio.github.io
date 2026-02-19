all: git

git:
	git add --all
	git commit -m "Updated website at $(shell date)"
	git push
