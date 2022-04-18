---
title: 【Rust】引用
date: 2022-04-17 22:45:08
tags:
  - 引用
  - 《Rust 程序设计》
categories:
  - rust
---

在 Rust 中，指针按是否有所有权属性可以分为两类，例如 `Box<T>`，`String`，或者 `Vec`具有所有权属性的指针（`owning pointers`），可以说它们拥有指向的内存，当它们被删除时，指向的内存也会被被释放掉。但是，也有一种非所有权指针，叫做引用 `references`，它们的存在不会影响指向内容的声明周期。在 `Rust` 中创建引用的行为称之为对值得借用。

### 引用值

在《【Rust】所有权》章节中，我们说到函数传值会转移值得所有权，`for` 循环也会，例如，对下面的代码，我们在将 `table` 传递给 `show` 函数之后，`table` 就处于未初始化状态：

```rust
use std::collections::HashMap;
type Table = HashMap<String, Vec<String>>;

fn show(table: Table) {
    for (artist, works) in table {
        println!("works by {}:", artist); for work in works {
            println!("  {}", work);
        }
    } }


fn main() {
    let mut table = Table::new();
    table.insert("Gesualdo".to_string(),
                 vec!["many madrigals".to_string(),
                      "Tenebrae Responsoria".to_string()]);
    table.insert("Caravaggio".to_string(),
                 vec!["The Musicians".to_string(),
                      "The Calling of St. Matthew".to_string()]);
    table.insert("Cellini".to_string(),
                 vec!["Perseus with the head of Medusa".to_string(),
                      "a salt cellar".to_string()]);
    show(table);
}
```

{% note warning %}
但是如果在 `show` 函数之后，我们再想使用 `table` 变量就会报错，例如：

```rust
...
show(table);
assert_eq!(table["Gesualdo"][0], "many madrigals");
```

`Rust` 编译器提示变量 `table` 已经不可用，`show` 函数的调用已经转移 `table` 的所有权：

    error[E0382]: borrow of moved value: `table`
    --> src/main.rs:24:16
    |
    13 |     let mut table = Table::new();
    |         --------- move occurs because `table` has type `HashMap<String, Vec<String>>`, which does not implement the `Copy` trait
    ...
    23 |     show(table);
    |          ----- value moved here
    24 |     assert_eq!(table["Gesualdo"][0], "many madrigals");
    |                ^^^^^ value borrowed here after move

{% endnote %}

正确处理这个问题的方法是使用引用，使用引用不会改变值得所有者，引用有两种类型：

- `shared reference`：可以读引用的值，但不能改变它。而且同时可以有多个`shared reference`。表达式 `&e` 会生成 `e` 的`shared reference`。如果 `e` 的类型是 `T`，那么 `&e` 的类型是 `&T`，读作 `ref T`，**`shared reference`是可以复制的**；

- `mutable reference`：可读可写所引用的值，但是不能拥有其他任何 `shared reference` 或者 `mutable reference`。表达式 `&mut e` 生成 `e` 的 `mutable reference`。如果 `e` 的类型是 `T`，那么 `&mut e` 的类型是 `&mut T`，读作 `ref mute T`。 **`mutable reference`是不可以复制的**；

因此，我们可以对上面的 `show` 函数作如下修改，就可以使得代码编译通过。在 `show` 函数中，`table` 的类型是 `&Table`，那么 `artist` 和 `works` 的类型就是 `&String` 和 `&Vec<String>`，内部的 `for` 循环中 `work` 的类型也就变成了 `&String`。

```rust
use std::collections::HashMap;
type Table = HashMap<String, Vec<String>>;

fn show(table: &Table) {
    for (artist, works) in table {
        println!("works by {}:", artist);
        for work in works {
            println!("  {}", work);
        }
    }
}

fn main() {
    let mut table = Table::new();
    table.insert(
        "Gesualdo".to_string(),
        vec![
            "many madrigals".to_string(),
            "Tenebrae Responsoria".to_string(),
        ],
    );
    table.insert(
        "Caravaggio".to_string(),
        vec![
            "The Musicians".to_string(),
            "The Calling of St. Matthew".to_string(),
        ],
    );
    table.insert(
        "Cellini".to_string(),
        vec![
            "Perseus with the head of Medusa".to_string(),
            "a salt cellar".to_string(),
        ],
    );
    show(&table);
    assert_eq!(table["Gesualdo"][0], "many madrigals");
}
```

现在，如果我们 `table` 中的值进行排序，`shared reference` 肯定不能满足要求，因为它不允许改变值，所以我们需要一个 `mutable reference`。可变借用使得 `sort_works` 有能力读和修改 `works`。

```rust
fn sort_works(table: &mut Table) {
    for (_artist, works) in table {
        works.sort();
    }
}


fn main() {
    ...
    sort_works(&mut table);
    ...
}
```

当我们将一个值传递给函数时，可以说是将值的所有权转移给了函数，称之为按值传参。但是，如果我们将引用传给函数，我们可以称之位按引用传参，它没有改变值的所有权，只是借用了值。
