---
title: Go Modules
date: 2021-09-16 19:57:45
tags:
    - 依赖管理
categories:
    - golang
---

每个语言都有自己的依赖管理系统，就像 `Cargo`，`npm`，`Composer`， `Nuget`， `Pip`， `Maven` 等，Go 语言也不能例外，在 `go mod` 出来之前，有两种模式：

- `GOPATH` 模式，这种模式把问题想象的太过于简单理想化，可以说是Go语言设计的败笔，因为不支持对依赖的版本管理，不同的项目依赖同一个第三方库的不同版本，`GOPATH` 就无法搞定，只能切来切去。

-  `vendor` 模式，这种模式将第三方依赖下载到项目的 `vendor` 目录下，实现了不同项目之间相互隔离，但是也不支持对依赖的版本管理，没有统一的地方进行声明，一更新就会升级到最新版本，不像很多语言中，将项目的依赖固化到一个 `*_lock.json` 版本中，这样在项目转移到其他地方进行编译，能确保得到一致的功能。当然，也有很多人喜欢将 `vendor` 目录上传到仓库，保持不同地方编译后二进制一致性，不过这样会导致仓库体积过大，有利有弊。

在这种诉求下，诞生了很多第三方的依赖管理工具，如：[`govendor`](https://github.com/kardianos/govendor)，[`glide`](https://github.com/Masterminds/glide)，[`dep`](https://github.com/golang/dep)等，为了解决这种乱象，Go官方出品了 [`Go Modules`](https://golang.google.cn/ref/mod)。

<!-- more -->

{% asset_img go-modules.jpeg Go依赖管理 %}

