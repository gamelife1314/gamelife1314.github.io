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

