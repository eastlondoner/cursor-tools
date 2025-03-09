## Check that .repomixignore is respected

First update the .repomixignore file to be empty

Then run a dummy plan command like `plan 'make tsconfig noEmit'` with debug output enabled and check how many tokens are produced during repo packing

Then add a .repomixignore like:
```
src/**
```

Then run the same plan command with debug output enabled and check how many tokens are produced. It should be significantly less

Then clean out the .repomixignore file (it should be just an empty file)
