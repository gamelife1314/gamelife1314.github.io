---
title: 【Rust】实现智能指针类型
date: 2022-05-15 11:49:30
tags:
    - "smart pointer"
categories:
    - rust
---

很多时候，我们需要实现一些自动优化的数据结构，在某些情况下是一种优化的数据结构和相应的算法，在其他情况下使用通用的结构和通用的算法。比如当一个 `HashSet` 的内容比较少的时候，可以用数组实现，但内容逐渐增多，再转换成用哈希表实现。如果我们想让使用者不用关心这些实现的细节，使用同样的接口就能享受到更好的性能，那么，就可以考虑用智能指针来统一它的行为。

我们来实现一个智能 `String`，`Rust` 下 `String` 在栈上占了 `24` 个字节，然后在堆上存放字符串实际的内容，对于一些比较短的字符串，这很浪费内存。

参考 `Cow`，我们可以用一个 `enum` 来处理：当字符串小于 `N` 字节时，我们直接用栈上的数组，否则使用 `String`。但是这个 `N` 不宜太大，否则当使用 `String` 时，会比目前的版本浪费内存。

当使用 `enum` 时，额外的 `tag` + 为了对齐而使用的 `padding` 会占用一些内存。因为 `String` 结构是 `8` 字节对齐的，我们的 `enum` 最小 `8 + 24 = 32` 个字节。

所以，可以设计一个数据结构，内部用`1`个字节表示字符串的长度，用 `30` 个字节表示字符串内容，再加上 `1` 个字节的 `tag`，正好也是 `32` 字节，可以和 `String` 放在一个 `enum` 里使用，我们暂且称这个 `enum` 叫 `SmartString`，它的结构如下图所示：

{% asset_img Rust-smart-string.png %}

<!-- more -->

```rust
use std::{fmt, ops::Deref, str};

/// INLINE_STRING_MAX_LEN represent the maximum length
/// that can be stored in the stack.
const INLINE_STRING_MAX_LEN: usize = 30;

/// InlineString 会被存储在栈上，最多占用 32 字节
struct InlineString {
    len: u8,
    data: [u8; INLINE_STRING_MAX_LEN],
}

impl InlineString {
    /// 这里的 new 接口不能暴露出去，我们需要在调用的时候保证传入的字节长度小于 INLINE_STRING_MAX_LEN
    fn new(input: impl AsRef<str>) -> Self {
        let bytes = input.as_ref().as_bytes();
        let len = bytes.len();
        let mut data = [0u8; INLINE_STRING_MAX_LEN];
        data[..len].copy_from_slice(bytes);
        Self {
            len: len as u8,
            data,
        }
    }
}

impl Deref for InlineString {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        // 由于生成 InlineString 的接口是隐藏的，它只能来自字符串，所以下面这行是安全的
        str::from_utf8(&self.data[..self.len as usize]).unwrap()
    }
}

impl fmt::Debug for InlineString {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.deref())
    }
}

#[derive(Debug)]
enum SmartString {
    Inline(InlineString),
    Standard(String),
}

impl Deref for SmartString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        match *self {
            SmartString::Inline(ref v) => v.deref(),
            SmartString::Standard(ref v) => v.deref(),
        }
    }
}

impl From<&str> for SmartString {
    fn from(s: &str) -> Self {
        match s.len() > INLINE_STRING_MAX_LEN {
            true => SmartString::Standard(s.to_owned()),
            _ => SmartString::Inline(InlineString::new(s)),
        }
    }
}

impl fmt::Display for SmartString {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.deref())
    }
}

fn main() {
    let len1 = std::mem::size_of::<SmartString>();
    let len2 = std::mem::size_of::<InlineString>();
    println!("Len: SmartString {}, InlineString: {}", len1, len2);

    let s1: SmartString = "hello world".into();
    let s2 = SmartString::from("这是一个超过了三十个字节的很长很长的字符串");
    println!("s1: {:?}, s2: {:?}", s1, s2);

    // display 输出
    println!(
        "s1: {}({} bytes, {} chars), s2: {}({} bytes, {} chars)",
        s1,
        s1.len(),
        s1.chars().count(),
        s2,
        s2.len(),
        s2.chars().count()
    );

    // SmartString 可以使用一切 &str 接口，感谢 Rust 的自动 Deref
    assert!(s1.ends_with("world"));
    assert!(s2.starts_with("这"));
}
```

这将输出：

    Len: SmartString 32, InlineString: 31
    s1: Inline(hello world), s2: Standard("这是一个超过了三十个字节的很长很长的字符串")
    s1: hello world(11 bytes, 11 chars), s2: 这是一个超过了三十个字节的很长很长的字符串(63 bytes, 21 chars)