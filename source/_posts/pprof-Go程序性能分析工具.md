---
title: pprof Go程序性能分析工具
date: 2020-03-15 20:44:47
tags:
  - pprof
  - 火焰图
---


Go 语言内置的程序性能分析工具 pprof 能让开发者清除地看到程序在运行时 CPU，以及内存的使用情况，借此，我们可以优化发现很多待优化的函数，查看性能瓶颈；例如，我们可以在测试的是记录程序 CPU 和 内存的采样，然后通过生成的火焰图查看。

生成 CPU 采样数据和内存采样数据：

> go test -cpuprofile cpu.prof -memprofile mem.prof -bench . github.com/bigfile/bigfile/service

查看结果数据，这回自动打开浏览器渲染：

> go tool pprof -http=":8099" cpu.prof

{% asset_img cover.png cover %}

<!-- more -->

本节内容参考的内容如下，主要学习如何使用这个工具定位问题，分析问题：

1. [google/pprof](https://github.com/google/pprof/blob/master/doc/README.md) 

2. [runtime/pprof](https://pkg.go.dev/runtime/pprof?tab=doc)

3. [net/http/pprof](https://pkg.go.dev/net/http/pprof?tab=doc)

4. [Profiling Go Programs](https://blog.golang.org/profiling-go-programs)

#### 数据采样

分析的前提是有数据，所以我们得先采集 CPU 和内存相关的数据用于分析，这里有三种方式，我们来一一介绍。

- 测试的时候生成 CPU 和内存剖析文件

go测试内置了对使用标准测试包构建的性能分析基准的支持。例如，以下命令在当前目录中运行基准测试，并将CPU和内存配置文件写入 `cpu.prof` 和 `mem.prof`

> go test -cpuprofile cpu.prof -memprofile mem.prof -bench .

- 在程序中注入代码生成 CPU 和内存剖析文件

```go
var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to `file`")
var memprofile = flag.String("memprofile", "", "write memory profile to `file`")

func main() {
    flag.Parse()
    if *cpuprofile != "" {
        f, err := os.Create(*cpuprofile)
        if err != nil {
            log.Fatal("could not create CPU profile: ", err)
        }
        defer f.Close() // error handling omitted for example
        if err := pprof.StartCPUProfile(f); err != nil {
            log.Fatal("could not start CPU profile: ", err)
        }
        defer pprof.StopCPUProfile()
    }

    // ... rest of the program ...

    if *memprofile != "" {
        f, err := os.Create(*memprofile)
        if err != nil {
            log.Fatal("could not create memory profile: ", err)
        }
        defer f.Close() // error handling omitted for example
        runtime.GC() // get up-to-date statistics
        if err := pprof.WriteHeapProfile(f); err != nil {
            log.Fatal("could not write memory profile: ", err)
        }
    }
}
```

- 通过标准的 HTTP 接口剖析数据

添加下面这行代码在 HTTP 服务中，将会暴露 `/debug/pprof` 接口用于查看即时的剖析数据，、

> import _ "net/http/pprof"

如果我们的程序没有开启 HTTP 服务器，我们需要开启一个，通过在程序入口处注入一下代码实现：

```go
go func() {
	log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

如果你用的不是默认的 `DefaultServeMux`，你需要把 handler 自行添加进去；配置好之后，就可以使用如下的方式查看性能数据了，例如查看 30s 的 CPU 数据：

> go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

更多详情请看：[https://pkg.go.dev/net/http/pprof?tab=doc](https://pkg.go.dev/net/http/pprof?tab=doc)


### go tool pprof 工具

[pprof](https://github.com/google/pprof) 原本是 Google 单独的开发的工具，现在被 go 集成到语言工具中，详细的文档这里 [https://github.com/google/pprof/blob/master/doc/README.md](https://github.com/google/pprof/blob/master/doc/README.md) 这里可以查询到，pprof 是一个可视化和分析剖析数据的可视化工具。

pprof 读取 `profile.proto` 格式的概要分析样本的集合，并生成报告以可视化并帮助分析数据。它可以生成文本和图形报告。简单来说有三种使用模型：

- 生成指定格式的报告

> pprof <format> [options] source

pprof 将以指定的格式生成报告并退出。格式可以是文本，也可以是图形。有关支持的 `format`，`options` 和 `source` 的详细信息，请参见下文。

- 终端交互查看

> pprof [options] source

pprof将启动一个交互式 shell 程序，用户可以在其中键入命令。输入 `help` 以获得在线帮助。

- Web 形式

如果命令行中声明 `host:port`：

> pprof -http=[host]:[port] [options] source

ppro 将在指定端口上开启一个 HTTP 服务，打开浏览器访问相应的端口就可以在线查看报告，开始的火焰图就是这种形式。

