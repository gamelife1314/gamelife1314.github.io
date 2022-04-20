---
title: 【Rust】表达式
date: 2022-04-20 11:12:52
tags:
  - 表达式
  - 《Rust 程序设计》
categories:
  - rust
---

`Rust` 被称作表达式语言，在`C`中，`if`和`switch`是语句，它们不会产生值，也不能在表达式中间使用。在`Rust`中，`if` 和 `match`可以产生值。例如：

```rust
let status = if cpu.temperature <= MAX_TEMP {
        HttpStatus::Ok
    } else {
        HttpStatus::ServerError
    };
}

 println!(
    "Inside the vat, you see {}.",
    match vat.contents {
        Some(brain) => brain.desc(),
        None => "nothing of interest",
    }
);
```

这解释了为什么`Rust`没有`C`的三元运算符`(expr1: Expr2: expr3)`，在 `C` 中，它类似 `if` 语句，而在 `Rust` 中，`if` 完全可以代替。另外大多数控制流在 `C` 中是语句，而在 `Rust` 中是表达式（语句都会以 `;` 结束，而表达式没有）。

<!-- more -->

下面是 `Rust` 中所有支持的表达式列表：

{% grouppicture 2-1 %}

![](express_list-1.png)
![](express_list-2.png)

{% endgrouppicture %}

下面的运算符都是左联运算符。例如：`a - b - c` 被分组成 `(a-b)-c`，而不是 `a - (b - c)`：

> `* / % + - << >> & ^ | && || as`

比较运算符，赋值运算符以及范围运算符 `..` 不能被链在一起使用。

### 代码块和分号

块，也就是一个大括号，是最通用的表达方式，它能产生一个值，可以在任何需要值的地方使用：

```rust
fn main() {
    let display_name = match post.author() {
        Some(author) => author.name(),
        None => {
            let network_info = post.get_network_metadata()?;
            let ip = network_info.client_address();
            ip.to_string()
        }
    };
}
```

`Some(author) =>` 后面是简单的表达式 `author.name()`，而 `None` 后面是一个块表达式，它的值是其中的最后一个表达式 `ip.to_string()` 的值，并且要注意它的后面没有分号。

确实大多数 `Rust` 代码行都是以 `;` 分号结束的，如果一个代码块以 `;` 结束，那么它的值是 `()`。在 `javascript` 中，允许省略 `;`，但是语言会自动填充。在 `Rust` 中有没有分号是有不同的意义的：

```rust
fn main() {
    let msg = {
        // let 语句，分号是必要的
        let dandelion_control = puffball.open();
        // 表达式 + 分号：方法被调用，但是返回值被丢弃
        dandelion_control.release_all_seeds(launch_codes);
        // 表达式没有分号：方法被调用，值被存储在msg中
        dandelion_control.get_status()
    };
}
```

代码块内可以做一些声明，并且在最后返回一个值，能够使代码看起来比较整洁，用多了会觉得很爽。缺点是当忘记加分号时，可能会引发错误。但幸运的是编译器会提示我们。

### 声明

`let` 语句的形式如下，其中的 `type` 和 `expr` 是可以省略的：

> let name: type = expr;

`let` 语句可以只声明一个变量而不用初始化，可以在后面的代码中用赋值语句初始化它。这有时候很有用，我们可以先声明一个变量，然后在下面的控制流代中初始化它：

```rust
let name;
if user.has_nickname() {
    name = user.nickname();
} else {
    name = generate_unique_name();
    user.register(&name);
}
```

这里局部变量有两种不同的方式初始化，但无论哪种方式，`name` 仅被初始化依次，所以无需声明为 `mut` 类型，在没有初始化之前使用变量是不允许的。

`Rust` 代码中允许重新二次定义同名变量，它会在这个二次定义的变量存在期间，将之前的变量屏蔽。在这里，`line` 开始的类型是 `Result<String, io::Error>`，后面又是 `String`，这在代码中是非常常见的，具有同一个语义的变量具有不同的类型。

```rust
for line in file.lines() {
    let line  = line?;
}
```

我们甚至可以在代码块中声明一个 `fn` 或者 `struct`，但是它们的作用域仅限于这个代码块。当我们在代码块中定义函数时，它是不能访问代码块中的局部变量的。例如，下面的 `cmp_by_timestamp_then_name` 不能访问变量 `v`：

```rust
use std::io;
use std::cmp::Ordering;
fn show_files() -> io::Result<()> {
    let mut v = vec![];
    ...
    fn cmp_by_timestamp_then_name(a: &FileInfo, b: &FileInfo) -> Ordering {
        a.timestamp.cmp(&b.timestamp) // first, compare timestamps
        .reverse() // newest file first
        .then(a.path.cmp(&b.path)) // compare paths to break ties
    }
    v.sort_by(cmp_by_timestamp_then_name);
    ...
}
```

### if 和 match

`if` 表达式比较简单，形式如下：

```
if condition1 { 
    block1
} else if condition2 { 
    block2
}else{
    block_n
}
```

每个 `condition` 必须是一个 `bool` 类型的表达式，`Rust` 不会对数字或者指针进行隐式转换。`condition` 两边的括号不是必须的，如果添加了，`rustc` 会给一个告警。

`match` 语句很像 C  语言中的 `switch`，但是更加灵活，下面是一个简单的例子。这很像 `switch` 语句根据 `code` 的值具体执行某个分支的表达式，通配符 `_` 就像 `switch` 中的 `default`，能匹配任何东西，只是它必须放在最后面。将 `_` 放在之前，意味着它的优先级更高，在它的之后匹配都不可达。

```rust
 match code {
    0 => println!("OK"),
    1 => println!("Wires Tangled"),
    2 => println!("User Asleep"),
    _ => println!("Unrecognized Error {}", code)
}
```

`match` 表达式经常用于去区分 `Option` 的两种类型：`Some(v)` 和 `None`：

```rust
match params.get("name") {
    Some(name) => println!("Hello, {}!", name),
    None => println!("Greetings, stranger.")
}
```

`match` 的通用形式如下：

```
match value { 
    pattern => expr,
}
```

如果 `expr` 是一个代码块，那么逗号 `,` 是可以省略的的。`Rust` 从头开始检查 `value` 和哪个 `pattern` 匹配，一旦匹配，表达式 `expr` 就会被执行，后面的 `pattern` 就不会被检查了，所以如果我们将通配符 `_` 放在最前面，那么在它后面的 `pattern` 都不会被检查了。`rust` 中，`match` 表达式必须包含所有可能的情况，例如下面的代码会编译失败:

{% note warning %}

```rust

fn main() {
    let code = 2;
    match code {
        0 => println!("OK"),
        1 => println!("Wires Tangled"),
        2 => println!("User Asleep"),
    }
}
```

编译器提示我们有未覆盖的情况，建议我们使用通配符：

    error[E0004]: non-exhaustive patterns: `i32::MIN..=-1_i32` and `3_i32..=i32::MAX` not covered
    --> src/main.rs:4:11
    |
    4 |     match code {
    |           ^^^^ patterns `i32::MIN..=-1_i32` and `3_i32..=i32::MAX` not covered
    |
    = note: the matched value is of type `i32`
    help: ensure that all possible cases are being handled by adding a match arm with a wildcard pattern, a match arm with multiple or-patterns as shown, or multiple match arms
    |
    7 ~         2 => println!("User Asleep"),
    8 ~         i32::MIN..=-1_i32 | 3_i32..=i32::MAX => todo!(),

{% endnote %}


所有的 `if` 分支返回的值类型必须是相同的：

```rust
let suggested_pet =
    if with_wings { Pet::Buzzard } else { Pet::Hyena }; // ok 

let favorite_number =
    if user.is_hobbit() { "eleventy-one" } else { 9 }; // error 

let best_sports_team =
    if is_hockey_season() { "Predators" }; // 错误，因为会返回数字或者 ()
```

相思地，`match` 表达式也是，所有的分支必须返回相同类型的值：

```rust
let suggested_pet =
    match favorites.element {
        Fire => Pet::RedPanda,
        Air => Pet::Buffalo,
        Water => Pet::Orca,
        _ => None //错误，不兼容的类型
    };
```

更多关于 `match` 的用法可以看 [【Rust】实战突破](/2021/09/05/【Rust】实战突破/#match)。

### if let

这里还有一个 `if` 的形式，`if let` 表达式：

```
if let pattern = expr {
     block1
} else {
    block2
}
```

如果给定的表达式 `expr` 匹配 `pattern`，那么 `block1` 将会运行；如果不匹配，`block2` 就会运行。这种一个比较好的方式从 `Option` 或者 `Result` 获取数据：

```rust
if let Some(cookie) = request.session_cookie { 
    return restore_session(cookie);
}

if let Err(err) = show_cheesy_anti_robot_task() {
    log_robot_attempt(err);
    politely_accuse_user_of_being_a_robot();
}else{ 
    session.mark_as_human();
}
```

`if let` 可以做的事情 `match` 都可以做，`if let` 只是 `match` 的一种简写方式：

```
match expr {
    pattern => { block1 } 
    _ => { block2 }
}
```

