from text_edituh import TextEdituh


def test_update_text():
    test_edituh = TextEdituh("")
    test_edituh.update_text("test")
    assert test_edituh.text == "test", f"Expected 'test', got '{test_edituh.text}'"


def test_set_text_replaces_existing_content():
    test_edituh = TextEdituh("hello")
    test_edituh.set_text("world")

    assert test_edituh.text == "world"
    assert test_edituh.cursor == len("world")


def test_save_to_file_updates_filepath(tmp_path):
    test_edituh = TextEdituh("")
    test_edituh.update_text("test")

    destination = tmp_path / "saved.txt"
    test_edituh.save_to_file(str(destination))

    assert destination.read_text(encoding="utf-8") == "test"
    assert test_edituh.filepath == str(destination)
