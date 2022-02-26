---
title: 【Golang】影响runtime行为的环境变量
date: 2022-02-23 16:17:56
categories:
    - golang
---

在Go语言中，为了控制低级别的 `runtime` 行为，官方提供了一些环境变量，主要有：

- `GOGC`
- `GODEBUG`
- `GOMAXPROCS`
- `GORACE`
- `GOTRACEBACK`

初次之外，还有用于编译期的 `GOROOT`，`GOPATH`，`GOOS` 和 `GOARCH`，以及用于玩转SSA的 `GOSSAFUNC`。

<!-- more -->

在 `src/runtime/extern.go` 文件中详细描述了这些环境变量的背景和意义。在调度器初始化阶段，解析环境变量并且把他们放进全局变量 `envs` 中。

```go
// The bootstrap sequence is:
//
//	call osinit
//	call schedinit
//	make & queue new G
//	call runtime·mstart
//
// The new G calls runtime·main.
func schedinit() {
    ...
    goenvs()
    ...
}
```

### GOGC

`GOGC` 用于控制GC的触发频率，默认值是：`100`，意思是直到上次垃圾回收堆内存上涨 `100%` 时触发GC。如果设置 `GOGC=off`将彻底关闭GC。在运行时可以通过 [`debug.SetGCPercent`](https://pkg.go.dev/runtime/debug#SetGCPercent ) 进行动态调整。


