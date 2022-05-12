---
title: 【Rust】代码片段
date: 2022-05-12 20:34:14
tags:
categories:
    - Rust
---

### 构造 `Double Free`

使用 `unsafe` 特性构造指向同一块内存的两个变量，导致 `Double Free`：

{% note warning %}
```rust
use std::{mem, ptr};

fn main() {
    let mut d = String::from("cccc");
    let d_len = d.len();
    
    let mut c = String::with_capacity(d_len);
    unsafe {
        ptr::copy(&d, &mut c, 1);
    };
    println!("{:?}", c.as_ptr());

    println!("{:?}", d.as_ptr());
    d.push_str("c");
    println!("{}", d);
}
```
{% endnote %}

<!-- more -->

### `Arc` 无法 `DerefMove`

{% note danger %}
```rust
use std::sync::Arc;

fn main(){
    let s = Arc::new("hello".to_string());
    println!("{:p}", &s);
    println!("{:p}", s.as_ptr());
    // DerefMove Error : cannot move out of an `Arc`
    let s2 = *s;
    // println!("{:p}", s.as_ptr()); // Moved s
    println!("{:p}", s2.as_ptr());
}
```
{% endnote %}

但如果换成 `Box` 是可以的。

### 函数参数生命周期关系

下面的代码中说明 `'a` 的生命周期要大于 `'c`，可以这样理解，如果一个引用的生命周期满足 `'a`，那么它必然可以满足 `'c`：

```rust
#![allow(unused)]

fn the_longest<'c, 'a: 'c>(s1: &'a str, s2: &'a str) -> &'c str {
    if s1.len() > s2.len() {
        s1
    } else {
        s2
    }
}

fn main() {
    let s1 = String::from("Rust");
    let s1_r = &s1;
    {
        let s2 = String::from("C");
        let res = the_longest(s1_r, &s2);
        println!("{} is the longest", res);
    }
}
```

或者我们可以给每个引用都声明一个单独的声明周期参数：

```rust
fn the_longest<'c, 'a: 'c, 'b: 'c>(s1: &'a str, s2: &'b str) -> &'c str {
    if s1.len() > s2.len() {
        s1
    } else {
        s2
    }
}
```
