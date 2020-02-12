---
title: 'CGO: 站在巨人的肩膀上'
date: 2020-02-05 16:49:57
categories:
  - Go语言进阶 
tags:
    - CGO
---

C/C++ 经过几十年的发展，积累了庞大的软件资产，他们很多已经久经考验而且性能足够优化。Go 语言要是可以站在 C/C++ 这个巨人的肩膀上，借助海量 C/C++ 软件资产，应用场景将会被无限扩展。

{% asset_img cover.png cover %}

<!-- more -->

### 快速入门

我们从 `hello world` 开始，先看一个最简单的 CGO 程序，看一下 CGO 程序长什么样子。

```go
package main

//#include <stdio.h>
import "C"

func main() {
	C.puts(C.CString("hello world\n"))
}

```

这里唯一需要注意的是，CGO 代码块和 `import "C"` 之间不能有空行。


#### 自己编写 C 函数

我们自定义一个 `SayHello()` 函数，用于输出字符串：

```go
package main

/*
#include <stdio.h>

void SayHello(const char *s) {
	puts(s);
}
*/
import "C"

func main() {
	C.SayHello(C.CString("hello world\n"))
}

```

#### 拆分 C 代码和 Go 代码

我们也可以将 C 代码放到单独的文件中，例如将下面的 `hello.c` 和 `main.go` 放到同一目录下：

{% tabs 自己编写C函数 %}

<!-- tab hello.c -->
```c
#include <stdio.h>

void SayHello(const char *s) {
	puts(s);
}
```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

//void SayHello(const char *s);
import "C"

func main() {
	C.SayHello(C.CString("hello world\n"))
}

```
<!-- endtab -->

{% endtabs %}


我们可以继续将代码重新组织拆分，拆分成 `hello.h`，`hello.c` 以及 `main.go`，我们继续来看：

{% tabs 自己编写C函数，继续拆分 %}

<!-- tab hello.h -->
```c
void SayHello(const char *s);
```
<!-- endtab -->

<!-- tab hello.c -->
```c
#include <stdio.h>
#include "hello.h"

 void SayHello(const char *s) {
 	puts(s);
 }
```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

//#include "hello.h"
import "C"

func main() {
	C.SayHello(C.CString("hello world\n"))
}

```
<!-- endtab -->

{% endtabs %}

#### Go 语言实现 C 函数

在上面的例子中，我们将代码返回拆分，以达到模块化组织代码的目的，我们继续进行骚操作，我们将在 `hello.h` 中声明的函数，但是使用 Go 来实现这个 C 语言中约定的函数。

{% tabs 自己编写C函数，Go实现, 2%}

<!-- tab hello.h -->
```c
void SayHello(const char *s);
```
<!-- endtab -->

<!-- tab hello.go -->
```go
package main

import "C"

import "fmt"

//export SayHello
func SayHello(s *C.char)  {
	fmt.Println(C.GoString(s))
}
```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

//#include "hello.h"
import "C"

func main() {
	C.SayHello(C.CString("hello world\n"))
}

```
<!-- endtab -->

{% endtabs %}


#### 面向 C 接口的 Go 编程

我们通过 Go 代码实现 C 接口，使得 CGO 代码中 C 的比例逐渐下降，Go1.10 中增加了一个 `_GoString_` 预定义的 C 语言类型，用来表示 Go 语言字符串。我们对上面的代码进行一次整合：

```go
// +build go1.10

package main

//void SayHello(_GoString_ s);
import "C"
import "fmt"

func main() {
	C.SayHello("Hello world\n")
}

//export SayHello
func SayHello(s string)  {
	fmt.Println(s)
}
```

### CGO 基础

从一个简单的例子开始，我们认识了一个 CGO 程序是什么样子的，如何使用 CGO 编程。事实上，要使用 CGO 编程，需要在安装 C/C++ 工具链，在 MacOS 或者 linux 中需要安装 GCC，Windows 中则需要安装 MinGW 工具，同时需要设置 `CGO_ENABLED=1`，表示 CGO 处于启动状态。本地构建时，CGO 默认是启用的，但是在交叉编译时是默认禁止的。如果需要跨平台 CGO 编译，需要自行设置编译工具，但是这样比较麻烦，所以 github 上有一款跨平台 Golang CGO 编译工具：[https://github.com/karalabe/xgo](https://github.com/karalabe/xgo)。

#### `import "C"`

如果代码中出现 `importt "C"` 语句则表示启用了 CGO 特性，**紧邻**这行语句前面的注释是一种特殊语法，里面包含正常的 C 语言代码，确保 CGO 弃用的情况下， 还可以在当前目录中包含 C/C++ 代码。C 的相关的头文件被包含之后，所有的 C 语言元素都会出现在虚拟的包 "C" 中，需要注意的是 `import "C"` 这个语句需要需要独占一行，不能和其他的 `import` 语句写在一起。

因为 C 和 Go 都是强类型语言，所以在 CGO 中传递的参数类型必须和声明的类型完全一致，而且，传递前必须使用 "C" 中的转换函数转换成对应的 C 类型，不能直接传入 Go 中类型的变量。

同时通过虚拟 C 包导入的语言符号不需要以大写字母开头，不受 Go 语言导出规则约束。

CGO 将当前引用的C语言符号都放到了虚拟的 C 包中，同时当前包依赖的其他 Go 语言包内部也可能通过 CGO 引入了相似的虚拟 C 包，但是不同的 Go 语言包引入的虚拟 C 包之间的符号是不能通用的。例如下面这段代码就是不能运行的：

{% tabs import_c %}

<!-- tab 代码组织 -->
![import_c](import_c.png)
<!-- endtab -->

<!-- tab code.go -->
```go
package another

//#include <stdio.h>
import "C"

type CChar C.char

func (c *CChar) String() string  {
	return C.GoString((*C.char)(c))
}

func PrintCString(cs *C.char)  {
	C.puts(cs)
}
```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

/*
#include <stdio.h>
const char* cs = "hello";
*/
import "C"
import "go-study/cgo_diff_pkg/another"

func main() {
	another.PrintCString(C.cs)
}

```
<!-- endtab -->

<!-- tab 运行错误 -->
![import_c](import_c_err.png)
<!-- endtab -->

{% endtabs %}


#### #cgo 语句

在 `import "C"` 语句前的注释中可以通过 `#cgo` 设置编一阶段和链接阶段的参数，编译阶段的参数主要用于定义相关宏和指定头文件检索路径。链接阶段的参数只要是指定库库文件检索路径和要链接的库文件。

```golang
// #cgo CFLAGS: -DPNG_DEBUG=1 -I./include
// #cgo LDFLAGS: -L/usr/local/lib -lpng
// #include <stdio.h>
import "C"
```

上面的代码中， `CFLAGS` 定义了宏 `PNG_DEBUG`值为 `1`；`-I` 定义了头文件包含的检索目录。`LDFLAGS` 部分的 `-L` 指定了链接时库文件检索目录，`-l` 指定了链接时需要链接 png 库。

由于 C/C++ 遗留问题，C 头文件检索目录可以是相对路径，但是库文件检索目录必须是绝对路径，在库文件的检索目录中可以通过 ${SRCDIR} 变量表示当前包目录的绝对路径：

 >// #cgo LDFLAGS: -L${SRCDIR}/libs -lfoo

上面的代码将在链接时被展开为：

>// #cgo LDFLAGS: -L/go/src/foo/libs -lfoo

`#cgo` 也支持条件选择，当满足某个 CPU 架构或者系统类型时，后面的编译选项才会生效，例如下面的针对 Windows 和非 Windows 的编译和链接选项：

>// #cgo windows CFLAGS: -Dx86=1
>// #cgo !windows LDFLAGS: -lm

如果在不同的系统下，CGO 对应着不同的 C 代码，那么我们可以先使用 #cgo 定义不同的 C 语言宏，然后通过不同的宏来区分不同的代码：

```golang
package main

/*
#cgo windows CFLAGS: -DCGO_OS_WINDOWS=1
#cgo darwin CFLAGS: -DCGO_OS_DARWIN=1
#cgo linux CFLAGS: -DCGO_OS_LINUX=1

#if defined(CGO_OS_WINDOWS)
	const char* os = "windows";
#elif defined(CGO_OS_DARWIN)
	const char* os = "darwin";
#elif defined(CGO_OS_LINUX)
	const char* os = "linux";
#else
	#error("unkown os")
#endif

#include <stdio.h>

*/
import "C"

func main() {
	C.puts(C.os)
}
```

#### build 条件编译

关于条件编译的详情可以在这篇文章中了解更多：[https://studygolang.com/articles/154](https://studygolang.com/articles/154)，官方的描述是在这里：[https://golang.org/pkg/go/build/](https://golang.org/pkg/go/build/)。

`build` 标志是在 Go 或者 CGO 环境下的 C/C++ 文件开头的一种特殊的注释。条件编译类似于前面通过 `#cgo` 在不同平台定义的宏，只有在对应平台的宏被定义后才会编译相应的代码。但是通过 `#cgo` 语句定义宏有两个限制，即它只能是基于 Go 语言支持的 Windows、Darwin 和 Linux 等已经支持的文件系统，如果希望定义一个 DEBUG 标志的宏，`#cgo` 语句就无能为力了。而 Go 语言提供的 build 标志条件编译则容易做到。例如，下面的源文件只有在设置 debug 构建标志是才会被构建，我们来看这样一个例子：

{% tabs build_compile %}

<!-- tab 代码结构 -->
![build_compile](build_compile.png)
<!-- endtab -->

<!-- tab build.go -->
```go
//+build debug

package main

import "fmt"

func init()  {
	fmt.Println("编译了这个文件")
}
```
<!-- endtab -->

<!-- tab main.go -->
```go
package main

import "fmt"

func main() {
	fmt.Println("hello")
}

```
<!-- endtab -->

<!-- tab 运行视频 -->
{% video build_compile.mp4 %}
<!-- endtab -->

{% endtabs %}

当 build 有多个标志时，可以通过逻辑操作的规则来组合使用多个标志。例如，以下构建只有在 "Linux/386" 或 "Darwin 平台费 CGO 环境" 才进行构建：

> // +build linux,386 darwin,!cgo

其中，`linux` 和 `386` 是通过 `,` 分隔表示与，`linux,386` 和 `darwin,!cgo` 通过 ` ` 分隔表示或。

### 类型转换

最初 CGO 事务IE了达到方便从 Go 语言函数调用 C 语言函数（用 C 语言实现 Go 语言函数），以复用 C 语言资源这一目的而出现的（因为 C 语言还会涉及回调函数，自然也会涉及从 C 语言函数调用 Go 语言函数（Go 实现 C 语言函数））。现在，它已经演变为 C 语言和 Go 语言双通信的桥梁。要想利用好 CGO 特性，字眼需要了解两种语言类型之间的转换规则。

#### 数值类型

在 Go 语言中访问 C 语言类型符号时，一般是通过虚拟的 "C" 包访问的，例如 `C.int` 对应 C语言的 int 类型，有些 C 语言类型由多个关键字组成，但通过虚拟的 "C" 包访问C语言类型时名称部分不能为存在空格，例如 `unsigned int` 不能通过 `C.unsigned int` 访问。因此 CGO 为 C 语言基础类型提供了相对应转换规则，例如 `C.uint` 对应 C 语言的 `unsigned int`。

需要注意的是，虽然在 C 语言中 int，short 等类型没有明确定义内存大小，但是在 CGO 中他们的内存大小是确定的。在 CGO 中，C 语言的 int 和 long类型都是对应 4 字节内存大小，size_t 类型可以当做 Go 语言 uint 无符号整形类型对待。

|C语言类型	 |CGO类型	|Go语言类型|
|:--:|:--:|:--:|
|char	|C.char	|byte|
|singed char	|C.schar	|int8|
|unsigned char	|C.uchar	|uint8|
|short	|C.short	|int16|
|unsigned short	|C.ushort	uint16|
|int	|C.int	|int32|
|unsigned int	|C.uint	|uint32|
|long	|C.long	|int32|
|unsigned long|	C.ulong	|uint32|
|long long int|	C.longlong	|int64|
|unsigned long long int|	C.ulonglong	|uint64|
|float	|C.float	|float32|
|double	|C.double	|float64|
|size_t	|C.size_t|	uint|

需要注意的是，虽然在 `C` 语言中 `int`、`short` 等类型没有明确定义内存大小，但是在 `CGO` 中它们的内存大小是确定的。在c`CGO` 中，C语言的`int` 和 `long` 类型都是对应4个字节的内存大小，`size_t` 类型可以当作Go语言uint无符号整数类型对待。

CGO中，虽然C语言的int固定为4字节的大小，但是Go语言自己的`int` 和 `uint` 却在32位和64位系统下分别对应4个字节和8个字节大小。如果需要在C语言中访问Go语言的int类型，可以通过 `GoInt` 类型访问，`GoInt` 类型在CGO工具生成的 `_cgo_export.h` 头文件中定义。其实在 `_cgo_export.h`头文件中，每个基本的Go数值类型都定义了对应的C语言类型，它们一般都是以单词Go为前缀。下面是64位环境下，_cgo_export.h头文件生成的Go数值类型的定义，其中`GoInt`和 `GoUint` 类型分别对应 `GoInt64` 和 `GoUint64`。下面是 `_cgo_export.h` 文件的内容：

{% tabs _cgo_export.h %}

<!-- tab 生成方式 -->
{% video cgo_export.mp4  %}
<!-- endtab -->

<!-- tab _cgo_export.h -->
```c
/* Code generated by cmd/cgo; DO NOT EDIT. */

/* package main */


#line 1 "cgo-builtin-export-prolog"

#include <stddef.h> /* for ptrdiff_t below */

#ifndef GO_CGO_EXPORT_PROLOGUE_H
#define GO_CGO_EXPORT_PROLOGUE_H

#ifndef GO_CGO_GOSTRING_TYPEDEF
typedef struct { const char *p; ptrdiff_t n; } _GoString_;
#endif

#endif

/* Start of preamble from import "C" comments.  */


#line 5 "main.go"
void SayHello(_GoString_ s);

#line 1 "cgo-generated-wrapper"


/* End of preamble from import "C" comments.  */


/* Start of boilerplate cgo prologue.  */
#line 1 "cgo-gcc-export-header-prolog"

#ifndef GO_CGO_PROLOGUE_H
#define GO_CGO_PROLOGUE_H

typedef signed char GoInt8;
typedef unsigned char GoUint8;
typedef short GoInt16;
typedef unsigned short GoUint16;
typedef int GoInt32;
typedef unsigned int GoUint32;
typedef long long GoInt64;
typedef unsigned long long GoUint64;
typedef GoInt64 GoInt;
typedef GoUint64 GoUint;
typedef __SIZE_TYPE__ GoUintptr;
typedef float GoFloat32;
typedef double GoFloat64;
typedef float _Complex GoComplex64;
typedef double _Complex GoComplex128;

/*
  static assertion to make sure the file is being used on architecture
  at least with matching size of GoInt.
*/
typedef char _check_for_64_bit_pointer_matching_GoInt[sizeof(void*)==64/8 ? 1:-1];

#ifndef GO_CGO_GOSTRING_TYPEDEF
typedef _GoString_ GoString;
#endif
typedef void *GoMap;
typedef void *GoChan;
typedef struct { void *t; void *v; } GoInterface;
typedef struct { void *data; GoInt len; GoInt cap; } GoSlice;

#endif

/* End of boilerplate cgo prologue.  */

#ifdef __cplusplus
extern "C" {
#endif


extern void SayHello(GoString p0);

#ifdef __cplusplus
}
#endif

```
<!-- endtab -->
{% endtabs %}

除了 `GoInt` 和 `GoUint` 之外，我们并不推荐直接访问 `GoInt32`、`GoInt64` 等类型。更好的做法是通过C语言的C99标准引入的`<stdint.h>`头文件。为了提高C语言的可移植性，在 `<stdint.h>` 文件中，不但每个数值类型都提供了明确内存大小，而且和Go语言的类型命名更加一致。Go语言类型`<stdint.h>` 头文件类型对比如下表示。

|C语言类型 |CGO类型|Go语言类型|
|:---|:---|:---|
|int8_t|C.int8_t|int8|
|uint8_t|C.uint8_t|uint8|
|int16_t|C.int16_t|int16|
|uint16_t|C.uint16_t|uint16|
|int32_t|C.int32_t|int32|
|uint32_t|C.uint32_t|uint32|
|int64_t|C.int64_t|int64|
|uint64_t|C.uint64_t|uint64

前文说过，如果C语言的类型是由多个关键字组成，则无法通过虚拟的“C”包直接访问(比如C语言的unsigned short不能直接通过C.unsigned short访问)。但是，在 `<stdint.h>` 中通过使用C语言的typedef关键字将unsigned short重新定义为uint16_t这样一个单词的类型后，我们就可以通过C.uint16_t访问原来的unsigned short类型了。对于比较复杂的C语言类型，推荐使用typedef关键字提供一个规则的类型命名，这样更利于在CGO中访问。

#### 字符串切片

在CGO生成的 `_cgo_export.h` 头文件中还会为Go语言的字符串、切片、字典、接口和管道等特有的数据类型生成对应的C语言类型：

```c
typedef struct { const char *p; GoInt n; } GoString;
typedef void *GoMap;
typedef void *GoChan;
typedef struct { void *t; void *v; } GoInterface;
typedef struct { void *data; GoInt len; GoInt cap; } GoSlice;
```

不过需要注意的是，其中只有字符串和切片在CGO中有一定的使用价值，因为CGO为他们的某些GO语言版本的操作函数生成了C语言版本，因此二者可以在Go调用C语言函数时马上使用;而CGO并未针对其他的类型提供相关的辅助函数，且Go语言特有的内存模型导致我们无法保持这些由Go语言管理的内存指针，所以它们C语言环境并无使用的价值。

在导出的C语言函数中我们可以直接使用Go字符串和切片。假设有以下两个导出函数：

```go
//export helloString
func helloString(s string) {}

//export helloSlice
func helloSlice(s []byte) {}
```

CGO生成的_cgo_export.h头文件会包含以下的函数声明：

```c
extern void helloString(GoString p0);
extern void helloSlice(GoSlice p0);
```

不过需要注意的是，如果使用了`GoString`类型则会对`_cgo_export.h`头文件产生依赖，而这个头文件是动态输出的。

Go1.10针对Go字符串增加了一个`_GoString_`预定义类型，可以降低在cgo代码中可能对`_cgo_export.h`头文件产生的循环依赖的风险。我们可以调整helloString函数的C语言声明为：

> extern void helloString(_GoString_ p0);

因为 `_GoString_` 是预定义类型，我们无法通过此类型直接访问字符串的长度和指针等信息。Go1.10同时也增加了以下两个函数用于获取字符串结构中的长度和指针信息：

```c
size_t _GoStringLen(_GoString_ s);
const char *_GoStringPtr(_GoString_ s);
```

更严谨的做法是为C语言函数接口定义严格的头文件，然后基于稳定的头文件实现代码。


#### 结构体，联合以及枚举类型

C语言的结构体、联合、枚举类型不能作为匿名成员被嵌入到Go语言的结构体中。在Go语言中，我们可以通过 `C.struct_xxx` 来访问C语言中定义的 `struct_xxx` 结构体类型。结构体的内存布局按照C语言的通用对齐规则，在32位Go语言环境C语言结构体也按照32位对齐规则，在64位Go语言环境按照64位的对齐规则。对于指定了特殊对齐规则的结构体，无法在CGO中访问

```go
package main

/*
struct A {
    int type;
    int i;
    float f;
};
*/
import "C"
import "fmt"

func main() {
	var a C.struct_A
	a.i = 10
	fmt.Println(a.i)
	fmt.Println(a.f)
	fmt.Println(a._type)
}

```

如果结构体的成员名字中碰巧是Go语言的关键字，可以通过在成员名开头添加下划线来访问，如上述代码。但是如果有2个成员：一个是以Go语言关键字命名，另一个刚好是以下划线和Go语言关键字命名，那么以Go语言关键字命名的成员将会以双下划线开始：

{% tabs 结构体包含Go语言关键字 %}

<!-- tab 示例代码 -->
```go
package main

/*
struct A {
    int        type;
    _GoString_ _type;
};
*/
import "C"
import "fmt"

func main() {
	var a C.struct_A
	a._type = "hello"
	a.__type = 10
	fmt.Printf("%#v\n", a)
	fmt.Println(a.__type, a._type)
}
```

<!-- endtab -->

<!-- tab 运行结果 -->
![运行结果](cgo_struct.png)
<!-- endtab -->

{% endtabs %}

C语言结构体中位字段对应的成员无法在Go语言中访问，如果需要操作位字段成员，需要通过在C语言中定义辅助函数来完成。对应零长数组的成员，也无法在Go语言中直接访问数组的元素：

```go
/*
struct A {
    int   size: 10; // 位字段无法访问
    float arr[];    // 零长的数组也无法访问
};
*/
import "C"
import "fmt"

func main() {
    var a C.struct_A
    fmt.Println(a.size) // 错误: 位字段无法访问
    fmt.Println(a.arr)  // 错误: 零长的数组也无法访问
}
```

在C语言中，我们无法直接访问Go语言定义的结构体类型。

对于联合类型，我们可以通过C.union_xxx来访问C语言中定义的union xxx类型。但是Go语言中并不支持C语言联合类型，它们会被转为对应大小的字节数组。

```go
package main

/*
#include <stdint.h>

union B1 {
    int i;
    float f;
};

union B2 {
    int8_t i8;
    int64_t i64;
};
*/
import "C"
import "fmt"

func main() {
    var b1 C.union_B1;
    fmt.Printf("%T\n", b1) // [4]uint8

    var b2 C.union_B2;
    fmt.Printf("%T\n", b2) // [8]uint8
}
```

如果需要操作C语言的联合类型变量，一般有三种方法：第一种是在C语言中定义辅助函数；第二种是通过Go语言的"encoding/binary"手工解码成员(需要注意大端小端问题)；第三种是使用unsafe包强制转型为对应类型(这是性能最好的方式)。下面展示通过unsafe包访问联合类型成员的方式：

```go
package main

/*
#include <stdint.h>

union B {
    int i;
    float f;
};
*/
import "C"
import (
	"fmt"
	"unsafe"
)

func main() {
	var b C.union_B;
	fmt.Println("b.i:", *(*C.int)(unsafe.Pointer(&b)))
	fmt.Println("b.f:", *(*C.float)(unsafe.Pointer(&b)))
}
```

虽然unsafe包访问最简单、性能也最好，但是对于有嵌套联合类型的情况处理会导致问题复杂化。对于复杂的联合类型，推荐通过在C语言中定义辅助函数的方式处理。

对于枚举类型，我们可以通过C.enum_xxx来访问C语言中定义的enum xxx结构体类型。

```go
package main

/*
enum C {
    ONE,
    TWO,
};
*/
import "C"
import "fmt"

func main() {
	var c C.enum_C = C.TWO
	fmt.Println(c)
	fmt.Println(C.ONE)
	fmt.Println(C.TWO)
}

```

在C语言中，枚举类型底层对应int类型，支持负数类型的值。我们可以通过C.ONE、C.TWO等直接访问定义的枚举值。


#### 数组、字符串和切片

在C语言中，数组名其实对应于一个指针，指向特定类型特定长度的一段内存，但是这个指针不能被修改；当把数组名传递给一个函数时，实际上传递的是数组第一个元素的地址。为了讨论方便，我们将一段特定长度的内存统称为数组。C语言的字符串是一个char类型的数组，字符串的长度需要根据表示结尾的NULL字符的位置确定。C语言中没有切片类型。

在Go语言中，数组是一种值类型，而且数组的长度是数组类型的一个部分。Go语言字符串对应一段长度确定的只读byte类型的内存。Go语言的切片则是一个简化版的动态数组。

Go语言和C语言的数组、字符串和切片之间的相互转换可以简化为Go语言的切片和C语言中指向一定长度内存的指针之间的转换。

CGO的C虚拟包提供了以下一组函数，用于Go语言和C语言之间数组和字符串的双向转换：

```go
// Go string to C string
// The C string is allocated in the C heap using malloc.
// It is the caller's responsibility to arrange for it to be
// freed, such as by calling C.free (be sure to include stdlib.h
// if C.free is needed).
func C.CString(string) *C.char

// Go []byte slice to C array
// The C array is allocated in the C heap using malloc.
// It is the caller's responsibility to arrange for it to be
// freed, such as by calling C.free (be sure to include stdlib.h
// if C.free is needed).
func C.CBytes([]byte) unsafe.Pointer

// C string to Go string
func C.GoString(*C.char) string

// C data with explicit length to Go string
func C.GoStringN(*C.char, C.int) string

// C data with explicit length to Go []byte
func C.GoBytes(unsafe.Pointer, C.int) []byte
```

其中C.CString针对输入的Go字符串，克隆一个C语言格式的字符串；返回的字符串由 C 语言的 `malloc` 函数分配，不使用时需要通过 C 语言的 `free` 函数释放。`C.CBytes` 函数的功能和 `C.CString` 类似，用于从输入的 Go 语言字节切片克隆一个C语言版本的字节数组，同样返回的数组需要在合适的时候释放。`C.GoString` 用于将从 `NULL`结尾的 C 语言字符串克隆一个 Go 语言字符串。`C.GoStringN` 是另一个字符数组克隆函数。`C.GoBytes` 用于从 C 语言数组，克隆一个 Go 语言字节切片。

该组辅助函数都是以克隆的方式运行。当 Go 语言字符串和切片向 C 语言转换时，克隆的内存由 C 语言的 malloc 函数分配，最终可以通过 free 函数释放。当 C 语言字符串或数组向 Go 语言转换时，克隆的内存由 Go 语言分配管理。通过该组转换函数，转换前和转换后的内存依然在各自的语言环境中，它们并没有跨越 Go 语言和 C 语言。克隆方式实现转换的优点是接口和内存管理都很简单，缺点是克隆需要分配新的内存和复制操作都会导致额外的开销。

在 reflect 包中有字符串和切片的定义：

```go
type StringHeader struct {
    Data uintptr
    Len  int
}

type SliceHeader struct {
    Data uintptr
    Len  int
    Cap  int
}
```

如果不希望单独分配内存，可以在Go语言中直接访问C语言的内存空间：

{% tabs CGO数组 %}

<!-- tab 示例代码-->
```go
package main

/*
#include <string.h>
char arr[10];
char *s = "Hello";
*/
import "C"
import (
	"fmt"
	"reflect"
	"unsafe"
)
func main() {
	// 通过 reflect.SliceHeader 转换
	var arr0 []byte
	var arr0Hdr = (*reflect.SliceHeader)(unsafe.Pointer(&arr0))
	arr0Hdr.Data = uintptr(unsafe.Pointer(&C.arr[0]))
	arr0Hdr.Len = 10
	arr0Hdr.Cap = 10


	var s0 string
	var s0Hdr = (*reflect.StringHeader)(unsafe.Pointer(&s0))
	s0Hdr.Data = uintptr(unsafe.Pointer(C.s))
	s0Hdr.Len = int(C.strlen(C.s))

	fmt.Println(arr0, s0)
}
```
<!-- endtab -->

<!-- tab 运行结果 -->
![运行结果](cgo_arr.png)
<!-- endtab -->

{% endtabs %}

因为Go语言的字符串是只读的，用户需要自己保证Go字符串在使用期间，底层对应的C字符串内容不会发生变化、内存不会被提前释放掉。

在CGO中，会为字符串和切片生成和上面结构对应的C语言版本的结构体：

```c
typedef struct { const char *p; GoInt n; } GoString;
typedef struct { void *data; GoInt len; GoInt cap; } GoSlice;
```

在C语言中可以通过GoString和GoSlice来访问Go语言的字符串和切片。如果是Go语言中数组类型，可以将数组转为切片后再行转换。如果字符串或切片对应的底层内存空间由Go语言的运行时管理，那么在C语言中不能长时间保存Go内存对象。


### 课外阅读

1. [https://golang.org/cmd/cgo/](https://golang.org/cmd/cgo/)
2. [https://github.com/golang/go/wiki/cgo](https://github.com/golang/go/wiki/cgo)
3. [Go 语言高级编程](https://chai2010.cn/advanced-go-programming-book/)
