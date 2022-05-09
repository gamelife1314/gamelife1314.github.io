---
title: 【Golang】Application Binary Interface
date: 2022-03-24 17:03:17
categories:
    - golang
---

`ABI（Application Binary Interface）`，即应用程序二进制接口，定义了函数调用时参数和返回值如何传递。就像C语言 `x86-64` 系统中，返回值保存在寄存器 `%rax` 中，前6个参数分别通过寄存器 `%rdi`，`%rsi`，`%rdx`，`%rcx`，`%r8` 以及 `%r9` 中。

但是Go语言使用了一套跨架构通用 `ABI` 设计，它定义了数据在内存上的布局和函数之间的调用规约，这个调用规约是不稳定的，是会随着Go的版本进行变换的，称之为 `ABIInternal`。如果我们想开发汇编代码，应该使用稳定[稳定的 `ABI0`](https://go.dev/doc/asm)。所有的Go函数都遵循 `ABIInternal`，两种调用规约下的函数可以通过透明的 wrapper 相互调用。

之所以有两套调用规约，并且一个是稳定的（`ABI0`，承诺向后兼容），一个是不稳定的（`ABIInternal`，不承诺向后兼容）是因为一开始Go的调用规约约定所有的参数和返回值都通过栈传递，并且很多Go内部的包中有很多基于这个机制编写的汇编代码，例如 `math/big`，如果现在想升级调用规约，那么这么多汇编代码都得重写，显然不是很现实。所以，比较好的办法是引入一种新的私有约定，不承诺向后兼容，但可以在多个调用规约之间透明互调。私有的调用规约用于Go代码最终汇编的生成，稳定的调用规约用于汇编代码开发，由编译器完成两者之间的自动互调用。更多的内容可以查看 [Proposal: Create an undefined internal calling convention](https://go.googlesource.com/proposal/+/master/design/27539-internal-abi.md)。

[Go1.17 Release Notes Compiler](https://go.dev/doc/go1.17#compiler) 就对原有的调用规约做了更新，从基于栈的参数传递更新成基于寄存器，基准测试发现，性能有 `5%` 的提升，二进制大小减少 `2%`，但是 `Go1.17` 只在 `Amd64` 平台上实现了。

[Go1.18 Release Notes Compiler](https://go.dev/doc/go1.18#compiler) 开始支持 `GOARCH=arm64`，`OARCH=ppc64, ppc64le`。在 `64` 位 `ARM` 和 `64` 位 `PowerPC` 系统上，基准测试显示性能提升 `10%` 或更多。

也就是说，在Go的调用规约中，我们需要遵循以下这些点：

- 如果想写汇编代码，那么可以基于 `ABI0`，通过栈传递参数，汇编中使用 `FP` 等伪寄存器传递和访问参数以及返回值；
- `ABI0` 是当前的调用约定，它在堆栈上传递参数和结果，在调用时破坏所有寄存器，并且有一些平台相关的固定寄存器；
- `ABIInternal` 不稳定，可能会随版本变化。最初的时候它是与 `ABI0` 相同的，但 `ABIInternal` 为扩展提供了更多的可能性；

<!--more-->

为了测试Go不同版本的调用规约，我们使用下面的示例代码：

```go abi.go
package abi

import "fmt"

//go:noinline
func add(a, b, c, d, e, f, g, h, i, j int) (int, int, int, int, int, int, int, int, int, int) {
	sum := a + b + c + d + e + f + g + h + i + j
	return sum, 999, 888, 777, 666, 555, 444, 333, 222, 111
}

//go:nosplit
func callAdd() {
	fmt.Println(add(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))
}
```

测试机的系统信息如下：

> Linux ecs-335906 4.18.0-348.7.1.el8_5.x86_64 #1 SMP Wed Dec 22 13:25:12 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux

使用下面的指令获取Go的汇编代码：

> go tool compile -S -l abi.go

### go version go1.17.8 linux/amd64

从下面的汇编代码中可以看出，`Go1.17` 中，前9个参数是通过寄存器传递的分别是 `AX`，`BX`，`CX`，`DI`，`SI`，`R8`，`R9`，`R10`以及`R11`，从第10个开始在栈上传递；返回值的传递使用相同的规则。

```
"".add STEXT nosplit size=88 args=0x58 locals=0x0 funcid=0x0
	0x0000 00000 (abi.go:6)	TEXT	"".add(SB), NOSPLIT|ABIInternal, $0-88
	0x0000 00000 (abi.go:6)	FUNCDATA	$0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (abi.go:6)	FUNCDATA	$1, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (abi.go:6)	FUNCDATA	$5, "".add.arginfo1(SB)
	0x0000 00000 (abi.go:8)	MOVQ	$111, "".~r19+16(SP) // 返回值10
	0x0009 00009 (abi.go:7)	LEAQ	(BX)(AX*1), DX // 计算 a + b，LEAQ指令的特殊运用，可以用来求和
	0x000d 00013 (abi.go:7)	ADDQ	CX, DX         // 计算 a + b + c
	0x0010 00016 (abi.go:7)	ADDQ	DI, DX         // 计算 a + b + c + d
	0x0013 00019 (abi.go:7)	ADDQ	SI, DX         // 计算 a + b + c + d + e
	0x0016 00022 (abi.go:7)	ADDQ	R8, DX         // 计算 a + b + c + d + e + f
	0x0019 00025 (abi.go:7)	ADDQ	R9, DX         // 计算 a + b + c + d + e + f + g
	0x001c 00028 (abi.go:7)	ADDQ	R10, DX        // 计算 a + b + c + d + e + f + g + h
	0x001f 00031 (abi.go:7)	ADDQ	R11, DX        // 计算 a + b + c + d + e + f + g + h + i 放到DX中
	0x0022 00034 (abi.go:7)	MOVQ	"".j+8(SP), R12 // 读取参数10，j，放到R12中
	0x0027 00039 (abi.go:7)	LEAQ	(R12)(DX*1), AX // 计算 DX + j，放到AX中返回
	0x002b 00043 (abi.go:8)	MOVL	$999, BX        // 返回值2
	0x0030 00048 (abi.go:8)	MOVL	$888, CX        // 返回值3
	0x0035 00053 (abi.go:8)	MOVL	$777, DI        // 返回值4
	0x003a 00058 (abi.go:8)	MOVL	$666, SI        // 返回值5
	0x003f 00063 (abi.go:8)	MOVL	$555, R8        // 返回值6
	0x0045 00069 (abi.go:8)	MOVL	$444, R9        // 返回值7
	0x004b 00075 (abi.go:8)	MOVL	$333, R10       // 返回值8
	0x0051 00081 (abi.go:8)	MOVL	$222, R11       // 返回值9
	0x0057 00087 (abi.go:8)	RET

"".callAdd STEXT nosplit size=558 args=0x0 locals=0x148 funcid=0x0
	0x0000 00000 (abi.go:12)	TEXT	"".callAdd(SB), NOSPLIT|ABIInternal, $328-0
	0x0000 00000 (abi.go:12)	SUBQ	$328, SP
	0x0007 00007 (abi.go:12)	MOVQ	BP, 320(SP)
	0x000f 00015 (abi.go:12)	LEAQ	320(SP), BP
	0x0017 00023 (abi.go:12)	FUNCDATA	$0, gclocals·69c1753bd5f81501d95132d08af04464(SB)
	0x0017 00023 (abi.go:12)	FUNCDATA	$1, gclocals·a9e740cbf6936fdd3f94716bd5034c63(SB)
	0x0017 00023 (abi.go:12)	FUNCDATA	$2, "".callAdd.stkobj(SB)
	0x0017 00023 (abi.go:13)	PCDATA	$0, $-2
	0x0017 00023 (abi.go:13)	MOVQ	$10, (SP)  // 参数j
	0x001f 00031 (abi.go:13)	MOVL	$1, AX     // 参数a
	0x0024 00036 (abi.go:13)	MOVL	$2, BX     // 参数b
	0x0029 00041 (abi.go:13)	MOVL	$3, CX     // 参数c
	0x002e 00046 (abi.go:13)	MOVL	$4, DI     // 参数d
	0x0033 00051 (abi.go:13)	MOVL	$5, SI     // 参数e
	0x0038 00056 (abi.go:13)	MOVL	$6, R8     // 参数f
	0x003e 00062 (abi.go:13)	MOVL	$7, R9     // 参数g
	0x0044 00068 (abi.go:13)	MOVL	$8, R10    // 参数h
	0x004a 00074 (abi.go:13)	MOVL	$9, R11    // 参数i
	0x0050 00080 (abi.go:13)	PCDATA	$1, $0
	0x0050 00080 (abi.go:13)	CALL	"".add(SB)
    ...
```

当调用函数 `add` 时，此时的栈结构如下图所示:

![](go1.17-abi.png)

### go version go1.16.15 linux/amd64

可以很明显的看出这个版本中指令较多，参数传递都是通过栈来传递，需要计算的时候再复制到寄存器中进行运算。

```
"".add STEXT nosplit size=179 args=0xa0 locals=0x0 funcid=0x0
	0x0000 00000 (abi.go:6)	TEXT	"".add(SB), NOSPLIT|ABIInternal, $0-160
	0x0000 00000 (abi.go:6)	FUNCDATA	$0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (abi.go:6)	FUNCDATA	$1, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (abi.go:7)	MOVQ	"".a+8(SP), AX    // 参数 a -> AX
	0x0005 00005 (abi.go:7)	MOVQ	"".b+16(SP), CX   // 参数 b -> CX
	0x000a 00010 (abi.go:7)	ADDQ	CX, AX            // a+b -> AX
	0x000d 00013 (abi.go:7)	MOVQ	"".c+24(SP), CX   // 参数 c -> CX
	0x0012 00018 (abi.go:7)	ADDQ	CX, AX            // a+b+c -> AX
	0x0015 00021 (abi.go:7)	MOVQ	"".d+32(SP), CX   // 参数 d -> CX
	0x001a 00026 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d -> AX
	0x001d 00029 (abi.go:7)	MOVQ	"".e+40(SP), CX   // 参数 e -> CX
	0x0022 00034 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e -> AX
	0x0025 00037 (abi.go:7)	MOVQ	"".f+48(SP), CX   // 参数 f -> CX
	0x002a 00042 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e+f -> AX
	0x002d 00045 (abi.go:7)	MOVQ	"".g+56(SP), CX   // 参数 g -> CX
	0x0032 00050 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e+f+g -> AX
	0x0035 00053 (abi.go:7)	MOVQ	"".h+64(SP), CX   // 参数 h -> CX
	0x003a 00058 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e+f+g+h -> AX
	0x003d 00061 (abi.go:7)	MOVQ	"".i+72(SP), CX   // 参数 i -> CX
	0x0042 00066 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e+f+g+h+i -> AX
	0x0045 00069 (abi.go:7)	MOVQ	"".j+80(SP), CX   // 参数 j -> CX
	0x004a 00074 (abi.go:7)	ADDQ	CX, AX            // a+b+c+d+e+f+g+h+i+j -> AX
	0x004d 00077 (abi.go:8)	MOVQ	AX, "".~r10+88(SP)    // 返回值sum
	0x0052 00082 (abi.go:8)	MOVQ	$999, "".~r11+96(SP)
	0x005b 00091 (abi.go:8)	MOVQ	$888, "".~r12+104(SP)
	0x0064 00100 (abi.go:8)	MOVQ	$777, "".~r13+112(SP)
	0x006d 00109 (abi.go:8)	MOVQ	$666, "".~r14+120(SP)
	0x0076 00118 (abi.go:8)	MOVQ	$555, "".~r15+128(SP)
	0x0082 00130 (abi.go:8)	MOVQ	$444, "".~r16+136(SP)
	0x008e 00142 (abi.go:8)	MOVQ	$333, "".~r17+144(SP)
	0x009a 00154 (abi.go:8)	MOVQ	$222, "".~r18+152(SP)
	0x00a6 00166 (abi.go:8)	MOVQ	$111, "".~r19+160(SP)
	0x00b2 00178 (abi.go:8)	RET

"".callAdd STEXT nosplit size=789 args=0x0 locals=0x190 funcid=0x0
	0x0000 00000 (abi.go:12)	TEXT	"".callAdd(SB), NOSPLIT|ABIInternal, $400-0
	0x0000 00000 (abi.go:12)	SUBQ	$400, SP
	0x0007 00007 (abi.go:12)	MOVQ	BP, 392(SP)
	0x000f 00015 (abi.go:12)	LEAQ	392(SP), BP
	0x0017 00023 (abi.go:12)	FUNCDATA	$0, gclocals·69c1753bd5f81501d95132d08af04464(SB)
	0x0017 00023 (abi.go:12)	FUNCDATA	$1, gclocals·a9e740cbf6936fdd3f94716bd5034c63(SB)
	0x0017 00023 (abi.go:12)	FUNCDATA	$2, "".callAdd.stkobj(SB)
	0x0017 00023 (abi.go:13)	PCDATA	$0, $-2
	0x0017 00023 (abi.go:13)	MOVQ	$1, (SP)   // 参数 a
	0x001f 00031 (abi.go:13)	MOVQ	$2, 8(SP)  // 参数 b
	0x0028 00040 (abi.go:13)	MOVQ	$3, 16(SP) // 参数 c
	0x0031 00049 (abi.go:13)	MOVQ	$4, 24(SP) // 参数 d
	0x003a 00058 (abi.go:13)	MOVQ	$5, 32(SP) // 参数 e
	0x0043 00067 (abi.go:13)	MOVQ	$6, 40(SP) // 参数 f
	0x004c 00076 (abi.go:13)	MOVQ	$7, 48(SP) // 参数 g
	0x0055 00085 (abi.go:13)	MOVQ	$8, 56(SP) // 参数 h
	0x005e 00094 (abi.go:13)	MOVQ	$9, 64(SP) // 参数 i
	0x0067 00103 (abi.go:13)	MOVQ	$10, 72(SP)// 参数 j
	0x0070 00112 (abi.go:13)	PCDATA	$1, $0
	0x0070 00112 (abi.go:13)	CALL	"".add(SB)
    ...
```

栈结构如下图所示：

![](go1.16-abi.png)

### ABIInternal 调用 ABI0 函数

假设我们有下面的Go程序，并且使用汇编实现函数`p`和函数`q`，并且采用栈传参的调用规约 `ABI0`，但是我们使用 `Go 1.17`版本编译改代码，发现编译器会自动生成Wrapper函数。

编译方法，把 `main.go` 和 `asm.s` 保存在 `msa` 目录中，放在 `GOPATH` 目录下，使用下面的指令编译：
> go version go1.17.8 linux/amd64
> go build -o testmsa -gcflags="-S -l" msa

{% tabs ABI互调示例 %}

<!-- tab 生成的wrapper函数 -->

Go编译器生成了新的函数 `p` 和 `q`，分别调用我们汇编中的函数，这样就有两个同名的函数，所以使用了 `DUPOK` 这个标记，允许存在多个同名函数，`ABIWRAPPER` 表明这只是一个 `ABI` 包装器。

![](abiinternal-call-abi0.png)

<!-- endtab -->

<!-- tab main.go -->
```go
package main

import "fmt"

var numa, numb uint32

func p()

func q(a, b uint32) (ret0, ret1 uint32)

func main() {
	fmt.Println(numa, numb)
	p()
	fmt.Println(numa, numb)
}

```
<!-- endtab -->

<!-- tab asm.s -->
```
#include "textflag.h"

DATA  ·numa+0(SB)/4, $1
GLOBL ·numa(SB),NOPTR,$4

DATA  ·numb+0(SB)/4, $2
GLOBL ·numb(SB),NOPTR,$4

TEXT ·p(SB), NOSPLIT, $40-0
    SUBQ  $40, SP
    MOVQ  BP, 32(SP)
    LEAQ  32(SP), BP

    MOVQ ·numa(SB), AX
    MOVQ AX, a-40(SP)

    MOVQ ·numb(SB), BX
    MOVQ BX, b-32(SP)

    CALL ·q(SB)

    MOVQ ret0-24(SP), AX
    MOVQ ret1-16(SP), CX
    MOVQ AX, ·numa(SB)
    MOVQ CX, ·numb(SB)

    MOVQ 32(SP), BP
    ADDQ $40, SP

    RET

TEXT ·q(SB), NOSPLIT, $0-24
    MOVQ a+0(FP), DI
    MOVQ DI, ret1+24(FP)

    MOVQ b+8(FP), SI
    MOVQ SI, ret0+16(FP)

    RET

```
<!-- endtab -->

{% endtabs %}

### 相关链接

1. [Go internal ABI specification](https://go.googlesource.com/go/+/refs/heads/master/src/cmd/compile/abi-internal.md)
2. [Proposal: Create an undefined internal calling convention](https://go.googlesource.com/proposal/+/master/design/27539-internal-abi.md)
3. [go1.18 编译器改动](https://go.dev/doc/go1.18#compiler)
3. [go1.17 编译器改动](https://go.dev/doc/go1.17#compiler)