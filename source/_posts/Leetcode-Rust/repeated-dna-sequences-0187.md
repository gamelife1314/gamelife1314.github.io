---
title: 【Leetcode-Rust】重复的DNA序列(0187)
date: 2022-06-11 22:38:44
tags:
  - 滑动窗口
categories:
  - Leetcode
---

### [题目](https://leetcode.cn/problems/repeated-dna-sequences/)

`DNA` 序列 由一系列核苷酸组成，缩写为 `'A'`, `'C'`, `'G'` 和 `'T'`.。

例如，`"ACGAATTCCG"` 是一个 `DNA` 序列，在研究 `DNA` 时，识别 `DNA` 中的重复序列非常有用。

给定一个表示 `DNA` 序列 的字符串 `s` ，返回所有在 `DNA` 分子中出现不止一次的 长度为 `10` 的序列(子字符串)。你可以按 任意顺序 返回答案。

### 示例

示例 `1`：

    输入：s = "AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT"
    输出：["AAAAACCCCC","CCCCCAAAAA"]

示例 `2`：

    输入：s = "AAAAAAAAAAAAA"
    输出：["AAAAAAAAAA"]
 

提示：

    0 <= s.length <= 105
    s[i]=='A'、'C'、'G' or 'T'


### 解法一

暴力解法，双层循环比较，结果可想而知，超时。

```rust
struct Solution;

impl Solution {
    pub fn find_repeated_dna_sequences(s: String) -> Vec<String> {
        let sub_strlen = 10;

        if s.len() <= sub_strlen {
            return vec![];
        }

        let s = s.into_bytes();
        let end = s.len() - 10;
        let mut set = std::collections::HashSet::new();

        for i in 0..=end {
            let tmp1 = &s[i..i + (sub_strlen as usize)];
            for j in (i + 1)..=end {
                let tmp2 = &s[j..j + (sub_strlen as usize)];
                if tmp2 == tmp1 {
                    unsafe {
                        set.insert(String::from_utf8_unchecked(tmp1.to_vec()));
                    }
                }
            }
        }
        set.into_iter().collect()
    }
}

fn main() {
    let dna = "AAAAAAAAAAAAA".to_owned();
    println!("{:?}", Solution::find_repeated_dna_sequences(dna));
}
```

### 解法二

`O(n)` 的时间复杂度，一次遍历将长度为 `10` 的所有子串放在 `map` 中，并且计数，最后将出现次数大于 `1` 的子串找出来返回。

```rust
use std::collections::HashMap;

struct Solution;

impl Solution {
    pub fn find_repeated_dna_sequences(s: String) -> Vec<String> {
        let sub_strlen = 10;

        if s.len() <= sub_strlen {
            return vec![];
        }

        let s = s.into_bytes();
        let end = s.len() - 10;
        let mut result = HashMap::new();

        for i in 0..=end {
            let tmp1 = &s[i..i + (sub_strlen as usize)];
            let tmp1 = unsafe { String::from_utf8_unchecked(tmp1.to_vec()) };
            result
                .entry(tmp1)
                .and_modify(|count| *count = *count + 1)
                .or_insert(1);
        }

        let result: HashMap<&String, &i32> =
            result.iter().filter(|(_, count)| **count > 1).collect();

        let result = result
            .into_keys()
            .map(|key| key.to_owned())
            .collect::<Vec<String>>();

        result
    }
}

fn main() {
    let dna = "AAAAAAAAAAAAA".to_owned();
    println!("{:?}", Solution::find_repeated_dna_sequences(dna));
}
```