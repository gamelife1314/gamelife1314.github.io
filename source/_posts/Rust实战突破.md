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


### `loop` 返回

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

### match 匹配

`rust`提供`match`关键字用于模式匹配，类似于其他语言中的`switch`，不同的是`match`必须列出所有可能情况。

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


### if let

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

### @ 绑定

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

### while let

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


### Trait

`trait` 告诉 Rust 编译器某个特定类型拥有可能与其他类型共享的功能。可以通过 `trait` 以一种抽象的方式定义共享的行为。


#### 默认类型参数和关联参数

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