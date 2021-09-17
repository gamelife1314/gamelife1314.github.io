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

在这种背景下，诞生了很多第三方的依赖管理工具，如：[`govendor`](https://github.com/kardianos/govendor)，[`glide`](https://github.com/Masterminds/glide)，[`dep`](https://github.com/golang/dep)等，为了解决这种乱象，Go官方出品了 [`Go Modules`](https://golang.google.cn/ref/mod)，一统江山，其他的第三方管理工具都退出了历史的舞台。

<!-- more -->

{% asset_img go-modules.jpeg %}

本文中的内容均来自Go语言官方的 [go.mod 文件参考](https://golang.google.cn/doc/modules/gomod-ref) 和 [Go Modules参考](https://golang.google.cn/ref/mod)，如有不实，请参考官方，Go语言的模块管理系统一直在变动，做些细微的调整。


### go.mod

学习之前，先看个 [`etcd`](https://github.com/etcd-io/etcd/blob/main/go.mod) 的例子，看看工业级项目的 `go.mod` 文件都长什么样，文件中包含好几个部分，以不同的指令分成不同的模块：

```
module go.etcd.io/etcd/v3

go 1.16

replace (
	go.etcd.io/etcd/api/v3 => ./api
	go.etcd.io/etcd/client/pkg/v3 => ./client/pkg
	go.etcd.io/etcd/client/v2 => ./client/v2
	go.etcd.io/etcd/client/v3 => ./client/v3
	go.etcd.io/etcd/etcdctl/v3 => ./etcdctl
	go.etcd.io/etcd/etcdutl/v3 => ./etcdutl
	go.etcd.io/etcd/pkg/v3 => ./pkg
	go.etcd.io/etcd/raft/v3 => ./raft
	go.etcd.io/etcd/server/v3 => ./server
	go.etcd.io/etcd/tests/v3 => ./tests
)

require (
	github.com/bgentry/speakeasy v0.1.0
	github.com/dustin/go-humanize v1.0.0
	github.com/spf13/cobra v1.1.3
	go.etcd.io/bbolt v1.3.6
	go.etcd.io/etcd/api/v3 v3.5.0
	go.etcd.io/etcd/client/pkg/v3 v3.5.0
	go.etcd.io/etcd/client/v2 v2.305.0
	go.etcd.io/etcd/client/v3 v3.5.0
	go.etcd.io/etcd/etcdctl/v3 v3.5.0
	go.etcd.io/etcd/etcdutl/v3 v3.5.0
	go.etcd.io/etcd/pkg/v3 v3.5.0
	go.etcd.io/etcd/raft/v3 v3.5.0
	go.etcd.io/etcd/server/v3 v3.5.0
	go.etcd.io/etcd/tests/v3 v3.5.0
	go.uber.org/zap v1.17.0
	golang.org/x/time v0.0.0-20210220033141-f8bda1e9f3ba
	google.golang.org/grpc v1.38.0
	gopkg.in/cheggaaa/pb.v1 v1.0.28
)
```

`go.mod` 文件描述了Go模块的一些属性，模块是包的集合，模块中的每个包都是同一目录中编译在一起的源文件的集合，**包路径**（[`package path`](https://golang.google.cn/ref/mod#glos-package-path)），就是将**模块路径**（[`module path`](https://golang.google.cn/ref/mod#module-path)），和包含包的子目录连接起来，例如 `golang.org/x/net` 模块在 `html` 目录中包含一个包，那么这个包的路径就是 `golang.org/x/net/html`。`go.mod` 要包括第三方依赖信息和Go版本，其中：

- 模块路径（`module path`）：包含两层意思，当前模块是什么和去哪里找。通常情况下，模块路径由仓库根路径、仓库中的目录和可选的版本后缀（用于v2版本或者更高版本）组成。

    go 的下载命令会根据模块路径构造查询请求，[找到模块的源码下载路径和协议](https://golang.google.cn/ref/mod#vcs-find) ，如 `github.com/bgentry/speakeasy` 模块，Go 在查找此模块时，会先构造查询请求：`https://github.com/bgentry/speakeasy?go-get=1`，这个请求的返回内容中，通常包含一个特殊的 HTML META 标签，格式为：`<meta name="go-import" content="root-path vcs repo-url">`，包含三部分信息：

    1. **`root-path`** 存储仓库的根路径，和模块路径相对应，该目录下包含了 `go.mod`文件，它必须是所请求模块路径的前缀或完全匹配。
    2. **`vcs`**       版本控制系统，例如：`git`、`svn`、`hg`
    3. **`repo-url`**  仓库的URL

    ![](go-get-module-path.png)

    如何从一个 `package path` 解析找到`module`，请[点击查看详情](https://golang.google.cn/ref/mod#resolve-pkg-mod)。

- Go版本，通过 `go` 指令指定当前模块需要的最低版本；

- 第三方依赖，通过 `require` 指令指定需要的第三方依赖最小版本；

- 其他可选指令，例如通过 `replace` 指定替换某个版本或者通过 `exclude` 排除某个版本。

