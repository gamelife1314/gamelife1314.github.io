---
title: Rust实战突破
date: 2021-09-05 21:08:01
tags:
    - rust基础
categories:
    - rust
---

{% cq %}`Rust` 是一门赋予每个人构建可靠且高效软件能力的语言。{% endcq %}

`Rust` 相比其他语言，具有显著的特点，尤其是：

1. 性能高；`Rust` 速度惊人且内存利用率极高。由于没有运行时和垃圾回收，它能够胜任对性能要求特别高的服务，可以在嵌入式设备上运行，还能轻松和其他语言集成。 

2. 高可靠；`Rust` 丰富的类型系统和所有权模型保证了内存安全和线程安全，让您在编译期就能够消除各种各样的错误。

3. 极具生产力；`Rust` 拥有出色的文档、友好的编译器和清晰的错误提示信息， 还集成了一流的工具——包管理器和构建工具， 智能地自动补全和类型检验的多编辑器支持， 以及自动格式化代码等等。

{% asset_img why-is-rust-programmng-language-so-popular-fi.png why rust so popular %}

<!-- more -->

### 表达式

#### `loop`

不同于其他语言，`rust` 的 `loop` 循环是可以返回值的，因为 `loop` 循环是一个表达式，表达式可以求值，这样就可以作为赋值语句使用，如下示例：

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

#### `if let`

由于 `match` 模式匹配必须要指出所有的可能性，所以在使用上不是很优雅，因此有了 `if let`，可以说它是 `match` 的语法糖，可以按需只匹配自己想要的。

```rust
fn main() {
    let number = Some(5);
    if let Some(value) = number {
        println!("value is {}", value);
    }

    // rust 中的 None 值
    let none: Option<i32> = None;
    if let Some(n) = none {
        println!("value is {}", n);
    } else {
        println!("value is none");
    }
}
```


#### while let

同 `if let` 类似，`while let` 可以简化代码的书写方式，使得呈现上更加优雅。

{% tabs loop and while let, 2 %}

<!-- tab loop match -->

```rust
fn main() {
    let mut number = Some(0);
    loop {
        match number {
            Some(value) => {
                if value > 9 {
                    number = None;
                } else {
                    number = Some(value + 1);
                    println!("number is {:?}", number);
                }
            }
            None => break,
        }
    }
    println!("number is none: {}", number.is_none());
}
```

<!-- endtab -->

<!-- tab while let -->

```rust
fn main() {
    let mut number = Some(0);
    while let Some(value) = number {
        if value > 9 {
            number = None;
        } else {
            number = Some(value + 1);
            println!("number is {:?}", number);
        }
    }
    println!("number is none: {}", number.is_none());
}
```

<!-- endtab -->

{% endtabs %}

### 零类型

`rust` 中某些类型的是不占用任何内存的，享受 `rust` 为他们提供的优化，我们可以用标准库提供的 `std::mem::size_of_val` 函数进行测量。

```rust
#![allow(unused)]

enum Color {
    R(i16),
    G(i16),
    B(i16),
}
// 该枚举等价于，所以他们可以被当做函数使用
// fn Color::R(c: i16) -> Color { /* ... */ }
// fn Color::G(c: i16) -> Color { /* ... */ }
// fn Color::B(c: i16) -> Color { /* ... */ }

fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    // 同样一个函数，我们再赋值给一个变量时，在指定函数指针类型时，占用8个字节
    // 不指定时，为函数项类型，占用0字节，函数项类型在必要时可以自动转化为函数指针类型
    let add = add;
    let add_ptr: fn(i32, i32) -> i32 = add;
    println!("add size: {}", std::mem::size_of_val(&add)); // 0
    println!("add_ptr size: {}", std::mem::size_of_val(&add_ptr)); // 8

    // 枚举项占用的大小也是0
    println!("Color::B size: {}", std::mem::size_of_val(&Color::B)); // 0
}
```


### match

`rust`提供`match`关键字用于模式匹配，类似于其他语言中的`switch`，不同的是`match`必须列出所有可能情况。

#### 示例

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

#### 卫语句

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

#### @ 绑定

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

#### 解构

解构可以非常方便地从一个结构体或者元组中提取某个字段或者全部：

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

#### 指针和引用

对指针来说，解构（`destructure`）和解引用（`dereference`）要区分开，因为这两者的概念 是不同的，和 C 那样的语言用法不一样。

- 解引用使用 `*`
- 解构使用 `&`、`ref`、和 `ref mut`

```rust
fn main() {
    // 获得一个 `i32` 类型的引用。`&` 表示取引用。
    let reference = &4;

    match reference {
        // 如果用 `&val` 这个模式去匹配 `reference`，就相当于做这样的比较：
        // `&i32`（译注：即 `reference` 的类型）
        //    |
        // `&val`（译注：即用于匹配的模式）
        // ^ 我们看到，如果去掉匹配的 `&`，`i32` 应当赋给 `val`。
        // 译注：因此可用 `val` 表示被 `reference` 引用的值 4。
        &val => println!("Got a value via destructuring: {:?}", val),
    }

    // 如果不想用 `&`，需要在匹配前解引用。
    match *reference {
        val => println!("Got a value via dereferencing: {:?}", val),
    }

    // 如果一开始就不用引用，会怎样？ `reference` 是一个 `&` 类型，因为赋值语句
    // 的右边已经是一个引用。但下面这个不是引用，因为右边不是。
    let _not_a_reference = 3;

    // Rust 对这种情况提供了 `ref`。它更改了赋值行为，从而可以对具体值创建引用。
    // 下面这行将得到一个引用。
    let ref _is_a_reference = 3;

    // 相应地，定义两个非引用的变量，通过 `ref` 和 `ref mut` 仍可取得其引用。
    let value = 5;
    let mut mut_value = 6;

    // 使用 `ref` 关键字来创建引用。
    // 译注：下面的 r 是 `&i32` 类型，它像 `i32` 一样可以直接打印，因此用法上
    // 似乎看不出什么区别。但读者可以把 `println!` 中的 `r` 改成 `*r`，仍然能
    // 正常运行。前面例子中的 `println!` 里就不能是 `*val`，因为不能对整数解
    // 引用。
    match value {
        ref r => println!("Got a reference to a value: {:?}", r),
    }

    // 类似地使用 `ref mut`。
    match mut_value {
        ref mut m => {
            // 已经获得了 `mut_value` 的引用，先要解引用，才能改变它的值。
            *m += 10;
            println!("We added 10. `mut_value`: {:?}", m);
        }
    }
}
```

`&` 和 `ref` 都表示获取引用，只是一个出现在表达式左边一个出现在右边，当 `&` 出现在右边的时候等价于 `ref` 出现在左边，`&` 出现在左边的时候等价于 `*` 出现在右边：

```rust
#![feature(core_intrinsics)]

fn main() {
    let x = &false;
    print_type_name_of(x);

    let &x = &false;
    print_type_name_of(x);

    let ref x = &false;
    print_type_name_of(x);

    let ref x = 1;
    let x = &1;
    let &y = x;
    let y = *x;
    print_type_name_of(x);
    print_type_name_of(y);
}

fn print_type_name_of<T>(_: T) {
    println!("{}", unsafe { std::intrinsics::type_name::<T>() })
}
```

输出：
```
&bool
bool
&&bool
&i32
i32
```

参考：[https://users.rust-lang.org/t/ref-keyword-versus/18818/2](https://users.rust-lang.org/t/ref-keyword-versus/18818/2)

### 方法

方法通常用于和函数对比，和函数的区别是方法附着于对象，方法分为静态方法和实例方法，静态方法常用语构造对象，实例方法中通过关键字 `self` 来引用对象中的数据。


{% tabs 静态方法和实例方法 %}

<!-- tab 静态方法 -->

```rust
#![allow(unused)]

#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

impl Point {
    // 静态方法，返回原点
    fn origin() -> Point {
        Point { x: 0, y: 0 }
    }

    // 根据指定坐标构造
    fn new(x: i32, y: i32) -> Point {
        Point { x, y }
    }
}

fn main() {
    let origin = Point::origin();
    let other = Point::new(1, 2);
}
```
<!-- endtab -->

<!-- tab 实例方法 -->
```rust
#![allow(unused)]

#[derive(Debug)]
struct Rectangle {
    width: i32,
    height: i32,
}

impl Rectangle {
    // &self 其实是 self: &Self 的语法糖，表示不可变引用
    fn area(&self) -> i32 {
        self.height * self.width
    }

    // &mut self 其实是 self: &mut Self, 表示可变引用
    fn plus_one(&mut self) {
        self.width += 1;
        self.height += 1;
    }

    // self 直接将所有权转移
    fn transfer(self) -> Rectangle {
        self
    }
}

fn main() {
    let mut rec = Rectangle {
        width: 1,
        height: 1,
    };
    println!("rectangle {:?}, area is: {}", rec, rec.area());

    rec.plus_one();
    println!("rectangle {:?}, area is: {}", rec, rec.area());

    let rec1 = rec.transfer();
    // rec; // 编译失败，rec 的所有权已经转移至 rec1
}
```
<!-- endtab -->

{% endtabs %}

### 闭包

闭包是函数式编程中不可获取的一员，`rust` 对此也提供了支持，也叫 `lambda`，能够捕获环境中的变量，例如：

> `|val| val + x`

#### 简单示例 

这种超级简便的语法使得它在临时使用时非常方便，输入和返回值类型都可以自行推导，但是必须指定输入参数名称。在声明参数是，同函数不同，它是使用 `||` 而不是 `()` 将参数包裹起来；另外们对于单个表达式的闭包，`{}` 是可以省略的。

```rust
fn main() {
    let (a, b) = (32, 32);
    // 捕获变量 b
    let plus_b_closure = |input| input + b;
    let plus_one = |x| x + 1;
    fn plus_b_fn(input: i32, b: i32) -> i32 {
        input + b
    }
    println!("a + b = {}", plus_b_closure(a));
    println!("a + b = {}", plus_b_fn(a, b));
    println!("a + 1 = {}", plus_one(a));
    println!("a + 1 = {}", plus_one(a));
}
```

#### 捕获变量

闭包会自动满足函数功能的要求，使得闭包不需要类型说明就可以工作。这允许变量捕获（`capture`）灵活地适应使用场合，既可移动（`move`）又可借用（`borrow`）变量。闭包可以通过：`引用 &T`， `可变引用 &mut T`，`值 T`  自动捕获变量，也可以通过 `move` 强制获得变量的所有权：

```rust
fn main() {
    use std::mem;

    let color = "green";
    // 这个闭包打印 `color`。它会立即借用（通过引用，`&`）`color` 并将该借用和
    // 闭包本身存储到 `print` 变量中。`color` 会一直保持被借用状态直到 `print` 离开作用域。
    let print = || println!("`color`: {}", color);
    print();
    print();

    let mut count = 0;
    // 这个闭包使 `count` 值增加。要做到这点，它需要得到 `&mut count` 或者
    // `count` 本身。`inc` 前面需要加上 `mut`，因为闭包里存储着一个 `&mut` 变量。
    // 调用闭包时，该变量的变化就意味着闭包内部发生了变化。因此闭包需要是可变的。
    let mut inc = || {
        count += 1;
        println!("`count`: {}", count);
    };
    inc();
    inc();
    // 不能再次获得 count 的可变引用，因为前面的闭包中已经借用一次了
    // let reborrow = &mut count;
    // reborrow += 1;

    // 不可复制类型（non-copy type）。
    let movable = Box::new(3);
    // `mem::drop` 要求 `T` 类型本身，所以闭包将会捕获变量的值。这种情况下，
    // 可复制类型将会复制给闭包，从而原始值不受影响。不可复制类型必须移动
    // （move）到闭包中，因而 `movable` 变量在这里立即移动到了闭包中。
    let consume = || {
        println!("`movable`: {:?}", movable);
        mem::drop(movable);
    };
    // `consume` 消耗了该变量，所以该闭包只能调用一次。
    consume();
    // consume();

    // 通过 move 关键字强制将 numbers 的所有权移动到闭包中
    let numbers = vec![1, 2, 3];
    let contains = move |needle| numbers.contains(needle);
    println!("numbers include 1 ? {}", contains(&1));
    println!("numbers include 4 ? {}", contains(&5));
    // 由于 numbers 的所有权已经被移入 contains 中，所以这里不能再使用
    // println!("numbers length is {}", numbers.len());
}
```

#### 作为入参

虽然闭包可以自动做类型推断，但是在编写函数以闭包作为参数时，还是得必须明确指定类型，可以通过以下三个之一来指定闭包捕获变量的类型，他们的受限程度依次递减：

- `Fn`：表示捕获方式为通过引用（`&T`）的闭包
- `FnMut`：表示捕获方式为通过可变引用（`&mut T`）的闭包
- `FnOnce`：表示捕获方式为通过值（`T`）的闭包

```rust
fn plus_one<T>(mut f: T)
where
    T: FnMut(),
{
    println!("execute plus one");
    f();
}

// 该函数将闭包作为参数并调用它。
fn apply<F>(f: F)
where
    // 闭包没有输入值和返回值。
    F: FnOnce(),
{
    f();
}

fn main() {
    let mut number = 1;
    plus_one(|| number += 1);
    println!("number is {}", number);

    use std::mem;

    let greeting = "hello";
    // 不可复制的类型。`to_owned` 从借用的数据创建有所有权的数据。
    let mut farewell = "goodbye".to_owned();

    // 捕获 2 个变量：通过引用捕获 `greeting`，通过值捕获 `farewell`。
    let diary = || {
        // `greeting` 通过引用捕获，故需要闭包是 `Fn`。
        println!("I said {}.", greeting);

        // 下文改变了 `farewell` ，因而要求闭包通过可变引用来捕获它。
        // 现在需要 `FnMut`。
        farewell.push_str("!!!");
        println!("Then I screamed {}.", farewell);

        // 手动调用 drop 又要求闭包通过值获取 `farewell`。
        // 现在需要 `FnOnce`。
        mem::drop(farewell);
    };

    // 以闭包作为参数，调用函数 `apply`。
    apply(diary);
}
```

#### 作为返回值

闭包可以作为输入参数，也可以作为返回值返回，由于闭包的类型是未知的，所以只有使用 `impl Trait` 才能返回一个闭包。除此之外，还必须使用 `move` 关键字，它表明所有的捕获都是通过值进行的。因为在函数退出时，任何通过引用的捕获都被丢弃，在闭包中留下无效的引用。

```rust
fn create_fn() -> impl Fn() {
    let text = "Fn".to_owned();

    move || println!("This is a: {}", text)
}

fn create_fnmut() -> impl FnMut() {
    let text = "FnMut".to_owned();

    move || println!("This is a: {}", text)
}

fn create_fnonce() -> impl FnOnce() {
    let text = "FnOnce".to_owned();
    move || println!("This is a: {}", text)
}

fn main() {
    let fn_plain = create_fn();
    let mut fn_mut = create_fnmut();
    let fn_once = create_fnonce();

    fn_plain();
    fn_mut();
    fn_once();
}
```

#### 函数指针

通过函数指针允许我们使用函数作为另一个函数的参数，函数的类型是 `fn`，注意和 `Fn` 区分，后者是闭包实现的 `trait` 类型，`fn` 被称为函数指针。 函数指针实现了**所有三个闭包** `trait`（`Fn`、`FnMut` 和 `FnOnce`），所以总是可以在调用期望闭包的函数时传递函数指针作为参数。倾向于编写使用泛型和闭包 `trait` 的函数，这样它就能接受函数或闭包作为参数。`Fn` 系列 `trait` 由标准库提供，**所有的闭包都实现了 `trait` `Fn`、`FnMut` 或 `FnOnce` 中的一个**，所以闭包和函数可以自动互相转换。

{% tabs 函数和闭包作为参数 %}

<!-- tab 闭包作为参数 -->

```rust
#![allow(unused)]
fn main() {
    let list_of_numbers = vec![1, 2, 3];
    let list_of_strings: Vec<String> = list_of_numbers.iter().map(|i| i.to_string()).collect();
    println!("{:?}", list_of_strings);
}
```
<!-- endtab -->

<!-- tab 函数作为参数 -->
```rust
#![allow(unused)]
fn main() {
    let list_of_numbers = vec![1, 2, 3];
    let list_of_strings: Vec<String> = list_of_numbers.iter().map(ToString::to_string).collect();
    println!("{:?}", list_of_strings);
}
```
<!-- endtab -->

<!-- tab 元组结构体，枚举项作为参数 -->
在构造元组结构体时使用 `()` 语法进行初始化，很像是函数调用，实际上它们确实被实现为返回由参数构造的实例的函数，所以它们也被称为实现了闭包 `trait` 的函数指针。

```rust
#![allow(unused)]

#[derive(Debug)]
enum Status {
    Value(u32),
    Stop,
}

#[derive(Debug)]
struct State(u32);

fn main() {
    let list_of_statuses: Vec<Status> = (0u32..5).map(Status::Value).collect();
    println!("{:?}", list_of_statuses);
    
    let list_of_statuses: Vec<State> = (0u32..5).map(State).collect();
    println!("{:?}", list_of_statuses);
}
```
<!-- endtab -->

<!-- tab 闭包和函数指针相互转换 -->

```rust
#![allow(unused)]

#[derive(Debug)]
struct RGB(i32, i32, i32);

fn color(s: &str) -> RGB {
    RGB(1, 1, 1)
}

fn show(f: fn(s: &str) -> RGB) {
    println!("color is {:?}", f(""));
}

fn show_with_trait<T: Fn(&str) -> RGB>(f: T) {
    println!("show color with trait is {:?}", f(""));
}

fn main() {
    let c = |s: &str| RGB(2, 2, 2);

    // 闭包和函数自动转换为函数指针
    show(c);
    show(color);

    // 闭包和函数都实现了 Fn trait
    show_with_trait(c);
    show_with_trait(color);
}
```
<!-- endtab -->

{% endtabs %}

### Trait

`trait` 用于定义共享的行为，`trait` 告诉 `Rust` 编译器某个特定类型拥有可能与其他类型共享的功能。可以通过 `trait` 以一种抽象的方式定义共享的行为，可以使用 `trait bounds` 指定泛型是任何拥有特定行为的类型。`trait` 定义是一种将方法签名组合起来的方法，目的是定义一个实现某些目的所必需的行为的集合，这里定义的方法可以只是签名说明而没有函数体。

```rust

pub trait Summary {
    fn summarize(&self) -> String;
}

```

#### 默认类型和关联参数

`rust` 官方提供了一个 `use std::ops::Add;`，可以用于重载 `+` 运算符，定义如下：

```rust
trait Add<RHS=Self> {
    type Output;
    fn add(self, rhs: RHS) -> Self::Output;
}
```

这里的 `Output` 被称作关联类型，用来决定 `add` 的返回值类型，在具体实现的时候指定具体类型。这里的 `RHS=Self` 语法表示：**默认类型参数**，`RHS` 是 `right hand side` 的缩写，用于定义 `add` 方法中的 `rhs` 参数。如果实现 `Add trait` 时不指定 `RHS` 的具体类型，`RHS` 的类型将是默认的 `Self` 类型，也就是在其上实现 `Add` 的类型。

```rust
use std::ops::Add;

#[derive(Debug, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

impl Add for Point {
    // 关联类型 Output 指定为 Point
    type Output = Point;

    fn add(self, other: Point) -> Point {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

#[derive(PartialEq, Debug)]
struct Millimeters(u32);
struct Meters(u32);

// RHS 默认类型参数指定为：Meters
impl Add<Meters> for Millimeters {
    // 关联类型 Output 指定为 Millimeters，指定 add 方法返回值类型
    type Output = Millimeters;

    fn add(self, other: Meters) -> Millimeters {
        Millimeters(self.0 + (other.0 * 1000))
    }
}

fn main() {
    assert_eq!(
        Point { x: 1, y: 0 } + Point { x: 2, y: 3 },
        Point { x: 3, y: 3 }
    );

    let meter = Meters(1);
    let millimeters = Millimeters(1);
    assert_eq!(Millimeters(1001), millimeters + meter);
}
```

#### 完全限定语法

`Rust` 既不能避免一个 `trait` 与另一个 `trait` 拥有相同名称的方法，也不能阻止为同一类型同时实现这两个 `trait`。甚至直接在类型上实现开始已经有的同名方法也是可能的。下面的示例中通过在方法名称前面添加 `trait` 限定符，我们向 `rust` 指定我们需要哪个实现。

```rust
#![allow(unused)]

trait Pilot {
    fn fly(&self);
}

trait Wizard {
    fn fly(&self);
}

struct Human;

impl Pilot for Human {
    fn fly(&self) {
        println!("This is your captain speaking.");
    }
}

impl Wizard for Human {
    fn fly(&self) {
        println!("Up!");
    }
}

impl Human {
    fn fly(&self) {
        println!("*waving arms furiously*");
    }
}

fn main() {
    let person = Human;
    person.fly();         // 直接调用 Human 的方法
    Pilot::fly(&person);  // 调用 Human 为 Pilot 的 fly 实现
    Wizard::fly(&person); // 调用 Human 为 Wizard 的 fly 实现
}

```

像上面这种 `fly` 方法有一个 `self` 参数，即使有多个类型实现同一 `trait`，在使用 `Trait::method(self)`时，`rust` 可以根据 `self` 类型帮我们定位具体哪个类型的实现。然而，当遇到关联函数，即第一个参数不是 `self` 时，`rust` 就不能帮我们计算出该使用哪个类型了。下面的示例中使用完全限定语法消除歧义，该语法为：

> `<Type as Trait>::function(receiver_if_method, next_arg, ...);`
> 
>  关联函数没有 `receiver`

```rust
#![allow(unused)]

trait Animal {
    fn baby_name() -> String;
}

struct Dog;

impl Dog {
    fn baby_name() -> String {
        String::from("Spot")
    }
}

impl Animal for Dog {
    fn baby_name() -> String {
        String::from("puppy")
    }
}

fn main() {
    // Dog 类型的实现
    println!("A baby dog is called a {}", Dog::baby_name());
    // Dog 类型为 Animal trait 的实现
    println!("A baby dog is called a {}", <Dog as Animal>::baby_name());
}
```

#### 自定义实现

实现 `trait` 时需要注意的一个限制是，只有当 `trait` 或者要实现 `trait` 的类型位于 `crate` 的本地作用域时，才能为该类型实现 `trait`，这个限制是被称为`相干性（coherence）` 的程序属性的一部分，或者更具体的说是`孤儿规则（orphan rule）`。这条规则确保了其他人编写的代码不会破坏你代码，反之亦然。没有这条规则的话，两个`crate`可以分别对相同类型实现相同的`trait`，而`Rust`将无从得知应该使用哪一个实现。

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    content: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        self.content.clone()
    }
}

fn main() {
    let article = Article {
        content: "hello".to_string(),
    };
    println!("{}", article.summarize())
}
```

#### 默认实现

默认实现指我们在定义 `trait` 方法时提供默认的实现行为，在为类型实现`trait`时，就可以不用再去实现它的方法了。默认实现的`trait`方法中还允许我们调用相同`trait`的其他方法，即使他们没有实现。

```rust
trait Summary {
    fn author(&self) -> String;

    fn summarize(&self) -> String {
        format!("author is {}", self.author())
    }
}

struct Article {
    content: String,
    author: String,
}

impl Summary for Article {
    fn author(&self) -> String {
        self.author.clone()
    }
}

fn main() {
    let article = Article {
        content: "hello".to_string(),
        author: "michael".to_owned(),
    };
    println!("{}", article.summarize())
}
```

#### 作为参数

我们可以将函数参数定义为实现了某个`trait`的类型，这样我们不用于去关心`trait`背后的具体类型，只在乎这些类型的行为。实现这一目标以多种不同的语法方式，它们是等价的，只是表现形式不同。

{% tabs trait作为参数 %}

<!-- tab impl -->
如下，我们定义 `notify` 函数，指定 `item` 参数为实现了 `Summary` 的一个类型。

```rust
trait Summary {
    fn author(&self) -> String;

    fn summarize(&self) -> String {
        format!("author is {}", self.author())
    }
}

fn notify(item: impl Summary) {
    println!("notify: {}", item.summarize())
}

```
<!-- endtab -->

<!-- tab trait bound  -->

`impl` 看起来比较直观，它实际上是一个较长形式的语法糖，称之为 `trait bound`，所以前面的 `impl Summary` 等价于如下的形式：

```rust
fn notify(item: impl Summary) {
    println!("notify: {}", item.summarize())
}

fn notify_bound<T: Summary>(item: T) {
    println!("notify: {}", item.summarize())
}
```

`impl` 形式在参数较少时比较方便，在参数较多时就看起来比较冗余，使用 `trait bound` 看起来就比较方便：

```rust
fn notify_para2(item1: impl Summary, item2: impl Summary) {
    println!(
        "notify1: {}, notify2: {}",
        item1.summarize(),
        item2.summarize()
    )
}

fn notify_para2_bound<T: Summary>(item1: T, item2: T) {
    println!(
        "notify1: {}, notify2: {}",
        item1.summarize(),
        item2.summarize()
    )
}
```
<!-- endtab -->

<!-- tab 多个 trait bound -->

`trait bound` 可以理解为将 `trait` 绑定到某个泛型上，当需要将参数声明为实现了多个`trait`的类型时，可以使用 `+` ：

```rust
fn notify_two_trait(item: impl Summary + Display) {
    println!("{}", item)
}

fn notify_two_trait_bound<T: Summary + Display>(item: T) {
    println!("{}", item)
}
```

使用过多的 `trait bound` 也有缺点。每个泛型有其自己的 `trait bound`，所以有多个泛型参数的函数在名称和参数列表之间会有很长的 `trait bound` 信息，这使得函数签名难以阅读。为此，`Rust` 有另一个在函数签名之后的 **`where`** 从句中指定 `trait bound` 的语法。

```rust
fn notify_complex<T: Summary + Display, U: Debug + Copy>(item1: T, item2: U) {
    println!("item1: {}, item2: {:?}", item1, item2)
}

fn notify_complex_where<T, U>(item1: T, item2: U)
where
    T: Summary + Display,
    U: Debug + Copy,
{
    println!("item1: {}, item2: {:?}", item1, item2)
}
```

<!-- endtab -->

{% endtabs %}

#### 作为返回值

我们可以将函数的返回值定义为实现了某个trait的类型，例如我们指定 `returns_summarizable` 函数返回实现了 `Summary` 的类型：

```rust
#![allow(unused)]

use std::fmt::{Debug, Display};

trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    content: String,
    author: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        self.content.clone()
    }
}

struct Tweet {
    content: String,
    author: String,
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        self.content.clone()
    }
}

fn returns_summarizable() -> impl Summary {
    Tweet {
        content: String::from("of course, as you probably already know, people"),
        author: "michael".to_string(),
    }
}

fn main() {
    let tweet = returns_summarizable();
    println!("{}", tweet.summarize());
}
```

但是如果我们想从一个函数中返回多种实现了同一`trait`的类型，就不可以了，如下面这段代码就{% label danger@不能通过编译 %}，因为`rust`需要在编译时期就确定函数返回值的大小。返回不同的类型，意味着函数的返回值大小是不确定的，这对于 `rust` 来说是{% label danger@不允许 %}的。

```rust
fn try_return_multiple_types(switch: bool) -> impl Summary {
    if switch {
        Tweet {
            content: String::from("of course, as you probably already know, people"),
            author: "michael".to_string(),
        }
    } else {
        Article {
            content: String::from("of course, as you probably already know, people"),
            author: "michael".to_string(),
        }
    }
}
```

如果我们确实想这样做，我们可以使用 `Box<T>` 类型，这个类型将数据实际存储在堆上，保留该数据的指针，所以其大小是固定的，这样就实现了动态分发：

```rust
fn try_return_multiple_types(switch: bool) -> Box<dyn Summary> {
    if switch {
        Box::new(Tweet {
            content: String::from("of course, as you probably already know, people"),
            author: "michael".to_string(),
        })
    } else {
        Box::new(Article {
            content: String::from("of course, as you probably already know, people"),
            author: "michael".to_string(),
        })
    }
}
```

#### 有条件地实现方法

有时候我们在为某一个泛型结构体实现方法的时候，首先需要它的类型实现某些`trait`。如下示例中，类型 `Pair<T>` 总是实现了 `new` 方法，不过只有那些为 `T` 类型实现了 `PartialOrd trait` （来允许比较） 和 `Display trait` （来启用打印）的 `Pair<T>` 才会实现 `cmp_display` 方法：

```rust
#![allow(unused)]

use std::fmt::Display;

struct Pair<T> {
    x: T,
    y: T,
}

impl<T> Pair<T> {
    fn new(x: T, y: T) -> Self {
        Self { x, y }
    }
}

impl<T: Display + PartialOrd> Pair<T> {
    fn cmp_display(&self) {
        if self.x >= self.y {
            println!("The largest member is x = {}", self.x);
        } else {
            println!("The largest member is y = {}", self.y);
        }
    }
}

fn main() {
    let pair = Pair { x: 1, y: 0 };
    pair.cmp_display();
}
```

也可以对任何实现了特定 `trait` 的类型有条件地实现 `trait`。对任何满足特定 `trait bound` 的类型实现 `trait` 被称为 `blanket implementations`，他们被广泛的用于 `Rust` 标准库中。例如，标准库为任何实现了 `Display trait` 的类型实现了 `ToString trait`。这个 `impl` 块看起来像这样：

```rust
impl<T: Display> ToString for T {
    // --snip--
}
```

所以可以对任何实现了 `Display trait` 的类型调用由 `ToString` 定义的 `to_string` 方法。

> `let s = 3.to_string();`


#### 父 trait

在前面的例子中，我们演示过可以在 `trait` 的默认实现中使用相同`trait`的其他方法，即使该方法未实现。但是，我们有时也需要在当前`trait`中使用其他`trait`中的功能，这就形成了 `trait` 依赖，被依赖的`trait`的我们称之为当前`trait`的 **`父trait`**。

下面的例子中，`OutlinePrint` 在定义的默认方法 `outline_print` 调用了 `fmt::Display` 中的 `to_string` 方法：

```rust
#![allow(unused)]

use std::fmt;

trait OutlinePrint: fmt::Display {
    fn outline_print(&self) {
        let output = self.to_string();
        let len = output.len();
        println!("{}", "*".repeat(len + 4));
        println!("*{}*", " ".repeat(len + 2));
        println!("* {} *", output);
        println!("*{}*", " ".repeat(len + 2));
        println!("{}", "*".repeat(len + 4));
    }
}

struct Point {
    x: i32,
    y: i32,
}

impl OutlinePrint for Point {}

impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

fn main() {
    let point = Point { x: 1, y: 2 };
    point.outline_print();
}
```

#### Copy 和 Clone

`Copy` 和 `Clone` 直接从字面意义上感觉没什么区别，它们最终都是产生了一个新的对象，但是这两个 `trait` 面向的对象不同，`Copy` 面向编译器，而 `Clone` 面向开发者。换句话说就是`copy`操作编译器帮我们做了，但是 `clone` 需要我们自己手动调用。

参考文章：

1. [`https://stackoverflow.com/questions/31012923/what-is-the-difference-between-copy-and-clone?answertab=active#tab-top`](https://stackoverflow.com/questions/31012923/what-is-the-difference-between-copy-and-clone?answertab=active#tab-top)
2. [`https://doc.rust-lang.org/std/marker/trait.Copy.html#whats-the-difference-between-copy-and-clone`](https://doc.rust-lang.org/std/marker/trait.Copy.html#whats-the-difference-between-copy-and-clone)
3. [`https://zhuanlan.zhihu.com/p/21730929`](https://zhuanlan.zhihu.com/p/21730929)
4. [`https://hashrust.com/blog/moves-copies-and-clones-in-rust/`](`https://hashrust.com/blog/moves-copies-and-clones-in-rust/ `)

##### Copy

`Copy` 的全称是 [`std::marker::Copy`](https://doc.rust-lang.org/std/clone/trait.Clone.html)，它的内部其实什么方法都没有，但是实现它必须实现 `Clone`。一旦一个类型实现 `Copy` 意味着在任何需要的时候，我们可以简单的通过内存拷贝（C语言的按位拷贝`memcpy`）实现该类型的复制，而不会出现任何问题。在变量绑定、函数参数传递、函数返回值传递等场景下，它都是 `copy` 语义，而不再是默认的 `move` 语义

> `pub trait Copy: Clone { }`

{% tabs Copy对所有权移动的影响 %}

<!-- tab 实现 Copy -->

`i32` 实现了 `Copy`，所以我们在使用 `let` 表达式的时候，其实是复制而不是所有权转移。

实现 `Copy` 的基本类型： [https://doc.rust-lang.org/std/marker/trait.Copy.html#implementors](https://doc.rust-lang.org/std/marker/trait.Copy.html#implementors)

```rust
fn main() {
    let a = 3;
    let b = a;
    println!("{} {}", a, b);
}
```
<!-- endtab -->

<!-- tab 未实现Copy -->

[`String` 没有实现 `Copy`](https://doc.rust-lang.org/std/marker/trait.Copy.html#when-cant-my-type-be-copy)，所以它在使用 `let` 表达式的时候，是所有权转移，下面的代码{% label danger@编译失败 %}

```rust
fn main() {
    let a = "hello world".to_string();
    let b = a;
    println!("{} {}", a, b);
}
```

![String not implement Copy](./string-not-implement-copy.PNG)

<!-- endtab -->

{% endtabs %}

并不是所有的类型都可以实现 `Copy` 。`Rust` 规定，对于自定义类型，只有所有的成员都实现了 `Copy` ，这个类型才有资格实现 `Copy`。例如下面的类型：

```rust
#[derive(Copy, Clone)]
struct Point {
   x: i32,
   y: i32,
}
```

但是看下面的 `PointList` 类型，他就不能实现 `Copy`，因为 [`Vec<T>`](https://doc.rust-lang.org/std/vec/struct.Vec.html) 没有实现 `Copy`。

```rust
struct PointList {
    points: Vec<Point>,
}
```

虽然 `PointList` 不能实现 `Copy`，但是是由于共享引用 `&T` 可以 `Copy`，所以我们可以实现一个 `PointListWrapper`，包含 `PointList` 的一个引用，这样即使 `PointList` 不能 `Copy`，`PointListWrapper` 也可以 `Copy`。

```rust
#[derive(Copy, Clone)]
struct PointListWrapper<'a> {
    point_list_ref: &'a PointList,
}
```

##### Clone

`Clone` 的全称是 [`std::clone::Clone;`](https://doc.rust-lang.org/std/clone/trait.Clone.html)，他定义了两个方法，其中 `clone_from` 默认实现。

```rust
pub trait Clone: Sized {
    fn clone(&self) -> Self;
    fn clone_from(&mut self, source: &Self) {
        *self = source.clone()
    }
}
```

`clone` 方法一般用于基于语义的复制操作。所以，它做什么事情，跟具体类型的作用息息相关。比如对于 `Box` 类型，`clone` 就是执行的深拷贝，而对于 `Rc` 类型，`clone` 做的事情就是把引用计数值加`1`。你可以根据情况在 `clone` 函数中编写任意的逻辑。但是有一条规则需要注意：对于实现了 `Copy` 的类型，它的 `clone` 方法应该跟 `Copy` 语义相容，等同于按位拷贝。

实现了 `Clone` 的所有基本类型： [https://doc.rust-lang.org/std/clone/trait.Clone.html#implementors](https://doc.rust-lang.org/std/clone/trait.Clone.html#implementors)

下面这段代码是{% label success@编译通过 %}的，可以看到，`String` 虽然未实现 `Copy`，但是它实现了 `Clone`。

```rust
fn main() {
    let a = "hello world".to_string();
    let b = a.clone();
    println!("{} {}", a, b);
}
```