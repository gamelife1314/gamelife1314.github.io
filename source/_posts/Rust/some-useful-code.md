---
title: 【Rust】代码片段
date: 2022-05-12 20:34:14
tags:
categories:
    - rust
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

### 参数生命周期继承

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

### 早期绑定、晚期绑定

可以阅读：[https://dtolnay.github.io/rust-quiz/11](https://dtolnay.github.io/rust-quiz/11)

泛型参数可以是早期绑定或晚期绑定，当前（以及在可预见的将来）类型参数总是早期绑定，但生命周期参数可以是早期绑定或后绑定。

早期绑定参数由编译器在单态化期间确定，由于类型参数始终是早期绑定的，因此不能拥具有未解析类型参数的值。例如：

{% note warning %}
```rust
fn m<T>() {}

fn main() {
    let m1 = m::<u8>; // ok
    let m2 = m; // error: cannot infer type for `T`
}
```
{% endnote %}

但是这个对于生命周期却是允许的，因为生命周期 `'a` 的实际选择取决于它的调用方式，因此我们可以省略生命周期参数，它将在调用的地方确定：每次调用的生命周期甚至可能不同：

{% note success %}

```rust
fn m<'a>(_: &'a ()) {}

fn main() {
    let m1 = m; // ok even though 'a isn't provided
}
```
{% endnote %}}

出于这个原因，我们不能指定生命周期直到它被调用，也不能让借用检查器去推断它：

{% note danger %}
```rust
// error: cannot specify lifetime arguments explicitly if late bound lifetime parameters are present
let m2 = m::<'static>;

// error: cannot specify lifetime arguments explicitly if late bound lifetime parameters are present
let m3 = m::<'_>;
```
{% endnote %}

晚期绑定参数的想法与 `Rust` 的一个称为“高级`Trait`边界”（`HRTB`）的特性有很大的重叠，这是一种机制，用于表示`trait`参数的界限是后期界限。目前这仅限于生命周期参数，可以使用 `for` 关键字表达生命周期的`HRTB`，例如，对于上面的 `m1`：

```
let m1: impl for<'r> Fn(&'r ()) = m;
```

可以把它理解为这里有一个生命周期，但是我们目前还不需要知道它。

后期绑定生命周期总是无限的；没有语法来表示必须比其他生命周期更长的后期绑定生命周期：

{% note danger %}
```rust
fn main() {
    let _: for<'b: 'a> fn(&'b ()); // 错误
}
```
{% endnote %}}

除非开发人员明确使用 `HRTB` 作为语法，否则数据类型的生命周期总是提前绑定的。在函数上，生命周期默认为后期绑定，但在以下情况下可以提前绑定：

- 生命周期在函数签名之外声明，例如在结构体的关联方法中，它可以来自结构体本身；

- 生命周期参数以它必须超过的其他生命周期为界；

通过这些规则，我们来看个例子：

{% note danger %}
```rust
fn f<'a>() {}
fn g<'a: 'a>() {}

fn main() {
    let pf = f::<'static> as fn(); // error
    let pg = g::<'static> as fn(); // ok
    print!("{}", pf == pg);
}
```
{% endnote %}

根据这些规则，签名 `fn f<'a>()` 具有后期绑定生命周期参数，而签名 `fn g<'a: 'a>()` 具有早期绑定生命周期参数（即使此处的约束无效）。

{% tabs 早晚期绑定 %}

<!-- tab 示例一（错误）  -->

下面这段代码编译失败，原因很很直接，我们对 `buf` 存在两次可变借用，但是我们的第一次可变借用在获取 `b1` 之后就应该失效，只要 `buf` 存在，`b1` 和 `b2` 就应该保持有效。但是从 `read_bytes` 的实现中我们可以看出，它有一个后期绑定生命周期参数，返回值还和每次调用的可变借用必须具有相同生命周期，所以可变借用得保留到返回值最后一次使用位置。

```rust
struct Buffer {
    buf: Vec<u8>,
    pos: usize,
}

impl Buffer {
    fn new() -> Buffer {
        Buffer {
            buf: vec![1, 2, 3, 4, 5, 6],
            pos: 0,
        }
    }

    fn read_bytes<'a>(&'a mut self) -> &'a [u8] {
        self.pos += 3;
        &self.buf[self.pos - 3..self.pos]
    }
}

fn print(b1: &[u8], b2: &[u8]) {
    println!("{:#?} {:#?}", b1, b2)
}

fn main() {
    let mut buf = Buffer::new();
    let b1 = buf.read_bytes();   // -----------第一次-----------+
    let b2 = buf.read_bytes();   // -----------第二次-----------|
    print(b1, b2)                // --------------------------\|/
}
```
<!-- endtab -->

<!-- tab 示例二（通过）  -->

但是我们将我们的 `Buffer` 改改，让它拥有一个具有 `'a` 的 `buf`，而且让 `read_bytes` 的返回值生命周期跟 `buf` 相同，这样就和它的调用者没关系了，生成 `b1` 和 `b2` 的可变借用在它们使用完就结束了，这里 `read_bytes` 的参数生命周期是早期绑定的，在编译期间就能但太态化。

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5, 6];
    let mut buf = Buffer::new(&v);
    let b1 = buf.read_bytes();    // 第一次可变借用，相当于 (&mut buf).read_bytes()
    let b2 = buf.read_bytes();    // 第二次可变借用
    print(b1, b2)                 // b1 和 b2 引用至 v，和 v 有相同的生命周期
}

fn print(b1: &[u8], b2: &[u8]) {
    println!("{:#?} {:#?}", b1, b2)
}

struct Buffer<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'b, 'a: 'b> Buffer<'a> {
    fn new(b: &'a [u8]) -> Buffer {
        Buffer { buf: b, pos: 0 }
    }

    fn read_bytes(&'b mut self) -> &'a [u8] {
        self.pos += 3;
        &self.buf[self.pos - 3..self.pos]
    }
}
```
<!-- endtab -->

{% endtabs %}