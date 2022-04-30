---
title: 【Rust】迭代器
date: 2022-04-30 20:20:44
tags:
  - 迭代器
  - 《Rust 程序设计》
categories:
  - rust
---

迭代器是产生一系列值的值，通常用于循环操作。`Rust` 的标准库提供了遍历向量、字符串、哈希表和其他集合的迭代器，还提供了从输入流生成文本行、到达网络服务器的连接、通过通信通道从其他线程接收值的迭代器，`Rust` 的迭代器灵活、富有表现力且高效。

在 `Rust` 中，[`std::iter::Iterator`](https://doc.rust-lang.org/stable/std/iter/trait.Iterator.html) 和 [`std::iter::IntoIterator`](https://doc.rust-lang.org/stable/std/iter/trait.IntoIterator.html) 是实现迭代器的基础。


```rust
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    ...
}
```

迭代器可以是任何实现了 `Iterator` 的值，`Item` 是每次迭代产生的值，`next` 要么返回 `Some(v)`，`v` 是下一个值，要么返回 `None` 表示迭代结束。

想要被迭代的类型也可以实现 [`std::iter::IntoIterator`](https://doc.rust-lang.org/stable/std/iter/trait.IntoIterator.html)，它的 `into_iter` 返回一个迭代器：

```rust
pub trait IntoIterator {
    type Item;
    type IntoIter: Iterator;
    fn into_iter(self) -> Self::IntoIter;
}
```

我们常用的 `for` 循环仅仅是先调用 `into_iter` 生成一个迭代器，然后重复调用迭代器的 `next` 方法，直到 `next` 返回 `None`，预示着迭代结束。

<!-- more -->

### 创建迭代器

Rust 标准库文档详细解释了每种类型提供的迭代器类型，但该库遵循一些通用约定来帮助定位并找到您需要的东西。

#### `iter` 和 `iter_mut`

大多数集合类型都提供了 `iter` 和 `iter_mut` 方法，它们返回类型的自然迭代器，生成对每个项目的共享或可变引用。 像 `&[T]` 和 `&mut [T]` 这样的数组切片也有 `iter` 和 `iter_mut` 方法。这些方法是获取迭代器的最常用方法，如果您不打算让 `for` 循环为您处理它，可以这样做：

```rust
let v = vec![4, 20, 12, 8, 6];
let mut iterator = v.iter();
assert_eq!(iterator.next(), Some(&4));
assert_eq!(iterator.next(), Some(&20));
assert_eq!(iterator.next(), Some(&12));
assert_eq!(iterator.next(), Some(&8));
assert_eq!(iterator.next(), Some(&6));
assert_eq!(iterator.next(), None);
```

这个迭代器的项类型是 `&i32`：每次调用 `next` 都会产生对下一个元素的引用，直到我们到达向量的末尾。 每种类型都可以自由地以最适合其目的的方式实现 `iter` 和 `iter_mut`。 `std::path::Path` 上的 `iter` 方法返回一个迭代器，该迭代器一次生成一个路径信息：

```rust
use std::ffi::OsStr;
use std::path::Path;
let path = Path::new("C:/Users/JimB/Downloads/Fedora.iso");
let mut iterator = path.iter();
assert_eq!(iterator.next(), Some(OsStr::new("C:")));
assert_eq!(iterator.next(), Some(OsStr::new("Users")));
assert_eq!(iterator.next(), Some(OsStr::new("JimB")));
```

#### `into_iter` 实现

当一个类型实现 `IntoIterator` 时，你可以自己调用它的 `into_iter` 方法，就像 `for` 循环一样：

```rust
use std::collections::BTreeSet;
let mut favorites = BTreeSet::new();
favorites.insert("Lucy in the Sky With Diamonds".to_string());
favorites.insert("Liebesträume No. 3".to_string());
let mut it = favorites.into_iter();
assert_eq!(it.next(), Some("Liebesträume No. 3".to_string()));
assert_eq!(it.next(), Some("Lucy in the Sky With Diamonds".to_string()));
assert_eq!(it.next(), None);
```

大多数集合提供了几种 `IntoIterator` 的实现，例如，`&T`，`&mut T` 和 `T`：

- `&T` 类型的迭代器产生的每个值都是对值的共享引用；

- `&mut T` 类型的迭代器产生的每个值都对值的可变引用。例如 `Vec<String>`，调用 `(&mut vector).into_iter()` 返回了一个迭代器，它的 `Item` 类型是 `&mut String`；

- 调用 `T` 类型的 `into_iter()` 方法首先会获取集合值的是所有权，在迭代过程中，每个 `item` 的所有权从集合移动至消费者。

`for` 循环将 `IntoIterator::into_iter` 应用于其操作数，因此这三个实现创建了以下习惯用法，用于迭代对集合的共享或可变引用，或使用集合并获取其元素的所有权：

```rust
for element in &collection { ... }
for element in &mut collection { ... }
for element in collection { ... }
```

并非每种类型都提供所有三种实现。例如，`HashSet`、`BTreeSet` 和 `BinaryHeap` 不会在可变引用上实现 `IntoIterator`，因为修改它们的元素可能会违反类型的不变性。

切片实现了三个 `IntoIterator` 变体中的两个； 因为他们不拥有自己的元素，所以不存在`[T]`这种情况。 相反，`&[T]` 和 `&mut [T]` 的 `into_iter` 返回一个迭代器，该迭代器生成对元素的共享和可变引用。

#### `from_fn` 和 `successors`

一个更简单通用的方式是提供一个返回它们的闭包。[`std::iter::from_fn`](https://doc.rust-lang.org/stable/std/iter/fn.from_fn.html) 调用一个返回 `Option<T>` 的函数生成一个迭代器：

```rust
fn main() {
    use rand::random; // In Cargo.toml dependencies: rand = "0.7"
    use std::iter::from_fn;

    let lengths: Vec<f64> = from_fn(|| Some((random::<f64>() - random::<f64>()).abs()))
        .take(1000)
        .collect();
}
```

由于这个迭代器永远返回 `Some(f64)`，所以它永远不会结束，但是我们通过 `take(1000)` 只取了前 `1000` 个值。

如果产生的每个值都和前一个相关，那么可以使用 [`std::iter::successors`](https://doc.rust-lang.org/stable/std/iter/fn.successors.html) 函数完成，它接受一个初始值和一个函数并且返回下一个 `item`：

```rust
use num::Complex;
use std::iter::successors;

fn escape_time(c: Complex<f64>, limit: usize) -> Option<usize> {
    let zero = Complex { re: 0.0, im: 0.0 };
    successors(Some(zero), |&z| Some(z * z + c))
        .take(limit)
        .enumerate()
        .find(|(_i, z)| z.norm_sqr() > 4.0)
        .map(|(i, _z)| i)
}
```

从零开始，`successors` 通过重复对最后一个点求平方并与参数 `c`求和。

`from_fn` 和 `successors` 都接受 `FnMut` 闭包，因此您的闭包可以捕获和修改来自周围范围的变量。例如，这个斐波那契函数使用移动闭包来捕获变量并将其用作其运行状态：

```rust
fn fibonacci() -> impl Iterator<Item = usize> {
    let mut state = (0, 1);
    std::iter::from_fn(move || {
        state = (state.1, state.0 + state.1);
        Some(state.0)
    })
}

fn main() {
    println!("{:?}", fibonacci().take(10).collect::<Vec<usize>>());
}
```

#### `drain`

许多集合类型提供了一个 `drain` 方法，该方法需要获取集合的可变引用，将对应区间的值从原来的集合中删掉，并且将删除的值以一个新的迭代器返回：

```rust
fn main() {
    let mut outer = "Earth".to_string();
    let inner = String::from_iter(outer.drain(1..4));
    assert_eq!(outer, "Eh");
    assert_eq!(inner, "art");
}
```

#### 其他迭代器

![](other-iterators.png)


### 迭代适配器

一旦有了一个迭代器，`Iterator` 提供了广泛的适配器方法选择，它们使用一个迭代器并构建一个新迭代器。要了解适配器的工作原理，我们将从两个最流行的适配器开始，`map` 和 `filter`。

#### `map`、`filter`

`Iterator` 和 `map` 方法接受一个闭包或者函数作为参数应用于它的所有元素，然后产生新的迭代器。而 `filter` 接受一个闭包或函数作为参数，应用于所有元素过滤出符合要求的元素组成新的迭代器。

例如，我们可以使用 `map` 去将一段文本每行开始和结尾的空格去掉：

```rust
fn main() {
    let text = " ponies \n giraffes\niguanas \nsquid".to_string();
    let v: Vec<&str> = text.lines().map(str::trim).collect();
    assert_eq!(v, ["ponies", "giraffes", "iguanas", "squid"]);
}
```

同样的案例，我们如果想在处理掉首尾的空格之后，还要排除 `"iguanas"`，我们可以这样做：

```rust
fn main() {
    let text = " ponies \n giraffes\niguanas \nsquid".to_string();
    let v: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|s| *s != "iguanas")
        .collect();
    assert_eq!(v, ["ponies", "giraffes", "squid"]);
}
```

迭代器适配器就像 `shell` 中的 `pipeline`，每个适配器有一个单独的目的。这些适配器函数签名如下所示：

```rust
fn map<B, F>(self, f: F) -> impl Iterator<Item=B>
    where Self: Sized, F: FnMut(Self::Item) -> B;

fn filter<P>(self, predicate: P) -> impl Iterator<Item=Self::Item>
    where Self: Sized, P: FnMut(&Self::Item) -> bool;
```

在标准库中，`map` 和 `filter` 实际上返回名为 `std::iter::Map` 和 `std::iter::Filter` 的特定不透明结构类型。 然而，仅仅看到它们的名字并不能提供太多信息，所以这里，我们只打算写 `-> impl Iterator<Item=...>` ，因为它告诉我们真正想知道的：方法返回一个生成给定 `item` 类型的迭代器。

由于大多数适配器需要获取所有权，因此它们需要 `Self ` 是 `Sized`。

`map` 通过值将每个`item`传递给它的闭包，然后将闭包结果的所有权传递给它的消费者。`filter` 通过共享引用将每个项目传递给它的闭包，在`item`被选择传递给其消费者的情况下保留所有权。这就是示例必须解引用 `s` 来和 `"iguanas"` 比较的原因：`filter` 闭包的参数 `s` 的类型是 `&&str`。

关于迭代器适配器，有两点需要注意。

- 迭代器是惰性的，你不调用 `next` 方法就不会实际运行，也就是不会消费任何 `item`。前面的例子中，在 `collect` 调用 `filter` 返回的迭代器的 `next` 方法之前，`text.lines()` 和 `map()` 不会做任何工作，这点很像 `python` 中的生成器；

- 迭代适配器是零成本抽象，这意味着 `Rust` 有足够的信息将每个迭代器的 `next` 方法内联到其消费者中，然后将整个安排转换为机器代码作为一个单元；也就是我们不用关心适配器的性能开销，`Rust` 帮我们解决，对于上面的例子，和我们手写下面的代码有同样的性能：

    ```rust
    for line in text.lines() {
        let line = line.trim();
        if line != "iguanas" {
            v.push(line);
        }
    }
    ```


#### `filter_map`、`flat_map`

`filter_map` 类似于 `map`，但是它的闭包函数返回一个 `Option<T>` 决定这个值是留还是删掉，有点像 `filter` 和 `map` 的结合，该函数的声明如下：

```rust
fn filter_map<B, F>(self, f: F) -> impl Iterator<Item=B>
    where Self: Sized, F: FnMut(Self::Item) -> Option<B>;
```

举个例子，如果你想从一段以空格分割的字符串中解析出数字，可以这样做：

```rust
fn main() {
    use std::str::FromStr;
    let text = "1\nfrond .25 289\n3.1415 estuary\n";
    for number in text
        .split_whitespace()
        .filter_map(|w| f64::from_str(w).ok())
    {
        println!("{:4.2}", number.sqrt());
    }
}
```

该代码输出：

    1.00
    0.50
    17.00
    1.77


这个目的可以使用 `map` 和 `filter` 配合完成，但是有了 `filter_map` 就显得有点笨拙了：

{% note warning %}
```rust
fn main() {
    use std::str::FromStr;
    let text = "1\nfrond .25 289\n3.1415 estuary\n";
    for number in text
        .split_whitespace()
        .map(|w| f64::from_str(w))
        .filter(|r| r.is_ok())
        .map(|r| r.unwrap())
    {
        println!("{:4.2}", number.sqrt());
    }
}
```
{% endnote %}

而 `flat_map` 和 `map` 一样，只是他的闭包可以返回多个 `item`，而不是一个，它的签名如下：

```rust
fn flat_map<U, F>(self, f: F) -> impl Iterator<Item=U::Item>
    where F: FnMut(Self::Item) -> U, U: IntoIterator;
```

举个例子：

```rust
fn main() {
    use std::collections::HashMap;
    let mut major_cities = HashMap::new();
    major_cities.insert("Japan", vec!["Tokyo", "Kyoto"]);
    major_cities.insert("The United States", vec!["Portland", "Nashville"]);
    major_cities.insert("Brazil", vec!["São Paulo", "Brasília"]);
    major_cities.insert("Kenya", vec!["Nairobi", "Mombasa"]);
    major_cities.insert("The Netherlands", vec!["Amsterdam", "Utrecht"]);
    let countries = ["Japan", "Brazil", "Kenya"];
    for &city in countries.iter().flat_map(|country| &major_cities[country]) {
        println!("{}", city);
    }
}
```

该代码输出：

    Tokyo
    Kyoto
    São Paulo
    Brasília
    Nairobi
    Mombasa


#### `flatten`

如果我们要将一个二维数组转换成一个一维数组，就可以使用 `flatten`，在这里二维数组的每个元素都是可迭代的，它的定义如下，要求迭代器中的每个元素也都是可迭代的：

```rust
fn flatten(self) -> impl Iterator<Item=Self::Item::Item>
    where Self::Item: IntoIterator;
```

举个例子：

```rust
fn main() {
    use std::collections::BTreeMap;
    // A table mapping cities to their parks: each value is a vector.
    let mut parks = BTreeMap::new();
    parks.insert("Portland", vec!["Mt. Tabor Park", "Forest Park"]);
    parks.insert("Kyoto", vec!["Tadasu-no-Mori Forest", "Maruyama Koen"]);
    parks.insert("Nashville", vec!["Percy Warner Park", "Dragon Park"]);
    // Build a vector of all parks. `values` gives us an iterator producing
    // vectors, and then `flatten` produces each vector's elements in turn.
    let all_parks: Vec<_> = parks.values().flatten().cloned().collect();
    assert_eq!(
        all_parks,
        vec![
            "Tadasu-no-Mori Forest",
            "Maruyama Koen",
            "Percy Warner Park",
            "Dragon Park",
            "Mt. Tabor Park",
            "Forest Park"
        ]
    );
}
```

我们可以用 `flatten` 挑出 `Vec<Option<&str>>` 中所有 `Some<&str>`，因为 `Option` 也是可迭代的，例如，：

```rust
fn main() {
    assert_eq!(
        vec![None, Some("day"), None, Some("one")]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>(),
        vec!["day", "one"]
    );
}
```

#### `take`、`take_while`

`take` 和 `take_while` 用于决定迭代什么时候结束，前者迭代的次数，后者通过一个闭包。它们都会获取原迭代器的所有权，它们的定义如下：

```rust
fn take(self, n: usize) -> impl Iterator<Item=Self::Item>
    where Self: Sized;

fn take_while<P>(self, predicate: P) -> impl Iterator<Item=Self::Item>
    where Self: Sized, P: FnMut(&Self::Item) -> bool;
```

举个例子，给定一封电子邮件，其中一个空行将标头与邮件正文分开，可以使用 `take_while` 仅迭代标头：

```rust
fn main() {
    let message = "To: jimb\r\n\
 From: superego <editor@oreilly.com>\r\n\
 \r\n\
 Did you get any writing done today?\r\n\
 When will you stop wasting time plotting fractals?\r\n";
    for header in message.lines().take_while(|l| !l.is_empty()) {
        println!("{}", header);
    }
}
```

#### `skip`、`skip_while`

`skip` 和 `skip_while` 方法是 `take` 和 `take_while` 的补充：它们从迭代的开始丢弃一定数量的`item`，或者丢弃`item`直到闭包找到一个可接受的项目，剩余的保持不变。 它们的签名如下：

```rust
fn skip(self, n: usize) -> impl Iterator<Item=Self::Item>
    where Self: Sized;

fn skip_while<P>(self, predicate: P) -> impl Iterator<Item=Self::Item>
    where Self: Sized, P: FnMut(&Self::Item) -> bool;
```

例如，我们处理命令行参数时，通常丢掉第一个表示程序路径的值：

```rust
for arg in std::env::args().skip(1) {
    ...
}
```

如果想处理上面的邮件中的主体消息而不是标题，我们可以跳过开头的非空行：

```rust
fn main() {
    let message = "To: jimb\r\n\
 From: superego <editor@oreilly.com>\r\n\
 \r\n\
 Did you get any writing done today?\r\n\
 When will you stop wasting time plotting fractals?\r\n";
    for body in message.lines().skip_while(|l| !l.is_empty()).skip(1) {
        println!("{}", body);
    }
}
```

#### `peekable`

`peekable` 迭代器就是可以让你浏览下一个 `item` 但是又没实际使用它，就像调用了 `next` 然后又退回来了（假设），可以将任何迭代器通过转换成 `peekable` 的 `Iterator`。它的定义如下：

```rust
fn peekable(self) -> std::iter::Peekable<Self>
    where Self: Sized;
```

[`std::iter::Peekable`](https://doc.rust-lang.org/stable/std/iter/struct.Peekable.html) 是实现了 `Iterator<Item=Self::Item>` 的迭代器，这里的 `Self` 指的是底层的迭代器。

例如，如果您要从字符流中解析数字，则在看到其后的第一个非数字字符之前，您无法确定数字的结束位置：

```rust
use std::iter::Peekable;
fn parse_number<I>(tokens: &mut Peekable<I>) -> u32
where
    I: Iterator<Item = char>,
{
    let mut n = 0;
    loop {
        match tokens.peek() {
            Some(r) if r.is_digit(10) => {
                n = n * 10 + r.to_digit(10).unwrap();
            }
            _ => return n,
        }
        tokens.next();
    }
}

fn main() {
    let mut chars = "226153980,1766319049".chars().peekable();
    assert_eq!(parse_number(&mut chars), 226153980);
    // Look, `parse_number` didn't consume the comma! So we will.
    assert_eq!(chars.next(), Some(','));
    assert_eq!(parse_number(&mut chars), 1766319049);
    assert_eq!(chars.next(), None);
}
```

#### `fuse`

`fuse` 在迭代器第一次结束，即调用它的 `next` 方法返回 `None` 之后永远都返回 `None`，例如：

```rust

struct Flaky(bool);

impl Iterator for Flaky {
    type Item = &'static str;
    fn next(&mut self) -> Option<Self::Item> {
        if self.0 {
            self.0 = false;
            Some("totally the last item")
        } else {
            self.0 = true; // D'oh!
            None
        }
    }
}

fn main() {
    let mut flaky = Flaky(true);
    assert_eq!(flaky.next(), Some("totally the last item"));
    assert_eq!(flaky.next(), None);
    assert_eq!(flaky.next(), Some("totally the last item"));
    let mut not_flaky = Flaky(true).fuse();
    assert_eq!(not_flaky.next(), Some("totally the last item"));
    assert_eq!(not_flaky.next(), None);
    assert_eq!(not_flaky.next(), None);
}
```

#### `next_back`、`rev`

如果你的迭代器实现了 [`std::iter::DoubleEndedIterator`](https://doc.rust-lang.org/stable/std/iter/trait.DoubleEndedIterator.html)，就可以从两端开始迭代，直到它们相遇迭代结束。该 `trait` 的定义如下：

```rust
trait DoubleEndedIterator: Iterator {
    fn next_back(&mut self) -> Option<Self::Item>;
}
```

举个例子：

```rust
fn main() {
    let bee_parts = ["head", "thorax", "abdomen"];
    let mut iter = bee_parts.iter();
    assert_eq!(iter.next(), Some(&"head"));
    assert_eq!(iter.next_back(), Some(&"abdomen"));
    assert_eq!(iter.next(), Some(&"thorax"));
    assert_eq!(iter.next_back(), None);
    assert_eq!(iter.next(), None);
}
```

如果一个迭代器是双端迭代器，我们就可以使用 `rev` 对迭代器进行反转，`rev` 方法的定义如下：

```rust
fn rev(self) -> impl Iterator<Item=Self>
    where Self: Sized + DoubleEndedIterator;
```

例如：

```rust
fn main() {
    let meals = ["breakfast", "lunch", "dinner"];
    let mut iter = meals.iter().rev();
    assert_eq!(iter.next(), Some(&"dinner"));
    assert_eq!(iter.next(), Some(&"lunch"));
    assert_eq!(iter.next(), Some(&"breakfast"));
    assert_eq!(iter.next(), None);
}
```

#### `inspect`

`inspect` 对于调试很方便，但在生产代码中使用不多。 它只是将闭包应用于每个`item`的共享引用，然后传递该`item`。闭包不会影响`item`，但它可以做一些事情，比如打印它们或对它们进行断言。

例如：

```rust
fn main() {
    let upper_case: String = "große"
        .chars()
        .inspect(|c| println!("before: {:?}", c))
        .flat_map(|c| c.to_uppercase())
        .inspect(|c| println!(" after: {:?}", c))
        .collect();
    assert_eq!(upper_case, "GROSSE");
}
```

小写德语字母`“ß”`的大写等效项是`“SS”`，这就是为什么 `char::to_uppercase` 返回字符的迭代器，而不是单个替换字符。 前面的代码使用 `flat_map` 将 `to_uppercase` 返回的所有序列连接成一个字符串，并打印以下内容：

    before: 'g'
    after: 'G'
    before: 'r'
    after: 'R'
    before: 'o'
    after: 'O'
    before: 'ß'
    after: 'S'
    after: 'S'
    before: 'e'
    after: 'E'

#### `chain`

`chain` 可以将多个迭代器连接起来，它的方法声明如下：

```rust
fn chain<U>(self, other: U) -> impl Iterator<Item=Self::Item>
    where Self: Sized, U: IntoIterator<Item=Self::Item>;
```

例如：

```rust
fn main() {
    let v: Vec<i32> = (1..4).chain(vec![20, 30, 40]).collect();
    assert_eq!(v, [1, 2, 3, 20, 30, 40]);
}
```

`chain` 迭代器是可以反转的，例如：

```rust
fn main() {
    let v: Vec<i32> = (1..4).chain(vec![20, 30, 40]).rev().collect();
    assert_eq!(v, [40, 30, 20, 3, 2, 1]);
}
```

#### `enumerate`

`enumerate` 可以用于在迭代的时候自动加上索引，例如，原本返回 `A, B, C` 序列，现在返回 `(0, A), (1, B), (2, C)`。例如：

```rust
fn main() {
    for (index, num) in (1..4).chain(vec![20, 30, 40]).rev().enumerate() {
        println!("{}, {}", index, num);
    }
}
```

该代码输出：
    0, 40
    1, 30
    2, 20
    3, 3
    4, 2
    5, 1


#### `zip`

`zip` 用于将两个迭代器合成一个迭代器，每次各从一个中取出一个值，组成一对，直到有一个迭代结束。例如：

```rust
fn main() {
    let v: Vec<_> = (0..).zip("ABCD".chars()).collect();
    assert_eq!(v, vec![(0, 'A'), (1, 'B'), (2, 'C'), (3, 'D')]);
}
```

`zip` 的参数可以是任何可迭代对象：

```rust
use std::iter::repeat;

fn main() {
    let endings = vec!["once", "twice", "chicken soup with rice"];
    let rhyme: Vec<(&str, &str)> = repeat("going").zip(endings).collect();
    assert_eq!(
        rhyme,
        vec![
            ("going", "once"),
            ("going", "twice"),
            ("going", "chicken soup with rice")
        ]
    );
}
```

#### `by_ref`

前面看到的大多数的适配器都会获取底层迭代器的所有权，没法再次使用，例如，对于上面的邮件示例，我们想解析邮件标题和邮件内容，可以这样做：

```rust
fn main() {
    let message = "To: jimb\r\n\
 From: superego <editor@oreilly.com>\r\n\
 \r\n\
 Did you get any writing done today?\r\n\
 When will you stop wasting time plotting fractals?\r\n";
    let mut lines = message.lines();

    println!("Headers:");
    for header in lines.by_ref().take_while(|l| !l.is_empty()) {
        println!("{}", header);
    }

    println!("\nBody:");
    for body in lines {
        println!("{}", body);
    }
}
```

调用 `lines.by_ref()` 借用了一个对迭代器的可变引用，而 `take_while` 迭代器正是这个引用的所有者。 该迭代器在第一个 `for` 循环结束时退出时被丢掉，因此您可以在第二个 `for` 循环中再次使用行。该代码输出：

    Headers:
    To: jimb
    From: superego <editor@oreilly.com>

    Body:
    Did you get any writing done today?
    When will you stop wasting time plotting fractals?

#### `cycle`

`cycle` 可以通过底层的迭代器无休止地生成值序列，只要底层的迭代器实现了 `std::clone::Clone`，因为他需要保存它的初始状态并且在每次循环开始时重用它，例如：

```rust
fn main() {
    let dirs = ["North", "East", "South", "West"];
    let mut spin = dirs.iter().cycle();
    assert_eq!(spin.next(), Some(&"North"));
    assert_eq!(spin.next(), Some(&"East"));
    assert_eq!(spin.next(), Some(&"South"));
    assert_eq!(spin.next(), Some(&"West"));
    assert_eq!(spin.next(), Some(&"North"));
    assert_eq!(spin.next(), Some(&"East"));
}
```

