---
title: Go 程序调试器：gdb 和 dlv
date: 2020-07-20 22:40:05
tags: 
- Go
---

{% asset_img cover.jpg cover %}

<!-- more -->


### 源代码结构

{% tabs 代码调试 %}

<!-- tab 结构图片 -->
![结构图片](code-architecture.png)
<!-- endtab -->

<!-- tab main.go -->
```go
package main

import (
	"fmt"
	"os"

	"go-study/dlv_debug/lib"
)

func main() {
	fmt.Println("Golang dbg test...")

	var argc = len(os.Args)
	var argv = append([]string{}, os.Args...)

	fmt.Printf("argc:%d\n", argc)
	fmt.Printf("argv:%v\n", argv)

	var var1 = 1
	var var2 = "golang dbg test"
	var var3 = []int{1, 2, 3}
	var var4 lib.MyStruct
	var4.A = 1
	var4.B = "golang dbg my struct field B"
	var4.C = map[int]string{1: "value1", 2: "value2", 3: "value3"}
	var4.D = []string{"D1", "D2", "D3"}

	lib.DBGTestRun(var1, var2, var3, var4)
	fmt.Println("Golang dbg test over")
}

```
<!-- endtab -->

<!-- tab lib.go -->
```go
package lib

import (
	"fmt"
	"sync"
	"time"
)

type MyStruct struct {
	A int
	B string
	C map[int]string
	D []string
}

func DBGTestRun(var1 int, var2 string, var3 []int, var4 MyStruct) {
	fmt.Println("DBGTestRun Begin!")
	waiter := &sync.WaitGroup{}

	waiter.Add(1)
	go RunFunc1(var1, waiter)

	waiter.Add(1)
	go RunFunc2(var2, waiter)

	waiter.Add(1)
	go RunFunc3(&var3, waiter)

	waiter.Add(1)
	go RunFunc4(&var4, waiter)

	waiter.Wait()
	fmt.Println("DBGTestRun Finished!")
}

func RunFunc1(variable int, waiter *sync.WaitGroup) {
	fmt.Printf("var1:%v\n", variable)
	for {
		if variable != 123456 {
			continue
		} else {
			break
		}
	}
	time.Sleep(10 * time.Second)
	waiter.Done()
}

func RunFunc2(variable string, waiter *sync.WaitGroup) {
	fmt.Printf("var2:%v\n", variable)
	time.Sleep(10 * time.Second)
	waiter.Done()
}

func RunFunc3(pVariable *[]int, waiter *sync.WaitGroup) {
	fmt.Printf("*pVar3:%v\n", *pVariable)
	time.Sleep(10 * time.Second)
	waiter.Done()
}

func RunFunc4(pVariable *MyStruct, waiter *sync.WaitGroup) {
	fmt.Printf("*pVar4:%v\n", *pVariable)
	time.Sleep(10 * time.Second)
	waiter.Done()
}

```
<!-- endtab -->

{% endtabs %}

编译目标程序时，加入相应的编译选项生成调试信息，不然没法调试了：

> GOOS=linux go build -gcflags="-l -N" go-study/dlv_debug

我是在 docker 中装的 gdb，所以交叉编译，然后复制到容器中：

> docker cp dlv_debug 913ecec6c8c3:/workdir/

### gdb

1. 启动调试程序

        root@913ecec6c8c3:/workdir# gdb ./dlv_debug
        GNU gdb (Ubuntu 9.1-0ubuntu1) 9.1
        Copyright (C) 2020 Free Software Foundation, Inc.
        License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
        This is free software: you are free to change and redistribute it.
        There is NO WARRANTY, to the extent permitted by law.
        Type "show copying" and "show warranty" for details.
        This GDB was configured as "x86_64-linux-gnu".
        Type "show configuration" for configuration details.
        For bug reporting instructions, please see:
        <http://www.gnu.org/software/gdb/bugs/>.
        Find the GDB manual and other documentation resources online at:
            <http://www.gnu.org/software/gdb/documentation/>.

        For help, type "help".
        Type "apropos word" to search for commands related to "word"...
        Reading symbols from ./dlv_debug...
        warning: Missing auto-load script at offset 0 in section .debug_gdb_scripts
        of file /workdir/dlv_debug.
        Use `info auto-load python-scripts [REGEXP]' to list them.
        (gdb)

2. 在 `main.main` 函数上设置断点 `b`

        (gdb)
        (gdb) b main.main
        Breakpoint 1 at 0x493fc0: file /Users/fudenglong/workdir/go/src/go-study/dlv_debug/main.go, line 10.
        (gdb)

3. 带参数启动程序 `r`

        (gdb) r arg1 arg2
        Starting program: /workdir/dlv_debug arg1 arg2
        warning: Error disabling address space randomization: Operation not permitted
        [New LWP 52]
        [New LWP 53]
        [New LWP 54]
        [New LWP 55]

        Thread 1 "dlv_debug" hit Breakpoint 1, main.main () at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/main.go:10
        10	func main() {

4. 在 `lib/lib.go` 上通过行号在函数 `DBGTestRun` 入口处设置断点：`b filename:line`

        (gdb) b lib/lib.go:16
        Breakpoint 5 at 0x493900: file /Users/fudenglong/workdir/go/src/go-study/dlv_debug/lib/lib.go, line 16.

5. 查看当前已经设置的断点 `info b`

        (gdb) info b
        Num     Type           Disp Enb Address            What
        1       breakpoint     keep y   0x0000000000493fc0 in main.main at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/main.go:10
            breakpoint already hit 1 time
        5       breakpoint     keep y   0x0000000000493900 in go-study/dlv_debug/lib.DBGTestRun at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/lib/lib.go:16

6. 禁用断点 `dis n`      

        (gdb) dis 1
        (gdb) info b
        Num     Type           Disp Enb Address            What
        1       breakpoint     keep n   0x0000000000493fc0 in main.main at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/main.go:10
            breakpoint already hit 1 time
        5       breakpoint     keep y   0x0000000000493900 in go-study/dlv_debug/lib.DBGTestRun at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/lib/lib.go:16             

7. 删除断点 `del n`

        (gdb) del 1
        (gdb) info b
        Num     Type           Disp Enb Address            What
        5       breakpoint     keep y   0x0000000000493900 in go-study/dlv_debug/lib.DBGTestRun at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/lib/lib.go:16

8. 断点后继续执行 `c`

        (gdb) c
        Continuing.
        Golang dbg test...
        argc:3
        argv:[/workdir/dlv_debug arg1 arg2]

        Thread 1 "dlv_debug" hit Breakpoint 5, go-study/dlv_debug/lib.DBGTestRun (var1=1, var2=..., var3=..., var4=...) at /Users/fudenglong/workdir/go/src/go-study/dlv_debug/lib/lib.go:16
        16	func DBGTestRun(var1 int, var2 string, var3 []int, var4 MyStruct) {

9. 查看代码 `l`

        (gdb) l
        11		B string
        12		C map[int]string
        13		D []string
        14	}
        15
        16	func DBGTestRun(var1 int, var2 string, var3 []int, var4 MyStruct) {
        17		fmt.Println("DBGTestRun Begin!")
        18		waiter := &sync.WaitGroup{}
        19
        20		waiter.Add(1)

10. 单步执行 `n`   

        (gdb) n
        17		fmt.Println("DBGTestRun Begin!")

11. 显示变量信息 `p`

        (gdb) p var1
        $1 = 1
        (gdb) p var2
        $2 = 0x4c45d3 "golang dbg test"
        (gdb) p var3
        $3 = {array = 0xc00013c040, len = 3, cap = 3}
        (gdb) p var4
        $4 = {A = 1, B = 0x4c6e7a "golang dbg my struct field B", C = 0xc0001201b0, D = {array = 0xc0001201e0, len = 3, cap = 3}}

12. 查看调用栈 `bt`，切换调用栈 `f n`

    ![查看调用栈](call-stack.png)

13. 显示 goroutine 列表

        (gdb) info goroutines
        * 1 running  runtime.systemstack_switch
        2 waiting  runtime.gopark
        3 waiting  runtime.gopark
        4 waiting  runtime.gopark
        5 waiting  runtime.gopark
        * 6 running  syscall.Syscall

14. 在某个 goroutine 内执行操作

    ![执行命令](goroutine-cmd.png)

### dlv

{% centerquote %}Delve is a debugger for the Go programming language. The goal of the project is to provide a simple, full featured debugging tool for Go{% endcenterquote %}


1. 带参数启动程序 `dlv exec ./dlv_debug -- arg1 arg2`

        root@913ecec6c8c3:/workdir# ./dlv exec ./dlv_debug -- arg1 arg2
        Type 'help' for list of commands.
        (dlv)

2. 设置断点

    ![dlv 设置断点](dlv-breakpoint.png)

3. 启动程序，运行到下一个断点 `c`

    ![运行到下一个断点](dlv-next-bp.png)

4. 查看代码 `ls`

    ![运行到下一个断点](dlv-ls.png)

5. 查看当前调用栈

        (dlv) bt
        0  0x0000000000493913 in go-study/dlv_debug/lib.DBGTestRun
        at /Users/fudenglong./go/src/go-study/dlv_debug/lib/lib.go:16
        1  0x000000000049479b in main.main
        at /Users/fudenglong./go/src/go-study/dlv_debug/main.go:28
        2  0x0000000000431572 in runtime.main
        at /Users/fudenglong/.gvm/gos/go1.14/src/runtime/proc.go:203
        3  0x000000000045bef1 in runtime.goexit
        at /Users/fudenglong/.gvm/gos/go1.14/src/runtime/asm_amd64.s:1373
        (dlv)

6. 查看变量信息

    `vars` 可以查看全部包级的变量，可以使用正则参数选择想查看的局部变量。 
    `args` 可以查看函数的参数
    `locals` 查看局部边变量

    ![查看变量](dlv-view-var.png)

7. 切换到相应的调用栈执行命令 `bt` 和 `frame`

    ![切换到调用栈执行命令](dlv-framepng.png)

8. 查看 `goroutines` 信息

    ![查看 goroutines 信息](dlv-goroutines.png)

9. 切换到 goroutine 执行命令，`goroutine n`

    ![切换到 goroutine 执行命令](dlv-goroutine-cmd.png)

10. 查看当前处在哪个 `goroutine`

    ![dlv-goroutine](dlv-goroutine.png)

11. 查看汇编代码 `disass`

    ![disass](disass-dlv.png)

12. 查看变量类型，`whatis`

    ![dlv-whatis](dlv-whatis.png)


### 课外链接

1. [gdb调试Go,info goroutines 命令没有](https://blog.csdn.net/aggressive_snail/article/details/78479315)
2. [Golang程序调试工具介绍(gdb vs dlv)](https://www.cnblogs.com/sunsky303/p/12957078.html)
3. [](https://github.com/go-delve/delve/tree/master/Documentation/cli)