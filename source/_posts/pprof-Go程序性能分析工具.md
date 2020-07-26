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

### 数据采样

分析的前提是有数据，所以我们得先采集 CPU 和内存相关的数据用于分析，这里有三种方式，我们来一一介绍。

1. `go test` 可以在测试的是对内存和 CPU 进行采样

    > go test -cpuprofile cpu.prof -memprofile mem.prof

2. 在程序中注入代码进行采样

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

3. 开启 HTTP 服务，添加数据采样接口进行分析

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

    这个命令在采集完成之后会自动打开交互式终端查看结果，也可以使用如下的方式打开web查看：

        go tool pprof -http=:9999  http://localhost:11202/debug/pprof/profile?seconds=180
        Fetching profile over HTTP from http://localhost:11202/debug/pprof/profile?seconds=180
        Saved profile in C:\Users\fudenglong\pprof\pprof.samples.cpu.001.pb.gz
        Serving web UI on http://localhost:9999
        # 自动打开浏览器

    采集的数据文件保存在了 `C:\Users\fudenglong\pprof\pprof.samples.cpu.001.pb.gz`，日后需要可以直接使用如下命令打开：

    > go tool pprof -http=:9995 C:\Users\fudenglong\pprof\pprof.samples.cpu.001.pb.gz

    也可以通过 `wget http://localhost:6060/debug/pprof/trace?seconds=5` 获取到相应数据再通过 `go tool pprof` 进行分析。

    更多详情请看：[https://pkg.go.dev/net/http/pprof?tab=doc](https://pkg.go.dev/net/http/pprof?tab=doc)


### go tool pprof

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

### 案例

使用如下命令对官方的库：`net/http` 进行性能基准测试

> go test -run NONE -bench . -memprofile mem.out -cpuprofile cpu.out net/http

分别保存了 cpu 和 内存的采样数据。然后我们使用命令行直接输出单项采样结果：

    $ go tool pprof http.test  mem.out
    File: http.test
    Type: alloc_space
    Time: Jul 19, 2020 at 8:21pm (CST)
    Entering interactive mode (type "help" for commands, "o" for options)
    (pprof) top5
    Showing nodes accounting for 10097.16MB, 64.95% of 15545.62MB total
    Dropped 344 nodes (cum <= 77.73MB)
    Showing top 5 nodes out of 94
        flat  flat%   sum%        cum   cum%
    4798.18MB 30.87% 30.87%  4798.18MB 30.87%  net/textproto.(*Reader).ReadMIMEHeader
    2249.55MB 14.47% 45.34%  8249.36MB 53.07%  net/http.readRequest
    1149.16MB  7.39% 52.73%  1149.16MB  7.39%  net/http.copyValues
    1135.64MB  7.31% 60.03%  1135.64MB  7.31%  net/url.parse
    764.63MB  4.92% 64.95%   764.63MB  4.92%  net/http.readCookies
    (pprof)

- `flat`：仅当前函数，不包括它调用的其他函数；

- `sum`：列表前几行所占百分比的总和；

- `cum`：当前函数调用栈累计；

可以通过 `peek` 进一步查看目标的调用来源：

    $ go tool pprof http.test  mem.out
    File: http.test
    Type: alloc_space
    Time: Jul 19, 2020 at 8:21pm (CST)
    Entering interactive mode (type "help" for commands, "o" for options)
    (pprof) top5
    Showing nodes accounting for 10097.16MB, 64.95% of 15545.62MB total
    Dropped 344 nodes (cum <= 77.73MB)
    Showing top 5 nodes out of 94
        flat  flat%   sum%        cum   cum%
    4798.18MB 30.87% 30.87%  4798.18MB 30.87%  net/textproto.(*Reader).ReadMIMEHeader
    2249.55MB 14.47% 45.34%  8249.36MB 53.07%  net/http.readRequest
    1149.16MB  7.39% 52.73%  1149.16MB  7.39%  net/http.copyValues
    1135.64MB  7.31% 60.03%  1135.64MB  7.31%  net/url.parse
    764.63MB  4.92% 64.95%   764.63MB  4.92%  net/http.readCookies
    (pprof) peek net/url.parse
    Showing nodes accounting for 15545.62MB, 100% of 15545.62MB total
    ----------------------------------------------------------+-------------
        flat  flat%   sum%        cum   cum%   calls calls% + context
    ----------------------------------------------------------+-------------
                                            1107.64MB 97.53%  |   net/url.ParseRequestURI
                                                28MB  2.47%   |   net/url.Parse
    1135.64MB  7.31%  7.31%  1135.64MB  7.31%                 |   net/url.parse
    ----------------------------------------------------------+-------------
    (pprof)

从上面可以看到，`net/url.ParseRequestURI` 和 `net/url.Parse` 对 `net/url.parse` 的调用分别占 `97.53%` 和 `2.47%`。也可以用 `list` 命令输出源码行的统计样式，方便直观定位：

    $ go tool pprof http.test  mem.out
    File: http.test
    Type: alloc_space
    Time: Jul 19, 2020 at 8:21pm (CST)
    Entering interactive mode (type "help" for commands, "o" for options)
    (pprof) list net/url.parse
    Total: 15.18GB
    ROUTINE ======================== net/url.parse in /Users/fudenglong/.gvm/gos/go1.14/src/net/url/url.go
        1.11GB     1.11GB (flat, cum)  7.31% of Total
            .          .    513:	}
            .          .    514:
            .          .    515:	if rawurl == "" && viaRequest {
            .          .    516:		return nil, errors.New("empty url")
            .          .    517:	}
        1.11GB     1.11GB    518:	url := new(URL)
            .          .    519:
            .          .    520:	if rawurl == "*" {
            .          .    521:		url.Path = "*"
            .          .    522:		return url, nil
            .          .    523:	}
    (pprof)

也可以直接在命令行打开查看：

    $ go tool pprof  -text -alloc_objects -cum http.test mem.out
    File: http.test
    Type: alloc_objects
    Time: Jul 19, 2020 at 8:21pm (CST)
    Showing nodes accounting for 144346051, 92.56% of 155949440 total
    Dropped 350 nodes (cum <= 779747)
        flat  flat%   sum%        cum   cum%
            0     0%     0%  119558910 76.67%  testing.(*B).runN
            0     0%     0%  119557836 76.66%  testing.(*B).launch
    9214151  5.91%  5.91%   78429003 50.29%  net/http.readRequest
            0     0%  5.91%   67248520 43.12%  net/http_test.benchmarkReadRequest
            0     0%  5.91%   67248392 43.12%  net/http.ReadRequest (inline)
    50994457 32.70% 38.61%   50994457 32.70%  net/textproto.(*Reader).ReadMIMEHeader
        283998  0.18% 38.79%   25404673 16.29%  net/http.(*conn).serve
    9076873  5.82% 44.61%   20071685 12.87%  net/http.BenchmarkCopyValues
    3920946  2.51% 47.12%   18921809 12.13%  net/http.(*conn).readRequest
            0     0% 47.12%   16984636 10.89%  net/http.HandlerFunc.ServeHTTP
            0     0% 47.12%   16627031 10.66%  net/http_test.BenchmarkReadRequestWrk

### benchstat

[benchstat](https://pkg.go.dev/golang.org/x/perf@v0.0.0-20200318175901-9c9101da8316/cmd/benchstat?tab=doc) 用于计算和比较基准测试的统计详情。使用方式如下：

> benchstat [-delta-test name] [-geomean] [-html] [-sort order] old.txt [new.txt] [more.txt ...]

安装方式：

> go get -u golang.org/x/perf/cmd/...

加入我们搜集了一些基准测试结果，`old.txt` 包含：

    BenchmarkGobEncode   	100	  13552735 ns/op	  56.63 MB/s
    BenchmarkJSONEncode  	 50	  32395067 ns/op	  59.90 MB/s
    BenchmarkGobEncode   	100	  13553943 ns/op	  56.63 MB/s
    BenchmarkJSONEncode  	 50	  32334214 ns/op	  60.01 MB/s
    BenchmarkGobEncode   	100	  13606356 ns/op	  56.41 MB/s
    BenchmarkJSONEncode  	 50	  31992891 ns/op	  60.65 MB/s
    BenchmarkGobEncode   	100	  13683198 ns/op	  56.09 MB/s
    BenchmarkJSONEncode  	 50	  31735022 ns/op	  61.15 MB/s

`new.txt` 包含：

    BenchmarkGobEncode   	 100	  11773189 ns/op	  65.19 MB/s
    BenchmarkJSONEncode  	  50	  32036529 ns/op	  60.57 MB/s
    BenchmarkGobEncode   	 100	  11942588 ns/op	  64.27 MB/s
    BenchmarkJSONEncode  	  50	  32156552 ns/op	  60.34 MB/s
    BenchmarkGobEncode   	 100	  11786159 ns/op	  65.12 MB/s
    BenchmarkJSONEncode  	  50	  31288355 ns/op	  62.02 MB/s
    BenchmarkGobEncode   	 100	  11628583 ns/op	  66.00 MB/s
    BenchmarkJSONEncode  	  50	  31559706 ns/op	  61.49 MB/s
    BenchmarkGobEncode   	 100	  11815924 ns/op	  64.96 MB/s
    BenchmarkJSONEncode  	  50	  31765634 ns/op	  61.09 MB/s

如果我们仅仅是输入一个文件，`benchstat` 会输出如下结果：

    $ benchstat old.txt
    name        time/op
    GobEncode   13.6ms ± 1%
    JSONEncode  32.1ms ± 1%
    $

如果输入两个文件，`benchstat` 将会比较输出：

    $ benchstat old.txt new.txt
    name        old time/op  new time/op  delta
    GobEncode   13.6ms ± 1%  11.8ms ± 1%  -13.31% (p=0.016 n=4+5)
    JSONEncode  32.1ms ± 1%  31.8ms ± 1%     ~    (p=0.286 n=4+5)
    $

请注意，JSONEncode 结果报告为统计上无关紧要的，而不是-0.93％。