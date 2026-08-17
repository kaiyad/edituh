import json

from text_edituh import SessionStore, TextEdituh, diff_text


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


def test_type_text_replaces_selection():
    test_edituh = TextEdituh("hello world")
    test_edituh.set_selection(0, 5)
    test_edituh.type_text("goodbye")
    assert test_edituh.text == "goodbye world"
    assert test_edituh.cursor == 7
    assert test_edituh.anchor is None


def test_backspace_and_delete_forward():
    test_edituh = TextEdituh("abcdef")
    test_edituh.set_cursor(3)
    test_edituh.backspace()
    assert test_edituh.text == "abdef"
    test_edituh.delete_forward()
    assert test_edituh.text == "abef"


def test_backspace_removes_selection():
    test_edituh = TextEdituh("hello world")
    test_edituh.set_selection(6, 11)
    test_edituh.backspace()
    assert test_edituh.text == "hello "


def test_undo_redo():
    test_edituh = TextEdituh("")
    test_edituh.update_text("a")
    test_edituh.update_text("b")
    assert test_edituh.text == "ab"
    assert test_edituh.undo()
    assert test_edituh.text == "a"
    assert test_edituh.undo()
    assert test_edituh.text == ""
    assert not test_edituh.undo()
    assert test_edituh.redo()
    assert test_edituh.text == "a"
    assert test_edituh.redo()
    assert test_edituh.text == "ab"
    assert not test_edituh.redo()


def test_new_edit_clears_redo_stack():
    test_edituh = TextEdituh("")
    test_edituh.update_text("a")
    test_edituh.update_text("b")
    test_edituh.undo()
    assert test_edituh.text == "a"
    test_edituh.update_text("c")
    assert test_edituh.text == "ac"
    assert not test_edituh.redo()


def test_history_limit():
    test_edituh = TextEdituh("")
    for _ in range(1050):
        test_edituh.update_text("x")
    assert test_edituh.text == "x" * 1050
    assert len(test_edituh.history) <= 1000
    assert test_edituh.current_index == 999


def test_commit_import():
    test_edituh = TextEdituh("one")
    test_edituh.commit_import("two")
    assert test_edituh.text == "two"
    assert test_edituh.undo()
    assert test_edituh.text == "one"


def test_find_and_find_all():
    test_edituh = TextEdituh("one two one three one")
    assert test_edituh.find("one") == 0
    assert test_edituh.find_all("one") == [0, 8, 18]
    assert test_edituh.find("ONE") == -1
    assert test_edituh.find("ONE", case_sensitive=False) == 0


def test_find_spans():
    test_edituh = TextEdituh("one two one")
    assert test_edituh.find_spans("one") == [(0, 3), (8, 11)]
    assert test_edituh.find_spans(r"\w+", regex=True) == [(0, 3), (4, 7), (8, 11)]


def test_find_regex():
    test_edituh = TextEdituh("abc 123 def 456")
    assert test_edituh.find_all(r"\d+", regex=True) == [4, 12]
    assert test_edituh.find_all("\\d+") == []


def test_replace_all():
    test_edituh = TextEdituh("cat dog cat bird")
    assert test_edituh.replace_all("cat", "lion") == 2
    assert test_edituh.text == "lion dog lion bird"


def test_replace_one():
    test_edituh = TextEdituh("cat cat")
    assert test_edituh.replace_one("cat", "dog")
    assert test_edituh.text == "dog cat"


def test_replace_all_regex_backreference():
    test_edituh = TextEdituh("one two three")
    assert test_edituh.replace_all(r"(\w+)", r"<\1>", regex=True) == 3
    assert test_edituh.text == "<one> <two> <three>"


def test_find_next_selects_match():
    test_edituh = TextEdituh("cat cat")
    assert test_edituh.find_next("cat") == 0
    assert test_edituh.selection_range == (0, 3)
    assert test_edituh.find_next("cat") == 4
    assert test_edituh.find_next("cat") == 0


def test_transforms():
    test_edituh = TextEdituh("hello world")
    test_edituh.transform_upper()
    assert test_edituh.text == "HELLO WORLD"
    test_edituh.transform_lower()
    assert test_edituh.text == "hello world"
    test_edituh.transform_title()
    assert test_edituh.text == "Hello World"
    test_edituh.set_text("hello world foo_bar")
    test_edituh.transform_snake()
    assert test_edituh.text == "hello_world_foo_bar"
    test_edituh.transform_camel()
    assert test_edituh.text == "helloWorldFooBar"
    test_edituh.transform_pascal()
    assert test_edituh.text == "HelloWorldFooBar"
    test_edituh.set_text("hello world")
    test_edituh.transform_kebab()
    assert test_edituh.text == "hello-world"
    test_edituh.set_text("hello world")
    test_edituh.transform_capitalize()
    assert test_edituh.text == "Hello world"


def test_transform_selection_only():
    test_edituh = TextEdituh("hello world")
    test_edituh.set_selection(0, 5)
    test_edituh.transform_upper()
    assert test_edituh.text == "HELLO world"


def test_sort_lines():
    test_edituh = TextEdituh("banana\napple\ncherry")
    test_edituh.sort_lines()
    assert test_edituh.text == "apple\nbanana\ncherry"
    test_edituh.sort_lines(reverse=True)
    assert test_edituh.text == "cherry\nbanana\napple"


def test_natural_sort():
    test_edituh = TextEdituh("file10\nfile2\nfile1")
    test_edituh.sort_lines(natural=True)
    assert test_edituh.text == "file1\nfile2\nfile10"


def test_unique_reverse_trim_lines():
    test_edituh = TextEdituh("a\nb\na\nb\nc")
    test_edituh.unique_lines()
    assert test_edituh.text == "a\nb\nc"
    test_edituh.reverse_lines()
    assert test_edituh.text == "c\nb\na"
    test_edituh = TextEdituh("  x  \n  y  ")
    test_edituh.trim_lines()
    assert test_edituh.text == "x\ny"


def test_remove_empty_and_join_lines():
    test_edituh = TextEdituh("a\n\nb\n")
    test_edituh.remove_empty_lines()
    assert test_edituh.text == "a\nb"
    test_edituh.set_text("a\nb\nc")
    test_edituh.join_lines(" - ")
    assert test_edituh.text == "a - b - c"


def test_indent_dedent():
    test_edituh = TextEdituh("a\nb\n")
    test_edituh.indent(4)
    assert test_edituh.text == "    a\n    b\n"
    test_edituh.dedent(4)
    assert test_edituh.text == "a\nb\n"


def test_tabs_and_spaces():
    test_edituh = TextEdituh("a\tb")
    test_edituh.tabs_to_spaces(4)
    assert test_edituh.text == "a    b"
    test_edituh.spaces_to_tabs(4)
    assert test_edituh.text == "a\tb"


def test_trim_trailing_whitespace():
    test_edituh = TextEdituh("a   \nb\t\nc")
    test_edituh.trim_trailing_whitespace()
    assert test_edituh.text == "a\nb\nc"


def test_base64_roundtrip():
    test_edituh = TextEdituh("hello world")
    test_edituh.base64_encode()
    assert test_edituh.text == "aGVsbG8gd29ybGQ="
    test_edituh.base64_decode()
    assert test_edituh.text == "hello world"


def test_url_roundtrip():
    test_edituh = TextEdituh("hello world & more")
    test_edituh.url_encode()
    assert test_edituh.text == "hello%20world%20%26%20more"
    test_edituh.url_decode()
    assert test_edituh.text == "hello world & more"


def test_html_roundtrip():
    test_edituh = TextEdituh("<a href='x'>&</a>")
    test_edituh.html_escape()
    assert test_edituh.text == "&lt;a href=&#x27;x&#x27;&gt;&amp;&lt;/a&gt;"
    test_edituh.html_unescape()
    assert test_edituh.text == "<a href='x'>&</a>"


def test_json_format_and_minify():
    test_edituh = TextEdituh('{"b":1,"a":[1,2]}')
    test_edituh.json_format()
    assert json.loads(test_edituh.text) == {"a": [1, 2], "b": 1}
    test_edituh.json_minify()
    assert test_edituh.text == '{"b":1,"a":[1,2]}'


def test_json_validate():
    assert TextEdituh('{"a": 1}').json_validate()[0]
    valid, message = TextEdituh("{bad json").json_validate()
    assert not valid
    assert message


def test_stats():
    test_edituh = TextEdituh("one two\nthree four five")
    stats = test_edituh.stats()
    assert stats["lines"] == 2
    assert stats["characters"] == 23
    assert stats["characters_no_spaces"] == 19
    assert stats["words"] == 5
    assert stats["bytes"] == 23
    assert stats["paragraphs"] == 1
    assert stats["max_line_length"] == 15


def test_cursor_position_and_goto():
    test_edituh = TextEdituh("abc\ndef\nghi")
    assert test_edituh.cursor_position == (1, 1)
    test_edituh.goto_line(2)
    assert test_edituh.cursor_position == (2, 1)
    test_edituh.set_cursor(5)
    assert test_edituh.cursor_position == (2, 2)


def test_diff_to():
    test_edituh = TextEdituh("a\nb\nc")
    diff = test_edituh.diff_to("a\nc")
    assert "-b" in diff
    assert test_edituh.diff_to("a\nb\nc") == "The documents are identical."


def test_diff_text():
    assert "+world" in diff_text("alpha\nbeta", "alpha\nworld")


def test_load_from_file_encodings(tmp_path):
    path = tmp_path / "doc.txt"
    path.write_text("héllo", encoding="utf-8")
    test_edituh = TextEdituh("")
    test_edituh.load_from_file(str(path))
    assert test_edituh.text == "héllo"
    assert test_edituh.filepath == str(path)


def test_dirty_flag(tmp_path):
    test_edituh = TextEdituh("a")
    assert not test_edituh.dirty
    test_edituh.update_text("b")
    assert test_edituh.dirty
    test_edituh.undo()
    assert not test_edituh.dirty
    test_edituh.redo()
    assert test_edituh.dirty
    test_edituh.save_to_file(str(tmp_path / "saved.txt"))
    assert not test_edituh.dirty


def test_session_roundtrip(tmp_path):
    store = SessionStore(tmp_path / "session.json")
    store.save(1, [{"path": "/a", "text": "one"}, {"path": "/b", "text": "two"}])
    data = store.load()
    assert data["active"] == 1
    assert [item["path"] for item in data["documents"]] == ["/a", "/b"]
    assert [item["text"] for item in data["documents"]] == ["one", "two"]


def test_session_load_missing_file(tmp_path):
    store = SessionStore(tmp_path / "missing.json")
    assert store.load() == {"active": 0, "documents": []}