---
title: 【Rust】Unsafe 代码
date: 2022-05-05 14:37:24
tags:
  - Unsafe
  - 《Rust 程序设计》
categories:
  - rust
---

系统编程的秘密乐趣在于，在每一种安全语言和精心设计的抽象之下，都存在着极其`unsafe`的机器语言和小技巧，我们也可以用 `Rust` 来写。

到目前为止，我们介绍的语言可确保程序通过类型、生命周期、边界检查等完全自动地避免内存错误和数据竞争，但是这种自动推断有其局限性，有许多有价值的技术手段是无法被 `Rust` 认可的。             

`Unsafe` 代码告诉 `Rust`，程序选择使用它无法保证安全的特性。通过将代码块或函数标记为 `Unsafe`，可以获得调用标准库中的`unsafe`函数、解引用`unsafe`指针以及调用用其他语言（如 `C` 和 `C++`）编写的函数以及其他能力。 

这种跳出安全 `Rust` 边界的能力使得在 `Rust` 中实现许多 `Rust` 最基本的功能成为可能，就像`C`和`C++`用来实现自己的标准库一样。`Unssafe` 代码允许 `Vec` 有效地管理其缓冲区、`std::io` 能直接和操作系统对话、以及提供并发原语的 `std::thread` 和 `std::sync` 。

本节介绍了使用`unsafe`功能的要点：

- `Rust` 的 `Unsafe` 块在安全的 `Rust` 代码和使用`unsafe`特性的代码之间建立了界限；

- 可以将函数标记为`unsafe`，提醒调用者存他们必须遵守的额外规范以避免未定义的行为；

- 原生指针及其方法允许不受限制地访问内存，并允许构建 `Rust` 类型系统原本禁止的数据结构。尽管 `Rust` 的引用是安全但受约束的，但正如任何 `C` 或 `C++` 程序员所知道的，原生指针是一个强大而锋利的工具；

- 了解未定义行为将帮助理解为什么它会产生比仅仅得到错误结果更严重的后果；

- `unsafe`的`Trait`，类似于`unsafe`的函数，强加了每个实现必须遵循的规约；

<!-- more -->

### `Unsafe` 示例

下面这段程序在原书中说是运行会崩溃，但是在我自己的电脑上并未发生，就当它崩溃了吧。（我的 `Rust` 版本是 `rustc 1.62.0-nightly`）

```rust
fn main() {
    let mut a: usize = 0;
    let ptr = &mut a as *mut usize;
    unsafe {
        *ptr.offset(3) = 0x7000;
    }
}
```

该程序借用了对局部变量 `a` 的可变引用，将其转换为 `*mut usize` 类型的原始指针，然后使用 `offset` 方法在内存中生成一个指针，新指针等于 `ptr + 3 * size_of::<uszie>()`。按原书说这恰好是存储 `main` 的返回地址的地方（这其实得看 `Rust` 的调用规约了）。程序用一个常量覆盖了返回地址，这样从 `main` 中返回的行为就令人惊讶。导致这次崩溃的原因是程序对`unsafe`特性的错误使用，在这里就是滥用解引用原生指针的能力。

一个`unsafe`的特性是会有一个使用规约：但是 `Rust` 不能自动强制执行，所以必须遵循这些规约以避免未定义的行为。

`Unsafe` 代码能跳过常规的类型检查和生命周期检查，但增加了更多的使用规约。通常，`Rust` 本身根本不知道这些规约，它们只是在该功能的文档中进行了解释。例如，原始指针类型有一个规约，禁止解引用已超出其原来范围的指针，此示例中的表达式 `*ptr.offset(3) = ...` 违反了此约定。但是，`Rust` 依然编译了程序：它的安全检查没有检测到这种违规行为。当使用`unsafe`的功能时，作为程序员，有责任检查代码是否符合他们的规约。

许多功能都有正确使用它们应该遵循的规则，但这些规则不是我们在这里所说的意义上的规约，除非可能的后果包括未定义的行为。未定义的行为是 `Rust` 坚信你的代码永远不会出现的行为，例如，`Rust` 假设你不会用其他东西覆盖函数调用的返回地址。通过 `Rust` 的安全检查并遵守非安全功能规约的代码不可能做这样的事情。由于该程序违反了原始指针规约，它的行为是未定义的，所以出错了。

如果代码出现了未定义的行为，`Rust` 就无法保证代码会执行到哪里了，也无法保证结局，更无法保证安全。可能报告出一对不相关的错误消息然后崩溃，或者系统的控制权让出给其他程序，而且不同的 `Rust` 版本之间也不保证一致，也不会存在告警。

只能在`unsafe`代码块或`unsafe`函数中使用`unsafe`的功能；我们将在接下来的部分中解释这两个。通过强制编写一个`unsafe`的块或函数，这使得无意间使用`unsafe` 很困难，`Rust` 确保开发者知道需要遵循额外的规约。

### `Unsafe` 代码块

`Rust` 的 `unsafe` 代码块和普通到的代码块看起来没什么两样，只是由一个 `unsafe` 关键字开始：

```rust
unsafe {
    String::from_utf8_unchecked(ascii)
}
```

如果块前面没有 `unsafe` 关键字，`Rust` 不让使用 `from_utf8_unchecked`，它是一个`unsafe`的函数。有了 `unsafe` 块，可以在任何地方使用此代码。

与普通的 `Rust` 块一样，`unsafe` 代码块的值是其最终表达式的值，如果没有，则为 `()`。前面显示的对 `String::from_utf8_unchecked` 的调用提供了块的值。

`Unsafe` 代码块提供了`5`个编程能力：

- 可以调用`unsafe`的函数，但是每个`unsafe`的函数都必须根据其用途指定自己的规约；

- 可以解引用原始指针，安全代码可以传递原始指针，比较它们，并通过从引用（甚至从整数）转换来创建它们，但只有`unsafe`代码才能真正使用它们来访问内存；

- 可以访问联合体的字段，编译器无法确定它们是否包含代表它们类型的有效位模式；

- 可以访问可变静态变量，`Rust` 无法确定线程何时使用可变静态变量，因此它们的规约要求确保所有访问都是同步的；

- 可以访问通过 `Rust` 的外部函数接口声明的函数和变量。即使它们是不可变的，它们也被认为是 `unsafe` 的，因为它们对于用其他可能不遵守 `Rust` 安全规则的语言编写的代码是可见的；

将 `unsafe` 的功能限制在 `unsafe` 代码块中并不能真正阻止我们要做的事情，这个限制的好处主要在于将开发者的注意力吸引到 `Rust` 无法保证安全的代码上：

- 不会不小心使用了`unsafe`的特性，然后发现要为你甚至不知道的规约负责，肯定是开发者写的，出了事也要自己兜着，别怪 `Rust`；

- 一个 `unsafe` 的区块会引起 `commiter` 的更多关注。一些项目甚至具有自动化来确保这一点，标记为`unsafe`的代码块可以引起特别关注；

- 当考虑编写一个`unsafe`的块时，需要花点时间问问自己你的任务是否真的需要这样的措施。如果是为了性能，你是否有测量表明这实际上是一个瓶颈。也许有一个好方法可以在安全的 `Rust` 中完成同样的事情，不要为了那么一丁点的性能牺牲了整个程序的安全性。

### 高效的 `ASCII`

这里有一个 `Ascii` 类型，一个总是包含有效 `ASCII` 的 `string` 类型，使用了一个 `unsafe` 功能零成本转换成 `String`。

```rust
mod my_ascii {

    /// An ASCII-encoded string.
    #[derive(Debug, Eq, PartialEq)]
    pub struct Ascii(
        // This must hold only well-formed ASCII text:
        // bytes from `0` to `0x7f`.
        Vec<u8>,
    );

    impl Ascii {
        /// Create an `Ascii` from the ASCII text in `bytes`. Return a
        /// `NotAsciiError` error if `bytes` contains any non-ASCII
        /// characters.
        pub fn from_bytes(bytes: Vec<u8>) -> Result<Ascii, NotAsciiError> {
            if bytes.iter().any(|&byte| !byte.is_ascii()) {
                return Err(NotAsciiError(bytes));
            }
            Ok(Ascii(bytes))
        }
    }

    // When conversion fails, we give back the vector we couldn't convert.
    // This should implement `std::error::Error`; omitted for brevity.
    #[derive(Debug, Eq, PartialEq)]
    pub struct NotAsciiError(pub Vec<u8>);
    // Safe, efficient conversion, implemented using unsafe code.
    impl From<Ascii> for String {
        fn from(ascii: Ascii) -> String {
            // If this module has no bugs, this is safe, because
            // well-formed ASCII text is also well-formed UTF-8.
            unsafe { String::from_utf8_unchecked(ascii.0) }
        }
    }
}
```

这个模块的关键是 `Ascii` 类型的定义。类型本身被标记为 `pub`，以使其在 `my_ascii` 模块之外可见。但是该类型的 `Vec<u8>` 元素不是公共的，所以只有 `my_ascii` 模块可以构造一个 `Ascii` 值或引用它的元素。事实上，公共构造函数 `Ascii::from_bytes` 在构造一个`Ascii` 之前仔细检查了可能出现的错误，确保 `Ascii` 值始终包含正确的 `ASCII` 文本，就像 `String` 的方法确保其内容是有效的 `UTF-8` 一样。

这种保证让我们可以非常有效地为 `String` 实现 `From<Ascii>`。`unsafe`的函数 `String::from_utf8_unchecked` 接受一个字节`vector`并从中构建一个字符串，而不检查其内容是否是有效的 `UTF-8` 文本，函数的规约是让调用者对此负责。幸运的是，`Ascii` 类型强制执行的规则正是我们需要满足 `from_utf8_unchecked` 的规约。因为任何 `ASCII` 文本块也是有效的 `UTF-8`，因此 `Ascii` 的底层 V`ec<u8>` 可以立即用作字符串的缓冲区。

有了这些定义，我们可以写出如下的代码：

```rust
use my_ascii::Ascii;

let bytes: Vec<u8> = b"ASCII and ye shall receive".to_vec();
// This call entails no allocation or text copies, just a scan.
let ascii: Ascii = Ascii::from_bytes(bytes).unwrap(); // We know these chosen bytes are ok.
                                                        // This call is zero-cost: no allocation, copies, or scans.
let string = String::from(ascii);
assert_eq!(string, "ASCII and ye shall receive");
```

但使用 `Ascii` 不需要`unsafe`代码块，这里已经使用`unsafe`的操作实现了一个安全的接口，并且只根据模块自己的代码而不是用户的行为来安排满足他们的规约。

`Ascii` 只不过是 `Vec<u8>` 的包装器，隐藏在一个模块中，该模块对其内容实施额外的规则。这种类型称为 `newtype` ，是 `Rust` 中的一种常见模式。`Rust` 的 `String` 类型的定义方式完全相同，只是它的内容被限制为 `UTF-8`，而不是 `ASCII`。下面是标准库中对 `String` 的定义：

```rust
pub struct String {
    vec: Vec<u8>,
}
```

在机器层面上，去掉`Rust`类型，`newtype`和它的元素在内存中有相同的表示，所以构造一个`newtype`根本不需要任何机器指令。在`Ascii::from_bytes`中，表达式`Ascii(bytes)`简单地认为`Vec<u8>`的表示方法现在持有一个`Ascii`值。类似地，`String::from_utf8_unchecked`在内联时可能不需要机器指令：`Vec<u8>`现在被认为是一个字符串。

### `Unsafe` 函数

一个`unsafe`的函数定义看起来像一个普通的函数定义，前面有 `unsafe` 关键字。 `unsafe`函数的主体自动被视为`unsafe`块。

只能在`unsafe`的块中调用`unsafe`的函数。这意味着将函数标记为`unsafe`会提醒调用者使用它们必须认真看文档以避免未定义的行为。

例如，这是我们之前介绍的 `Ascii` 类型的新构造函数，它从字节`vector`构建 `Ascii`，而不检查其内容是否为有效的 `ASCII`：

```rust
// This must be placed inside the `my_ascii` module.
impl Ascii {
    /// Construct an `Ascii` value from `bytes`, without checking
    /// whether `bytes` actually contains well-formed ASCII.
    ///
    /// This constructor is infallible, and returns an `Ascii` directly,
    /// rather than a `Result<Ascii, NotAsciiError>` as the `from_bytes`
    /// constructor does.
    ///
    /// # Safety
    ///
    /// The caller must ensure that `bytes` contains only ASCII
    /// characters: bytes no greater than 0x7f. Otherwise, the effect is
    /// undefined.
    pub unsafe fn from_bytes_unchecked(bytes: Vec<u8>) -> Ascii {
        Ascii(bytes)
    }
}
```

从使用场景来说，可能已经确定调用 `Ascii::from_bytes_unchecked` 的代码的`vector`仅包含 `ASCII` 字符，因此 `Ascii::from_bytes` 坚持执行的检查将是浪费时间。

但之前我们强调了 `Ascii` 的公共构造函数和方法的重要性，以确保 `Ascii` 值的格式正确，而`from_bytes_unchecked` 制定规约将其传递给它的调用者来履行其义务。这个规约将函数标记为 `unsafe` 是完全正确的：尽管函数本身不执行`unsafe`的操作，但它的调用者必须遵循 `Rust` 无法自动强制执行的规约以避免未定义的行为。

你真的可以通过打破 Ascii::from_bytes_unchecked 的合同来导致未定义的行为吗？是的。您可以构造一个包含格式错误的 UTF-8 的字符串，如下所示：

我们可以不遵循 `Ascii::from_bytes_unchecked` 的规约，然后构造一个无效格式的 `UTF-8` 字符串：

{% note danger %}
```rust
// Imagine that this vector is the result of some complicated process
// that we expected to produce ASCII. Something went wrong!
let bytes = vec![0xf7, 0xbf, 0xbf, 0xbf];
let ascii = unsafe {
    // This unsafe function's contract is violated
    // when `bytes` holds non-ASCII bytes.
    my_ascii::Ascii::from_bytes_unchecked(bytes)
};
let bogus: String = ascii.into();
// `bogus` now holds ill-formed UTF-8. Parsing its first character produces
// a `char` that is not a valid Unicode code point. That's undefined
// behavior, so the language doesn't say how this assertion should behave.
assert_eq!(bogus.chars().next().unwrap() as u32, 0x1fffff);
```

在某些版本的Rust中，在某些平台上，这个断言被观察到会失败 时，会出现以下有趣的错误信息（然而我自己测试并未出现）：

    thread 'main' panicked at 'assertion failed: `(left == right)`
    left: `2097151`,
    right: `2097151`', src/main.rs:42:5

{% endnote %}

这两个数字在我们看来是相等的，但这不是`Rust`的错，而是之前`unsafe`代码的错。当我们说未定义行为会导致不可预测的结果时，这就是我们所指的那种情况。

从本质上讲，`Rust`的类型检查器、借用检查器和其他静态检查是在检查你的程序，并试图证明程序中不存在未定义的行为。当`Rust`成功编译你的程序时，这意味着它成功地证明了你的代码是合理的。然而一个`unsafe`的块是这个证明中的一个缺口，这就相当于你对 `Rust` 口头说相信你的代码，不过你口头承诺是否正确，可能取决于程序中影响`unsafe`块中发生的任何部分，而错误的后果可能出现在受`unsafe`块影响的任何地方。编写`unsafe`关键字相当于提醒你，你没有得到语言安全检查的全部保证。          

如果有选择的话，你应该自然而然地倾向于创建没有隐含规约的安全接口。这些接口更容易操作，因为用户可以依靠`Rust`的安全检查来确保他们的代码不存在未定义的行为。即使你的实现使用了`unsafe`的特性，最好还是使用`Rust`的类型、生命周期和模块系统来满足它们的规约。            

不幸的是，在很多地方遇到`unsafe`的函数是很正常的，这些函数的文档并没有对它们的规约进行解释。你应该根据你的经验和对代码行为的了解，自己推断出规则。

### `Unsafe block or Unsafe fn`

使用 `unsafe` 代码块还是 `unsafe` 函数，需要考虑：   

- 如果有可能以一种编译正常但仍导致未定义行为的方式滥用该函数，你必须将其标记为`unsafe`。正确使用该函数的规则就是它的规约；规约的存在就是使该函数`unsafe`的原因；

- 否则，该函数是安全的：对它的良好类型的调用都不会导致未定义的行为，它不应该被标记为`unsafe`。该函数是否在其主体中使用了`unsafe`的特性并不重要，重要的是规约的存在。之前，我们展示了一个没有使用`unsafe`特征的`unsafe`函数，以及一个使用了`unsafe`特性的安全函数。          

不要因为在一个安全函数的主体中使用了`unsafe`的特征，就把它标记为`unsafe`，这将使函数更难使用，并使读者感到困惑，他们会（正常情况下）期望在某处找到规约的解释。

### 未定义行为

在介绍中，我们说过，未定义的行为是指 “`Rust`坚决认为你的代码不可能出现的行为”。这是一个很奇怪的说法，尤其是我们从其他语言的经验中知道，这些行为确实会经常意外发生。为什么这个概念对规定`unsafe`代码的义务有帮助？ 

我们知道编译器是一种编程语言到另一种语言的翻译器。`Rust` 编译器将一个`Rust`程序翻译成一个等效的机器语言程序。但是，如果说这种完全不同的语言的表示的程序是等价的，这意味着什么？ 

意味着两个程序在执行时总是有相同的可见行为，它们进行相同的系统调用，以相同的方式与外部库交互，等等。这有点像程序的图灵测试：如果你无法分辨你是在与原版还是译版互动，那么它们就是等价的。 

现在考虑一下下面的代码：

```rust
let i = 10;
very_trustworthy(&i);
println!("{}", i * 100);
```

即使对`very_trustworthy`的定义一无所知，我们也可以看到它只接收对i的共享引用，所以这个调用不能改变i的值。由于传递给`println!`的值总是`1000`，`Rust`可以将这段代码翻译成机器语言，就像：

```rust
very_trustworthy(&10);
println!("{}", 1000);
```

这个转换后的版本具有与原版相同的行为，而且它的速度可能会快一点。但只有当我们同意这个版本与原始版本具有相同的意义时，考虑这个版本的性能才有意义。如果`very_trustworthy`被定义为以下情况呢？

```rust
fn very_trustworthy(shared: &i32) {
    unsafe {
        // Turn the shared reference into a mutable pointer.
        // This is undefined behavior.
        let mutable = shared as *const i32 as *mut i32;
        *mutable = 20;
    }
}
```

这段代码打破了共享引用的规则：它将`i`的值改为`20`，尽管它不应该被修改，因为`i`是借用来共享的。结果，我们对调用者所做的转换现在有一个非常明显的效果：如果 `Rust` 转换代码，程序会打印 `1000`；如果它不理会代码并使用 `i` 的新值，它会打印 `2000`。在`very_trustworthy` 中打破共享引用的规则意味着共享引用在其调用者中不会像预期的那样运行。                

这类问题几乎出现在`Rust`可能尝试的每一种转换中。即使是将一个函数内联到它的调用位置，也假定当被调用者完成时，控制流将返回到调用站点。但是我们在这一章的开头举了一个甚至违反了这个假设的不良代码的例子。               

对于`Rust`来说，除非它能相信语言的基本功能会按照设计的方式运行，否则基本上不可能评估对程序的转换是否保留了其意义。而他们是否能做到这一点，不仅取决于手头的代码，还取决于程序的其他可能遥远的部分。 为了对你的代码做任何事情，`Rust`必须假设你的程序的其他部分是具有良好的行为。

`Rust` 定义了具有好行为的程序：

- 禁止读未初始化的内存；

- 程序不得创建无效的原始值：

    1. 引用，`Box`或者 `fn` 指针不能是 `Null`；
    2. `bool` 值只能是 `0` 或者 `1`；
    3. 枚举值只能使用有效的项；
    4. `char` 必须是有效的 `Unicode` 码点；
    5. `str` 必须是有效的 `UTF-8`；
    6.  胖指针必须具有有效的 `vtables` 或者 `slice` 长度；
    7.  不得使用 [特殊类型 !](/2022/04/20/【Rust】表达式/#特殊类型) 的任何值；

- 必须遵守引用规则，任何引用都不能比其引用的值活得更久；共享访问是只读访问；可变访问是独占访问；

- 程序不得解引用空指针、不正确对齐的指针或悬空指针；

- 程序不得使用指针访问与指针关联的分配之外的内存；

- 程序必须没有数据争用，当两个线程在没有同步的情况下访问相同的内存位置时，如果至少其中一个访问是写入，就会发生数据竞争；

- The program must not unwind across a call made from another language, via the foreign function interface.

- 程序必须遵守标准库函数的约定；

由于我们还没有一个完整的 `Rust` `unsafe`代码语义模型，这个列表可能会随着时间的推移而演变，但这些可能永远是被禁止的。

任何违反这些规则的行为都会构成未定义的行为，并使 `Rust` 优化程序并将其翻译成机器语言的努力变得不可信。

不使用`unsafe`特性的 `Rust` 代码保证在编译后遵循所有前面的规则。只有当使用`unsafe`功能时，这些规则才会成为必尽责任。

### `Unsafe Trait`

*unsafe trait* 是具有规约的`trait`，`Rust` 无法检查或强制实现者必须满足以避免未定义的行为。要实现`unsafe trait`，必须将实现标记为`unsafe`。由你来理解 `trait` 的`规约`并确保你的类型满足它。

将其类型变量与`unsafe trait`绑定的函数通常是使用`unsafe trait`本身的函数，并且仅通过依赖于`unsafe trait`的规约来满足它们的规约,`trait`的不正确实现可能会导致此类函数表现出未定义的行为。

`std::marker::Send` 和 `std::marker::Sync` 是`unsafe trait`的经典示例。这些`trait`没有定义任何方法，因此对于任何类型都可以轻松实现。但是它们确实有规约：`Send` 要求实现者可以安全地移动到另一个线程，而 `Sync` 要求它们可以安全地通过共享引用在线程之间共享。例如，为不合适的类型实现 `Send` 将使 `std::sync::Mutex` 不能完全避免数据竞争。

举个简单的例子，`Rust` 标准库曾经包含一个`unsafe trait` `core::nonzero::Zeroable`，用于可以通过将所有字节设置为零来安全初始化的类型。显然，将 `usize` 归零很好，但是将 `&T` 归零会给您一个空引用，如果解引用，这将导致崩溃。对于可归零的类型，可以进行一些优化：可以使用 `std::ptr::write_bytes`（`Rust` 的 `memset` 等效项）快速初始化它们的数组，或者使用分配归零页面的操作系统调用。 （`Zeroable` 是不稳定的，在 `Rust 1.26` 的 `num` 包中被转移到仅供内部使用，但它是一个很好的、简单的、真实的例子。） `Zeroable` 是一个典型的标记特征，没有方法或相关类型：

```rust
pub unsafe trait Zeroable {}
```

合适类型的实现同样简单：

```rust
unsafe impl Zeroable for u8 {}
unsafe impl Zeroable for i32 {}
unsafe impl Zeroable for usize {}
```

使用这些定义，我们可以编写一个函数来快速分配一个给定长度的包含 `Zeroable` 类型的`vector`：

```rust
use core::nonzero::Zeroable;

fn zeroed_vector<T>(len: usize) -> Vec<T>
    where T: Zeroable
{
    let mut vec = Vec::with_capacity(len);
    unsafe {
        std::ptr::write_bytes(vec.as_mut_ptr(), 0, len);
        vec.set_len(len);
    }
    vec
}
```

该函数首先创建一个具有所需容量的空 `Vec`，然后调用 `write_bytes` 以用零填充未占用的缓冲区。（`write_bytes` 函数将 `len` 视为 `T` 元素的数量，而不是字节的数量，所以这个调用确实填满了整个缓冲区。）`vector` 的 `set_len` 方法改变它的长度而不对缓冲区做任何事情； 这是不安全的，因为必须确保`vector`的缓冲区空间实际上包含正确初始化的 `T` 类型值。但这正是 `T：Zeroable` 界限所建立的：零字节块表示有效的 `T` 值，我们使用 `set_len` 是安全的。

这里我们可以写：

```rust
let v: Vec<usize> = zeroed_vector(100_000);
assert!(v.iter().all(|&u| u == 0));
```

显然，`Zeroable` 必须是一个不`unsafe trait`，因为不尊重其规约的实现可能会导致未定义的行为：

```rust
struct HoldsRef<'a>(&'a mut i32);

unsafe impl<'a> Zeroable for HoldsRef<'a> { }

let mut v: Vec<HoldsRef> = zeroed_vector(1);

*v[0].0 = 1; // crashes: dereferences null pointer
```

`Rust` 不知道 `Zeroable` 是什么意思，也不知道什么类型会实现它。与任何其他`unsafe`特性一样，由开发者来理解和遵守`unsafe trait`的规约。


