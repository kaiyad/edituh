# app.py
import subprocess
import streamlit as st
import streamlit_hotkeys as hotkeys
from text_edituh import TextEdituh  # Ensure this file exists
import os

st.set_page_config(page_title="Edituh", layout="wide")

# --- Initialization ---
if 'editor' not in st.session_state:
    st.session_state.editor = TextEdituh("")
if 'text_area_key' not in st.session_state:
    st.session_state.text_area_key = 0
if 'current_file_path' not in st.session_state:
    st.session_state.current_file_path = os.path.expanduser("~/Documents/document.txt")

editor = st.session_state.editor

# --- Hotkeys (Fixed for Mac & Windows) ---
hotkeys.activate([
    hotkeys.hk("save", "s", ctrl=True, prevent_default=True),
    hotkeys.hk("save", "s", meta=True, prevent_default=True),   # Mac Cmd+S
    hotkeys.hk("open", "o", ctrl=True, prevent_default=True),
    hotkeys.hk("open", "o", meta=True, prevent_default=True),   # Mac Cmd+O
    hotkeys.hk("undo", "z", ctrl=True, prevent_default=True),
    hotkeys.hk("undo", "z", meta=True, prevent_default=True),   # Mac Cmd+Z
    hotkeys.hk("redo", "z", ctrl=True, shift=True),
    hotkeys.hk("redo", "z", meta=True, shift=True),             # Mac Cmd+Shift+Z
    hotkeys.hk("redo", "y", ctrl=True),
    hotkeys.hk("redo", "y", meta=True),                         # Mac Cmd+Y
])

# --- Actions ---
def save_to_disk(filepath):
    """Save content to specific path on server."""
    if not filepath:
        st.error("No file path specified.")
        return False

    try:
        dir_name = os.path.dirname(filepath)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        editor.save_to_file(filepath)
        st.toast(f"✅ Saved to: {filepath}")
        return True
    except PermissionError:
        st.error(f"Permission denied: {filepath}. Check folder permissions.")
        return False
    except Exception as e:
        st.error(f"Save failed: {e}")
        return False

if hotkeys.pressed("undo"):
    if editor.undo():
        st.session_state.text_area_key += 1  # Reset widget on undo
        st.rerun()

if hotkeys.pressed("redo"):
    if editor.redo():
        st.session_state.text_area_key += 1  # Reset widget on redo
        st.rerun()

# --- UI Layout ---
st.title("Edituh")

with st.sidebar:
    st.header("File Operations")

    if "file_content" not in st.session_state:
        st.session_state.file_content = ""

    # app.py (Sidebar section)

# 1. Initialize a trigger flag
    if "load_triggered" not in st.session_state:
        st.session_state.load_triggered = False


    # File Uploader
    uploaded_file = st.file_uploader("Upload a Text File", type=["txt", "md", "py", "json"])
    if uploaded_file is not None and not st.session_state.load_triggered:
        try:
            content = uploaded_file.getvalue().decode("utf-8")
            st.session_state.file_content = content
            st.session_state.file_name = uploaded_file.name
            st.session_state.load_triggered = True  # Set flag to prevent re-run loop
            st.toast(f"Loaded: {uploaded_file.name}")
            st.rerun()  # Now safe to rerun once
        except Exception as e:
            st.error(f"Error: {e}")

    if uploaded_file is None:
        st.session_state.load_triggered = False

    if st.session_state.get("file_content"):
        if not editor.text or editor.text != st.session_state.file_content:
            editor.set_text(st.session_state.file_content)
            editor.filepath = os.path.abspath(uploaded_file.name) if uploaded_file is not None else editor.filepath
            st.session_state.current_file_path = editor.filepath or st.session_state.current_file_path
            st.session_state.text_area_key += 1
            # Clear content after loading to prevent re-loading on next rerun
            st.session_state.file_content = ""
            st.rerun()

    st.divider()

    def handle_save():
        target_path = editor.filepath or st.session_state.get("current_file_path")
        if target_path:
            save_to_disk(target_path)
            st.session_state.current_file_path = target_path
        else:
            st.warning("No file path set. Use 'Save As' first.")

    # Save Button
    if st.button("💾 Save", type="primary", use_container_width=True, on_click=handle_save):
        pass

    st.divider()

    # Save As
    st.subheader("Save As")
    default_path = st.session_state.get("current_file_path") or os.path.expanduser("~/Documents/document.txt")
    save_path = st.text_input("File Path", value=default_path, key="save_path_input")
    st.session_state.current_file_path = save_path or st.session_state.current_file_path

    def handle_save_as():
        target_path = st.session_state.get("save_path_input")
        if target_path:
            save_to_disk(target_path)
            st.session_state.current_file_path = target_path
            editor.filepath = target_path
        else:
            st.warning("Please enter a file path.")

    if st.button("💾 Save As (Path)", use_container_width=True, on_click=handle_save_as):
        pass

    st.divider()
    if editor.filepath:
        st.info(f"Editing: {editor.filepath}")

current_key = f"main_area_{st.session_state.text_area_key}"

# --- Main Editor ---
def on_change():
    # Replace the full document state instead of appending on every widget refresh.
    new_text = st.session_state.get(current_key)
    if new_text != editor.text:
        editor.set_text(new_text)

# CRITICAL: Dynamic key forces complete widget reset on upload/undo/redo
st.text_area(
    "Editor",
    value=editor.text,
    key=current_key,  # <--- Dynamic Key
    height=600,
    on_change=on_change,
    label_visibility="collapsed"
)

status_msg = f"Editing: {editor.filepath}" if editor.filepath else "Unsaved Document"
st.caption(status_msg)
