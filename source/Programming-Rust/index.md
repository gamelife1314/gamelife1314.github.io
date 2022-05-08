---
title: Programming Rust
date: 2022-05-05 09:54:08
---

本文总结 `Rust` 编程中常用到的一些资料，集中做一个索引，以便查找。

<!-- ![](assets/programing-rust.png) -->


### 《Programming Rust, 2nd Edition》

这本书是 `O'Reilly` 出版社的，个人认为还是非常透彻的，作为初学者，对本书进行了学习和记录，内容大体上没有遗漏，只是对一些描述做了精简，[出版社书籍链接](https://www.oreilly.com/library/view/programming-rust-2nd/9781492052586/)。

![](assets/programing-rust-cover.png)

这里是文档源码 [gamelife1314/gamelife1314.github.io](https://github.com/gamelife1314/gamelife1314.github.io)。

正在重新校对中，表述有误的地方请评论或者提 `pr`，`✔️` 表示已校对。

1. [《第3章-Fundamental Types》（✔️）](/2022/04/10/【Rust】基础类型/)
2. [《第4章-Ownership and Moves》（✔️）](/2022/04/12/【Rust】所有权/)
3. [《第5章-References》（✔️）](/2022/04/17/【Rust】引用/)
4. [《第6章-Expressions》（✔️）](/2022/04/20/【Rust】表达式/)
5. [《第7章-Error Handling》（✔️）](/2022/04/21/【Rust】错误处理/)
6. [《第8章-Crates and Modules》（✔️）](/2022/04/22/【Rust】Crate-和-Module/)
7. [《第9章-Structs》（✔️）](/2022/04/24/【Rust】结构体/)
8. [《第10章-Enums and Patterns》（✔️）](/2022/04/25/【Rust】枚举和模式匹配/)
9. [《第11章-Traits and Generics》（✔️）](/2022/04/26/【Rust】Trait和泛型/)
10. [《第12章-Operator Overloading》（✔️）](/2022/05/08/Rust/Rust-operator-overloading/)
11. [《第13章-Utility Traits》（✔️）](/2022/04/29/【Rust】常用-Trait/)
12. [《第14章-Closures》（✔️）](/2022/04/30/【Rust】闭包/)
13. [《第15章-Iterators》（✔️）](/2022/04/30/【Rust】迭代器/)
14. [《第16章-Collections》（✔️）](/2022/05/01/【Rust】集合类型/)
15. [《第17章-Strings and Text》（✔️）](/2022/05/01/【Rust】字符串和文本/)
16. [《第18章-Input and Output》（✔️）](/2022/05/02/【Rust】输入输出/)
17. [《第19章-Concurrency》](/2022/05/03/【Rust】并发/)
18. [《第20章-Asynchronous Programming》](/2022/05/03/【Rust】异步编程/)
19. [《第21章-Macros》](/2022/05/04/【Rust】宏/)
20. [《第22章-Unsafe Code》](/2022/05/05/【Rust】Unsafe-代码/)
21. [《第23章-Foreign Functions》](/2022/05/06/Rust/Rust-ffi/)

### 其他内容

1. [Rust 生命周期](/2021/09/14/【Rust】生命周期/)
2. [Rust 学习笔记](/2021/09/05/【Rust】实战突破/)
3. [Rustup 介绍](/2022/04/07/【Rust】Rustup%20介绍/)
4. [Rust 交叉编译](/2022/04/08/【Rust】交叉编译/)
5. [Rust 二进制文件体积减小](https://github.com/johnthagen/min-sized-rust)
6. [Rust 格式化](/2022/05/01/【Rust】字符串和文本/#格式化)
7. [Rust 正则表达式](/2022/05/01/【Rust】字符串和文本/#正则表达式)
8. [文件和目录](/2022/05/02/【Rust】输入输出/#文件和目录)

### 常用的 `crate`

1. [`thiserror`](https://crates.io/crates/thiserror)：自动派生标准库中的 `std::error::Error`；
2. [`anyhow`](https://crates.io/crates/anyhow)：提供了 `anyhow::Result<T>` 用于任何可能失败返回错误的函数；
3. [`crossbeam`](https://crates.io/crates/crossbeam)：提供很多用于并发编程的工具；
4. [`waker_fn`](https://crates.io/crates/waker-fn)：转换闭包为 `waker`；
5. [`lazy_static`](https://crates.io/crates/lazy_static)：可以用于初始化全局可变静态变量；
6. [`unicode-width`](https://crates.io/crates/unicode-width)：获取 `Unicode` 字符宽度；
7. [`enum_primitive`](https://crates.io/crates/enum_primitive)：提供宏能自动从数字转换成枚举；
8. [`serde_json`](https://crates.io/crates/serde_json)：`json` 序列化；
9. [`fnv`](https://crates.io/crates/fnv)：基于 `Fowler–Noll–Vo` 算法实现的 `HashMap`；
10. [reqwest](https://crates.io/crates/reqwest)：高级 `HTTP` 客户端；
11. [actix-web](https://crates.io/crates/actix-web)：`Web` 框架；


