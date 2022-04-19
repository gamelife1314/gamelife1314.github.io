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

### 从任何表达式借用引用

在C、C++或者其他大多数语言中，我们都是从变量获取引用，也就是 `&` 运算符后面一般都是紧跟某个变量。但是在 `Rust` 中，我们可以从任何表达式借用引用：

```rust
fn main() {
    let r = &factorial(6);
    // Arithmetic operators can see through one level of references.
    assert_eq!(r + &1009, 1729);
}

fn factorial(n: usize) -> usize {
    (1..n + 1).product()
}
```

这种情况下，`Rust` 会创建一个持有表达式值的匿名变量，然后再从匿名变量创建一个引用。匿名表达式的声明周期取决于我们怎么使用这个引用：

- 如果我们是将这个引用用在赋值语句 `let`，结构体字段或者数组中，那么这个匿名变量的生命周期和我们 `let` 语句初始化的变量一样，例如上面的 `r`；

- 否则，这个匿名变量在当前语句结束就会被释放掉，例如上面为 `1009` 创建的匿名变量在 `assert_eq!` 结束就会被丢掉；

### 胖指针

胖指针，即 `fat pointers`，指哪些不仅仅是包含了地址的指针，就像 `&[T]`，引用自 `slice` 的指针除了包含首元素的地址之外，还包括 `slice` 的数量；

另一种胖指针是 `trait` 类型。

### 引用安全性

截止到目前为止，我们看到的指针都和C中差不多，但是既然这样，我们又如何保证安全性呢，下面从几个简单的例子来说明 `Rust` 指针的安全性。

#### 引用局部变量

如果我们引用的是一个局部变量，并且我们的引用比局部变量的作用域更大，也就是局部变量释放了之后，我们的音容会如何，来看下面的示例：

{% note warning %}

```rust
fn main() {
    let r;
    {
        let x = 1;
        r = &x;
    }
    assert_eq!(*r, 1);
}
```

这段代码编译会失败的，编译器提示：我们引用的值没有引用活得久，因为 `x` 在内部的括号之后就被释放了，导致 `r`  成了一个悬垂指针：

    error[E0597]: `x` does not live long enough
    --> src/main.rs:5:13
    |
    5 |         r = &x;
    |             ^^ borrowed value does not live long enough
    6 |     }
    |     - `x` dropped here while still borrowed
    7 |     assert_eq!(*r, 1);
    |     ----------------- borrow later used here


{% endnote %}

`Rust` 编译器是如何确保每个引用都是有效的呢？ `Rust` 为每个引用都赋予了一个满足其使用范围的 **生命周期**。**生命周期** 是程序的一部分，可以被安全地用于语句，表达式或者变量。但是**声明周期**完全是`Rust`编译时虚构的。在运行时，引用只不过是一个地址；其生命周期是其类型的一部分，没有运行时表示。

在上面的例子中，有三个生命周期，变量 `x`和 `r` 的声明周期是从它们初始化到编译器认为它们不再使用为止。第三个生命周期是一个引用类型，我们引用自`x`并且存储在 `r` 中。

正如我们上面看到的，生命周期有一个很明显的约束，就是它不能比它引用的值活的久。因为如果这里 `x` 出了内部的括号，就会被释放，所有来自于它的引用都会变成一个悬垂指针，所以， `Rust` 规定 **约束1：值的声明周期必须大于它的引用的生命周期**，上面的示例中，`x`的生命周期就小于它的引用的生命周期：

![](local-r-lifetime.png)

还有另外一个约束，**约束2：如果我们将引用存储在一个变量中，那么这个引用必须要覆盖这个变量的整个生命周期，从它的初始化到最后一次使用为止**。上面示例中，`x` 引用的生命周期没有覆盖到`r`的使用范围：

![](local-x-lifetime.png)

第一个约束限制了生命周期的上限，也就是它最大是多大；第二个约束限制了它的下限，也就是它最小应该是多少；`Rust` 的编译器必须能找到一个能满足所有约束的生命周期，也就是从上限开始到下限为止。然而遗憾的是，我们的示例中，没有这样的生命周期，所以编译失败：

![](lifetime-high-and-low.png)

{% note success %}

对于我们上面的示例，稍作修改，就可以找到满足的声明周期：

```rust
fn main() {
    let r;
    {
        let x = 1;
        r = &x;
        assert_eq!(*r, 1);
    }
}
```

此时 `x` 引用的声明周期满足我们的使用：

![](lifetime-satisfy-situation.png)

{% endnote %}

#### 引用作为函数参数

