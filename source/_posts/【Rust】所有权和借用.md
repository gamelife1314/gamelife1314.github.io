---
title: 【Rust】所有权和借用
date: 2022-04-12 23:57:30
tags:
    - ownership
categories:
    - rust
---

在编程语言的内存使用中，我们经常遇到两个问题：什么时候释放内存以及禁止访问已释放的内存。在内存管理方式中，存在着两大阵营：

- 一种是以 `Python`，`JavaScript`， `Ruby`，`Java`， `C#`，以及 `Go` 等为代表的拥有垃圾回收器的语言，垃圾回收器在对象不再被访问时，会释放对象所持有的内存。这种方式对开发者友好，因为我们不用太多关心内存的申请和释放，但是这意味着将对象释放的权利交给了垃圾回收器，对于理解什么时候释放内存会是一个较大的挑战。

- 另一种是以 `C` 和 `C++` 为代表的语言，它们将内存的使用和回收完全交给了开发者，这造成过很多致命的问题，成悬垂指针，访问已释放内存以及多重释放等问题；

Rust旨在既安全又高效，因此这两种妥协都不能接受，但如果和解很容易，早就有人这样做了，Rust以一种独特的方式打破了僵局，限制我们程序使用指针的方式。Rust的激进做法，成了它成功的基础，即使限制足够多，但是对于任务处理依然很灵活。

<!-- more -->

### 所有权

在 `Rust` 中，所有权的概念根植于语言自身并且由编译器在编译时检查。每个值都有一个决定其生死的所有者，当这个所有者被释放（在 Rust 中，称为 `Droop`）时，他所拥有的值也会被释放。

每个变量都有一个值，当变量离开它的作用域时，就会被 `drop`，它拥有的值也会被释放。

```rust
fn print_padovan() {
    let mut padovan = vec![1, 1, 1]; // 申请内存
    for i in 3..10 {
        let next = padovan[i - 3] + padovan[i - 2];
        padovan.push(next);
    }
    println!("P(1..10) = {:?}", padovan);
    // padovan 离开作用域，值被释放
}
```

变量 `padovan` 的类型是 `Vec<i32>`，在内存中，它的值看起来像下面这样，`padovan` 的指针，容量和长度分配在函数 `print_padovan` 的栈帧上，只有 `vector` 的缓冲池是在对上分配的：

![](padovan-mem-like.png)

Rust的`Box`类型是所有权的另一个例子。`Box<T>`是存储在堆上的`T`型值的指针。调用`Box::new(v)`分配一些堆空间，将值`v`移动到其中，并返回指向堆空间的`Box`。由于`Box`拥有它指向的空间，当`Box`来开作用域时，它也会释放空间。例如：

```rust
{
    let point = Box::new((0.625, 0.5)); // point allocated here 
    let label = format!("{:?}", point); // label allocated here 
    assert_eq!(label, "(0.625, 0.5)");
}  // both dropped here
```

当程序调用`Box::new`时，它会为堆上两个`f64`值的元组分配空间，将其参数`(0.625，0.5)`移动到该空间中，并返回指向它的指针。当程序运行到`assert_eq!`时，栈帧如下图所示：


![](box-mem-like.png)


来看一个结构体的例子，结构体字段也可以是 `String`，`Array` 或者 `Vector` 等：

```rust
struct Person {
    name: String,
    birth: i32,
}

fn main() {
    let mut composers = Vec::new();
    composers.push(Person{name: "Palestrina".to_string(), birth: 1525});
    composers.push(Person{name: "Dowland".to_string(), birth: 1563});
    composers.push(Person{name: "Lully".to_string(), birth: 1632});
    for composer in &composers {
        println!("{}, born {}", composer.name, composer.birth);
    }
}
```

`composers` 的类型是 `Vec<Person>`，它在内存中的表示如下图所示：

![](composers-mem-like.png)

这里有很多所有权关系，但每个关系都非常简单：`composers`拥有一个`vector`；`vector`拥有其元素，每个元素都是`Person`结构；每个结构都拥有自己的字段；字符串字段拥有其文本。当`composers`离开作用域时，程序会释放掉所有对上内存。

{% note success %}

从上面的示例来看，每个值都有一个所有者，所有者离开作用域值被释放。为了对开发友好，`Rust` 的所有权概念有一些变通：

- 值得所有者可以进行转移；

- 简单的整数，浮点数，字符这些类型不收所有者规则约束，它们在参数传递，重新赋值时会进行拷贝，称之为 `Copy Type`；

- 标准库提供了引用计数类型 `Rc` 和 `Arc`，允许值在某些规则下可以有多个所有者；

- 可以借用值得引用，引用不改变值的所有者；

{% endnote %}


