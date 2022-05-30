---
title: 【Leetcode-Rust】两数相加(0002)
date: 2022-05-30 18:30:44
categories:
  - Leetcode
---

### [题目](https://leetcode.cn/problems/add-two-numbers/)

给你两个非空的链表，表示两个非负的整数。它们每位数字都是按照逆序的方式存储的，并且每个节点只能存储一位数字。

请你将两个数相加，并以相同形式返回一个表示和的链表。

你可以假设除了数字 `0` 之外，这两个数都不会以 `0` 开头。

### 示例

示例 `1`：

    输入：l1 = [2,4,3], l2 = [5,6,4]
    输出：[7,0,8]
    解释：342 + 465 = 807.


示例 `2`：

    输入：l1 = [0], l2 = [0]
    输出：[0]


示例 `3`：

    输入：l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]
    输出：[8,9,9,9,0,0,0,1]

### 思路

`2` 个逆序的链表，要求从低位开始相加，得出结果也逆序输出，返回值是逆序结果链表的头结点，需要注意的是处理进位问题。

### 代码

```rust
impl Solution {
    pub fn add_two_numbers(
        l1: Option<Box<ListNode>>,
        l2: Option<Box<ListNode>>,
    ) -> Option<Box<ListNode>> {
        let mut head = Box::new(ListNode::new(0));
        let mut n1 = 0;
        let mut n2 = 0;
        let mut carry = 0;
        let mut current = &mut head;

        let mut l1 = l1;
        let mut l2 = l2;

        loop {
            if l1.is_none() && l2.is_none() && carry == 0 {
                break;
            }

            if l1.is_none() {
                n1 = 0;
            } else {
                n1 = l1.as_ref().unwrap().val;
                l1 = l1.unwrap().next;
            }

            if l2.is_none() {
                n2 = 0;
            } else {
                n2 = l2.as_ref().unwrap().val;
                l2 = l2.unwrap().next;
            }

            current.next = Some(Box::new(ListNode::new((n1 + n2 + carry) % 10)));
            current = current.next.as_mut().unwrap();
            carry = (n1 + n2 + carry) / 10;
        }

        head.next
    }
}
```

### 参考链接

1. [`Add Two Numbers`](https://books.halfrost.com/leetcode/ChapterFour/0001~0099/0002.Add-Two-Numbers/)
