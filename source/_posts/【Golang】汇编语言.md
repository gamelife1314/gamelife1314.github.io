---
title: 【Golang】汇编语言
date: 2022-03-01 11:27:32
categories:
    - golang
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



### 参考链接

1. [A Quick Guide to Go's Assembler](https://go.dev/doc/asm)
2. [第3章 Go汇编语言](https://chai2010.cn/advanced-go-programming-book/ch3-asm/readme.html)
3. [Golang Calling Convention](https://particle.cafe/blog/golang-calling-convention.html)

