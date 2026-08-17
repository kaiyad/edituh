import random

from rope import RopeNode


def test_empty_rope():
    rope = RopeNode.empty()
    assert len(rope) == 0
    assert rope.to_string() == ""


def test_create_from_string():
    rope = RopeNode.create_rope_from_string("hello world")
    assert len(rope) == 11
    assert rope.to_string() == "hello world"


def test_insert():
    rope = RopeNode.create_rope_from_string("hello")
    rope = RopeNode.insert(rope, 2, "xx")
    assert rope.to_string() == "hexxllo"


def test_insert_at_start_and_end():
    rope = RopeNode.create_rope_from_string("ab")
    assert RopeNode.insert(rope, 0, "z").to_string() == "zab"
    assert RopeNode.insert(rope, 2, "z").to_string() == "abz"


def test_insert_into_empty_rope():
    rope = RopeNode.empty()
    rope = RopeNode.insert(rope, 0, "abc")
    assert rope.to_string() == "abc"


def test_delete_range():
    rope = RopeNode.create_rope_from_string("hello world")
    rope = RopeNode.delete(rope, 2, 5)
    assert rope.to_string() == "he world"


def test_replace_range():
    rope = RopeNode.create_rope_from_string("hello world")
    rope = RopeNode.replace(rope, 6, 11, "there")
    assert rope.to_string() == "hello there"


def test_split():
    rope = RopeNode.create_rope_from_string("abcdef")
    left, right = RopeNode.split(rope, 2)
    assert left.to_string() == "ab"
    assert right.to_string() == "cdef"
    left, right = RopeNode.split(rope, 0)
    assert left.to_string() == ""
    assert right.to_string() == "abcdef"
    left, right = RopeNode.split(rope, 6)
    assert left.to_string() == "abcdef"
    assert right.to_string() == ""


def test_char_at():
    rope = RopeNode.create_rope_from_string("abcdef")
    assert rope.char_at(0) == "a"
    assert rope.char_at(5) == "f"
    for i in range(3):
        rope = RopeNode.insert(rope, i * 2, "XY")
    assert rope.to_string() == "XYXYXYabcdef"
    for i in range(len(rope)):
        assert rope.char_at(i) == rope.to_string()[i]


def test_substring():
    rope = RopeNode.create_rope_from_string("hello world")
    assert rope.substring(6, 11) == "world"
    assert rope.substring(0, 5) == "hello"
    assert rope.substring(2, 2) == ""
    assert rope.substring(3, 8) == "lo wo"


def test_large_string():
    source = "".join(chr(97 + (i % 26)) for i in range(100_000))
    rope = RopeNode.create_rope_from_string(source)
    assert len(rope) == 100_000
    assert rope.to_string() == source
    assert rope.substring(50_000, 50_010) == source[50_000:50_010]


def test_balance_invariant():
    random.seed(42)
    rope = RopeNode.create_rope_from_string("The quick brown fox jumps over the lazy dog")
    for _ in range(1500):
        op = random.randrange(4)
        length = len(rope)
        index = random.randrange(length + 1) if length else 0
        if op == 0:
            rope = RopeNode.insert(rope, index, random.choice(["a", "bb", "ccc"]))
        elif op == 1 and length > 0:
            end = min(length, index + random.randrange(1, 4))
            rope = RopeNode.delete(rope, index, end)
        elif op == 2 and length > 0:
            end = min(length, index + random.randrange(1, 3))
            rope = RopeNode.replace(rope, index, end, "Z")
        else:
            rope = RopeNode.replace(rope, index, index, "xy")
        limit = 2 * max(1, rope.length.bit_length()) + 2
        assert rope.depth <= limit


def test_random_ops_match_string():
    random.seed(7)
    rope = RopeNode.create_rope_from_string("")
    reference = ""
    for _ in range(800):
        op = random.randrange(3)
        index = random.randrange(len(reference) + 1)
        if op == 0:
            value = random.choice(["alpha", "beta", "!!", "1"])
            rope = RopeNode.insert(rope, index, value)
            reference = reference[:index] + value + reference[index:]
        elif op == 1:
            end = random.randrange(index, len(reference) + 1)
            rope = RopeNode.delete(rope, index, end)
            reference = reference[:index] + reference[end:]
        else:
            value = random.choice(["x", "longer-value", ""])
            end = random.randrange(index, len(reference) + 1)
            rope = RopeNode.replace(rope, index, end, value)
            reference = reference[:index] + value + reference[end:]
        assert len(rope) == len(reference)
        assert rope.to_string() == reference