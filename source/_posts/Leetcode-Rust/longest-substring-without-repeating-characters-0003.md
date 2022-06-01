---
title: 【Leetcode-Rust】无重复字符的最长子串(0003)
date: 2022-05-30 22:28:05
tags:
  - 滑动窗口
categories:
  - Leetcode
---

### [题目](https://leetcode.cn/problems/longest-substring-without-repeating-characters/)

给定一个字符串 `s` ，请你找出其中不含有重复字符的 最长子串 的长度。

### 示例

示例 `1`：

    输入: s = "abcabcbb"
    输出: 3 
    解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。

示例 `2`：

    输入: s = "bbbbb"
    输出: 1
    解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。

示例 `3`：

    输入: s = "pwwkew"
    输出: 3
    解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。

### 思路

使用滑动窗口，它的右边界不断的右移，只要没有重复的字符，就持续向右扩大窗口边界。一旦探测到出现了重复字符，就需要右边界先停下，然后缩小左边界，直到重复的字符移出了左边界，然后继续移动滑动窗口的右边界。以此类推，每次移动需要计算当前长度，并判断是否需要更新最大长度，最终最大的值就是题目中的所求。

```rust
fn max(a: i32, b: i32) -> i32 {
    if a >= b {
        a
    } else {
        b
    }
}

impl Solution {
    pub fn length_of_longest_substring(s: String) -> i32 {
        let mut result = 0;
        let mut left = 0i32;
        let mut right = -1i32;
        let mut freq = [0; 127];
        let s = s.into_bytes();

        while (left as usize) < s.len() {
            let right_index = (right + 1) as usize;
            if right_index < s.len() && freq[s[right_index] as usize] == 0 {
                right += 1;
                freq[s[right_index] as usize] += 1;
            } else {
                freq[s[left as usize] as usize] -= 1;
                left += 1;
            }

            result = max(result, right - left + 1);
        }

        result
    }
}
```