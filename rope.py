# Rope data structure implementation in Python

class RopeNode:
	def __init__(self, left=None, right=None, value: str="", length: int=0):
		self.left = left
		self.right = right
		self.value = value
		self.length = length


	def __len__(self) -> int:
		return self.length


	def __str__(self) -> str:
		return self.to_string()


	def to_string(self) -> str:
		if self.value:
			return self.value

		left_str =  self.left.to_string() if self.left else ""
		right_str = self.right.to_string() if self.right else ""

		return left_str + right_str


	def char_at(self, index: int):
		if self.value:
			return self.value[index]

		if index < len(self.left):
			return self.left.char_at(index)
		else:
			return self.right.char_at(index - len(self.left))


	def substring(self, start: int, end: int) -> str:
		if self.value:
			return self.value[start:end]

		if end <= len(self.left):
			return self.left.substring(start, end)
		elif start >= len(self.left):
			return self.right.substring(start - len(self.left), end - len(self.left))
		else:
			left_substring = self.left.substring(start, len(self.left))
			right_substring = self.right.substring(0, end - len(self.left))
			return left_substring + right_substring


	def concatenate(rope1, rope2):
		new_length = len(rope1) + len(rope2)
		return RopeNode(left=rope1, right=rope2, length=new_length)


	def split(rope, index: int) -> tuple:
		if not rope or index <= 0:
			return RopeNode(value="", length=0), rope
		if index >= rope.length:
			return rope, RopeNode(value="", length=0)

		if rope.value:
			left_value = rope.value[:index]
			right_value = rope.value[index:]
			left_node = RopeNode(value=left_value, length=len(left_value))
			right_node = RopeNode(value=right_value, length=len(right_value))
			return left_node, right_node

		if index < len(rope.left):
			left_split, right_split = RopeNode.split(rope.left, index)
			new_right = RopeNode.concatenate(right_split, rope.right)
			return left_split, new_right
		else:
			left_split, right_split = RopeNode.split(rope.right, index - len(rope.left))
			new_left = RopeNode.concatenate(rope.left, left_split)
			return new_left, right_split


	def insert(rope, index: int, value: str):
		left, right = RopeNode.split(rope, index)
		new_node = RopeNode(value=value, length=len(value))
		return RopeNode.concatenate(RopeNode.concatenate(left, new_node), right)

	def delete(rope, start: int, end: int):
		left, right = RopeNode.split(rope, start)
		_, right = RopeNode.split(right, end - start)
		return RopeNode.concatenate(left, right)

	def create_rope_from_string(s: str):
		return RopeNode(value=s, length=len(s))
