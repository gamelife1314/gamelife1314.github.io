---
title: 【Rust】Trait和泛型
date: 2022-04-26 22:08:30
tags:
  - Trait
  - 泛型
  - 《Rust 程序设计》
categories:
  - rust
---

编程中可能经常遇到要用相同的逻辑处理不同的类型，即使这个类型是还没出世的自定义类型。这种能力对于 `Rust` 来说并不新鲜，它被称为多态性，诞生于 `1970` 年代的编程语言技术，到现在为止仍然普遍。`Rust` 支持具有两个相关特性的多态性：`Trait` 和 泛型。

`Trait` 是 `Rust` 对接口或抽象基类的对照实现，它们看起来就像 `Java` 或 `C#` 中的接口：

```rust
trait Write {
    fn write(&mut self, buf: &[u8]) -> Result<usize>;

    fn flush(&mut self) -> Result<()>;

    fn write_all(&mut self, buf: &[u8]) -> Result<()> { ... }
    ...
}
```

`File`，`TcpStream` 以及 [`Vec<u8>`](https://doc.rust-lang.org/std/vec/struct.Vec.html#impl-Write) 都实现了 [`std::io::Write`](https://doc.rust-lang.org/std/io/trait.Write.html)，这`3`个类型都提供了 `.write()`，`.flush()` 等等方法，我们可以使用 `write` 方法而不用关心它的实际类型：

```rust
use std::io::Write;

fn say_hello(out: &mut dyn Write) -> std::io::Result<()> {
    out.write_all(b"hello world\n")?;
    out.flush()
}
```

`&mut dyn Write` 的意思是任何实现了 `Write` 的可变引用，我们可以调用 `say_hello` 并且给他传递这样一个引用：

```rust
use std::fs::File;
let mut local_file = File::create("hello.txt")?;
say_hello(&mut local_file)?; // works

let mut bytes = vec![];
say_hello(&mut bytes)?; // also works
assert_eq!(bytes, b"hello world\n");
```

泛型函数就像 `C++` 中模板函数，一个泛型函数或者类型可以用于许多不同类型的值：

```rust
/// Given two values, pick whichever one is less.
fn min<T: Ord>(value1: T, value2: T) -> T {
    
    if value1 <= value2 {
        value1
    } else {
        value2
    }
}
```

`<T: Ord>` 意思是 `T` 类型必须实现 `Ord`，这称为边界，因为它设置了 `T` 可能是哪些类型，编译器为实际使用的每种类型 `T` 生成自定义机器代码。

<!-- more -->


### 使用 `Trait`

`Trait` 代表了一种能力，这个类型能做哪些事情，例如：

- 实现 [`std::io::Write`](https://doc.rust-lang.org/std/io/trait.Write.html) 意味着可以调用 `.write()` 方法写入字节等；

- 实现 [`std::iter::Iterator`](https://doc.rust-lang.org/std/iter/trait.Iterator.html) 可以产生一个序列值；

- 实现 [`std::clone::Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html) 可以在内存中 `clone` 自身；

- 实现 [`std::fmt::Debug`](https://doc.rust-lang.org/std/fmt/trait.Debug.html) 可以使用 `{:?}` 打印；

这 `4` 个 `Trait` 只是标准库中的一部分，许多标准类型都实现了他们，例如：`std::fs::File` 实现 `Write`，`Range<i32>(0..10)` 实现了 `Iterator`，有很多类型都实现了 `Clone` 和 `Debug`。

关于 `Trait` 方法有一个不寻常的规则：`Trait` 本身必须在范围内。否则，它的所有方法都会被隐藏：

{% note danger %}
```rust
let mut buf: Vec<u8> = vec![];
buf.write_all(b"hello")?; // error: no method named `write_all`
```
{% endnote %}

正常情况下，编译器会提示我们需要导入 `std::io::Write`：

{% note success %}
```rust
use std::io::Write;

let mut buf: Vec<u8> = vec![];
buf.write_all(b"hello")?; // ok
```
{% endnote %}

之所以要这样做，是因为了避免命名冲突，需要导入计划使用的 `Trait`，因为我们可能为类型实现了多种 `Trait`，它们都相同的方法名。但如果我们需要导入这两个名称冲突的方法，就需要使用[完全限定方法调用](#完全限定调用)，而 `Clone` 和 `Iterator` 能正常使用的原因是它们是预导入的。

### `Trait` 对象

在 `Rust` 中，一个变量的大小必须在编译时就能确定，而 `Trait` 可以被任何类型实现，所以它们的大小无法确认，类似下面的代码会编译失败：

{% note danger %}
```rust
use std::io::Write;

let mut buf: Vec<u8> = vec![];
let writer: dyn Write = buf; // error: `Write` does not have a constant size
```
{% endnote %}

然而一个引用的大小时确定的，我们可以获取 `Trait` 的引用：

{% note success %}
```rust
use std::io::Write;

let mut buf: Vec<u8> = vec![];
let writer: &mut dyn Write = &mut buf; // ok
```
{% endnote %}

对 `Trait` 类型的引用，如 `writer`，称为 {% label @Trait 对象 %}。 `Trait` 对象指向某个值，它有生命周期，可以是可变引用或共享引用。`Trait` 对象的不同之处在于，它包含了一些关于所指对象类型的额外信息，当你调用 `writer.write(data)` 时，`Rust` 需要根据 `*writer` 的类型动态调用正确的 `write` 方法。`Rust` 不允许直接查询类型信息，也不支持从 `Trait` 对象向下转换，`&mut dyn` 不能转换为 `Vec<u8> `这样的具体类型。

在内存中，`Trait` 对象是一个胖指针，由一个指向值的指针和一个指向拥有该值类型方法表的指针组成，因此，每个`Trait`对象占用两个机器字，下图所示：

![](trait-obj-inmem.png)

`C++` 也有这种运行时类型信息，它被称为虚拟表，`vtable` 是 `Rust` 的私有实现细节，这些是不可以直接访问的字段和数据结构。当调用`Trait`对象的方法时语言自动使用 `vtable` 去决定使用哪个类型。

`Rust` 在需要时会自动将普通引用转换为 `Trait` 对象， 这就是为什么我们能够在这个例子中将 `&mut local_file` 传递给 `say_hello`：

```rust
let mut local_file = File::create("hello.txt")?;
say_hello(&mut local_file)?;
```

`local_file` 的类型是 `&mut File`，`say_hello` 函数的参数类型是 `&mut dyn Write`，由于 `File` 实现了 `Write`，所以允许自动转换。同样，`Rust` 也可以将 `Box<File>` 转换为 `Box<dyn Write>`：

```rust
let w: Box<dyn Write> = Box::new(local_file);
```

`Box<dyn Write>` 和 `&mut dyn Write` 一样，是一个胖指针：它包含 `writer` 本身和 `vtable` 的地址。其他指针类型也是如此，例如 `Rc<dyn Write>`。

### 泛型函数

首先来看一个普通函数和泛型函数的例子：

```rust
fn say_hello(out: &mut dyn Write) // plain function
fn say_hello<W: Write>(out: &mut W) // generic function
```

`<W: Write>` 预示着这个函数是泛型的，`W` 是一个类型参数，意味着在整个函数体中，类型 `W` 是实现了 `Write` 的类型。约定上，类型参数使用单个大写字母表示，而 `W` 实际代表哪种类型取决于泛型函数的使用方式：

```rust
say_hello(&mut local_file)?; // calls say_hello::<File>
say_hello(&mut bytes)?; // calls say_hello::<Vec<u8>>
```

当我们传递给 `say_hello` 函数 `&mut local_file`，`Rust` 就会为 `say_hello::<File>()` 类型的机器代码，当使用 `&mut bytes` 时，就会生成`say_hello::<Vec<u8>>()` 类型的代码。在这两种情况中，`W` 的类型都会由编译器自动推断，这叫做{% label @单态化（monomorphization） %}。

如果不嫌麻烦，可以显示写出 `W` 的类型：

```rust
say_hello::<File>(&mut local_file)?;
```

但是，如果你调用的泛型函数没有提供任何可供编译器进行类型推断的信息，就需要显示提供：

{% note warning %}
```rust
// calling a generic method collect<C>() that takes no arguments
let v1 = (0 .. 1000).collect(); // 无法进行类型推断

let v2 = (0 .. 1000).collect::<Vec<i32>>(); // ok
let v3: Vec<i32> = (0..1000).collect();    // ok
```
{% endnote %}

有时候，一个类型可能需要具备多种能力，也就是它得实现多个 `Trait`，这个时候我们可以使用 `+` ：

```rust
use std::hash::Hash;
use std::fmt::Debug;
fn top_ten<T: Debug + Hash + Eq>(values: &Vec<T>) { ... }
```

![](type-parameter-implement-multiple-trait.png)

泛型函数也是可以拥有多个类型参数的，例如：

```rust
/// Run a query on a large, partitioned data set.
/// See <http://research.google.com/archive/mapreduce.html>.
fn run_query<M: Mapper + Serialize, R: Reducer + Serialize>(
    data: &DataSet,
    map: M,
    reduce: R,
) -> Results {
}
```

但是这样写会让函数的签名变得很长，看起来不是很顺眼，所以可以使用 `where` 关键字达到同样的效果，只是将 `M` 和 `R` 的边界移动到了后边，让函数签名看起来更加清晰而已：

```rust
fn run_query<M, R>(data: &DataSet, map: M, reduce: R) -> Results
where
    M: Mapper + Serialize,
    R: Reducer + Serialize,
{
    ...
}
```

泛型函数的参数有引用时，可能需要显示使用生命周期参数，这种情况需要把生命周期写在最前面：

```rust
/// Return a reference to the point in `candidates` that's
/// closest to the `target` point.
fn nearest<'t, 'c, P>(target: &'t P, candidates: &'c [P]) -> &'c P
where
    P: MeasureDistance,
{
    ...
}
```

生命周期参数不会影响函数的机器代码生成，只有不同的类型 `P` 才会导致编译器生成不同的 `nearest` 版本。

即使结构=体不是泛型，它的类型也可以是泛型的：

```rust
impl PancakeStack {
    fn push<T: Topping>(&mut self, goop: T) -> PancakeResult<()> {
        goop.pour(&self);
        self.absorb_topping(goop)
    }
}
```

也有泛型类型：

```rust
type PancakeResult<T> = Result<T, PancakeError>;
```

### 泛型 or `Trait`

`Trait` 解决的问题是像什么，它能代表一类对象，这一类对象都有相同的行为；而泛型解决的问题是解决重复编码，更像是一个代码模板，泛型类型可以使用 `Trait` 作为边界。

对于代码体积来说，由于泛型更像是代码模板，所以在编译时更具会对不同类型生成真正的代码，代码体积会增大，但是运行速度会更快，而 `Trait` 对象只有在实际运行时才能确定其真正的类型。

### 定义实现 `Trait`

定义 `Trait` 相对比较简单，有两个必须的信息，名称和方法签名列表：

```rust
/// A trait for characters, items, and scenery -
/// anything in the game world that's visible on screen.
trait Visible {

    /// Render this object on the given canvas.
    fn draw(&self, canvas: &mut Canvas);

    /// Return true if clicking at (x, y) should
    /// select this object.
    fn hit_test(&self, x: i32, y: i32) -> bool;
}
```

如果要为类型实现 `Trait`，需要使用 `impl TraitName for Type` 的语法，这里只包含 `Type` 为 `TraitName` 实现的方法：

```rust
impl Visible for Broom {
    fn draw(&self, canvas: &mut Canvas) {
        for y in self.y - self.height - 1..self.y {
            canvas.write_at(self.x, y, '|');
        }

        canvas.write_at(self.x, self.y, 'M');
    }

    fn hit_test(&self, x: i32, y: i32) -> bool {
        self.x == x && self.y - self.height - 1 <= y && y <= self.y
    }
}
```

### `Trait` 默认方法

`Trait` 中可以不止包含方法签名列表，也可以包含方法的实现，如果类型没有重新实现方法，在调用的时候，会选择 `Trait` 的默认实现：

```rust
trait Write {
    fn write(&mut self, buf: &[u8]) -> Result<usize>;

    fn flush(&mut self) -> Result<()>;

    fn write_all(&mut self, buf: &[u8]) -> Result<()> {
        let mut bytes_written = 0;
        while bytes_written < buf.len() {
            bytes_written += self.write(&buf[bytes_written..])?;
        }
        Ok(())
    }
}

```

`Write` 默认实现了 `write_all` 方法，在为自定义类型实现时，如果没有重新实现，就会选择这个 `write_all` 。

### `Trait` 实现限制

只要类型或者 `Trait` 是当前 `crate` 引入的，就可以：

1. 为其他任何类型实现当前 `crate` 中的 `Trait`；

2. 或者为当前 `crate` 中的类型实现任何 `Trait`；

例如，我们可以为标准库 `char` 类型实现我们自定义的 `IsEmoji`，只要 `IsEmoji` 在作用域之内就可以使用：

```rust
trait IsEmoji {
    fn is_emoji(&self) -> bool;
}

/// Implement IsEmoji for the built-in character type.
impl IsEmoji for char {
    fn is_emoji(&self) -> bool {
        ...
    }
}
```

### 方法扩展

还可以对某类已存在类型一次性扩展多个方法，通过一个 {% label @泛型impl块 %}，这里，为所有实现了 `Write` 的类型添加 `write_html` 方法：

```rust
use std::io::{self, Write};

/// Trait for values to which you can send HTML.
trait WriteHtml {
    fn write_html(&mut self, html: &HtmlDocument) -> io::Result<()>;
}

/// You can write HTML to any std::io writer.
impl<W: Write> WriteHtml for W {
    fn write_html(&mut self, html: &HtmlDocument) -> io::Result<()> {
    ...
 }
}
```

例如，标准库中为所有实现了 [`From`](https://doc.rust-lang.org/stable/std/convert/trait.From.html) 的类型自动实现了 [`Into`](https://doc.rust-lang.org/stable/std/convert/trait.Into.html)：

```rust
#[stable(feature = "rust1", since = "1.0.0")]
#[rustc_const_unstable(feature = "const_convert", issue = "88674")]
impl<T, U> const Into<U> for T
where
    U: ~const From<T>,
{
    /// Calls `U::from(self)`.
    ///
    /// That is, this conversion is whatever the implementation of
    /// <code>[From]&lt;T&gt; for U</code> chooses to do.
    fn into(self) -> U {
        U::from(self)
    }
}
```

要注意的是，当实现一个 `Trait` 的时候，`Trait` 或者类型必须要有是当前 `crate` 中，这称之为**孤儿原则**，它确保 `Trait` 实现是唯一的，所以不能为 `u8` 实现 `Write`，因为它两都是标准库中的。


### `Trait` 中的 `Self`

在 `Trait` 的方法定义中可以使用 `Self` 关键字，例如：

```rust
pub trait Spliceable {
    fn splice(&self, other: &Self) -> Self;
}

impl Spliceable for CherryTree {
    fn splice(&self, other: &Self) -> Self {
        ...
    }
}

impl Spliceable for Mammoth {
    fn splice(&self, other: &Self) -> Self {
        ...
    }
}
```

在第一个 `impl` 中，`Self` 表示 `CherryTree`，在第二个 `impl` 中，`Self` 表示 `Mammoth`，而且 `self` 和 `other` 的类型必须匹配。但是如果 `Trait` 中包含了 `Self`，就和 `Trait` 对象不兼容，因为在编译时，`Rust` 不能确定 `Trait` 对象背后的实际类型，所以下面的代码会编译失败，因为 `Rust` 不知道 `left` 和 `right` 是否是相同类型：

```rust
// error: the trait `Spliceable` cannot be made into an object
fn splice_anything(left: &dyn Spliceable, right: &dyn Spliceable) {
    let combo = left.splice(right);
    // ...
}
```

如果我们想要 `splice` 函数能够处理兼容处理不同类型，我们可以这样做：

```rust
pub trait MegaSpliceable {
    fn splice(&self, other: &dyn MegaSpliceable) -> Box<dyn MegaSpliceable>;
}
```

### 子`Trait`

`Trait` 之间可以扩展，例如：

```rust
trait Creature: Visible {
    fn position(&self) -> (i32, i32);
    fn facing(&self) -> Direction;
    ...
}
```

这样每个想实现 `Creature` 的类型就必须实现 `Visible`，我们将 `Creature` 称作 `Visible` 的 **子 `Trait`**，或者将 `Visible` 称作 `Creature` 的 **父`Trait`**，但是**子 `Trait`** 不能继承 **父`Trait`** 的关联项。另外如果想调用 `Trait` 的方法，依然需要每个 `Trait` 都在作用域内。

其实 `trait Creature: Visible` 只是下面的简写：

```rust
trait Creature where Self: Visible {
    ...
}
```

### `Trait` 的关联函数

`Rust` 的 `Trait` 是可以包含静态类型方法的：

```rust
trait StringSet {
    /// 返回空的set
    fn new() -> Self;

    /// Return a set that contains all the strings in `strings`.
    fn from_slice(strings: &[&str]) -> Self;
    
    /// Find out if this set contains a particular `value`.
    fn contains(&self, string: &str) -> bool;
    
    /// Add a string to this set.
    fn add(&mut self, string: &str);
}
```

`new` 和 `from_slice` 没有将 `self` 作为第一个参数，每个实现 `StringSet` 的类型必须实现关联的静态方法。

`Trait` 对象不支持类型关联的函数，如果你想使用 `&dyn StringSet`，即 `Trait` 对象，你必须改变 `Trait`，给每个接受 `self` 参数的关联函数添加边界 `where Self: Sized`：


```rust
trait StringSet {
    fn new() -> Self
    where
        Self: Sized;
    
    fn from_slice(strings: &[&str]) -> Self
    where
        Self: Sized;
    
    fn contains(&self, string: &str) -> bool;
    
    fn add(&mut self, string: &str);
}
```

这个边界告诉`Rust`，`Trait` 对象可以不支持这个特定的关联函数。有了这些补充，虽然 `StringSet` 的 `Trait`对象仍然不支持`new`或`from_slice`，但可以创建它们并使用它们来调用`.contains()`和`.add()`。

### 完全限定调用

当调用 `"hello".to_string()` 的时候，`Rust` 会根据方法查找算法进行方法查找，这里的 `to_string()` 实际上引用到了 [`ToString`](https://doc.rust-lang.org/std/string/trait.ToString.html) `Trait` 的方法。下面的四种方法是等价的：

```rust
"hello".to_string();
str::to_string("hello");                // 限定类型
ToString::to_string("hello");           // 限定Trait
<str as ToString>::to_string("hello");  // 限定类型和Trait，完全限定
```

其中最后一种称之为**完全限定语法**，通过这个语法，可以明确知道调用哪个方法，这在下面这些场景中非常有用：

- 当两个方法有相同的名称时，调用就会有歧义，可以通过限定类型或者指定 `Trait` 来具体说明：

    ```rust
    outlaw.draw(); // 不知道调用哪个？

    Visible::draw(&outlaw); // ok: draw on screen
    HasPistol::draw(&outlaw); // ok: corral
    ```

- 当 `self` 参数类型不能推断时：

    ```rust
    let zero = 0; // type unspecified; could be `i8`, `u8`, ...
    zero.abs(); // error: can't call method `abs`
    // on ambiguous numeric type
    i64::abs(zero); // ok
    ```

- 当使用函数本身作为函数值时：

    ```rust
    let words: Vec<String> =
        line.split_whitespace() // iterator produces &str values
            .map(ToString::to_string) // ok
            .collect();
    ```

- 在宏中调用 `Trait` 方法时；

### `Trait` 关联类型

`Trait` 内部也可以定义类型，用于类型之间相互交互，例如 [std::iter::Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html) 和 [std::ops::Mul](https://doc.rust-lang.org/std/ops/trait.Mul.html)

```rust
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    ....
}

pub trait Mul {
    type Output;
    fn mul(self, rhs: Rhs) -> Self::Output;
}
```

这其中的 `type Item;` 是一个关联类型，每个实现 `Iterator` 的类型必须声明 `Item` 的具体类型，`next` 的返回值用了 `Item` 关联类型，这里写作 `Self::Item` 表明他不是一个普通类型，而是和每个实现 `Iterator` 的类型相关。

我们可以看到 [`std::env::Args`](https://doc.rust-lang.org/std/env/struct.Args.html#impl-Iterator) 的实现，在这里的实现中，`Item` 的类型是 `String`：

```rust
impl Iterator for Args {
    
    type Item = String;

    fn next(&mut self) -> Option<String> {
        self.inner.next().map(|s| s.into_string().unwrap())
    }
    
    ...
}
```

泛型代码也可以使用 `Trait` 的关联类型，在 `collect_into_vector` 的返回值中，我们必须使用 `Vec<I::Item>` 而不能是 ` Vec<I`：

```rust
/// Loop over an iterator, storing the values in a new vector.
fn collect_into_vector<I: Iterator>(iter: I) -> Vec<I::Item> {
    let mut results = Vec::new();
    for value in iter {
        results.push(value);
    }
    results
}
```

我们还可以指定关联类型的边界，如果不指定，我们可能会遇到问题，我们想打印出 `Iterator` 的每个值，但是编译器会提示我们 `<I as Iterator>::Item` 没有实现 `Debug`：

{% note danger %}
```rust
/// Print out all the values produced by an iterator
fn dump<I>(iter: I)
    where I: Iterator
{
    for (index, value) in iter.enumerate() {
        println!("{}: {:?}", index, value);  // 错误
    }
}
```
{% endnote %}

鉴于此错误，我们要么指定 `<I as Iterator>::Item` 的边界，要么指定它的具体类型：

{% note success %}
```rust
/// Print out all the values produced by an iterator
fn dump<I>(iter: I)
    where I: Iterator, I::Item: Debug
{
    for (index, value) in iter.enumerate() {
        println!("{}: {:?}", index, value);  // ok
    }
}
```
{% endnote %}

或者

{% note success %}
```rust
/// Print out all the values produced by an iterator
fn dump<I>(iter: I)
    where I: Iterator<Item=String>
{
    for (index, value) in iter.enumerate() {
        println!("{}: {:?}", index, value);  // ok
    }
}
```
{% endnote %}

后面这个语法可用于任何 `Trait` 名称可以使用的地方被使用，包括 `Trait` 对象类型：

```rust
fn dump(iter: &mut dyn Iterator<Item=String>) {
    for (index, s) in iter.enumerate() {
     println!("{}: {:?}", index, s);
    }
}
```

### 泛型 `Trait`

`Trait` 也可以是泛型的，例如[`std::ops::Mul`](https://doc.rust-lang.org/std/ops/trait.Mul.html)：

```rust
pub trait Mul<Rhs = Self> {
    type Output;
    fn mul(self, rhs: Rhs) -> Self::Output;
}
```

这里的类型参数和在结构体或函数上的意思是一样的：`Mul` 是泛型 `Trait`，它的实例 `Mul<f64>`、`Mul<String>`、`Mul<Size>` 等都是不同的 `Trait`。

之前说我们实现 `Trait` 时，`Trait` 或者类型必须要有一个是当前 `crate` 中的。假设我们有自己的结构体 `Number`，我们完全可以为 `f64` 实现 `Mul<Number>`，以支持 `f64 * Number`，即使 `Mul` 和 `f64` 不是我们 `crate` 的，但是 `Mul<Number>` 是我们自己定义的：

```rust
#![allow(dead_code)]

use std::ops::Mul;

struct Number {
    num: f64,
}

impl Mul<Number> for f64 {
    type Output = f64;
    fn mul(self, rhs: Number) -> Self::Output {
        self * rhs.num
    }
}

fn main() {
    let left = 0.5f64;
    let number = Number { num: 4.0 };
    println!("{:}", left * number);
}
```

### `impl Trait`

许多泛型类型的组合可能会使代码变得混乱，例如，使用标准库几个迭代器会使代码的返回类型变得异常复杂：

```rust
use std::iter;
use std::vec::IntoIter;

fn cyclical_zip(v: Vec<u8>, u: Vec<u8>) -> iter::Cycle<iter::Chain<IntoIter<u8>, IntoIter<u8>>> {
    v.into_iter().chain(u.into_iter()).cycle()
}
```

我们可以使用 `Trait` 对象替换这个看起来很复杂的返回值类型：

```rust
fn cyclical_zip(v: Vec<u8>, u: Vec<u8>) -> Box<dyn Iterator<Item=u8>> {
    Box::new(v.into_iter().chain(u.into_iter()).cycle())
}
```

但是这个返回值每次都要在堆中重新申请内存，也是有代价的。因此，`Rust` 专门为这种情况提供了 `impl Trait` 这种语法，只指定它实现的一个或多个`Trait`，而无需动态调度或堆分配：

```rust
fn cyclical_zip(v: Vec<u8>, u: Vec<u8>) -> impl Iterator<Item = u8> {
    v.into_iter().chain(u.into_iter()).cycle()
}
```

但是我们不能通过这个实现在运行时动态返回不同类型的函数，错误是很明显的，`Rust` 需要在编译的时候就知道返回值的大小，并且分配大小正确的空间，这里返回三个不同类型，`Rust` 就不知道怎么做了：

{% note danger 查看错误示例 %}
```rust
#![allow(dead_code)]

trait Shape {
    fn new() -> Self;
    fn area(&self) -> f64;
}

struct Circle;

impl Shape for Circle {
    fn new() -> Self {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

struct Triangle;

impl Shape for Triangle {
    fn new() -> Self {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

struct Rectangle;

impl Shape for Rectangle {
    fn new() -> Self {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

fn make_shape(shape: &str) -> impl Shape {
    match shape {
        "triangle" => Triangle::new(),
        "shape" => Rectangle::new(),
        _ => Circle::new(),
    }
}

fn main() {}
```
{% endnote %}

正确的修改方法是：

{% note success 查看正确示例 %}

```rust
#![allow(dead_code)]

trait Shape {
    fn new() -> Self
    where
        Self: Sized;
    fn area(&self) -> f64;
}

struct Circle;

impl Shape for Circle {
    fn new() -> Self
    where
        Self: Sized,
    {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

struct Triangle;

impl Shape for Triangle {
    fn new() -> Self
    where
        Self: Sized,
    {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

struct Rectangle;

impl Shape for Rectangle {
    fn new() -> Self
    where
        Self: Sized,
    {
        Self
    }

    fn area(&self) -> f64 {
        0f64
    }
}

fn make_shape(shape: &str) -> Box<dyn Shape> {
    match shape {
        "triangle" => Box::new(Triangle::new()),
        "shape" => Box::new(Rectangle::new()),
        _ => Box::new(Circle::new()),
    }
}

fn main() {}
```

更多可以查看 [使用 dyn 返回 trait](https://www.rustwiki.org.cn/zh-CN/rust-by-example/trait/dyn.html)。

{% endnote %}

需要注意的是，`Rust` 不允许 `Trait` 方法使用 `impl Trait` 返回值，只有自由函数和与类型关联的函数才能使用 `impl Trait` 返回。`impl Trait` 也可以用在接受泛型参数的函数中。例如，下面两个函数的实现等价：

```rust
fn print<T: Display>(val: T) {
    println!("{}", val);
}

fn print(val: impl Display) {
    println!("{}", val);
}
```

有一个重要的例外，使用泛型函数允许函数调用者声明泛型参数类型，例如：`print::<i32>(42)`，但是当使用 `impl Trait` 是不允许的。

每个 `impl Trait` 参数都分配有自己的匿名类型参数，因此参数是 `impl Trait` 仅限于简单的泛型函数，类型和参数之间没有关系的。

### 关联常量

像结构体和枚举一样，`Trait` 也可以有关联的常量，例如：

```rust
trait Greet {
    const GREETING: &'static str = "Hello";
    fn greet(&self) -> String;
}
```

关联的常量可以只声明而不用给值：

```rust
trait Float {
    const ZERO: Self;
    const ONE: Self;
}
```

然后在实现的时候再定义这些值：

```rust
impl Float for f32 {
    const ZERO: f32 = 0.0;
    const ONE: f32 = 1.0;
}

impl Float for f64 {
    const ZERO: f64 = 0.0;
    const ONE: f64 = 1.0;
}
```

这允许我们定义这样的泛型函数，以使用这些常量：

```rust
fn add_one<T: Float + Add<Output=T>>(value: T) -> T {
    value + T::ONE
}
```

请注意，关联常量不能与 `Trait` 对象一起使用，因为编译器依赖于有关实现的类型信息以便在编译时选择正确的值。即使是一个根本没有行为的简单 `Trait`，比如 `Float`，也可以提供足够的关于类型的信息，结合一些运算符，来实现常见的数学函数，比如 `Fibonacci`：

```rust
fn fib<T: Float + Add<Output=T>>(n: usize) -> T {
    match n {
        0 => T::ZERO,
        1 => T::ONE,
        n => fib::<T>(n - 1) + fib::<T>(n - 2)
    }
} 
```

### 步步为营

假设我们写了一个函数用于求和两个 `&[i64]` 的和，代码可能看起来是这个样子的，代码也可以正常运行：

{% note success %}
```rust
fn dot(v1: &[i64], v2: &[i64]) -> i64 {
    let mut total = 0;
    for i in 0 .. v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}
```
{% endnote %}

现在假设我们又想实现两个 `&[f64]` 的和，我们可以第一步想到的是改成泛型函数：

{% note danger %}
```rust
fn dot<N>(v1: &[N], v2: &[N]) -> N {
    let mut total: N = 0;
    for i in 0 .. v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}
```
{% endnote %}

但这肯定不定，类型 `N` 必须支持 `+` 和 `*` 运算。另外由于 `0` 是整数，不是浮点数，当 `N` 代表 `f64` 是依然不对，所以我们可以改成这个样子，对 `N` 进行边界限定：

{% note danger %}
```rust
use std::ops::{Add, Mul};

fn dot<N: Add<Output = N> + Mul<Output = N> + Default>(v1: &[N], v2: &[N]) -> N {
    let mut total = N::default();
    for i in 0..v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}
```
{% endnote %}

由于看起来很丑陋，所以我们对它进行美化，但还是编译不过：

{% note danger %}

```rust
use std::ops::{Add, Mul};

fn dot<N>(v1: &[N], v2: &[N]) -> N
where
    N: Add<Output = N> + Mul<Output = N> + Default,
{
    let mut total = N::default();
    for i in 0..v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}
```

因为 `&v1[N]` 没有实现 `Copy`，`v1[i]` 会转移所有权：

        error[E0508]: cannot move out of type `[N]`, a non-copy slice
        --> src/main.rs:11:25
        |
        11 |         total = total + v1[i] * v2[i];
        |                         ^^^^^
        |                         |
        |                         cannot move out of here
        |                         move occurs because `v1[_]` has type `N`, which does not implement the `Copy` trait

        error[E0508]: cannot move out of type `[N]`, a non-copy slice
        --> src/main.rs:11:33
        |
        11 |         total = total + v1[i] * v2[i];
        |                                 ^^^^^
        |                                 |
        |                                 cannot move out of here
        |                                 move occurs because `v2[_]` has type `N`, which does not implement the `Copy` trait
{% endnote %}


所以我们接着改，这次改对了：

{% note success %}

```rust
#![allow(dead_code)]

use std::ops::{Add, Mul};

fn dot<N>(v1: &[N], v2: &[N]) -> N
where
    N: Add<Output = N> + Mul<Output = N> + Default + Copy,
{
    let mut total = N::default();
    for i in 0..v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}

fn main() {
    assert_eq!(dot(&[1, 2, 3, 4], &[1, 1, 1, 1]), 10);
    assert_eq!(
        dot(
            &[1.01f64, 2.02f64, 3f64, 4f64],
            &[1.01f64, 2.02f64, 3f64, 4f64]
        ),
        30.1005f64
    );
}
```
{% endnote %}

虽然结局看起来不错，但是我们是跟着编译器提示把 `N` 的边界给找出来。就这个问题而言，我们可以使用 `num` 这个 `crate`，就看起来很简洁：

```rust
use num::Num;

fn dot<N>(v1: &[N], v2: &[N]) -> N
where
    N: Num + Copy,
{
    let mut total = N::zero();
    for i in 0..v1.len() {
        total = total + v1[i] * v2[i];
    }
    total
}
```