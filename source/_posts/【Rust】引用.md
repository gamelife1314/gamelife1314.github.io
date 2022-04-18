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
如果在 `show` 函数之后，我们再想使用 `table` 变量就会报错，例如：

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

<!-- more -->

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

### 解引用

在 `Rust` 中，我们可以通过 `&` 或者 `&mut` 创建 `shared reference` 或者 `mutable reference`，在机器级别，它们就是个地址。解引用可以通过 `*` 操作符。

```rust
fn main() {
    // Back to Rust code from this point onward.
    let x =10;
    let r = &x; // &x is a shared reference to x
    assert!(*r == 10); // explicitly dereference r

    let mut y=32;
    let m = &mut y; // &mut y is a mutable reference to y
    *m += 32; // explicitly dereference m to set y's value
    assert!(*m == 64); // and to see y's new value
}
```

如果每次访问引用指向的值，都需要 `*` 操作符，在访问结构体字段的时候，不难想象，体验有点糟糕。所在，在 `Rust` 中，可以通过 **`.`** 操作符隐式地解引用它的左操作数。

```rust
fn main() {
    struct Anime {
        name: &'static str,
        bechdel_pass: bool,
    };
    let aria = Anime {
        name: "Aria: The Animation",
        bechdel_pass: true,
    };
    let anime_ref = &aria;
    assert_eq!(anime_ref.name, "Aria: The Animation");
    // Equivalent to the above, but with the dereference written out:
    assert_eq!((*anime_ref).name, "Aria: The Animation");
}
```

除此之外，**`.`** 操作符还可以隐式地从它的左操作数借用引用，因此下面两个操作使等价的：

```rust
fn main() {
    let mut v = vec![1973, 1968];
    v.sort(); // implicitly borrows a mutable reference to v
    (&mut v).sort(); // equivalent, but more verbose
}
```

### 引用更新

在 C++ 中，一旦一个引用被初始化，是不能更改其指向的。但是在 `Rust` 中是完全允许的，例如下面的代码中，一开始 `r` 借用了 `x`，后面又借用了 `y`：

```rust
fn main() {
    let x = 10;
    let y = 20;
    let mut r = &x;
    assert_eq!(*r, 10);
    r = &y;
    assert_eq!(*r, 20);
}
```

### References to References

在C语言中我们经常听到指向指针的指针，在 `Rust` 中也是允许的，如下所示，为了清晰，我们写出了每个变量的类型，实际上我们完全可以省略，由 Rust 来推断。

```rust
fn main() {
    struct Point { x: i32, y: i32 }
    let point = Point { x: 1000, y: 729 };
    let r: &Point = &point;
    let rr: &&Point = &r;
    let rrr: &&&Point = &rr;

    assert_eq!(rrr.y, 729);
}
```

然而，**`.`** 操作符可以一直向前寻找，直到找到最终的值。这些变量在内存中的分布如下图所示：

![](ref-to-ref.png)

### 引用比较

同 **`.`** 操作符一样，比较运算符也有向前连续找到最终值的功效，例如：

```rust
fn main() {
    let x = 10;
    let y = 10;
    let rx = &x;
    let ry = &y;
    let rrx = &rx;
    let rry = &ry;

    assert!(rrx <= rry);
    assert_eq!(rrx, rry);
}
```

这在大多数情况下应该是我们想要的效果，但是如果我们确实想知道两个引用它们指向的内存是否相同，我们可以使用 `std::ptr::eq`，仅仅比较地址而不是指向的值：

```rust
assert_eq!(rx, ry);
assert!(!std::ptr::eq(rx, ry));
```

但是，无论如何，比较操作符左右两侧的操作数必须要有相同的类型，例如：

```rust
assert!(rx == rrx); // error: type mismatch: `&i32` vs `&&i32` 
assert!(rx == *rrx); // this is okay
```

### 引用永不为空

`Rust` 中的引用永远不会为空。没有类似于`C`的`NULL`或`C++`的`nullptr`。引用没有默认初始值（因为任何变量在初始化之前，无论其类型如何，都不能使用），`Rust` 不会将整数转换为引用（安全代码中），因此无法将`0`转换为引用。

`C` 和 `C++` 代码中使用空指针表示没有值，例如，`malloc` 函数要么返回一个指向内存块的指针，要么返回 `null` 表示内存申请失败。

在 `Rust` 中，如果你需要用一个值表示引用某个变量的内存，或者没有，可以使用 `Option<&T>`。在机器层面，`Rust`将其表示为代表空指针的`None`或者`Some(r)`，其中`r`是`&T`值，表示为非零地址，因此`Option<&T>`与`C`或`C++`中的可空指针一样有效，但是它更安全：`Option`类型要求在使用它之前检查它是否为`None`。

