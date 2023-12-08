---
title: Protobuf Go 代码生成
date: 2023-12-07 12:24:56
tags:
    - protobuf
    - gogoprotobuf
categories:
    - golang
---


`Protobuf` 是 Google 出品的消息编码工具，相比常用的 `json` 等编码方式，以牺牲可读性，而提高编码效率，减少编码之后消息体占用的字节大小，以提升传输效率。本篇文章主要分享如何生成 `Go` 语言 `pb` 版本，对于 `Go` 语言而言，`protoc` 不能直接生成 `Go` 代码，需要额外的插件。对于这个插件，官方有自己的实现，也有第三方的 `gogo/protobuf`，本节主要是用来厘清他们之间的区别以及用法。在开始之前，我们先澄清一些基本的概念：

1. [`golang/protobuf`](https://github.com/golang/protobuf) 是官方早期的插件实现；
2. [`google.golang.org/protobuf`](https://pkg.go.dev/google.golang.org/protobuf) 是上面的继承者，有更新和更简化的 API，以及其他许多改进，是官方当前的实现；
3. [`gogo/protobuf`](https://github.com/gogo/protobuf) 社区实现，该实现目前被废弃，但是在历史中依然后很多著名的软件在使用，例如 `etcd`；
4. [`protoc`](https://github.com/protocolbuffers/protobuf) 是 `protobuf` 的编译器，用于将 `.proto` 文件编译成各自语言的实现；
5. [`protobuf`](https://protobuf.dev/programming-guides/proto3/) 是一般用于指这门编码语言，该语言目前有两个版本，`proto2` 和 `proto3`；

关于 `protobuf` 编码是如何优化编码效率，可以查看这篇文章：[Protocol Buffers 编码](https://taoshu.in/pb-encoding.html)。

<!-- more -->

### 准备工作

在本地创建一个目录 `proto`，下载 [`protoc`](https://github.com/protocolbuffers/protobuf/releases) 对应平台的版本到本地目录，然后创建一个 `hello.proto` 文件，内容如下：

```proto
// version of protocol buffer used
syntax = "proto3";

import "google/protobuf/any.proto";

// package name for the buffer will be used later
package hello;

// service which can be executed
service Say {
// function which can be called
    rpc Send (SayRequest) returns (SayResponse);
}

// argument
message SayRequest {
// data type and position of data
    string name = 1;
}

// return value
message SayResponse {
// data type and position of data
    string message = 1;
}


message Post {
    string message = 1;
    repeated google.protobuf.Any details = 2;
}
```

目前新创建的 `proto` 目录内容如下：

```
proto/
├── hello.proto
└── protoc
    ├── bin             // protobuf 编译器
    │   └── protoc
    └── include
        └── google      // 预定义的一些消息类型，可以直接在我们的消息定义中引入使用，如 hello.proto 中 Post.details 字段
            └── protobuf
                ├── any.proto
                ├── api.proto
                ├── compiler
                │   └── plugin.proto
                ├── descriptor.proto
                ├── duration.proto
                ├── empty.proto
                ├── field_mask.proto
                ├── source_context.proto
                ├── struct.proto
                ├── timestamp.proto
                ├── type.proto
                └── wrappers.proto
```

### gogo/protobuf

在生成 `gogo/protobuf` 代码之前，我们还需要下载 `gogo/protobuf` 的插件，它实现了多种插件，在生成的代码速度等其他方面有些差别，例如：`protoc-gen-gofast`，`protoc-gen-gogofast`，`protoc-gen-gogofaster` 等，我们以 `protoc-gen-gogofaster` 为例，本地下载插件直接使用命令：

> go install github.com/gogo/protobuf/protoc-gen-gogofaster@latest

命令执行成功之后，插件会安装在 `$GOPATH/bin` 目录下，确保该目录在系统的 `$PATH` 目录中。安装成功之后，我们执行以下命令来生成 `pb` 代码：

> ./protoc/bin/protoc --gogofaster_out=./ hello.proto

注意 `protoc` 引用插件的方式，不包含前缀 `protoc-gen-`。该命令执行成功之后，会在和 `hello.proto` 命令同级目录下生成 `hello.pb.go` 文件。在生成的代码中，可以看到引入的 `Post.details` 字段引入和的 `Any` 类型引用到了 `google` 的实现：

```go
package hello

import (
	fmt "fmt"
	proto "github.com/gogo/protobuf/proto"
	anypb "google.golang.org/protobuf/types/known/anypb"  // 导入 any.proto 对应的代码包
	io "io"
	math "math"
	math_bits "math/bits"
)

...
```

虽然应该是这样的，用谁的 `proto` 定义就用谁的代码实现，但是对应的我们就得引入 `google.golang.org/protobuf` 这个包了。如果想处理这个问题，我们可以通过设置如下的参数解决，给 `gogofaster` 插件传递参数以 `,` 进行分割，以 `:` 结束：

> ./protoc/bin/protoc --gogofaster_out=Mgoogle/protobuf/any.proto=github.com/gogo/protobuf/types:./ hello.proto

这样在生成代码时，`google/protobuf/any.proto` 就会使用 `github.com/gogo/protobuf/types` 这个导入路径，指定 `proto` 文件的导入路径参数规则是：`M${PROTO_FILE}=${GO_IMPORT_PATH}`。如下是新生成的代码：

```go
package hello

import (
	fmt "fmt"
	proto "github.com/gogo/protobuf/proto"
	types "github.com/gogo/protobuf/types"
	io "io"
	math "math"
	math_bits "math/bits"
)
...
```

上面生成的 `pb` 代码都是在当前目录下，包名都是 `hello`。有时候我们想指定新的包名，例如：`example.com/hello/proto/types`，这种该如何处理呢？`proto` 的 `package` 声明的包名和 `Go` 语言不能很好的兼容，`protobuf` 对于语言的差别提供了自定义选项，对于 `Go` 是通过 `option go_package = "example.com/hello/proto/types";` 这样的语法声明，如下新增包名声明：

```proto hello.proto
// version of protocol buffer used
syntax = "proto3";

import "google/protobuf/any.proto";

option go_package = "example.com/hello/proto/types"; // 新增包名

...
```

我们再来生成代码，发现生成的代码位于 `./example.com/hello/proto/types/hello.pb.go`，包名也变成了 `types`：

```go
package types

...
```

默认情况下，这会自动创建一系列的目录，如果将输出目录指定为 `$GOPATH/src` 应该是默认模式最好的选择。如果我们只想生成一个简单源码文件，和 `*.proto` 放一起，只是想改变包名而已，就得指定 `paths=source_relative` 这个参数了，如下所示：

> ./protoc/bin/protoc --gogofaster_out=Mgoogle/protobuf/any.proto=github.com/gogo/protobuf/types,paths=source_relative:./ hello.proto

这个时候生成的文件和 `hello.proto` 在相同的位置，这种结果可能是我们大多情况下想要的。

如果要生成 `grpc` 代码，执行下面的命令，启用 `grpc` 插件，`plugins=grpc`：

> ./protoc/bin/protoc --gogofaster_out=plugins=grpc,Mgoogle/protobuf/any.proto=github.com/gogo/protobuf/types,paths=source_relative:./ hello.proto


### google/protobuf

官方的说明文档详见：[https://protobuf.dev/reference/go/go-generated/](https://protobuf.dev/reference/go/go-generated/)。

同样在编译我们的 `proto` 代码之前，得下载对应的插件：

> go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

同样插件会自动安装 `$GOPATH/bin` 目录下，如果没有设置 `$GOPATH`，默认是：`${HOME}/go`。执行下面的命令生成 `pb` 代码：

> ./protoc/bin/protoc --go_out=. hello.proto

官方之间指定参数得使用 `--go_opt`，例如指定 `pb` 文件的输出位置是相对于 `.proto` 源文件：

>  ./protoc/bin/protoc --go_out=. --go_opt=paths=source_relative  hello.proto

或者指定 `proto` 文件的导入路径：

> ./protoc/bin/protoc --go_out=. --go_opt=paths=source_relative  --go_opt=Mgoogle/protobuf/any.proto=github.com/gogo/protobuf/types  hello.proto

可以通过多个 `--go_opt` 传递参数。

如果指定了 `module=$PREFIX` 参数，则输出文件将放置在以 `Go` 包的导入路径命名的目录中，但会从输出文件名中删除指定的目录前缀。例如，输入文件 `protos/buzz.proto` 的 `Go` 导入路径为 `example.com/project/protos/fizz` 且指定为模块前缀 `example.com/project` 会生成位于 `protos/fizz/buzz.pb` 的输出文件。在模块路径之外生成任何 `Go` 包都会导致错误，此模式对于将生成的文件直接输出到 `Go` 模块非常有用。

例如，对于我们的 `hello.proto`（加了 `option go_package = "example.com/hello/proto/types";`），执行下面的编译命令：

> ./protoc/bin/protoc --go_out=. --go_opt=module=example.com/hello/proto  hello.proto

这会生成 `types/hello.pb.go` 文件，该参数和 `--go_opt=paths=source_relative` 冲突，不能一起使用。

如果想要生成 `grpc` 代码，得先下载[`grpc` 插件](https://grpc.io/docs/languages/go/quickstart/#regenerate-grpc-code)：

> go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

然后执行如下命令生成：

> ./protoc/bin/protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative hello.proto

将会输出 `hello.pb.go` 和 ` hello_grpc.pb.go` 两个文件。