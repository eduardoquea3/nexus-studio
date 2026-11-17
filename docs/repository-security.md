# Repository security cleanup

Run the focused, data-only regression checks with:

```sh
python -I scripts/check-repository-safety.py
```

The checks cover the confirmed loader files and script entrypoints, current Vite markers, font container signatures, relevant editor task references, and environment-file ignore rules. They do not execute project JavaScript, inspect environment files, validate dependencies, or certify the Windows host or any account as clean.

Do not run prior repository versions: historical Git objects may still contain the malware. Preserve Git objects and reflogs; this cleanup does not rewrite history or establish that historical content is safe.
