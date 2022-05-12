---
title: 【Rust】表达式
date: 2022-04-20 11:12:52
tags:
  - 表达式
  - 《Rust 程序设计》
categories:
  - rust
---

`Rust` 被称作表达式语言，在`C`中，`if` 和`switch` 是语句，它们不会产生值，也不能在表达式中间使用。在`Rust`中，`if` 和 `match`可以产生值。例如：

```rust
let status = if cpu.temperature <= MAX_TEMP {
    HttpStatus::Ok
} else {
    HttpStatus::ServerError
};

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

![](express_list-1.png)
![](express_list-2.png)

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

代码块内可以做一些声明，并且在最后返回一个值，能够使代码看起来比较整洁，用多了会觉得很爽。缺点是当忘记加分号时，可能会引发错误。但一般情况下是编译器都会提示我们。

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

这里局部变量有两种不同的方式初始化，但无论哪种方式，`name` 仅被初始化一次，所以无需声明为 `mut` 类型，在没有初始化之前使用变量是不允许的。

`Rust` 代码中允许重新二次定义同名变量，它会在这个二次定义的变量存在期间，将之前的变量屏蔽。在这里，`line` 开始的类型是 `Result<String, io::Error>`，后面又是 `String`，这在代码中是非常常见的，具有同一个语义的变量具有不同的类型。

```rust
for line in file.lines() {
    let line  = line?;
}
```

我们甚至可以在代码块中声明一个 `fn` 或者结构体，但是它们的作用域仅限于这个代码块。当我们在代码块中定义函数时，它是不能访问代码块中的局部变量的。例如，下面的 `cmp_by_timestamp_then_name` 不能访问变量 `v`：

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

### `if` 和 `match`

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

`match` 语句很像 `C`  语言中的 `switch`，但是更加灵活，下面是一个简单的例子。这很像 `switch` 语句根据 `code` 的值具体执行某个分支的表达式，通配符 `_` 就像 `switch` 中的 `default`，能匹配任何东西，只是它必须放在最后面。将 `_` 放在之前，意味着它的优先级更高，在它的之后匹配都不可达。

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

{% note danger %}

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
    if user.is_hobbit() { "eleventy-one" } else { 9 }; // 错误

let best_sports_team =
    if is_hockey_season() { "Predators" }; // 错误，因为会返回数字或者 ()
```

同理，`match` 表达式也是，所有的分支必须返回相同类型的值：

```rust
let suggested_pet =
    match favorites.element {
        Fire => Pet::RedPanda,
        Air => Pet::Buffalo,
        Water => Pet::Orca,
        _ => None //错误，不兼容的类型
    };
```

更多关于 `match` 的用法可以看 [【Rust】实战突破](/2021/09/05/【Rust】实战突破/#match)或者 [模式匹配](/2022/04/25/【Rust】枚举和模式匹配/#模式匹配)。

### `if let`

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

`if let` 可以做的事情 `match` 都可以做，所以说 `if let` 只是 `match` 的一种简写方式：

```
match expr {
    pattern => { block1 } 
    _ => { block2 }
}
```

### 循环

这里有四种循环表达式：

```
while condition {
    block
}

while let pattern = expr {
    block
}

loop {
    block
}

for pattern in itertable {
    block
}
```

`Rust` 中的循环语句都是表达式，但是 `while` 和 `for` 的值永远是 `()`，所以它们不是很有用，`loop` 倒是可以返回一个值，当然只有在你声明的时候。

`while` 循环和`C`语言很像，但是 `Rust` 中的 `condition` 必须是精确的 `bool` 类型。

`while let` 类似于 `if let`。在每次循环迭代开始的时候，`expr` 的值如果匹配 `pattern`，那么 `block` 就会运行，负责循环就会退出。

`loop` 经常用于去写无限循环，它会一直重复执行 `block`，直到遇到 `return`，`break` 或者 `panic`。

`for` 循环会计算 `iterable` 表达式获得一个值，然后运行 `block` 依次。这里有许多可以迭代的类型，包括标准集合中所有类型，例如: `vec` 和 `HashMap`。

标准的`C`循环：

```c
for(int i = 0;i < 20; i++) { 
    printf("%d\n", i);
}
```

在 `rust` 中写作如下的形式：

```rust
for i in 0..20 { 
    println!("{}", i);
}
```

`..` 运算符可以生成一个 `range`，它是一个具有两个字段（`start` 和 `end`）的简单结构体。`0..20` 很像标准库中的 `std::ops::Range { start: 0, end: 20 }`。`Range` 可以被用于 `for` 循环，是因为它实现了 `std::iter::IntoIterator`。


有一点需要记住的是 `for` 循环会 `move` 值得所有权并且它包含的元素，所以下面这段代码编译失败：

{% note danger %}

```rust
fn main() {
    let strings = vec!["hello", "world"];
    for s in strings {
        // each String is moved into s here...
        println!("{}", s);
    }
    println!("{} error(s)", strings.len()); // error: use of moved value
}
```

编译器提示我们，由于隐式调用 `.into_iter()` 方法，`strings` 包含的值的所有权已经被转移，他已经处于未初始化状态：

    error[E0382]: borrow of moved value: `strings`
    --> src/main.rs:7:29
        |
    2   |     let strings = vec!["hello", "world"];
        |         ------- move occurs because `strings` has type `Vec<&str>`, which does not implement the `Copy` trait
    3   |     for s in strings {
        |              ------- `strings` moved due to this implicit call to `.into_iter()`
    ...
    7   |     println!("{} error(s)", strings.len()); // error: use of moved value
        |                             ^^^^^^^^^^^^^ value borrowed here after move
        |

{% endnote %}

这看起来很不方便，改进的方式是使用引用迭代集合，例如：

```rust
for rs in &strings {
    println!("String {:?} is at address {:p}.", *rs, rs);
}
```

如果我们在迭代过程中需要对它进行更改，可以获取 `strings` 的 `muteable reference`：

{% note success %}

```rust
fn main() {
    let mut strings = vec!["hello".to_string(), "world".to_string()];
    for s in &mut strings {
        s.push_str("\n");
        println!("{}", s);
    }
    println!("{} error(s)", strings.len()); // error: use of moved value
}
```

运行成功：

    /Users/fudenglong/.cargo/bin/cargo run --color=always --package mandelbrot --bin mandelbrot
        Finished dev [unoptimized + debuginfo] target(s) in 0.00s
        Running `target/debug/mandelbrot`
    hello

    world

    2 error(s)

    Process finished with exit code 0

{% endnote %}

### `break` 和 `continue`

可以使用 `break` 退出 `loop` 循环，在 `loop` 的循环体中，可以给 `break` 一个表达式，它的值变成 `loop` 的值，`loop` 中所有 `break` 的表达式都必须要有相同的类型：

```rust
// Each call to `next_line` returns either `Some(line)`, where
// `line` is a line of input, or `None`, if we've reached the end of 
// the input. Return the first line that starts with "answer: ".
// Otherwise, return "answer: nothing".
let answer = loop {
    if let Some(line) = next_line() {
        if line.starts_with("answer: ") {
            break line; 
        }
    } else {
        break "answer: nothing";
    } 
};
```

`continue` 表达式用于跳到下次迭代：

```rust
// Read some data, one line at a time.
for line in input_lines {
    let trimmed = trim_comments_and_whitespace(line); 
    if trimmed.is_empty() {
        // Jump back to the top of the loop and 
        // move on to the next line of input. 
        continue;
    }
    ... 
}
```

对于嵌套的循环，我们如何直接从内部退出。在 `Rust` 中，我们可以给循环一个`label`，用于在 `break` 时退出到哪层循环。例如：

```rust
'search:
for room in apartment {
    for spot in room.hiding_spots() { 
        if spot.contains(keys) {
            println!("Your keys are {} in the {}.", spot, room);
            break 'search; 
        }
    } 
}
```

当然，`break` 语句也可以将表达式和`label`一起使用：

```rust
// Find the square root of the first perfect square // in the series.
let sqrt = 'outer: loop {
    let n = next_number(); 
    for i in 1.. {
        let square = i*i; 
        if square == n {
            // Found a square root.
            break 'outer i; 
        }
        if square > n {
            // `n` isn't a perfect square, try the next break;
        } 
    }
};
```

`label` 也可以配合 `continue` 使用。

### `return`

`return` 语句用于退出当前的函数，返回值给调用者，特殊情况，`return;` 其实就是 `return ();` 的简写。 函数一般可能没有显示的 `return` 语句，函数体很像一个 `block`，如果最后一个表达式没有以 `;` 结尾，那么它就是函数的返回值，一般情况下，这是 `Rust` 函数中用于返回值得首选方式。

但这并不意味着 `return` 是没用的，就像 `break` 一样，`return` 可以提前结束函数的运行。例如，下面的示例，当函数调用返回错误时，我们可以提前返回：

```rust
let output = match File::create(filename) { 
    Ok(f) => f,
    Err(err) => return Err(err),
};
```

### `never` 类型 `!`

[`!`](https://doc.rust-lang.org/stable/std/primitive.never.html) 表示 `never` 类型。在 `Rust` 中，有些函数，可能包含死循环，`panic!()` 或者类似 `std::process::exit()` ，这些函数都无法正常完成，它们的返回值难以确定是什么类型，例如，标准库中的 [`std::process::exit()`](https://doc.rust-lang.org/std/process/fn.exit.html)，它的源码是这样的：

```rust
pub fn exit(code: i32) -> ! {
    crate::rt::cleanup();
    crate::sys::os::exit(code)
}
```

在`Rust`中，这些函数没有正常类型，未正常完成的表达式被分配到特殊类型`!`，并且它们不受类型必须匹配的规则的约束。例如我们编写下面这样的函数：

```rust
fn serve_forever(socket: ServerSocket, handler: ServerHandler) -> ! { 
    socket.listen();
    loop {
        let s = socket.accept(); 
        handler.handle(s);
    } 
}
```

### 函数和方法调用

函数调用和方法调用同其他的语言比较类似：

```rust
let x = gcd(1302, 462); // function call 
let room = player.location(); // method call
```

`Rust` 在引用和值之间有明显的区分，所以在传递参数时精确的类型，如果函数需要 `i32` 类型，你传入的是 `&i32` 类型就会报错。但是 `.` 运算符放宽了这些规则，在 `player.location()` 的方法调用中，`player` 可能是 `Player`，`&Player`，`Box<Player>` 或者 `Rc<Player>`。`.location()` 方法可以通过值或引用来获取 `player`，因为 `Rust` 的 `.` 运算符能够自动解引用或根据需要创建引用。

另外一种语法是和类型关联的函数，例如 `Vec::new()`，类似于面向对象语言中的静态方法

```rust
let mut numbers = Vec::new(); // type-associated function call
```

方法调用可以串联起来：

```rust
server
    .bind("127.0.0.1:3000").expect("error binding server to address")
    .run().expect("error running server");
```

`Rust` 语法的一个怪癖是，在函数调用或方法调用中，泛型类型的常用语法 `Vec<T>` 不起作用：

{% note danger %}
```rust
return Vec<i32>::with_capacity(1000); // error: something about chained comparisons 

let ramp = (0 .. n).collect<Vec<i32>>(); // same error
```
{% endnote %}

问题是表达式中的 `<` 被当做小于运算符，正确的语法是：

{% note success %}
```rust
return Vec::<i32>::with_capacity(1000); // ok, using ::<

let ramp = (0 .. n).collect::<Vec<i32>>(); // ok, using ::<
```
{% endnote %}

`Rust` 社区将 ` ::<...> ` 叫做 `turbofish`，但是我们也可以省略它们，改由`Rust`进行推断：

{% note success %}
```rust
return Vec::with_capacity(10); // ok, if the fn return type is Vec<i32> 

let ramp: Vec<i32> = (0 .. n).collect(); // ok, variable's type is given
```
{% endnote %}

### 字段和索引

结构体字段的访问和其他语言比较类似，`tuple` 采用相同的语法，只是它只能使用数字作为索引。如果 `.` 左边是个引用或者智能指针，会自动进行解引用：

```rust
game.black_pawns // struct field 
coords.1 // tuple element
```

`[]` 用于访问数组，`slice` 或者 `vector` 的元素：

```rust
pieces[i]
```

这些变量可以被当做左值表达式，如果它们被声明为 `muteable`，例如：

```rust
game.black_pawns = 0x00ff0000_00000000_u64; 
coords.1 = 0;
pieces[2] = Some(Piece::new(Black, Knight, coords));
```

可以使用 `..` 运算符从一个数组，`slice` 或者 `vector` 获取一个 `slice`，例如：

```rust
let second_half = &game_moves[midpoint .. end];
```

`..` 运算符可以省略一些操作数，总共有下面这些操作类型，区间是左闭右开类型的，例如：`0 .. 3` 是 `0, 1, 2`：

```
..      // RangeFull
a ..    // RangeFrom { start: a }
.. b    // RangeTo { end: b } 不包括b
a .. b  // Range { start: a, end: b } 不包括b
```

`..=` 运算符可以包含右边的结束值，例如 `0 ..= 3` 是 `0, 1, 2, 3`：

```rust
..= b // RangeToInclusive { end: b } 
a ..= b // RangeInclusive::new(a, b)
```

但是在循环中，必须要有起始位置，因为循环必须要有个起始点。不过在数组切片中，六种形式都是有用的，如果 `start` 和 `end` 被省略，就会指向 `slice` 全部。

下面是一个分值算法的示例，用于实现快速排序：

```rust
fn quicksort<T: Ord>(slice: &mut [T]) { 
    if slice.len() <= 1 {
        return; // Nothing to sort. 
    }
    
    // Partition the slice into two parts, front and back.
    let pivot_index = partition(slice);
    
    // Recursively sort the front half of `slice`.
    quicksort(&mut slice[.. pivot_index]);
    
    // And the back half.
    quicksort(&mut slice[pivot_index + 1 ..]); 
}
```

### 解引用操作符

一元 `*` 操作符被用于访问引用指向的值，由于 `.` 在访问结构体字段或者方法时会自动解引用，所以 `*` 没有太多发挥的场景。

```rust
let padovan: Vec<u64> = compute_padovan_sequence(n); 
for elem in &padovan {
    draw_triangle(turtle, *elem);
}
```

### 算数，位运算，比较和逻辑运算符

大多数适合是和`C`语言比较相似的，我们来看一些特别的例子。`-` 可以用于表示负数，但是没有对应的 `+`。

```rust
println!("{}", -100);      // -100
println!("{}", -100u32);  // error: can't apply unary `-` to type `u32` 
println!("{}", +100);     // error: expected expression, found `+`
```


与 `C` 中一样， `a % b` 计算除法向零舍入的有符号余数或模数。结果与左操作数的符号相同。请注意，`%` 可用于浮点数和整数：

```rust
let x = 1234.567 % 10.0; // approximately 4.567
```

`Rust` 也继承了 `C` 的位运算符，`&, |, ^, <<, >>`，只是 `Rust` 中使用 `!` 表示 `NOT` 而不是 `~`：

```rust
let hi: u8 = 0xe0; let lo = !hi; // 0x1f
```

移位运算符在处理有符号数时进行符号扩展，在处理无符号整数时进行`0`扩展。

位运算符比比较运算符有更高的优先级，这点和 `C` 语言不太一样。`x & BIT != 0` 表示 `(x & BIT) != 0`。

比较运算符 ` ==, !=, <, <=, >, >=` 中的两个操作数必须要有相同的类型。

逻辑运算符 `||` 和 `&&` 两个操作数必须都是` bool` 类型。

### 赋值

`=` 赋值运算符用于变量的初始化，或者对可变变量，或者它们的字段，内部元素进行赋值。`Rust` 不同与其他语言，默认情况下，变量都是不可变的，也就是不能修改。

另外，如果值是 `non-copy` 类型，那么赋值运算符将会转移它的所有权，值原来的所有者就会变成未初始化状态。

除了基本的赋值运算符之外，还支持组合赋值，例如：`+=`，`*=`，`-=`等等：

```rust
total += item.price;
```
要注意的是，`Rust` 不支持`C`中的链式赋值，所以 `a = b = 3` 是不允许的，也不支持自增自减运算符 `++` 和 `--`。

### 类型转换

`Rust` 中的类型转换需要显示的使用 `as` 关键字：

```rust
let x = 17; // x is type i32
let index = x as usize; // convert to usize
```

下面是几种允许显示转换的类型：

- 内建的数字类型可以相互转换；将整数转换为另一种整数类型始终是明确定义的。转换为更窄的类型会导致截断。转换为更宽的有符号整数是符号扩展的，无符号整数是零扩展的，依此类推。从浮点类型转换为整数类型会向零舍入：`-1.99 as i32` 将会得到 `-1`。如果该值太大而无法放入整数类型，则强制转换会生成整数类型可以表示的最接近的值：`1e6 as u8` 将是 `255`；

- `bool` 或 `char` 类型或类似 `C` 的枚举类型的值可以转换为任何整数类型，但是反过来转换是不允许的，例如，禁止将 `u16` 强制转换为 `char` 类型，因为某些 `u16` 值（如 `0xd800`）对应于无效的 `Unicode` 码点，它不是有效的 `char` 值。有一个标准方法，`std::char::from_u32()`，它执行运行时检查并返回一个 `Option<char>`，但这种转换的需求很少。**作为一个例外，`u8` 是唯一可以转换成 `char` 的类型，因为它的范围 `0-255` 都是有效的 `ASCII` 字符**；

我们说过转换通常需要强制转换。 一些涉及引用类型的转换非常简单，即使没有强制转换，语言也会执行它们。 下面是一些自动转换的场景：

- `String` 类型的值自动转换为 `&str` 类型，无需强制转换；
- `&Vec<i32>` 类型的值自动转换为 `&[i32]` 类型，无需强制转换；
- `&Box<Chessboard>` 类型的值自动转换为 `&Chessboard` 类型，无需强制转换；

这是因为它们实现了 `Deref`，它的目的是使智能指针类型的行为尽可能地像基础值，因此使用 `Box<Chessboard>` 就像使用 `Chessboard` 一样。

### 闭包

`Rust` 有闭包，轻量级的类似函数的值。闭包通常由一个参数列表，在竖线之间给出，后跟一个表达式：

```rust
let is_even = |x| x % 2 == 0
```

`Rust` 可以推断参数类型和返回类型，当然也可以向函数那样明确写出来。但是如果指定了返回类型，则为了语法上的完整性，闭包体必须是一个块：

```rust
let is_even = |x: u64| -> bool x % 2 == 0; // error

let is_even = |x: u64| -> bool { x % 2 == 0 }; // ok
```

闭包的调用和函数调用语法一样：

```rust
assert_eq!(is_even(14), true);
```
