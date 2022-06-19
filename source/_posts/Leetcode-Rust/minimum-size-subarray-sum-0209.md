---
title: 【Leetcode-Rust】长度最小的子数组(0209)
date: 2022-06-19 19:32:09
tags:
  - 滑动窗口
categories:
  - Leetcode
---

### [题目](https://leetcode.cn/problems/minimum-size-subarray-sum/)

给定一个含有 `n` 个正整数的数组和一个正整数 `target`。

找出该数组中满足其和 `≥ target` 的长度最小的连续子数组 `[numsl, numsl+1, ..., numsr-1, numsr]`，并返回其长度。如果不存在符合条件的子数组，返回 `0`。

### 示例

示例 `1`：

    输入：target = 7, nums = [2,3,1,2,4,3]
    输出：2
    解释：子数组 [4,3] 是该条件下的长度最小的子数组。

示例 `2`：

    输入：target = 4, nums = [1,4,4]
    输出：1

示例 `3`：

    输入：target = 11, nums = [1,1,1,1,1,1,1,1]
    输出：0

### 思路

这一题的解题思路是用滑动窗口。在滑动窗口 `[i,j]` 之间不断往后移动，如果总和小于 `s`，就扩大右边界 `right`，不断加入右边的值，直到 `sum >= s`，然后判断满足的子数组的长度，再缩小 `left` 左边界，直到 `sum < s`，这时候右边界又可以往右移动，寻找下一个满足的子数组。

```rust
fn min(a: i32, b: i32) -> i32 {
    if a < b {
        return a;
    }
    b
}

impl Solution {
    pub fn min_sub_array_len(target: i32, nums: Vec<i32>) -> i32 {
        let mut left = 0usize;
        let mut sum = 0;
        let mut res = nums.len() as i32 + 1;
        for right in 0..nums.len() {
            let num = nums[right];
            sum += num;
            while sum >= target{
                res = min(res, (right - left + 1) as i32);
                sum -= nums[left];
                left += 1;
            }
        }

        if res == nums.len() as i32 + 1 {
            return 0;
        }
        return res;
    }
}
```