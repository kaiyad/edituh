# Edituh

Edituh is a lightweight text editor built with Streamlit. It lets you upload a text file, edit it in the browser, and save it back to the same path or to a new location with Save As.

## Features

- Upload common text-based files such as `.txt`, `.md`, `.py`, and `.json`
- Edit content in a full-width text area
- Save changes back to the currently opened path
- Use Save As to choose a new destination path
- Undo/redo through keyboard shortcuts

## Run locally

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -e .
   ```

3. Start the app:

   ```bash
   streamlit run app.py
   ```

## Save workflow

- Upload a file to load its contents into the editor.
- The app remembers the active document path for the current session.
- Click Save to write the current editor content back to that remembered path.
- Use Save As to pick a different path and update the active target.

## Testing

Run the test suite with:

```bash
python -m pytest -q
```
