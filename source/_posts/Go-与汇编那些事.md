---
title: Go 汇编语言
date: 2020-02-23 10:42:22
categories:
  - Go语言进阶 
tags:
    - Go 汇编
---

Go语言中很多设计思想和工具都是传承自Plan9操作系统，Go汇编语言也是基于Plan9汇编演化而来。根据Rob Pike的介绍，大神Ken Thompson在1986年为Plan9系统编写的C语言编译器输出的汇编伪代码就是Plan9汇编的前身。所谓的Plan9汇编语言只是便于以手工方式书写该C语言编译器输出的汇编伪代码而已。

无论高级语言如何发展，作为最接近CPU的汇编语言的地位依然是无法彻底被替代的。只有通过汇编语言才能彻底挖掘CPU芯片的全部功能，因此操作系统的引导过程必须要依赖汇编语言的帮助。只有通过汇编语言才能彻底榨干CPU芯片的性能，因此很多底层的加密解密等对性能敏感的算法会考虑通过汇编语言进行性能优化。

对于每一个严肃的Gopher，Go汇编语言都是一个不可忽视的技术。因为哪怕只懂一点点汇编，也便于更好地理解计算机原理，也更容易理解Go语言中动态栈/接口等高级特性的实现原理。而且掌握了Go汇编语言之后，你将重新站在编程语言鄙视链的顶端，不用担心再被任何其它所谓的高级编程语言用户鄙视。

{% asset_img cover.jpg cover %}

<!-- more -->

### 快速入门

Go汇编程序始终是幽灵一样的存在。我们将通过分析简单的Go程序输出的汇编代码，然后照猫画虎用汇编实现一个简单的输出程序。

#### 实现和声明

Go汇编语言并不是一个独立的语言，因为 Go 汇编程序无法独立使用。Go 汇编代码必须以 Go 包的方式组织，同时包中至少要有一个 Go 语言文件用于指明当前包名等基本包信息。如果 Go 汇编代码中定义的变量和函数要被其它Go语言代码引用，还需要通过 Go 语言代码将汇编中定义的符号声明出来。用于变量的定义和函数的定义 Go 汇编文件类似于 C 语言中的 `.c` 文件，而用于导出汇编中定义符号的Go源文件类似于 `C` 语言的 `.h` 文件。

#### 定义整数变量

为了简单，我们先用Go语言定义并赋值一个整数变量，然后查看生成的汇编代码。

首先创建一个pkg.go文件，内容如下：

```go
package pkg

var Id = 9527
```
代码中只定义了一个int类型的包级变量，并进行了初始化。然后用以下命令查看的Go语言程序对应的伪汇编代码：

    $ go tool compile -S pkg.go
    "".Id SNOPTRDATA size=8
    0x0000 37 25 00 00 00 00 00 00                          '.......

其中 `go tool compile` 命令用于调用 Go 语言提供的底层命令工具，其中 `-S` 参数表示输出汇编格式。输出的汇编比较简单，其中 `"".Id` 对应 `Id` 变量符号，变量的内存大小为 `8` 个字节。变量的初始化内容为 `37 25 00 00 00 00 00 00` ，对应十六进制格式的 `0x2537` ，对应十进制为`9527`。`SNOPTRDATA` 是相关的标志，其中 `NOPTR` 表示数据中不包含指针数据。

以上的内容只是目标文件对应的汇编，和Go汇编语言虽然相似当并不完全等价。Go语言官网自带了一个Go汇编语言的入门教程，地址在：https://golang.org/doc/asm 。

Go汇编语言提供了 **DATA** 命令用于初始化包变量，`DATA` 命令的语法如下：

> DATA symbol+offset(SB)/width, value

其中 `symbol` 为变量在汇编语言中对应的标识符，`offset` 是符号开始地址的偏移量，`width` 是要初始化内存的宽度大小，`value` 是要初始化的值。其中当前包中 `Go` 语言定义的符号 `symbol` ，在汇编代码中对应 `·symbol`，其中 `·` 中点符号为一个特殊的 unicode 符号。

我们采用以下命令可以给Id变量初始化为十六进制的 `0x2537`，对应十进制的 `9527`（常量需要以美元符号$开头表示）：

    DATA ·Id+0(SB)/1,$0x37
    DATA ·Id+1(SB)/1,$0x25

变量定义好之后需要导出以供其它代码引用。Go汇编语言提供了 **GLOBL** 命令用于将符号导出：

    GLOBL symbol(SB), width

其中 `symbol` 对应汇编中符号的名字，`width` 为符号对应内存的大小。用以下命令将汇编中的 `·Id` 变量导出：

    GLOBL ·Id, $8

现在已经初步完成了用汇编定义一个整数变量的工作。为了便于其它包使用该 `Id` 变量，我们还需要在 `Go` 代码中声明该变量，同时也给变量指定一个合适的类型。修改 `pkg.go` 的内容如下：

```go
package pkg

var Id int
```

现状Go语言的代码不再是定义一个变量，语义变成了声明一个变量（声明一个变量时不能再进行初始化操作）。而 `Id` 变量的定义工作已经在汇编语言中完成了。我们将完整的汇编代码放到 `pkg_amd64.s` 文件中：

    GLOBL ·Id(SB),$8

    DATA ·Id+0(SB)/1,$0x37
    DATA ·Id+1(SB)/1,$0x25
    DATA ·Id+2(SB)/1,$0x00
    DATA ·Id+3(SB)/1,$0x00
    DATA ·Id+4(SB)/1,$0x00
    DATA ·Id+5(SB)/1,$0x00
    DATA ·Id+6(SB)/1,$0x00
    DATA ·Id+7(SB)/1,$0x00

文件名 `pkg_amd64.s` 的后缀名表示 `AMD64` 环境下的汇编代码文件。虽然pkg包是用汇编实现，但是用法和之前的 Go 语言版本完全一样：

```go
package main

import pkg "pkg包的路径"

func main() {
    println(pkg.Id)
}
```

对于 Go 包的用户来说，用 Go汇编语言 或 Go语言 实现并无任何区别。

{% tabs Go汇编示例 %}

<!-- tab 图示-->
![example.png](example.png)
<!-- endtab -->

<!-- tab pkg.go-->
```go
package pkg

var Id int

```
<!-- endtab -->

<!-- tab pkg_amd64.go -->
```
GLOBL ·Id(SB),$8

DATA ·Id+0(SB)/1,$0x37
DATA ·Id+1(SB)/1,$0x25
DATA ·Id+2(SB)/1,$0x00
DATA ·Id+3(SB)/1,$0x00
DATA ·Id+4(SB)/1,$0x00
DATA ·Id+5(SB)/1,$0x00
DATA ·Id+6(SB)/1,$0x00
DATA ·Id+7(SB)/1,$0x00

```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

import (
	"fmt"
	"go-study/asm_go/pkg"
)

func main() {
	fmt.Println(pkg.Id)
}


```
<!-- endtab -->

{% endtabs %}

#### 定义字符串变量

在前一个例子中，我们通过汇编定义了一个整数变量。现在我们提高一点难度，尝试通过汇编定义一个字符串变量。虽然从Go语言角度看，定义字符串和整数变量的写法基本相同，但是字符串底层却有着比单个整数更复杂的数据结构。

实验的流程和前面的例子一样，还是先用 Go 语言实现类似的功能，然后观察分析生成的汇编代码，最后用 Go 汇编语言仿写。首先创建 `pkg.go` 文件，用 Go 语言定义字符串：

```go
package pkg

var Name = "gopher"
```

然后用以下命令查看的 Go 语言程序对应的伪汇编代码：

    $ go tool compile -S pkg.go
    go.string."gopher" SRODATA dupok size=6
    0x0000 67 6f 70 68 65 72                                gopher
    "".Name SDATA size=16
    0x0000 00 00 00 00 00 00 00 00 06 00 00 00 00 00 00 00  ................
    rel 0+8 t=1 go.string."gopher"+0

输出中出现了一个新的符号 `go.string."gopher"`，根据其长度和内容分析可以猜测是对应底层的 `"gopher"` 字符串数据。因为 `Go` 语言的字符串并不是值类型，`Go` 字符串其实是一种只读的引用类型。如果多个代码中出现了相同的 `"gopher"` 只读字符串时，程序链接后可以引用的同一个符号 `go.string."gopher"` 。因此，该符号有一个 **SRODATA** 标志表示这个数据在只读内存段，`dupok` 表示出现多个相同标识符的数据时只保留一个就可以了。而真正的 `Go` 字符串变量 `Name` 对应的大小却只有 `16` 个字节了。其实 `Name` 变量并没有直接对应 `“gopher”` 字符串，而是对应 `16` 字节大小的 `reflect.StringHeader` 结构体：

    type reflect.StringHeader struct {
        Data uintptr
        Len  int
    }

从汇编角度看，`Name` 变量其实对应的是 `reflect.StringHeader` 结构体类型。前 `8` 个字节对应底层真实字符串数据的指针，也就是符号 `go.string."gopher"` 对应的地址。后 `8` 个字节对应底层真实字符串数据的有效长度，这里是 `6` 个字节。

现在创建 `pkg_amd64.s` 文件，尝试通过汇编代码重新定义并初始化 `Name` 字符串：

```
GLOBL ·NameData(SB),$8
DATA  ·NameData(SB)/8,$"gopher"

GLOBL ·Name(SB),$16
DATA  ·Name+0(SB)/8,$·NameData(SB)
DATA  ·Name+8(SB)/8,$6

```

因为在Go汇编语言中，`go.string."gopher"` 不是一个合法的符号，因此我们无法通过手工创建（这是给编译器保留的部分特权，因为手工创建类似符号可能打破编译器输出代码的某些规则）。因此我们新创建了一个 `·NameData` 符号表示底层的字符串数据。然后定义 `·Name` 符号内存大小为 `16` 字节，其中前 `8` 个字节用 `·NameData` 符号对应的地址初始化，后 `8` 个字节为常量 `6` 表示字符串长度。当用汇编定义好字符串变量并导出之后，还需要在 Go 语言中声明该字符串变量。然后就可以用 Go 语言代码测试 `Name` 变量了：

```go
package main

import (
	"fmt"
	"go-study/asm_string/pkg"
)

func main() {
	fmt.Println(pkg.Name)
}

```

不幸的是这次运行产生了以下错误：

> pkgpath.NameData: missing Go type information for global symbol: size 8

错误提示汇编中定义的 `NameData` 符号没有类型信息。其实 Go 汇编语言中定义的数据并没有所谓的类型，每个符号只不过是对应一块内存而已，因此 `NameData` 符号也是没有类型的。但是 Go 语言是再带垃圾回收器的语言，而 Go 汇编语言是工作在自动垃圾回收体系框架内的。当 Go 语言的垃圾回收器在扫描到 `NameData` 变量的时候，无法知晓该变量内部是否包含指针，因此就出现了这种错误。错误的根本原因并不是 `NameData` 没有类型，而是`NameData` 变量没有标注是否会含有指针信息。通过给 `NameData` 变量增加一个 **NOPTR** 标志，表示其中不会包含指针数据可以修复该错误：

{% tabs GO汇编字符串 %}

<!-- tab 图示 -->
![asm_string.png ](asm_string.png )
<!-- endtab -->

<!-- tab pkg.go -->
```go
package pkg

var Name string

```
<!-- endtab -->

<!-- tab pkg_amd64.s -->
```
#include "textflag.h"

GLOBL ·NameData(SB),NOPTR,$8
DATA  ·NameData(SB)/8,$"gopher"

GLOBL ·Name(SB),$16
DATA  ·Name+0(SB)/8,$·NameData(SB)
DATA  ·Name+8(SB)/8,$6

```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

import (
	"fmt"
	"go-study/asm_string/pkg"
)

func main() {
	fmt.Println(pkg.Name)
}

```
<!-- endtab -->

{% endtabs %}

通过给 `·NameData` 增加 `NOPTR` 标志的方式表示其中不含指针数据。我们也可以通过给 `·NameData` 变量在 Go 语言中增加一个不含指针并且大小为 `8` 个字节的类型来修改该错误：

```go
package pkg

var NameData [8]byte
var Name string
```

我们将 `NameData` 声明为长度为 `8` 的字节数组。编译器可以通过类型分析出该变量不会包含指针，因此汇编代码中可以省略 `NOPTR` 标志。现在垃圾回收器在遇到该变量的时候就会停止内部数据的扫描。在这个实现中，`Name` 字符串底层其实引用的是 `NameData` 内存对应的 `“gopher”` 字符串数据。因此，如果 `NameData` 发生变化，`Name` 字符串的数据也会跟着变化。

{% tabs Go汇编字符串修改字符串 %}

<!-- tab 图示 -->
![图示](asm_string1.png)
<!-- endtab -->

<!-- tab pkg.go-->
```go
package pkg

var NameData [8]byte
var Name string

```
<!-- endtab -->

<!-- tab pkg_amd64.s -->
```
GLOBL ·NameData(SB),$8
DATA  ·NameData(SB)/8,$"gopher"

GLOBL ·Name(SB),$16
DATA  ·Name+0(SB)/8,$·NameData(SB)
DATA  ·Name+8(SB)/8,$6

```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

import (
	"fmt"
	"go-study/asm_string/pkg"
)

func main() {
	fmt.Println(pkg.Name)
	pkg.NameData[0] = '?'
	fmt.Println(pkg.Name)
}

```
<!-- endtab -->

{% endtabs %}

**当然这和字符串的只读定义是冲突的，正常的代码需要避免出现这种情况。最好的方法是不要导出内部的NameData变量，这样可以避免内部数据被无意破坏。**

在用汇编定义字符串时我们可以换一种思维：将底层的字符串数据和字符串头结构体定义在一起，这样可以避免引入 `NameData` 符号：

```
GLOBL ·Name(SB),$24

DATA ·Name+0(SB)/8,$·Name+16(SB)
DATA ·Name+8(SB)/8,$6
DATA ·Name+16(SB)/8,$"gopher"
```

在新的结构中，`Name` 符号对应的内存从 `16` 字节变为 `24` 字节，多出的 `8` 个字节存放底层的 `“gopher”` 字符串。`·Name` 符号前 `16` 个字节依然对应 `reflect.StringHeader` 结构体：`Data` 部分对应 `$·Name+16(SB)` ，表示数据的地址为 `Name` 符号往后偏移 `16` 个字节的位置；`Len` 部分依然对应 `6` 个字节的长度。这是C语言程序员经常使用的技巧。

#### 定义 main 函数

前面的例子已经展示了如何通过汇编定义整型和字符串类型变量。我们现在将尝试用汇编实现函数，然后输出一个字符串。先创建 `main.go` 文件，创建并初始化字符串变量，同时声明 `main` 函数，然后创建 `main_amd64.s` 文件，里面对应main函数的实现：

{% tabs GO汇编main %}

<!-- tab 图示-->
![asm_main](asm_main.png)
<!-- endtab  -->

<!-- tab main.go -->
```go
package main

import "fmt"

var helloworld = "你好, 世界"

func println(s string) {
	fmt.Println(s)
}

func main()

```
<!-- endtab -->

<!-- tab main_amd64.s -->
```
TEXT ·main(SB), $16-0
    MOVQ ·helloworld+0(SB), AX; MOVQ AX, 0(SP)
    MOVQ ·helloworld+8(SB), BX; MOVQ BX, 8(SP)
    CALL ·println(SB)
    RET
```
<!-- tab -->

{% endtabs %}

`TEXT ·main(SB), $16-0` 用于定义 `main` 函数，其中 `$16-0` 表示 `main` 函数的帧大小是 `16` 个字节（对应 `string` 头部结构体的大小，用于给 `println` 函数传递参数），`0` 表示 `main` 函数没有参数和返回值。`main` 函数内部通过调用运行时内部的 `·println(SB)` 函数来打印字符串。然后调用 `·println` 打印换行符号。

Go语言函数在函数调用时，完全通过栈传递调用参数和返回值。先通过 `MOVQ` 指令，将 `helloworld` 对应的字符串头部结构体的 `16` 个字节复制到栈指针 `SP` 对应的 `16` 字节的空间，然后通过 **CALL** 指令调用对应函数。最后使用 **RET** 指令表示当前函数返回。

#### 特殊字符

Go 语言函数或方法符号在编译为目标文件后，目标文件中的每个符号均包含对应包的绝对导入路径。因此目标文件的符号可能非常复杂，比如 `“path/to/pkg.(*SomeType).SomeMethod”`或 `“go.string."abc"”` 等名字。目标文件的符号名中不仅仅包含普通的字母，还可能包含点号、星号、小括弧和双引号等诸多特殊字符。而 Go 语言的汇编器是从 plan9 移植过来的二把刀，并不能处理这些特殊的字符，导致了用 Go 汇编语言手工实现 Go 诸多特性时遇到种种限制。

Go 汇编语言同样遵循 Go 语言少即是多的哲学，它只保留了最基本的特性：`定义变量和全局函数`。其中在变量和全局函数等名字中引入特殊的分隔符号支持 Go语言等包体系。为了简化 Go 汇编器的词法扫描程序的实现，特别引入了 Unicode 中的 中点 `·` 和大写的除法 `/`，对应的 Unicode 码点为 `U+00B7` 和 `U+2215` 。汇编器编译后，中点 `·` 会被替换为 `ASCII` 中的点 `“.”` ，大写的除法会被替换为ASCII码中的除法 `“/”` ，比如 `math/rand·Int` 会被替换为 `math/rand.Int` 。这样可以将中点和浮点数中的小数点、大写的除法和表达式中的除法符号分开，可以简化汇编程序词法分析部分的实现。

即使暂时抛开Go汇编语言设计取舍的问题，在不同的操作系统不同等输入法中如何输入中点`·`和除法`/`两个字符就是一个挑战。这两个字符在 https://golang.org/doc/asm 文档中均有描述，因此直接从该页面复制是最简单可靠的方式。

如果是macOS系统，则有以下几种方法输入中点·：在不开输入法时，可直接用 `option+shift+9` 输入；如果是自带的简体拼音输入法，输入左上角 `~` 键对应`·` ，如果是自带的Unicode输入法，则可以输入对应的 Unicode 码点。其中 Unicode 输入法可能是最安全可靠等输入方式。


### 参考阅读

1. [Go汇编语言](https://chai2010.cn/advanced-go-programming-book/ch3-asm/ch3-01-basic.html)
2. [A Quick Guide to Go's Assembler](https://golang.google.cn/doc/asm)
