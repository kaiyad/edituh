MAX_LEAF_LENGTH = 2048


class RopeNode:
    __slots__ = ("left", "right", "value", "length", "depth", "weight")

    def __init__(self, left=None, right=None, value=None):
        if value is not None:
            self.left = None
            self.right = None
            self.value = value
            self.length = len(value)
            self.weight = len(value)
            self.depth = 1
        else:
            self.left = left
            self.right = right
            self.value = None
            self.length = (len(left) if left is not None else 0) + (len(right) if right is not None else 0)
            self.weight = len(left) if left is not None else 0
            self.depth = 1 + max(
                left.depth if left is not None else 0,
                right.depth if right is not None else 0,
            )

    def __len__(self):
        return self.length

    def __bool__(self):
        return self.length > 0

    def __str__(self):
        return self.to_string()

    def to_string(self):
        if self.value is not None:
            return self.value
        parts = []
        stack = [self]
        while stack:
            node = stack.pop()
            if node.value is not None:
                parts.append(node.value)
            else:
                stack.append(node.right)
                stack.append(node.left)
        return "".join(parts)

    def char_at(self, index):
        node = self
        while node.value is None:
            if index < node.weight:
                node = node.left
            else:
                index -= node.weight
                node = node.right
        return node.value[index]

    def substring(self, start, end):
        start = max(0, min(start, self.length))
        end = max(start, min(end, self.length))
        return self.to_string()[start:end]

    @staticmethod
    def empty():
        return RopeNode(value="")

    @staticmethod
    def concatenate(left, right):
        if left is None or len(left) == 0:
            return right if right is not None else RopeNode.empty()
        if right is None or len(right) == 0:
            return left
        return RopeNode(left=left, right=right)

    @staticmethod
    def create_rope_from_string(value):
        value = value or ""
        parts = [value[index : index + MAX_LEAF_LENGTH] for index in range(0, len(value), MAX_LEAF_LENGTH)]
        return RopeNode._build(parts, 0, len(parts))

    @staticmethod
    def split(rope, index):
        if rope is None or len(rope) == 0:
            return RopeNode.empty(), RopeNode.empty()
        index = max(0, min(index, rope.length))
        if index == 0:
            return RopeNode.empty(), rope
        if index >= rope.length:
            return rope, RopeNode.empty()
        if rope.value is not None:
            return RopeNode(value=rope.value[:index]), RopeNode(value=rope.value[index:])
        if index < rope.weight:
            left, right = RopeNode.split(rope.left, index)
            return left, RopeNode(left=right, right=rope.right)
        left, right = RopeNode.split(rope.right, index - rope.weight)
        return RopeNode(left=rope.left, right=left), right

    @staticmethod
    def insert(rope, index, value):
        return RopeNode.replace(rope, index, index, value)

    @staticmethod
    def delete(rope, start, end):
        return RopeNode.replace(rope, start, end, "")

    @staticmethod
    def replace(rope, start, end, value):
        if rope is None or len(rope) == 0:
            return RopeNode.create_rope_from_string(value)
        start = max(0, min(start, rope.length))
        end = max(start, min(end, rope.length))
        left, rest = RopeNode.split(rope, start)
        _, right = RopeNode.split(rest, end - start)
        node = RopeNode.concatenate(left, right)
        if value:
            node = RopeNode.concatenate(RopeNode.concatenate(left, RopeNode.create_rope_from_string(value)), right)
        return RopeNode.rebalance(node)

    @staticmethod
    def _collect(node, parts):
        if node is None:
            return
        if node.value is not None:
            if node.value:
                for index in range(0, len(node.value), MAX_LEAF_LENGTH):
                    parts.append(node.value[index : index + MAX_LEAF_LENGTH])
            return
        RopeNode._collect(node.left, parts)
        RopeNode._collect(node.right, parts)

    @staticmethod
    def _build(parts, low, high):
        if low >= high:
            return RopeNode.empty()
        if high - low == 1:
            return RopeNode(value=parts[low])
        middle = (low + high) // 2
        return RopeNode(
            left=RopeNode._build(parts, low, middle),
            right=RopeNode._build(parts, middle, high),
        )

    @staticmethod
    def rebalance(node):
        if node is None or node.value is not None or node.length == 0:
            return node
        limit = 2 * max(1, node.length.bit_length()) + 2
        if node.depth <= limit:
            return node
        parts = []
        RopeNode._collect(node, parts)
        return RopeNode._build(parts, 0, len(parts))
