---
title: 【Leetcode-Rust】两数之和(0001)
date: 2022-05-27 00:25:05
categories:
    - Leetcode
---

### [题目](https://leetcode.cn/problems/two-sum/)

Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

给定一个整数数组 `nums` 和一个整数目标值 `target`，请你在该数组中找出 和为目标值 `target` 的那两个整数，并返回它们的数组下标。你可以假设每种输入只会对应一个答案。但是，数组中同一个元素在答案里不能重复出现。你可以按任意顺序返回答案。

在数组中找到 `2` 个数之和等于给定值的数字，结果返回 `2` 个数字在数组中的下标。

### 示例

    输入：nums = [2,7,11,15], target = 9
    输出：[0,1]
    解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。

    输入：nums = [3,2,4], target = 6
    输出：[1,2]

    输入：nums = [3,3], target = 6
    输出：[0,1]

### 思路

这道题最优的做法时间复杂度是 `O(n)`。顺序扫描数组，对每一个元素，在 `map` 中找能组合给定值的另一半数字，如果找到了，直接返回 `2` 个数字的下标即可。如果找不到，就把这个数字存入 `map` 中，等待扫到另一半数字的时候，再取出来返回结果。


### 代码

```rust
use std::collections::HashMap;

impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut positions = HashMap::<i32, usize>::new();
        for i in 0..nums.len() { 
            if let Some(j) = positions.get(&(target - nums[i])) {
                return vec![*j as i32, i as i32];
            }
            positions.insert(nums[i], i);
        }
        vec![]
    }
}
```