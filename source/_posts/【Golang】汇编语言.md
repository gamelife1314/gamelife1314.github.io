---
title: 【Golang】汇编语言
date: 2022-03-01 11:27:32
categories:
    - golang
mathjax: true
---

汇编语言是最接近机器代码的人类可读语言，通过阅读汇编代码，我们可以了解到自己所编写的高级语言代码最终生成的指令都是什么，以便更好的掌握高级语言和了解计算机系统。Go 语言的汇编器基于 [Plan9 汇编器](https://9p.io/sys/doc/asm.html)，并且在此基础之上定义了一些创新。

{% asset_img bg.png 汇编代码 %}

<!-- more -->

### X86-64 汇编

在学习 Go 语言的汇编语法之前，先大致了解下基于 `X86-64` 系列处理器的汇编语言，`X86-64` 是最常见的 Intel 处理器系列，普遍应用于桌面电脑和服务器中，本节的内容大都总结于《深入理解计算机系统》这本书。

#### 示例

演示一段简单的C代码生成的汇编指令。假设我们写了一个 C 语言代码文件，`mstore.c`，它包含如下的函数定义：

```c
long mult2(long, long);

void multstore(long x, long y, long *dest) {
    long t = mult2(x, y);
    *dest = t;
}
```

使用如下的指令生成汇编代码，汇编代码会保存在 `mstore.s` 中：

> gcc -Og -S mstore.c

其内容位：

```
[root@ecs-335906 ~]# cat mstore.s
	.file	"mstore.c"
	.text
	.globl	multstore
	.type	multstore, @function
multstore:
.LFB0:
	.cfi_startproc
	pushq	%rbx
	.cfi_def_cfa_offset 16
	.cfi_offset 3, -16
	movq	%rdx, %rbx
	call	mult2
	movq	%rax, (%rbx)
	popq	%rbx
	.cfi_def_cfa_offset 8
	ret
	.cfi_endproc
.LFE0:
	.size	multstore, .-multstore
	.ident	"GCC: (GNU) 8.5.0 20210514 (Red Hat 8.5.0-4)"
	.section	.note.GNU-stack,"",@progbits
```

我们也可以使用 `-c` 命令行选项，编译并汇编该段代码，这会生成一个二进制文件 `mstore.o`，我们可以使用 `GDB` 调试工具查看 `multstore` 生成的汇编指令：

```
[root@ecs-335906 ~]# gdb mstore.o
...
(gdb) x/14xb multstore
0x0 <multstore>:	0x53	0x48	0x89	0xd3	0xe8	0x00	0x00	0x00
0x8 <multstore+8>:	0x00	0x48	0x89	0x03	0x5b	0xc3
(gdb) disa
disable      disassemble
(gdb) disassemble multstore
Dump of assembler code for function multstore:
   0x0000000000000000 <+0>:	push   %rbx
   0x0000000000000001 <+1>:	mov    %rdx,%rbx
   0x0000000000000004 <+4>:	callq  0x9 <multstore+9>
   0x0000000000000009 <+9>:	mov    %rax,(%rbx)
   0x000000000000000c <+12>:	pop    %rbx
   0x000000000000000d <+13>:	retq
End of assembler dump.
(gdb)
```

或者使用反汇编工具将二进制文件翻译成汇编代码格式：

```
[root@ecs-335906 ~]# objdump -d mstore.o

mstore.o:     file format elf64-x86-64


Disassembly of section .text:

0000000000000000 <multstore>:
   0:	53                   	push   %rbx
   1:	48 89 d3             	mov    %rdx,%rbx
   4:	e8 00 00 00 00       	callq  9 <multstore+0x9>
   9:	48 89 03             	mov    %rax,(%rbx)
   c:	5b                   	pop    %rbx
   d:	c3                   	retq
[root@ecs-335906 ~]#
```

我们可以看到 `multstore` 函数编译成二进制文件之后，占据了 `14` 字节，反汇编工具将它们分成了 `6` 组，每组 `1~5` 个字节不等，每组都是一条指令，右边是等价的汇编语言。其中一些关于机器代码和它的反汇编表示的特性值得注意：

- x86-64的指令长度从1到15个字节不等。常用的指令以及操作数较少的指令所需的子节数少，而那些不太常用或操作数较多的指令所需字节数较多。
- 设计指令格式的方式是，从某个给定位置开始，可以将字节唯一地解码成机器指令。例如，只有指令 `pushg %rbx` 是以字节值 `53` 开头的。
- 反汇编器只是基于机器代码文件中的字节序列来确定汇编代码。它不需要访问该程序的源代码或汇编代码。
- 反汇编器使用的指令命名规则与 GCC 生成的汇编代码使用的有些细微的差别。在我们的示例中，它省略了很多指令结尾的 `q`。这些后缀是大小指示符，在大多数情况中可以省略。相反，反汇编器给 `call` 和 `ret` 指令添加了 `q` 后缀，同样，省略这些后缀也没有问题。

以 `.` 开头的都是指导汇编器和链接器工作的伪指令，去除它们之后，我们可以看到 `multstore` 函数转换成汇编语言之后的指令位：

```
multstore:
	pushq	%rbx
	movq	%rdx, %rbx
	call	mult2
	movq	%rax, (%rbx)
	popq	%rbx
	ret
```

我们常用的 `GCC`，`OBJDUMP` 生成的汇编代码是 `ATT`（根据 `AT&T` 命名，它是运营贝尔实验室多年的公司） 格式，有些 `Microsoft` 生成的格式是 `Intel` 的，这两种格式在许多方面有所不同，例如，我们可以用下面的指令生成 `multstore` 函数的 Intel 格式的汇编代码：

> gcc -Og -S -masm=intel mstore.c

```
multstore:
	push	rbx
	mov	rbx, rdx
	call	mult2
	mov	QWORD PTR [rbx], rax
	pop	rbx
	ret
```

#### 数据格式

大多数GCC生成的汇编代码都有一个字符的后缀，表明操作数的大小。例如数据传送指令有四个变种：`movb`（传送字节），`movw`（传送字），`movl`（传送双字） 以及 `movq`（传送四字）。汇编代使用后缀 `l`表示4字节整数和8字节双精度浮点数，这不会产生歧义，因为浮点数使用的一组完全不同的指令和寄存器。

Intel 派系中，“字（Word）”表示16位数据类型，因此，32位称之为 “双字”，64位称之为 “四字”。下表给出C语言数据类型和对应的 X86-64 表示。

|C声明|Intel 数据类型|汇编代码后缀|大小（字节）|
|:--:|:--:|:--:|:--:|
|char|字节|b|1|
|short|字|w|2|
|int|双字|l|4|
|long|四字|q|8|
|char*|四字|q|8|
|float|单精度|s|4|
|double|双精度|l|8|

#### 寄存器

一个 X86-64 的CPU包含一组16个存储64位值得通用目的寄存器，这些寄存器可以用来存储整数数据和指针。名称都是以 `%r` 开头，不过后面还跟着一些不同的命名规则的名字，这是由于指令集烟花而来的。最初 8086 CPU 有8个16位的寄存器，即 `%ax ~ %sp`，每个寄存器都有特殊的用途。扩展到 IA32架构时，这些寄存器也扩展成32位的，标号从 `%eax ~ %esp`。扩展到 X86-64 之后，原来的8个寄存器扩展成64位，标号从 `%rax ~ %rsp`，除此之外，还增加了8个新的寄存器，它们的标号是按照新的命名规则制定的：从 `%r8 ~ %r15`。

在常见的程序里，不同的寄存器扮演着不同的角色，其中最特别的是栈指针：`%rsp`，用来指明运行时栈的结束为止，约定的用途如下：

![所有16个寄存器的低位部分都可以作为字节，字（16位），双字（32位），四字（64位）来访问](registers.png)

有很多指令能用于复制生成1字节，2字节，4字节和8字节的值。当这些指令以寄存器作为目标时，对于生成小于8字节结果的指令，寄存器中剩余的字节会被按照以下两条规则处理：

- 生成1字节和2字节数字的指令，会保持剩下的字节不变；
- 生成4字节数字的指令，会把高位4字节置为0；

#### 操作数

大多数指令有一个或者多个操作数（operand），指示处执行一个操作中要使用的源数据值，以及放置结果的目标位置。X86-64 支持多种数据格式，源数据可以是常数值，或者从寄存器或者内存中读出，而结果呢可以放在寄存器或者内存中，因此各种不同的操作数可以分为三种类型：`立即数`，`寄存器`， `内存引用`。

##### 立即数

在ATT密码格式中，立即数的表示是 `$` 后面跟一个用标准C表示法的表示的整数。比如 `%-577` 或者 `$0x1F`。不同的指令允许的立即数范围不同，汇编器会自动选择最紧凑的方式进行数值编码。

##### 寄存器

寄存器表示寄存器中的内容，所有16个寄存器中的1字节，2字节，4字节或者8字节中一个作为操作数，这些字节数分别对应于8位，16位，32位或者64位。我们用表示 $r_a$ 表示任意寄存器 `a`，用引用 $R[r_a]$ 表示它的值，这是将寄存器看成一个数组 `R`，用寄存器标识符作为索引。

##### 内存引用

内存引用根据计算出来的地址（通常称为有效地址）访问某个内存位置。通常情况下，我们将内存看成一个大的字节数组，因此用符号 $M_b[Addr]$ 表示对存储在内存中从地址 `Addr` 开始的 `b` 个字节值的引用，为了方便，通常省去下标 `b`，最常用的内存引用表示形式是 $Imm(r_b,r_i,s)$ ，这里的引用有四个组成部分：
- `Imm`：立即数偏移；
- $r_b$：基址寄存器，必须是64位寄存器；
- $r_i$：变址寄存器，必须是64位寄存器；
- `s`：比例因子，必须是 `1`，`2`，`4`，或者 `8`，编译器根据源代码中数组的类型来确定比例因子，`char` 类型是 `1`，`int` 类型是 `4`，`double` 类型是8。

有效地址被计算为：$Imm + R[r_b] + R[r_i] · s$，引用数组元素时，会用到通用模式，其他形式都是这种通用形式的特殊情况，省略了某些部分而已，有关计算机寻址方式可以查看：

- [基址加变址寻址方式-百度百科](https://baike.baidu.com/item/%E5%9F%BA%E5%9D%80%E5%8A%A0%E5%8F%98%E5%9D%80%E5%AF%BB%E5%9D%80%E6%96%B9%E5%BC%8F/6686487)
- [寻址模式-维基百科](https://zh.wikipedia.org/wiki/%E5%AF%BB%E5%9D%80%E6%A8%A1%E5%BC%8F)

下面的表格给出常用的操作数类型机器含义：

|类型|格式|操作数值|名称|
|:--:|:--:|:--:|:--:|
|立即数|`$Imm`|`Imm`|立即数值|
|寄存器|$r_a$|$R[r_a]$|寄存器寻址|
|存储器|`Imm`|`M[Imm]`|绝对寻址|
|存储器|$(r_a)$|$M[R[r_a]]$|间接寻址|
|存储器|$Imm(r_b)$|$M[Imm+R[r_b]]$|(基址+偏移量)寻址|
|存储器|$(r_b,r_i)$|$M[R[r_b]+R[r_i]]$|变址寻址|
|存储器|$Imm(r_b,r_i)$|$M[Imm+R[r_b]+R[r_i]]$|变址寻址|
|存储器|$(,r_i,s)$|$M[R[r_i]·s]$|比例变址寻址|
|存储器|$Imm(,r_i,s)$|$M[Imm+R[r_i]·s]$|比例变址寻址|
|存储器|$(r_b,r_i,s)$|$M[R[r_b]+R[r_i]·s]$|比例变址寻址|
|存储器|$Imm(r_b,r_i,s)$|$M[Imm+R[r_b]+R[r_i]·s]$|比例变址寻址|

#### 数据传送

汇编代码中最常见的就是数据传送指令，经常需要将数据从一个位置复制到另外一个位置。操作数表示的通用性使得一条简单的数据传送指令能够许多机器中好几条不同的指令才能完成的功能。最简单的数据传送指令是 `MOV` 类，这些指令把数据从源位置复制到目的位置，不能做任何变化。`MOV` 类指令主要由四条指令组成：`movb`，`movw`，`movl` 以及 `movq`，这些指令执行同样的操作，区别在于它们传送的数据大小不同，分别是：`1`，`2`，`4` 和 `8` 字节。

|指令|效果|描述|
|:--:|:--:|:--:|
|`MOV S, D`|`D<-S`|传送|
|`movb`||传送字节|
|`movw`||传送字|
|`movl`||传送双字|
|`movq`||传送四字|
|`movabsq I, R`|`R<-I`|传送绝对四字|

源操作数指定的是一个立即数，存储在寄存器或者内存中，目的操作数指定一个位置，要么是一个寄存器，要么是一个内存地址。**`X86-64` 添加了一条限制，传送指令两个操作数不能都指向内存地址**，所以要在内存之间传送数据，就需要两次操作。

大多数情况下， `MOV` 指令大多数情况下，只会更新目的操作数指定的那些寄存器或者内存位置，根据指令最后一个字符指定的大小，例如每次 `movb` 指令只会更新一个字节，`movw` 更新双字16个字。有个例外就是 **`movl` 指令以寄存器位目的地址时，它会把寄存器的高4字节置为0（X86-64惯例）**。

下面是几个数据传送的指令：

- `movl $0x4050, %eax`&emsp;&emsp;&emsp;    立即数->寄存器，4字节
- `movw %bp, %sp`&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp;       寄存器->寄存器，2字节
- `movb (%rdi, %rcx), %al`&emsp;      内  存->寄存器，1字节
- `movb ($-17, (%rsp))`&emsp;&emsp;&nbsp;&nbsp;  立即数->内  存，1字节
- `movq %rax, -12(%rbp)`&emsp;&emsp; 寄存器->内  存，8字节

除此之外，**`movq` 指令只能以表示32位补码数字的立即数位源操作数，然后把这个值符号扩展到64位的值，放到目的位置**。而 **`movabsq` 指令能够以任何64位立即数值作为源操作数，并且只能以寄存器作为目的**。

还有两类寄存器，在移动数据时能够对符号位进行扩展，**`MOVZ` 类中的指令把目的剩余字节填充位0，而 `MOVS` 类中的指令通过符号扩展来填充，把源操作数的最高位进行赋值**，这两类指令最后两个字符都是大小指示符，第一个字符指定源操作数的大小，第二个指定目的大小。

|指令|效果|描述|
|:--:|:--:|:--:|
|`MOVZ S, R`|`D<-S（零扩展）`|以零扩展进行传送|
|`movzbw`||将做了零扩展的字节传送到字|
|`movzbl`||将做了零扩展的字节传送到双字|
|`movzwl`||将做了零扩展的字传送到双字|
|`movzbq`||将做了零扩展的字节传送到四字|
|`movzwq`||将做了零扩展的字传送到四字|

或者

|指令|效果|描述|
|:--:|:--:|:--:|
|`MOVZ S, R`|`D<-S（符号扩展）`|以传送符号扩展的字节|
|`movsbw`||将做了符号扩展的字节传送到字|
|`movsbl`||将做了符号扩展的字节传送到双字|
|`movswl`||将做了符号扩展的字传送到双字|
|`movsbq`||将做了符号扩展的字节传送到四字|
|`movswq`||将做了符号扩展的字传送到四字|

下面是一段 `C` 代码的示例生成的汇编代码：

{% tabs 数据传送指令示例 %}

<!-- tab 源代码 -->

```c
long exchange(long *xp, long y) {
    long x = *xp;
    *xp = y;
    return x;
}
```
<!-- endtab -->

<!-- tab 汇编代码 -->

根据约定，参数 `xp` 和 `y` 分别存储在寄存器 `%rdi` 和 `%rsi` 中，返回值存储在 `%rax` 中。先将 `xp` 中的值放到 `%rax` 中返回，然后将 `y` 的值放到  `xp` 指向的内存地址。

```asm
exchange:
	movq	(%rdi), %rax
	movq	%rsi, (%rdi)
	ret
```
<!-- endtab -->

{% endtabs %}

#### 压栈和出栈

栈在处理函数（过程）调用中起到至关重要的作用，栈是一种数据结构，可以添加或者删除，遵循**后进先出**的原则。通过 `push` 操作将数据压入栈中，通过 `pop` 操作删除数据，因此，弹出的值永远是最近被压入而且仍然在栈中的值。

在实现上，栈可以以数组的形式实现，总是从数据的一段插入和删除元素，这一端称为 **栈顶**。在 `x86-64` 中，程序栈放在内存中的某个区域，栈是从高地址向低地址增长，栈顶元素的地址是所有栈元素地址中最低的。

|指令|效果|描述|
|:--:|:--:|:--:|
|`pushq S`|`R[%rsp]<-R[%rsp]-8`；`M[R[%rsp]] <- S`|将四字压入栈|
|`popq  D`|`D<-M[R[%rsp]]`；`R[%rsp]<-R[%rsp]+8`|将四字弹出栈|

`pushq` 的功能是将数据压入到栈上，而 `popq` 指令是弹出数据，这些指令都只有一个操作数，压入的数据和弹出的数据目的地。

`pushq` 在压栈之前，首先要将栈指针减8，然后将数据写到栈顶位置，因此，指令 `pushq %rbp`的行为等于下面两条指令：

```
    subq %8, %rsp
    movq %rbp, (%rsp)
```

由于压栈和出栈操作太频繁，所以用一个单独的指令实现，减小最终生成的二进制文件体积。因为，上面两条指令在机器代码中占用8个字节，而 pushq 只需要1个字节。

![压栈和出栈](pushq_popq.png)

`x86-64` 中，栈的方向是向低地址增长，所以压栈是减小栈指针（`%rsp`）的值，并将数据存储到内存中，而出栈是从内存中读取数据，并增加栈的指针。

#### 算数和逻辑操作

下面的表格列出了一些整数和逻辑操作，大多数操作都分成了指令类，这些指令类有各种带不同大小操作数的变种。指令类 `ADD` 由四条加法指令组成：`addb`，`addw`，`addl` 和 `addq`，下面给出的每个指令都有对这四种不同大小数据的变种（除 `leaq` 之外），这些指令被分成四组：加载有效地址，一元操作，二元操作和移位。

|指令|效果|描述|
|:--:|:--:|:--:|
|`leaq S, D`|`D<-&S`|加载有效地址|
|`INC D`|`D <-  D+1`|加1|
|`DEC D`|`D <-  D-1`|减1|
|`NEG D`|`D <-  - D`|取负|
|`NOT D`|`D <-  ~ D`|取补|
|`ADD S, D`|`D <-  D + S`|加|
|`SUB S, D`|`D <-  D - S`|减|
|`IMUL S, D`|`D <- D * S`|乘|
|`XOR  S, D`|`D <- D ^ S`|异或|
|`OR   S, D`|`D <- D | S`|或|
|`AND  S, D`|`D <- D & S`|与|
|`SAL  k, D`|`D <- D << k`|左移|
|`SHL  k, D`|`D <- D << k`|左移（等同于 `SAL`）|
|`SAR  k, D`|`D <- D >>`$_A$ `k`|算数右移|
|`SHR  k, D`|`D <- D >>`$_L$ `k`|逻辑右移|

##### 加载有效地址

`leaq`（加载有效地址）指令实际上是 `movq` 指令的变形，它的指令形式是从内存读取数据到寄存器，但实际上根本就没有引用内存。它的第一个操作数看上去是一个内存引用，但是该指令实际上并不从指定位置读取数据，而是将有效地址写入到目的操作数。

除此之外，它还可以简单的描述普通的算数操作，例如，如果寄存器 `%rdx` 的值为 `x`，那么指令 `leaq 7(%rdx, %rdx, 4), %rax` 将设置寄存器 `%rax` 的值为 `7 + (x + x * 4) = 5x + 7`，编译器经常会使用 `leaq` 的一些灵活用法，看下面的示例代码：

```c
long scale(long x, long y, long z) {
    long t = x + 4 * y + 12 * z;
    return t;
}
```

`%rdi = x, %rsi = y, %rdx = z, %rax = t`，编译之后的汇编代码位：

```
scale:
	leaq	(%rdi,%rsi,4), %rax      // x + 4 * y
	leaq	(%rdx,%rdx,2), %rcx      // z + 2 * z = 3z
	leaq	0(,%rcx,4), %rdx         // (x + 4 * y) + 4 * (3 * z) = x + 4 * y + 12 * z
	addq	%rdx, %rax
	ret
```

##### 一元操作和二元操作

一元操作，及时源又是目的，这个操作数可以是寄存器，也可以是内存位置。例如，`incq (%rsp)` 会使栈顶的8字节元素加1，这种语法类似于C语言的`++` 和 `--` 从操作。

二元操作中，第二个操作数既是源又是目的，类似于C语言中的 `-=`，`+=`，`*=` 运算操作符。例如，`subq %rax, %rdx` 是将寄存器 `%rdx` 减去 `%rax` 的结果保存在 `%rdx` 中，第一个操作数可以使立即数，寄存器或是任意内存位置，第二个操作数可以是寄存器或是内存位置。

##### 移位操作

移位操作，先给出移位量，然后第二项给出的是要移位的数，可以进行算数和逻辑右移。移位量可以是一个立即数，或者放在单字节寄存器 `%cl` 中（这些指令很特别，只允许以这个特定的寄存器作为操作数）。原则上来说，1字节的移位量使得移位量的编码范围可以达到 $2^8-1=255$。

`x86-64` 中，移位操作对 `w` 位长的数据值进行操作，移位量由 `%cl` 寄存器的低 `m` 位决定，这里 $2^m=w$，高位会被忽略。所以，当寄存器 `%cl` 的十六进制位 `%0xFF` 时，指令 `salb` 会移 `7` 位，`salw` 会移 `15` 位，`sall` 会移 `31` 位，`salq` 会移 `63` 位。

左移指令有两个名字：`SAL` 和 `SHL`，两者的效果是一样的，都是讲右边填上0。右移指令不同， `SAR` 执行算数移位（填上符号位），而 `SHR` 执行逻辑移位（填上0）。移位操作的目的操作数可以是一个寄存器或者一个内存位置。

##### 特殊的算数操作

两个64位有符号或无符号整数相乘得到的乘积需要128位来表示。 `x86-64` 指令集对128位（16字节）数的操作提供有限的支持。延续字（2字节），双字（四字节），四字（8字节）的命令管理，Intel 将16字节的数称为八字（oct word）。

|指令|效果|描述|
|:--:|:--:|:--:|
|`imulq S`|`R[%rdx]: R[%rax] <- s * R[%rax]`|有符号全乘法|
|`mulq S`|`R[%rdx]: R[%rax] <- s * R[%rax]`|无符号全乘法|
|`cqto S`|`R[%rdx]: R[%rax] <- 符号扩展（R[%rax]）`|转换为八字|
|`idivq S`|`R[%rdx]<-R[%rdx] <- R[%rax] mod S; R[%rax]<-R[%rdx] <- R[%rax] ÷ S; `|有符号除法|
|`divq S`|`R[%rdx]<-R[%rdx] <- R[%rax] mod S; R[%rax]<-R[%rdx] <- R[%rax] ÷ S; `|无符号除法|

`imulq` 指令有两种不同的形式，双操作数和单操作数，单操作数时，计算两个64位值得全128位乘积，位补码乘法。而 `mulq` 是无符号乘法。这两个指令都要求一个参数必须在寄存器 `%rax` 中，而另一个作为指令的源操作数给出。然后乘积的高64位放在 `%rdx` 中，低64位放在 `%rax` 中。

看下面的代码示例，使用文件 `inttypes.h` 的定义，它是标准C扩展的一部分，只不过，它没有提供128位的值，因此只能依赖GCC提供的对128位的支持，声明一个新的类型 `uint128_t`。

```c
#include <inttypes.h>

typedef unsigned __int128 uint128_t;

void store_uprod(uint128_t *dest, uint64_t x, uint64_t y) {
    *dest = x * (uint128_t) y;
}
```

> gcc -Og -S imulq.c

生成的汇编代码如下，`dest in %rdi, x in %rsi, y in %rdx`，

```
store_uprod:
	movq	%rsi, %rax    // 先将 x 移动到 %rax 寄存器中
	mulq	%rdx          // 然后将 %rax（x）和 %rdx（y）相乘
	movq	%rax, (%rdi)  // 结果的低64位存储在 dest 中
	movq	%rdx, 8(%rdi) // 结果的高64位存储 dest 中
	ret
```

#### 函数调用

函数（过程）是软件设计中一种重要的抽象，它提供了一种封装代码的方式，用一组指定的参数和可选的一个或者多个返回值实现某种功能，然后又可以在程序的不同位置调用这个函数。

假设函数 `P` 调用函数 `Q`，要在机器级实现 `P` 调用 `Q`，然后从 `Q` 返回，我们必须考虑以下动作：

- `传递控制`：在进入函数 `Q` 的时候，程序计数器必须被设置位 `Q` 的起始地址，然后再返回时，必须将程序计数器设置为 `P` 调用 `Q` 后面的那条指令地址；

- `传递数据`：`P` 必须能向 `Q` 提供一个或者多个参数， `Q` 必须能够向 `P` 返回一个值；

- `内存释放和分配`：在调用开始时，`Q` 可能需要位局部变量分配空间，而在返回时，需要释放这些空间；

`C` 语言中，函数调用机制的实现得在于应用栈这个先进后出内存管理原则。在 `P` 调用 `Q` 的过程中，当 `Q` 在执行时，`P` 以及向上追溯到 `P` 的调用链的函数，都是暂时挂起的。当 `Q` 运行时，它只需要为局部变量分配新的存储空间，当它返回时，任何为它分配的局部存储空间都可以释放。所以，程序可以用栈来管理它的函数调用所需要的存储空间，栈和程序寄存器存放这`传递控制` 和 `传递数据`，以及分配内存所需要的信息。当 `P` 调用 `Q`，控制和数据信息添加到栈尾，当 `P` 返回时，这些信息会被释放掉。

在 `x86-64` 中，栈是向低地址方向增长的，栈指针 `%rsp` 指向栈顶元素（低地址），可以使用 `pushq` 或者 `popq` 指令将数据存入栈上或者从栈上弹出。将栈指针减小一个适当的量可以为没有指定初始值得数据在栈上分配空间，类似，可以通过增加指针来释放空间。

当 `x86-64` 函数调用需要的存储空间超出寄存器能够存放的大小时，就会在栈上分配空间，这部分内存空间就称为 **栈帧**。

如下图所示，当前正在执行的函数的帧总是在栈顶，当 `P` 调用 `Q` 时，会把返回地址压入栈中，指明当 `Q` 返回时，要从 `P` 程序的那个位置开始执行，我们这个返回地址当做`P`的栈帧的一部分，因为它存放的是与 `P` 相关的状态。`Q` 的代码会扩展当前栈的边界，分配它的栈帧所需要的空间。在这个空间中，它可以保存寄存器的值，分配局部变量空间，为它调用的函数设置参数。通过寄存器，`P` 可以传递最多6个整数值（也就是指针和整数），但是如果Q需要更多的参数，那么 `P` 可以在调用之前在自己的栈帧里存储好这些参数。

![栈帧](stack-frame.png)

##### 转移控制

将控制从函数 `P` 转移到函数 `Q`，只需要简单地把程序计数器（`PC`）设置为 `Q` 的起始地址。不过稍后从 `Q` 返回的时候，处理器必须记录好它需要从 `P` 的哪个位置继续执行。在 X86-64 系统中，这个信息是用指令 `call Q` 调用函数 `Q` 来记录的，该指令会把紧跟在 `call` 指令后面那条指令的地址压入栈中，并且把 `PC` 计数器设置为 `Q` 的起始地址，压入栈中的下一条指令的地址被称作**返回地址**。而对应的 `ret` 指令会从栈中弹出返回地址，并且把 `PC` 更新。

|指令|描述|
|:--:|:--:|
|`call Label`|函数调用|
|`call *Operand`|函数调用|
|`ret`|从函数调用中返回|

##### 数据传送

当函数调用时，除了要将控制传递给他并且在函数调用结束时再传递回来，函数调用还需要传递参数和返回值。x86-64 中，大部分的数据传递是通过寄存器实现的。当函数 `P` 调用 `Q` 时，`P` 的代码首先必须把参数复制到合适的寄存器中，而当 `Q` 返回时，`P` 的代码可以通过寄存器 `%rax` 而获取 `Q` 的返回值。

x86-64 中，可以通过寄存器最多传递6个整形（即整数和指针参数）。寄存器的使用也是有特殊顺序的，根据参数在参数列表中的顺序为他们分配寄存器，寄存器使用的名字取决于要传递的数据类型的大小。可以通过 64 位寄存器适当的部分访问小于 `64` 位的参数，例如，如果第一个参数是 `32` 位的，可以通过寄存器 `%edi` 来访问它。

|操作数大小|参数1|参数2|参数3|参数4|参数5|参数6|
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
|`64`|`%rdi`|`%rsi`|`rdx`|`%rcx`|`%r8`|`%r9`|
|`32`|`%edi`|`%esi`|`%edx`|`%ecx`|`%r8d`|`%r9d`|
|`16`|`%di`|`%si`|`%dx`|`%cx`|`%r8w`|`%r9w`|
|`8`|`%dil`|`%sil`|`%dl`|`%cl`|`%r8b`|`%r9b`|

如果一个函数有大雨6个整形参数，超出6个的部分就要通过栈来传递。假设函数 `P` 调用 `Q`，有 `n` 个整形参数，且 `n > 6`，那么 `P` 的代码分配的栈帧必须能够容纳 `7` 到 `n` 好参数的存储空间。也就是说，要把参数 `1~6` 复制到对应的寄存器，把参数 `7~n` 放到栈上，而参数 `7` 位于栈顶。通过栈传递参数的时候，所有的数据大小都向 `8` 的倍数对齐。参数放置到对应的位置以后，程序就可以执行 `call` 指令将控制转移到函数 `Q` 了，函数 `Q` 可以通过寄存器访问参数，有必要的话也可以通过栈访问。相应地，如果函数 `Q` 调用了某个有超过`6`个参数的函数，它也需要在自己的栈帧中为超过`6`个部分的参数分配空间，对应于栈帧结构图中的参数构造区。


### Go 汇编

众所周知，Go 汇编器基于 [`plan9` 汇编](https://9p.io/wiki/plan9/plan_9_wiki/)。那什么是 `plan9` 呢？`plan9` 来自于贝尔实验室的第九号计划，是一种概念操作系统， 基于现代化思想重新设计操作系统，目标是实现 UNIX 最初的承诺：一切皆文件。Plan 9的特色功能有：将所有本地和远程资源以文件形式组织的9P协议，union mounts，改进的进程文件系统以及本地的Unicode支持。在Plan 9中，所有的系统接口（如网络和用户界面接口），都是作为文件系统的一部分呈现，而不像其他操作系统上一样拥有自己独立的接口。

Go 编译器输出的汇编其是一种抽象，并没有映射到实际的硬件， Go 汇编器会将这个伪汇编翻译成目标硬件的机器语言。拥有这样一个中间层的最大优势在于它更容易适应新的架构，更多详细的可以看 [GopherCon 2016: Rob Pike - The Design of the Go Assembler](https://www.youtube.com/watch?v=KINIAgRpkDA)。关于 Go 汇编最重要的一点是 Go 汇编不直接对应于目标硬件这一事实，有些与硬件直接相关，但有些则没有。就像当我们类似 `MOV` 指令时，工具链位该操作实际生成的可能根本不是移动指令，可能是清除指令或加载指令等，或者他可能与具有该名称的机器指令完全对应。Go汇编作为连接器的输入，在生成机器码的时候才转换成对应平台相关的指令。

#### 汇编示例

Go 的汇编程序是一种解析该半抽象指令集的描述并将其转换为要输入到链接器的指令的方法，我们来看以下面一段简单的 `Go` 代码被Go编译器转换成 `Go汇编` 是什么样子：

```go
package main

//go:noinline
func add(x, y int) int {
    return x + y
}

func main() {
    println(add(1, 2))
}
```

环境信息如下：

> go version go1.17.8 linux/amd64
> Linux ecs-335906 4.18.0-348.7.1.el8_5.x86_64 #1 SMP Wed Dec 22 13:25:12 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux

我们可以使用下面的不同的命令查看 `Go汇编代码` 和 `目标平台汇编代码`，对比发现 `Go汇编` 中存在很多的伪指令。 

{% tabs Go汇编示例 %}

<!-- tab Go汇编 -->

使用命令：`go tool compile -S add.go`，这将生成的 `GO` 表示的汇编，或者可以使用命令 `go build -gcflags="-S" add.go` 生成。

```
"".add STEXT nosplit size=4 args=0x10 locals=0x0 funcid=0x0
	0x0000 00000 (add.go:4)	TEXT	"".add(SB), NOSPLIT|ABIInternal, $0-16
	0x0000 00000 (add.go:4)	FUNCDATA	$0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (add.go:4)	FUNCDATA	$1, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
	0x0000 00000 (add.go:4)	FUNCDATA	$5, "".add.arginfo1(SB)
	0x0000 00000 (add.go:5)	ADDQ	BX, AX
	0x0003 00003 (add.go:5)	RET
```

如果我们已经生成可执行文件，我们还可以通过 `GO` 提供的反汇编工具查看 `Go汇编`:

```
[root@ecs-335906 add]# go tool objdump -s main.add add
TEXT main.add(SB) /root/workdir/add/add.go
  add.go:5		0x4553e0		4801d8			ADDQ BX, AX
  add.go:5		0x4553e3		c3			RET
```

<!-- endtab -->

<!-- tab 目标机器汇编 -->

在生成对应平台的二进制文件之后，我们通过调试工具查看 `add` 函数的汇编代码。第一种方式我们可以通过 [`dlv`](https://github.com/go-delve/delve) ：

![](dlv_add_asm.png)

或者通过 `gdb`：

![](gdb_add_asm.png)

或者通过反汇编工具 `objdump`：

> objdump -d add > add.obj

![](objdump_add_asm.png)

<!-- endtab -->

{% endtabs %}

#### 编译过程

本节内容主要来源于 [Go: Overview of the Compiler](https://medium.com/a-journey-with-go/go-overview-of-the-compiler-4e5a153ca889) 和 [Introduction to the Go compiler](https://github.com/golang/go/blob/release-branch.go1.13/src/cmd/compile/README.md)。Go的编译过程包含四个阶段，被分成两类：

- `编译前端`：此阶段从源代码运行分析并生成源代码的抽象句法结构，称为 [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree)。

- `编译后端`：第二阶段将源代码的表示形式转换为机器代码，并进行一些优化。

![编译流程](compile-process.png)

由下面的一段代码展示这四个过程：

```go
package main

func main() {
	a := 1
	b := 2
	if true {
		add(a, b)
	}
}

func add(a, b int) {
	println(a + b)
}
```

##### 解析

这个阶段的主要实现是在 `cmd/compile/internal/syntax` 中，在编译的第一阶段，对源代码进行分词（词法分析）、解析（语法分析），并为每个源文件构建语法树。

每个语法树都是相应源文件的精确表示，其节点对应于源文件的各种元素，例如表达式、声明和语句。语法树还包括位置信息，用于错误报告和调试信息的创建。

{% tabs Go Compile parsing %}

<!-- tab 分词结果 -->

```
root@b89af2baca14:/WORKDIR/gostudy/compile# go run tokenized.go
1:1	package	"package"
1:9	IDENT	"main"
1:13	;	"\n"
3:1	func	"func"
3:6	IDENT	"main"
3:10	(	""
3:11	)	""
3:13	{	""
4:2	IDENT	"a"
4:4	:=	""
4:7	INT	"1"
4:8	;	"\n"
5:2	IDENT	"b"
5:4	:=	""
5:7	INT	"2"
5:8	;	"\n"
6:2	if	"if"
6:5	IDENT	"true"
6:10	{	""
7:3	IDENT	"add"
7:6	(	""
7:7	IDENT	"a"
7:8	,	""
7:10	IDENT	"b"
7:11	)	""
7:12	;	"\n"
8:2	}	""
8:3	;	"\n"
9:1	}	""
9:2	;	"\n"
11:1	func	"func"
11:6	IDENT	"add"
11:9	(	""
11:10	IDENT	"a"
11:11	,	""
11:13	IDENT	"b"
11:15	IDENT	"int"
11:18	)	""
11:20	{	""
12:2	IDENT	"println"
12:9	(	""
12:10	IDENT	"a"
12:12	+	""
12:14	IDENT	"b"
12:15	)	""
12:16	;	"\n"
13:1	}	""
13:2	;	"\n"
root@b89af2baca14:/WORKDIR/gostudy/compile#
```

<!-- endtab -->

<!-- tab 分词代码 -->

```go
package main

import (
	"fmt"
	"go/scanner"
	"go/token"
)

func main() {
	srcCode := []byte(
		`package main

func main() {
	a := 1
	b := 2
	if true {
		add(a, b)
	}
}

func add(a, b int) {
	println(a + b)
}`)

	// Initialize the scanner.
	var s scanner.Scanner
	fset := token.NewFileSet()                          // positions are relative to fset
	file := fset.AddFile("", fset.Base(), len(srcCode)) // register input "file"
	s.Init(file, srcCode, nil /* no error handler */, scanner.ScanComments)

	// Repeated calls to Scan yield the token sequence found in the input.
	for {
		pos, tok, lit := s.Scan()
		if tok == token.EOF {
			break
		}
		fmt.Printf("%s\t%s\t%q\n", fset.Position(pos), tok, lit)
	}
}
```

<!-- endtab -->

{% endtabs %}

分词之后就可以拿去构建语法树。

##### 类型检查和AST转换

这部分的代码实现主要在 `cmd/compile/internal/gc`，小写 `gc` 代表 `go compile`，大写 `GC` 代表 `Garbage Collector`。

这个阶段的第一件事情是将 `cmd/compile/internal/syntax` 的语法树转换为编译器的 `AST` 表示，接下来就是名称解析和类型推断，确定哪个对象属于哪个标识符，以及每个表达式具有什么类型。

这个阶段还会做一些优化，例如内联，我们可以使用 `go tool compile -w` 查看这些细节：

{% tabs 类型检查和AST转换 %}

<!--tab 允许内敛优化-->

将我们的代码保存为 `main.go` 之后，我们可以使用 `go tool compile -w` 查看这个过程，我们没有看到第7行存在函数调用。

![](compile-allow-inline.png)

<!-- endtab -->

<!--tab 禁用内敛优化-->

禁用内敛优化，我们可以使用 `go tool compile -w -l` 查看这个过程，我们在第7行看到了调用 `add` 函数。

![](compile-disable-inline.png)

<!-- endtab -->

{% endtabs %}

##### SSA 代码生成

这个阶段会将 `AST` 被转换为静态单一分配 (`SSA`（静态单赋值形式）) 形式，这是一种具有特定属性的较低级别的中间表示，可以更轻松地实现优化并最终从中生成机器代码。 在此转换期间，编译器将会根据情况应用高度优化的代码完成代码自动优化。

在 `AST` 到 `SSA` 的转换过程中，某些节点也被降低为更简单的组件，以便编译器的其余部分可以使用它们。例如，内建的 `copy` 被内存移动所取代，并且 `range` 循环被重写为 `for` 循环。

然后，应用一系列与机器无关的通行证和规则。这些不涉及任何单一的计算机架构，因此可以在所有 `GOARCH` 变体上运行。这些通用传递的一些示例包括消除死代码、删除不需要的 `nil` 检查和删除未使用的分支。通用重写规则主要关注表达式，比如用常量值替换一些表达式，优化乘法和浮点运算。

这部分的实现在：

- `cmd/compile/internal/gc` （AST 转换成SSA）
- `cmd/compile/internal/ssa` （应用一系列优化手段和基于架构的一些规则）

{% tabs SSA 代码生成 %}

<!-- tab 生成优化的SSA代码 -->
使用如下的命令可以生成 `SSA` 代码：

> GOSSAFUNC=main go tool compile main.go && open ssa.html

这个生成的 `HTML` 文档会展示在生成最终代码的过程中应用了哪些规则，例如下面的，由于我们代码中的 `a` 和 `b` 是常量，`a + b` 的和也是已知的，所以应用 `opt` 规则，直接将其结果存储，并将原来的 `a` 和 `b` 删除。

![](go-compile-ssa-optimize.png)

一旦将所有能用的优化手段都运用完之后，就会生成一个中间的汇编代码，就是我们的 `GO汇编`：

![](go-compile-gen-ir-asm.png)

<!-- endtab -->

<!-- tab 对比生成未优化的SSA代码 -->
使用如下的命令可以生成 `SSA` 代码：

> GOSSAFUNC=main go tool compile -l main.go && open ssa.html

这里我们禁用优化，可以看到最终生成的 `SSA` 和我们的源代码基本相同，`a` 和 `b` 两个变量没有被优化掉，没有使用 `opt` 优化规则：

![](go-compile-ssa-unoptimize.png)

生成的Go汇编中也可以证明这个：

![](go-compile-gen-ir-unoptimize-asm.png)

<!-- endtab -->

{% endtabs %}


##### 生成机器代码

这部分的实现主要在：

- `cmd/compile/internal/ssa` (SSA 降级成平台相关的表示，并且进行优化，不再是中间码)
- `cmd/internal/obj` （机器代码生成）

一旦 SSA 被“降低”并且更具体到目标架构，最终的代码优化通道就会运行。这包括另一个死代码消除过程、将值移近它们的用途、删除从不读取的局部变量以及寄存器分配。

作为此步骤的一部分完成的其他重要工作包括堆栈帧布局，它将堆栈偏移量分配给局部变量，以及指针活性分析，它计算在每个 `GC` 安全点处哪些堆栈指针处于活动状态。

在 `SSA` 生成阶段结束时，`Go` 函数已转换为一系列 `obj.Prog` 指令。这些被传递给汇编器（`cmd/internal/obj`），汇编器将它们转换为机器代码并写出最终的目标文件。目标文件还将包含反射数据、导出数据和调试信息。

`Go 汇编` 可以作为链接器的直接输入生成机器代码，例如：

```go
package main

import "fmt"

func main() {
	fmt.Println("hello world")
}
```

使用 `go tool compile -S hello.go` 将会直接输出 `Go汇编` 并且生成这个 `hello.o` 文件。使用 `go tool link hello.o` 将会链接并且生成可执行文件：

![](go-compile-obj-ir.png)

#### Plan9 汇编


### 参考链接

1. [A Quick Guide to Go's Assembler](https://go.dev/doc/asm)
2. [第3章 Go汇编语言](https://chai2010.cn/advanced-go-programming-book/ch3-asm/readme.html)
3. [Golang Calling Convention](https://particle.cafe/blog/golang-calling-convention.html)
4. [数学公式语法——Mathjax教程](https://oysz2016.github.io/post/8611e6fb.html)
5. [Plan9 wiki](https://9p.io/wiki/plan9/plan_9_wiki/)
6. [Go at Google: Language Design in the Service of Software Engineering](https://talks.golang.org/2012/splash.article)
7. [Go 使用的 plan9 汇编语言初探](https://kcode.icu/posts/go/2021-03-20-go-%E4%BD%BF%E7%94%A8%E7%9A%84-plan9-%E6%B1%87%E7%BC%96%E8%AF%AD%E8%A8%80%E5%88%9D%E6%8E%A2/)
8. [从Go走进plan9汇编](http://www.4k8k.xyz/article/weixin_40486544/108392947)
9. [Getting Started with Go Assembly](https://linuxtut.com/en/231350711f9ab6eba95e/)