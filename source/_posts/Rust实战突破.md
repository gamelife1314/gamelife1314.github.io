---
title: Rust实战突破
date: 2021-09-05 21:08:01
tags:
    - rust基础
categories:
    - rust
---

{% cq %}Rust 是一门赋予每个人构建可靠且高效软件能力的语言。{% endcq %}

Rust 相比其他语言，具有显著的特点，尤其是：

1. 性能高；Rust 速度惊人且内存利用率极高。由于没有运行时和垃圾回收，它能够胜任对性能要求特别高的服务，可以在嵌入式设备上运行，还能轻松和其他语言集成。 

2. 高可靠；Rust 丰富的类型系统和所有权模型保证了内存安全和线程安全，让您在编译期就能够消除各种各样的错误。

3. 极具生产力；Rust 拥有出色的文档、友好的编译器和清晰的错误提示信息， 还集成了一流的工具——包管理器和构建工具， 智能地自动补全和类型检验的多编辑器支持， 以及自动格式化代码等等。

{% asset_img why-is-rust-programmng-language-so-popular-fi.png why rust so popular %}

<!-- more -->


### 从`loop`循环中返回

不同于其他语言，rust的loop循环是可以返回值的，因为loop循环是一个表达式，表达式可以求值，这样就可以作为赋值语句使用，如下示例：

```rust
fn main() {
    let mut counter = 0;

    let result = loop {
        counter += 1;

        if counter == 10 {
            break counter * 2;
        }
    };

    assert_eq!(result, 20);
}
```

### match模式匹配

rust提供`match`关键字用于模式匹配，类似于其他语言中的`switch`，不同的是`match`必须列出所有可能情况。

```rust
fn main() {
    let number = 13;

    // match 分支必须覆盖所有可能的情况
    match number {
        // 可以匹配单个值
        1 => println!("One"),
        // 可以匹配多个值
        2 | 3 | 4 | 5 => {
            println!("2 -> 5");
        }
        // 还可以匹配一个范围
        6..=10 => {
            println!("6 -> 10");
        }
        _ => println!("others"),
    }
}
```

不仅如此，`match` 还可以用于解构枚举`enum`，下面是一个复杂的例子：

```rust
enum Color {
    Rgb(i32, i32, i32),
    Hsv(i32, i32, i32),
}

// 枚举值相互嵌套
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(Color),
}

fn main() {
    let msg = Message::ChangeColor(Color::Hsv(0, 160, 255));

    match msg {
        Message::ChangeColor(Color::Rgb(r, g, b)) => {
            println!("Change the color to red {}, green {}, and blue {}", r, g, b)
        }
        Message::ChangeColor(Color::Hsv(h, s, v)) => {
            println!(
                "Change the color to hue {}, saturation {}, and value {}",
                h, s, v
            )
        }
        // 匹配剩下所有的情况
        _ => (),
    }
}
```

`match` 在匹配到第一个条件之后，不会再往下匹配：

```rust
fn main() {
    let pair = (0, 0);
    match pair {
        // 只会匹配到这里
        (0, y) => println!("First is `0` and `y` is `{:?}`", y),
        (x, 0) => println!("`x` is `{:?}` and last is `0`", x),
        _ => (),
    }
}
```

### 卫语句

`match` 模式匹配可以加上 `if`条件语句来过滤分支，提供更加灵活的匹配方式：

```rust
fn main() {
    let pair = (2, -2);
    match pair {
        (x, y) if x + y == 0 => println!("{} + {} == 0", x, y),
        (x, y) if x == y => println!("x == y"),
        (x, y) if x % y == 0 => println!("{} % {} == 0", x, y),
        _ => (),
    }
}
```

### 绑定 @ 运算符

`match` 提供了 `@` 运算符用于将值绑定到变量：

```rust
fn age() -> u32 {
    15
}

fn some_number() -> Option<u32> {
    Some(42)
}

fn main() {
    println!("Tell me type of person you are");
    match age() {
        0 => println!("I'm not born yet I guess"),
        // 可以直接 `match` 1 ..= 12，但怎么把岁数打印出来呢？
        // 相反，在 1 ..= 12 分支中绑定匹配值到 `n` 。现在年龄就可以读取了。
        n @ 1..=12 => println!("I'm a child of age {:?}", n),
        n @ 13..=19 => println!("I'm a teen of age {:?}", n),
        // 其他情况
        n => println!("I'm an old person of age {:?}", n),
    }

    // 也可以用于枚举
    match some_number() {
        Some(n @ 42) => println!("The Answer: {}!", n),
        Some(n) => println!("Not interesting... {}", n),
        _ => (),
    }
}
```

### 结构体解构

结构体解构可以非常方便地从一个结构体中提取某个字段或者全部：

```rust
fn main() {
    struct Foo {
        x: (u32, u32),
        y: u32,
    }

    // 解构结构体的成员，字段x是一个元组，分别解析到a，b；字段y解析到y
    let foo = Foo { x: (1, 2), y: 3 };
    let Foo { x: (a, b), y } = foo;
    println!("a = {}, b = {},  y = {} ", a, b, y);

    // 可以解构结构体并重命名变量，成员顺序并不重要；将y解析成i；x解析成j；
    let Foo { y: i, x: j } = foo;
    println!("i = {:?}, j = {:?}", i, j);

    // 也可以忽略某些变量，只解析y，忽略x
    let Foo { y, .. } = foo;
    println!("y = {}", y);
}
```