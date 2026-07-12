from rope import RopeNode

class TextEdituh:
    def __init__(self, initial_text: str =""):
        self.history = [RopeNode.create_rope_from_string(initial_text)]
        self.current_index = 0
        self.cursor = 0
        self.filepath = None

    @property
    def current_rope(self) -> RopeNode:
        return self.history[self.current_index]

    @property
    def text(self) -> str:
        return self.current_rope.to_string()

    def _commit_change(self, new_rope: RopeNode):
        """Commit a new rope state to history, clearing redo stack."""
        self.history = self.history[:self.current_index + 1]
        self.history.append(new_rope)
        self.current_index += 1

        if len(self.history) > 100:
            self.history.pop(0)
            self.current_index -=1

    def set_text(self, new_text: str):
        new_rope = RopeNode.create_rope_from_string(new_text or "")
        self.history = [new_rope]
        self.current_index = 0
        self.cursor = len(new_text or "")

    def update_text(self, new_text: str):
        if not new_text:
            return
        new_rope = RopeNode.insert(self.current_rope, self.cursor, new_text)
        self._commit_change(new_rope)
        self.cursor += len(new_text)

    def backspace(self):
        if self.cursor > 0:
            new_rope = RopeNode.delete(self.current_rope, self.cursor -1, self.cursor)
            self._commit_change(new_rope)
            self.cursor -= 1

    def delete_forward(self):
        if self.cursor < len(self.text):
            new_rope = RopeNode.delete(self.current_rope, self.cursor, self.cursor + 1)
            self._commit_change(new_rope)

    def move_cursor(self, position: int):
        self.cursor += max(0, min(position, len(self.text)))

    def undo(self):
        if self.current_index > 0:
            self.current_index -= 1
            prev_len = len(self.text)
            if self.cursor > prev_len:
                self.cursor = prev_len
            return True
        return False

    def redo(self):
        if self.current_index < len(self.history) - 1:
            self.current_index += 1

            curr_len = len(self.text)
            if self.cursor > curr_len:
                self.cursor = curr_len
            return True
        return False

    def get_display_text(self):
        return self.text[:self.cursor] + '|' + self.text[self.cursor:]

    def save_to_file(self, path):
        with open(path, 'w', encoding='utf-8') as f:
            f.write(self.text)
        self.filepath = path

    def load_from_file(self, path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        self.history = [RopeNode.create_rope_from_string(content)]
        self.current_index = 0
        self.filepath = path
