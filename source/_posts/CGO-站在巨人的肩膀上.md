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

### 课外阅读

1. [https://golang.org/cmd/cgo/](https://golang.org/cmd/cgo/)
