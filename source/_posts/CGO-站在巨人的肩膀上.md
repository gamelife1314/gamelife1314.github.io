---
title: 'CGO: 站在巨人的肩膀上'
date: 2020-02-05 16:49:57
categories:
  - Go语言进阶 
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