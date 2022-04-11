---
title: 【Rust】Fundamental Types
date: 2022-04-10 14:00:03
tags:
  - rust
mathjax: true
---

下面是在 `Rust` 中会看到的类型的总结，展示了Rust的基本类型，标准库中一些非常常见的类型，以及一些用户定义类型的例子。

|Type|Description|Values|
|:--:|:--:|:--:|
|`i8, i16, i32, i64, i128 u8, u16, u32, u64, u128`|给定宽度的有符号和无符号整数|`42`,`-5i8`, `0x400u16`, `0o100i16`, `20_922_789_888_000u64`, `b'*'`|
|`isize`, `usize`|有符号整数和无符号整数， 与计算机上的地址大小相同(32位或64位)|`137`, `-0b0101_0010isize`, `0xffff_fc00usize`|
|`f32`, `f64`|IEEE浮点数，单精度和双精度|`1.61803`, `3.14f32`, `6.0221e23f64`|
|`bool`|Boolean|`true`，`false`|
|`char`|Unicode字符，32位宽|`'*'`, `'\n'`, `'字'`, `'\x7f'`, `'\u{CA0}'`|
|`(char, u8, i32)`|Tuple:允许混合类型|`('%', 0x7f, -1)`|
|`()`| 空元组|`()`|
|`struct S { x: f32, y: f32 }`|字段带名称的复合结构|`S { x: 120.0, y: 209.0 }`|
|`struct T (i32, char);`|Tuple-like struct|`T(120, 'X')`|
|`struct E;`|`Unit-like struct; has no fields`|`E`|
|`enum Attend { OnTime, Late(u32) }`|枚举|`Attend::Late(5), Attend::OnTime`|
|`Box<Attend>`|`Box:拥有指向堆中的值的指针`|`Box::new(Late(15))`|
|`&i32, &mut i32`|共享引用和可变引用:非拥有指针，不能比它们的引用活得更久|`&s.y, &mut v`|
|`String`|动态大小的UTF-8字符串|`"ラーメン: ramen".to_string()`|
|`&str`|`Reference to str: non-owning pointer to UTF-8 text`|`"そば: soba"`, `&s[0..12]`|
|`[f64; 4]`, `[u8; 256]`|数组，固定长度，元素同类型|`[1.0, 0.0, 0.0, 1.0]`, `[b' '; 256]`|
|`Vec<f64>`|变长Vector，元素同类型|`vec![0.367, 2.718, 7.389]`|
|`&[u8],&mut [u8]`|对slice的引用:对数组或向量的一部分的引用，包括指针和长度|`&v[10..20]`, `&mut a[..]`|
|`Option<&str>`|可选值，要么是 `None`，要么是 `Some(v)`|`Some("Dr.")`, `None`|
|`Result<u64, Error>`|可能失败的操作结果，成功就是 `Ok(v)`，失败则是：`Err(e)`|`Ok(4096)`, `Err(Error::last_os_error())`|
|`&dyn Any`, `&mut dyn Read`|Trait对象:引用任何实现了给定方法集的值|`value as &dyn Any,&mut file as &mut dyn Read`|
|`fn(&str) -> bool`|函数指针|`str::is_empty`|
|`(Closure types have no written form)`|闭包|`|a, b| { a*a + b*b }`|

<!-- more -->

### 整数类型

固定宽度的数字类型可能会溢出或失去精度，但它们对于大多数应用程序来说已经足够了，并且可能比任意精度整数和有理素数等表示快数千倍。如果需要这些功能，可以使用 [num](https://crates.io/crates/num)。`Rust` 的类型名称中包含了他们代表的宽度和用途。

|大小|无符号整数|有符号整数|浮点数|
|:--:|:--:|:--:|:--:|
|`8`|`u8`|`i8`||
|`16`|`u16`|`i16`||
|`32`|`u32`|`i32`|`f32`|
|`64`|`u64`|`i64`|`f64`|
|`128`|`u128`|`i128`||
|Machine word|`usize`|`isize`||

`Rust` 有符号数的范围如下：

类型|范围
:--:|:--
`i8`|  $-2^7$ ~ $2^7 - 1$ (−128 ~ 127)
`i16`| $-2^{15}$ ~ $2^{15}−1$ (−32,768 ~ 32,767)
`i32`| $-2^{31}$ ~ $2^{31}−1$ (−2,147,483,648 ~ 2,147,483,647)
`i64`| $-2^{63}$ ~ $2^{63}−1$  (−9,223,372,036,854,775,808 ~ 9,223,372,036,854,775,807)
`i128`| $-2^{127}$ ~ $2^{127}−1$ (roughly ${-1.7} \ast 10^{38}$ ~ $1.7 \ast 10^{38}$)
`isize`|$-2^{31}$ ~ $2^{31}−1$, 或者 $-2^{63}$ ~ $2^{63}−1$ 


`Rust` 无符号数的范围如下：

类型|范围
:--:|:--
`u8`|  0 ~ $2^8−1$ (0 ~ 255)
`u16`| 0 ~ $2^{16}−1$ (0 ~ 65,535)
`u32`| 0 ~ $2^{32}−1$  (0 ~ 4,294,967,295)
`u64`| 0 ~ $2^{64}−1$  (0 ~ 18,446,744,073,709,551,615)
`u128`| 0 ~ $2^{128}−1$ (0 ~ around $3.4 \ast 10^{38}$)
`usize`|0 ~ $2^{32}−1$, 或者 0 ~ $2^{64}−1$ 

`usize`和`isize`类型类似于`C`和`C++`中的`size_t`和`ptrdiff_t`，它们的大小和机器架构有关系，要么是 `32位` 要么是 `64位`。`Rust`要求数组索引为`usize`值。表示数组或向量大小或某些数据结构中元素数量计数的值通常也具有`usize`类型。

数字字面量可以用一个后缀表示它们的类型，例如：`42u8`，`1729isize`。如果没有类型后缀，Rust 会在赋值，函数调用或者比较的时候才确定其类型，也就是在使用的时候将它确定为合适的类型。最后，如果没有指定类型，多种类型也都可以，那么默认是 `i32`，否则，就会报告错误。

数字字面量可以用前缀 `0x`，`0o` 或者 `0b` 表示 `16进制`，`8进制` 或者 `2进制` 数值。

为了在表示长数字时更具可读性，可以在数字之间插入下划线 `_`。例如我们可将 `u32` 的最大值表示为 `4_294_967_295`。下划线的位置并不重要，例如，我们可以在表示16进制数字和2进制数字，以 ` 0xffff_ffff` 的形式进行分割，或者用 `_` 分割数值和类型 `127_u8`。

在 `Rust` 中，可以将字符表示为 `u8` 类型，例如用 `b'X'` 表示字母 `X`，`65` 和 `b'A'` 是完全相等的。对于一些字符不能直接表示，需要转义：

字符|字面量|等价数值
:--:|:--:|:--:|
单引号 |`b'\''`|`39u8`
反斜线  |`b'\\'`|`92u8`
换行键 |`b'\n'`|`10u8`
回车键 |`b'\r'`|`13u8`
水平制表符|`b'\t'`|`9u8`

对于一些很难表示的字符，可以用16进制表示，形式为 `b'\xHH'`。例如，ASCII 码，`27` 代表的 `ESC (Escape)`，我们可以表示为 `\x1b`。

对于数值之间的类型转换，可以使用 `as` 操作符：

```rust
assert_eq!(10_i8 as u16, 10_u16); // in range
assert_eq!(2525_u16 as i16, 2525_i16); // in range

assert_eq!(-1_i16 as i32, -1_i32); // sign-extended
assert_eq!(65535_u16 as i32, 65535_i32); // zero-extended

// Conversions that are out of range for the destination
// produce values that are equivalent to the original modulo 2^N, // where N is the width of the destination in bits. This
// is sometimes called "truncation." 
assert_eq!(1000_i16 as u8, 232_u8);
assert_eq!(65535_u32 as i16, -1_i16);
assert_eq!(-1_i8 as u8, 255_u8);
assert_eq!(255_u8 as i8, -1_i8);
```

标准库提供了很多整数操作方法，例如：

```rust
fn main() {
    assert_eq!(2_u16.pow(4), 16); // exponentiation
    assert_eq!((-4_i32).abs(), 4); // absolute value
    assert_eq!(0b101101_u8.count_ones(), 4); // population count
}
```

更多可以去看每个标准库每个类型的方法，例如 [i16](https://doc.rust-lang.org/std/primitive.i16.html)。

真实编码情况下，我们编码的时候一般不会写类型后缀，但是像下面这样调用方面就会报错:

```rust
fn main() {
    println!("{}", (-4).abs());
}
```

原因是：

> error[E0689]: can't call method `abs` on ambiguous numeric type `{integer}`

这可能会有点令人匪夷所思：所有有符号整数类型都有 `abs`方法，那么有什么问题呢？出于技术原因，`Rust` 想知道一个值在调用该类型自己的方法之前具有哪个整数类型。只有当类型在所有方法调用解决后仍然模棱两可时，`i32` 的默认值才适用，因此在这里提供帮助为时已晚。解决方案是用后缀或使用特定类型的函数来阐明您打算哪种类型：

```rust
fn main() {
    println!("{}", (-4_i32).abs());
    println!("{}", i32::abs(-4));
}
```

因为方法调用比一元操作符优先级高，所我们需要操作数用括号包括，否则 `-4_i32.abs()` 的结果将是 `-4`。

#### 溢出处理

当整数计算溢出时，`debug` 模式下，程序会奔溃。`release` 模式下，程序会一直运行，只是结果就不可期望了。对于下面的测试代码，我们使用两种不同的模式进行运行:

```rust
fn main() {
    let mut i = 1;
    loop {
        i *= 10; // panic: attempt to multiply with overflow // (but only in debug builds!)
    }
}
```

使用 `cargo run` 命令时程序会崩溃，使用 `cargo run --release` 时会一直运行。默认行为或许不是我们想要的， 那么我们可以用显示地表达我们的意图：

- `checked` 相关的方法会检查运算结果，如果数学上是正确的，那么就是会返回 `Some(v)`，否则，会返回 `None`：

    ```rust
    fn main() {
        // The sum of 10 and 20 can be represented as a u8.
        assert_eq!(10_u8.checked_add(20), Some(30));

        // Unfortunately, the sum of 100 and 200 cannot.
        assert_eq!(100_u8.checked_add(200), None);

        // Do the addition; panic if it overflows.
        let sum = x.checked_add(y).unwrap();

        // Oddly, signed division can overflow too, in one particular case.
        // A signed n-bit type can represent -2n−1, but not 2n−1.
        assert_eq!((-128_i8).checked_div(-1), None);
    }
    ```

- `wrapping` operations return the value equivalent to the mathematically correct result modulo the range of the value：

    ```rust
    fn main() {
        // The first product can be represented as a u16;
        // the second cannot, so we get 250000 modulo 216.
        assert_eq!(100_u16.wrapping_mul(200), 20000);
        assert_eq!(500_u16.wrapping_mul(500), 53392);

        // Operations on signed types may wrap to negative values.
        assert_eq!(500_i16.wrapping_mul(500), -12144);

        // In bitwise shift operations, the shift distance
        // is wrapped to fall within the size of the value.
        // So a shift of 17 bits in a 16-bit type is a shift
        // of 1.
        assert_eq!(5_i16.wrapping_shl(17), 10);
    }
    ```

- `Saturating` 相关的操作在溢出时会用类型最大值表示结果：

    ```rust
    fn main() {
        assert_eq!(254_u8.saturating_add(10), 255);
        assert_eq!(32760_i16.saturating_add(10), 32767);
        assert_eq!((-32760_i16).saturating_sub(10), -32768);
    }
    ```

- `Overflowing` 相关的操作会返回一个 `tuple(result, overflowed)`，其中 `result` 是 `wrapping` 将返回的内容，`overflowed` 指示是否发生了溢出：

    ```rust
    fn main() {
        assert_eq!(255_u8.overflowing_sub(2), (253, false));
        assert_eq!(255_u8.overflowing_add(2), (1, true));
    }
    ```

操作名称都以下面的前缀开始：`checked_`, `wrapping_`, `saturating_`, 或者 `overflowing_`，相关的操作有：

Operation| Name suffix|Example
:--:|:--:|:--|
Addition|`add`|`100_i8.checked_add(27) == Some(127)` 
Subtraction|`sub`|`10_u8.checked_sub(11) == None`
Multiplication|`mul`|`128_u8.saturating_mul(3) == 255`
Division|`div`|`64_u16.wrapping_div(8) == 8`
Remainder|`rem`|`(-32768_i16).wrapping_rem(-1) == 0`
Negation|`neg`|`(-128_i8).checked_neg() == None`
Absolute value|`abs`|`(-32768_i16).wrapping_abs() == -32768`
Exponentiation|`pow`|`3_u8.checked_pow(4) == Some(81)`
Bitwise left shift|`shl`|`10_u32.wrapping_shl(34) == 40`
Bitwise right shift|`shr`|`40_u64.wrapping_shr(66) == 10`

### 浮点数

Rust提供IEEE单精度和双精度浮点类型。这些类型包括正负无穷大，不同的正负零值，以及非数字值。单双精度数值的范围如下：

Type|Precision|Range
:--:|:--:|:--:|
`f32`| 单精度（最少6位小数）| Roughly ${–3.4} \ast 10^{38}$ ~ ${+3.4} \ast 10 ^{38}$
`f64`| 双精度 (最少15位小数)|  Roughly ${–1.8} \ast 10^{308}$ ~ ${+1.8} \ast 10^{308}$

Rust 的 `f32` 和 `f64` 对应于 `C`，`C++` 中的 `float` 和 `double`（在支持IEEE浮点的实现中）以及 `Java`（始终使用IEEE浮点）。浮点数的一般形式如下图所示：

![](floating-num.png)

整数部分之后浮点数的每个部分都是可选的，但分数部分、指数或类型后缀至少存在一个，以将其与整数文字区分开来。小数部分可能由一个单独的小数点组成，因此`5.`是一个有效的浮点常数。下面是一些示例：

Literal|Type|Mathematical value
:--:|:--:|:--:|
`-1.5625`|`Inferred`|$−(1\frac{9}{16})$
`2.`|`Inferred` |`2`
`0.25`|`Inferred`|$\frac{1}{4}$
`1e4`|`Inferred`|`10,000`
`40f32`|`f32`|`40`
`9.109_383_56e-31f64`|`f64`|Roughly $9.10938356 \ast 10^{–31}$

`f32`和`f64`类型具有IEEE要求的特殊值的相关常量，如 `INFINITY`、`NEG_INFINITY`（负无穷大）、`NAN`（非数字值）以及`MIN`和`MAX`（最大和最小的有限值）：

```rust
fn main() {
    assert!((-1. / f32::INFINITY).is_sign_negative());
    assert_eq!(-f32::MIN, f32::MAX);
}
```
`f32` 和 `f64` 类型为数学计算关系提供了完整的方法补充；例如，`2f64.sqrt()`是`2`的双精度平方根。一些例子：

```rust
fn main() {
    assert_eq!(5f32.sqrt() * 5f32.sqrt(), 5.); // exactly 5.0, per IEEE
    assert_eq!((-1.01f64).floor(), -2.0);
}
```

同样，方法调用的优先级高于前缀运算符，因此请务必对否定值对方法调用进行校正括号。

`std::f32::consts` 和 `std::f64::consts` 模块提供了各种常用的数学常量，如`E`、`PI`和两个的平方根。

与`C`和`C++`不同，`Rust`几乎不隐式执行数字转换。如果函数期望`f64`参数，则传递`i32`值作为参数是错误的。事实上，Rust甚至不会隐式将`i16`值转换为`i32值`，即使每个`i16`值也是`i32`值。但始终可以使用 `as` 运算符写出显式转换：`i as f64`，或 `x as i32`。

缺乏隐式转换有时使`Rust`表达式比类似的`C`或`C++`代码更冗长。然而，隐式整数转换有可能导致意想不到的安全漏洞，特别是当有关整数代表内存中某些东西的大小，并且发生意想不到的溢出时。根据经验，在`Rust`中写出数字转换的行为提醒我们注意否则我们会错过的问题。

### Bool 类型

`Rust` 的布尔类型 `bool` 具有此类类型的通常两个值，`true` 和 `false`。`==` 和 `<` 等比较运算符产生 `bool` 结果：`2 < 5` 的值为真。

许多语言对在需要布尔值的上下文中使用其他类型的值很宽容：`C`和`C++`隐式将字符、整数、浮点数和指针转换为布尔值，因此它们可以直接用作 `if` 或 `while` 语句中的条件。`Python` 允许在布尔上下文中设置字符串、列表、字典甚至集合，如果这些值是非空的，则将其视为 `true`。无论如何，`rust` 都非常严格：控制结构，例如 `if` 和 `while` 要求其条件语句必须为 `bool` 表达式，逻辑运算符`&&` 和 `||` 也是如此。所以你必须写 `if x != 0 { ... }` 而不是 `if x { ... }`。

`Rust` 的 `as` 操作符可以将bool值转换为整形：

```rust
assert_eq!(false as i32, 0);
assert_eq!(true as i32, 1);
```

但是，`as` 不能将数字转化为 `bool`，所以，必须写显示的比较操作，例如：`x != 0`。虽然`bool`只需要1个bit来表示它，但 `Rust` 使用整个字节来表示内存中的`bool`值，因此可以创建指向它的指针。

### 字符类型

Rust的字符类型 `char` 表示单个`Unicode`字符，为`32`位值。`Rust` 对单个字符使用 `char` 类型，但对字符串和文本流使用 `UTF-8` 编码。因此，字符串将其文本表示为 `UTF-8` 字节序列，而不是字符数组。字符字面量是用单引号括起来的字符，如`'8'`或`'!'`，可以任何 Unicode 字符，例如 '中'。

根据个人喜好，如果喜欢，可以用16进制写出任何一个字符的 Unicode 码：

- 如果字符的代码点在`U+0000`到`U+007F`的范围（也就是ASCII码），那么我们可以将字符写为`\xHH`，其中`HH`是一个两位`16进制`数字。例如，字符文字`*`和`\x2A`是等价的，因为字符`*`的代码点是`42`，或十六进制为`2A`。

- 可以将任何 `Unicode` 字符写成 `\u{HHHHHH}`，其中 `HHHHHH` 是一个`16进制`数字，长度可达 `6` 位数，允许使用下划线分组。例如，字面字符`\u{CA0}`表示字符`ಠ`。

`char`类型能表示的 Unicode 字符码点在 `0x0000 ~ 0xD7FF` 或者 `xE000 ~ 0x10FFFF` 之间。Rust使用类型系统和动态检查来确保字符值始终在允许范围内。

`Rust` 永远不会在 `char` 和任何其他类型之间隐式转换。可以使用转换运算符将字符转换为整数类型；对于小于`32位`的类型，字符值的上位被截断：

```rust
fn main() {
    assert_eq!('*' as i32, 42);
    assert_eq!('ಠ' as u16, 0xca0);
    assert_eq!('ಠ' as i8, -0x60); // U+0CA0 truncated to eight bits, signed
}
```

另一方面，u8是as运算符转换为char的唯一类型：Rust希望as运算符只执行廉价、无误的转换，但u8以外的每个整数类型都包含不允许的Unicode代码点的值，因此这些转换需要运行时检查。相反，标准库函数std::char::from_u32接受任何u32值并返回Option<char>：如果u32不是允许的Unicode代码点，则from_u32返回None；否则，它会返回Some(c)，其中c是char结果。

还有就是，`u8` 是唯一一个被 `as` 用来转换为 `char` 的类型，将其他的数值强制转换成 `char` 都会出错。因为 `u8` 表示的字符总是有效的，`u8` 以外的每个整数类型都包含不允许的`Unicode`代码点的值，因此这些转换需要运行时检查。相反，标准库函数`std::char::from_u32`接受任何`u32`值并返回`Option<char>`，如果`u32`不是允许的`Unicode`码点，则`from_u32`返回`None`；否则，它会返回`Some(c)`，其中`c`是`char`结果。

标准库提供了一些关于字符的有用方法，可以[这里](https://doc.rust-lang.org/std/primitive.char.html)。例如：

```rust
fn main() {
    assert_eq!('*'.is_alphabetic(), false);
    assert_eq!('β'.is_alphabetic(), true);
    assert_eq!('8'.to_digit(10), Some(8));
    assert_eq!('ಠ'.len_utf8(), 3);
    assert_eq!(std::char::from_digit(2, 10), Some('2'));
}
```

### 元组类型

`Tuple`是一个多元组，形式上是一个括号围起来的，逗号分割的元素序列。例如 `("Brazil", 1985)`，它的类型是 `(&str, i32)`，如果将它赋值给变量 `t`，可以通过 `t.0` 或者 `t.1` 访问元素。

在某种程度上，`tuple` 很想 `array`，都表示有序的值序列。有些编程语言中将他们统一在一起，但是在 `rust` 中，这完全是隔离开的。主要有两大区别：

1. `tuple` 的元素类型可以不同，但是数组所有元素的类型都是相同的；
2. `tuple` 只能用常量作为索引，例如 `t.4`，不能用 `t.i` 或者 `t[i]` 去访问第 `i` 个元素；

Rust 中，`tuple` 经常用于函数的多值返回，例如：

> fn split_at(&self, mid: usize) -> (&str, &str);

返回值 `(&str, &str)` 是一个包含两个字符串切片的 `tuple`，可以通过模式匹配将他们赋值给不同的变量:

```rust
fn main() {
    let text = "I see the eigenvalue in thine eye";
    let (head, tail) = text.split_at(21);
    assert_eq!(head, "I see the eigenvalue ");
    assert_eq!(tail, "in thine eye");
}
```

这比下面的代码更具可读性：

```rust
fn main() {
    let text = "I see the eigenvalue in thine eye";
    let temp = text.split_at(21);
    let head = temp.0;
    let tail = temp.1;
    assert_eq!(head, "I see the eigenvalue ");
    assert_eq!(tail, "in thine eye");
}
```

另一种常用的元组类型是零元组`()`。这一般被称为单位类型，因为它只有一个值，也写成 `()`。`Rust` 使用单位类型，虽然其中没有有意义的值可以携带，但上下文仍然需要某种类型。例如，我们可能有这样一个返回值 `Result<(), std::io::Error>`，它在成功时没有返回值，当出错时返回 `std::io::Error`。

还有就是，可以在 `tuple` 的最后一个元素后面添上逗号，但是还是同一个类型，例如 `(&str, i32,)` 和 `(&str, i32)` 是完全等价的。除此之外，`Rust` 在函数参数，数组，结构体或者枚举定义中都允许使用额外的逗号。

对于一元组，也就是只包含单个元素的元祖，也是允许的，例如 `("lonely hearts",) ` 它的类型是 `(&str,)`，这里的逗号就是必须的，为了和括号表达式区分。

### 指针类型

`Rust` 有几种代表内存地址的指针类型。Rust和大多数垃圾收集语言之间存在巨大差别。在Java中，如果类矩形包含一个字段 `Vector2D` 的字段 `upperLeft`，那么 `upperLeft` 是对另一个单独创建的 `Vector2D` 对象的引用。

`Rust` 是不同的，该语言旨在帮助将内存分配保持在最低限度。对于值`((0，0), (1440，900)) `存储为四个相邻整数。如果将其存储在局部变量中，则有一个四个整数宽的局部变量，堆里没有分配任何东西。

这会让内存具有极大的效率，但因此，当Rust程序需要值来指向其他值时，它必须显式使用指针类型。好的是，安全 `Rust` 中使用的指针类型受到限制，以消除未定义的行为，因此在 `Rust` 中比在 `C++` 中正确使用指针容易得多。

本节学习几种指针类型：`reference`，`box` 以及 `unsafe pointer`。

#### References

`&String` 类型的值（发音为`ref String`）是对`String`值的引用，`&i32`是对`i32`的引用，等等。

可以将 `Rust` 视为最基本的类型。在运行时，对`i32` 的引用是保存 `i32` 地址的单个机器字，该地址可能在堆栈上或堆栈中。表达式 `&x` 产生对 `x` 的引用；在Rust术语中，我们说它借用了对x的引用。给定引用 `r`，表达式 `*r` 指的是`r` 指向的值。这些非常像`C`和`C++`中的`&`和`*`运算符。就像`C`指针一样，当引用超出范围时，它不会自动释放任何资源。

然而，与`C`指针不同，`Rust`引用永远不会为空：根本无法在安全的`Rust` 中生成空引用。与 `C` 不同，`Rust` 跟踪值的所有权和生命周期，因此在编译时排除了悬垂指针、重复释放等错误。

`Rust` 有两种形式的引用：

- `&T`：可共享不可变引用，可以一次对给定值进行许多共享引用，但它们是只读的：修改它们指向的值是要禁止的，就像 `C` 中的 `const T*` 一样。

- `&mut T`：可变排它引用，可以读取和修改它指向的值，就像 `C` 中的 `T*` 一样。但只要该类型引用存在，就不会存在任何其他类型的该值引用。

Rust的共享引用和可变引用其实就是 `单读多写`，它可以由任何数量的 `reader` 共享，但 `writer` 始终只有一个，rust 在编译时就会执行这种检查，也是 rust 安全的核心。

