---
title: protobuf
date: 2017-01-29 11:04:34
search: false
categories:
  - protobuf
tags:
  - Python
  - protobuf
---

{% asset_img 3.jpeg cover %}

<!-- more -->


### 安装

>  Macos 10.13.1， protobuf 3.5，Python3.6


#### 参考文章

1. [google/protobuf](https://github.com/google/protobuf)

2. [protobuf for python](https://github.com/google/protobuf/tree/master/python)


#### 快速安装

1. [下载源代码](https://github.com/google/protobuf/releases)

    ![下载途中所示源代码](1.png)

2. 安装`protoc`

        解压：protoc-3.5.0-osx-x86_64.zip
        
        将解压出的:protoc-3.5.0-osx-x86_64/bin/protoc至于系统路径中

        输入：protoc --version 检查是否安装成功

3. 安装Python扩展，protobuf

        解压：protobuf-python-3.5.0.zip

        进入目录：protobuf-3.5.0/python

        首先更新：setuptools 和 pip， 执行命令：pip3 install -U setuptools pip
        避免出现错误：AttributeError: '_NamespacePath' object has no attribute 'sort'
        我的pip和setuptools版本分别是：pip: 10.0.0.dev0，setuptools: 36.7.2

        然后依次执行：

            python3 setup.py build 
            python3 setup.py test 
            python3 setup.py install

4. 检查是否安装成功

        Python 3.6.3 (v3.6.3:2c5fed86e0, Oct  3 2017, 00:32:08)
        [GCC 4.2.1 (Apple Inc. build 5666) (dot 3)] on darwin
        Type "help", "copyright", "credits" or "license" for more information.
        >>> import google.protobuf
        >>>


### Protobuf 语言指南

protobuf2 语言指南参考：[[翻译] Protobuf 语言指南 （ proto 2 ）](http://blog.csdn.net/cchd0001/article/details/50669079)

官方指南：[Language Guide (proto3)](https://developers.google.com/protocol-buffers/docs/proto3)
官方指南：[Language Guide (proto2)](https://developers.google.com/protocol-buffers/docs/proto)


#### 定义一个消息

首先来看一个简单的例子，定义一个搜索请求的消息格式，每个消息包含一个请求字符串，你感兴趣的页数和每页的结果数。下面是在.proto 文件中定义的消息。

```
syntax = "proto3";

message SearchRequest {
  string query = 1;
  int32 page_number = 2;
  int32 result_per_page = 3;
}
```

> 第一行声明在使用`proto3`语法，如果没有显示说明，protocol buffer 会认为你在使用`proto2`，版本声明必须在文件第一行；
> `SearchRequest` 定义了三个字段，每个字段有一个name和type；


#### 字段类型

在上面的例子中，所有的字段都是标量类型 ： 两个整形（page_number result_per_page）和一个字符串query。 当然你也可以使用其他组合类型，比如枚举或者其他 消息类型。


#### 分配标签

正如你所看到的，消息中每一个字段都被定义了一个独一无二的数字标签。这个标签是用来在二进制的消息格式中区分字段的，  
一旦你的消息开始被使用，这些标签就不应该再被修改了。注意`1`到`15`的标签在编码的时候仅占用`1byte`，`16-2047`占用  
`2byte`。因此你应该将`1-15`标签留给经常使用的消息元素。另外为未来可能添加的常用元素预留位子。  
你能定义的最小的标签是1， 最大是 `2^29 - 1` ， 另外 19000 到 19999 （
`FieldDescriptor::kFirstReservedNumber through FieldDescriptor::kLastReservedNumber` 
也不能用。他们是protobuf 的编译预留标签。另外你也不能使用被 `reserved`的标签;


#### 字段规则

消息字段可以是以下所描述的一种：

-  `singular`: 格式正确d的消息可以有0个或者1个这样的字段；
-  `repeated`: 这个字段可以有任意多个。字段值的顺序被保留。 

`proto3`中，默认情况下，标量数字类型的`repeated`字段使用`packet`编码；[Protocol Buffer Encoding](https://developers.google.com/protocol-buffers/docs/encoding.html#packed)


#### 定义更多的消息类型

多个消息类型可以在一个`.proto`文件中定义。当你定义多个相关联的消息的时候就用的上了;  
比如我要定义一个`SearchResponse`来回应`SearchRequest`消息，那么我在同一个文件中作如下声明：

```
message SearchRequest {
  string query = 1;
  int32 page_number = 2;
  int32 result_per_page = 3;
}

message SearchResponse {
 ...
}
```

#### 添加注释

在`.proto`文件中添加注释，可以使用C//C++分割的`//`和`/* ... */`语法，例如：

```
/* SearchRequest represents a search query, with pagination options to
 * indicate which results to include in the response. */

message SearchRequest {
  string query = 1;
  int32 page_number = 2;  // Which page number do we want?
  int32 result_per_page = 3;  // Number of results to return per page.
}
```

#### 保留字段

你可能在某次更新更新中删了一个字段或者屏蔽了，但是未来的使用者可能重用这个标签去标记他们自己的字段。  
然后当他们加载旧的消息的时候就会出现很多问题，包括数据冲突，隐藏的bug等等。  
指定这个字段的标签数字（或者名字，名字可能在序列化为JSON的时候可能冲突）标记为`reserved`来保证他们不会再次被使用。  
如果以后的人试用的话`protobuf`编译器会提示出错。
```
message Foo {
  reserved 2, 15, 9 to 11;
  reserved "foo", "bar";
}
```

#### 从`.proto`文件最终能生成什么？

对于`python`而言，Python编译器会根据在`.proto`文件中描述的`message type`生成一个静态描述符模块,  
然后在元类中使用它在运行时创建必要的Python数据访问类。 


#### 标量类型

一个标量消息字段可以是下列类型中的一个；

| proto         | python        | 描述   |
| ------------- |:-------------:|:----- |
| double        | float         |       |
| float         | float         |       |
| bool          | bool          |       |
| int32         | int           |    变长编码. 编码负数效率低下, 打算使用负数的话可以使用 sint32. |
| int64         | int           |    变长编码. 编码负数效率低下, 打算使用负数的话可以使用 sint64. |
| unit32        | int           |    变长编码. |
| unit64        | int           |    变长编码. |
| sint32	| int           |    变长编码，数值有符号，负数编码效率低于int32 |
| sint64	| int           |    变长编码，数值有符号，负数编码效率低于int64 |
| fixed32	| int           |    固定4byte， 如果数值经常大于2的28次方的话效率高于uint32. |
| fixed64	| int           |    固定4byte， 如果数值经常大于2的56次方的话效率高于uint64. |
| sfixed32	| int           |    固定4byte。 |
| sfixed64	| int           |    固定8byte。 |
| string	| string        |    字符串内容应该是 UTF-8 编码或者7-bit ASCII 文本. |
| bytes		| byte          |    任意二进制数据 |


#### 默认值

解析消息时，如果编码的消息不包含特定的`singular`元素，则解析对象中的相应字段将设置为该字段的默认值。这些默认值是特定于类型的:

- `string`： 空的字符串；
- `bytes`：  空的字节；
- `bool`：   `false`；
- 数字类型：  默认为0；
- `enum`    定义的第一个值，而且它必须为0；

#### 枚举

当你定义一个消息的时候，你可能希望它其中的某个字段一定是预先定义好的一组值中的一个。  
例如说要在`SearchRequest`中添加`corpus`字段。它只能是 `UNIVERSAL`, `WEB` , `IMAGES` , `LOCAL`, `NEWS` ,`PRODUCTS`, 或者 `VIDEO` 。  
你可以很简单的在你的消息中定义一个枚举并且定义`corpus`字段为枚举类型，如果这个字段给出了一个不再枚举中的值，那么解析器就会把它当作一个未知的字段。

下面的例子中，我们添加了一个`enum`字段叫`Corpus`以及所有已可能的值，以及一个`Corpus`类型的字段`corpus`，

```
message SearchRequest {
  string query = 1;
  int32 page_number = 2;
  int32 result_per_page = 3;
  enum Corpus {
    UNIVERSAL = 0;
    WEB = 1;
    IMAGES = 2;
    LOCAL = 3;
    NEWS = 4;
    PRODUCTS = 5;
    VIDEO = 6;
  }
  Corpus corpus = 4;
}
```

正如你看到的，`Corpus`第一个常量值必须为`0`, 每个常量**必须**包含一个值为0的常量并且为第一个元素，这是因为：

你可以通过将相同的值分配给不同的枚举常量来定义别名。为此，你需要将`allow_alias`选项设置为`true`，否则当找到别名时，protocal编译器将生成错误消息。
```
enum EnumAllowingAlias {
  option allow_alias = true;
  UNKNOWN = 0;
  STARTED = 1;
  RUNNING = 1;
}
enum EnumNotAllowingAlias {
  UNKNOWN = 0;
  STARTED = 1;
  // RUNNING = 1;  // Uncommenting this line will cause a compile error inside Google and a warning message outside.
}
```

枚举常数必须是一个32为的整数。由于枚举值在通讯的时候使用变长编码，所以负数的效率很低，不推荐使用。  
你可以在（像上面这样）在一个消息内定义枚举，也可以在消息外定义,这样枚举就在全文件可见了。  
如果你想要使用在消息内定义的枚举的话，使用语法 `MessageType.EnumType`。

当你在运行`protocol buffer compiler`编译一个包含了`enum`的`.proto`的文件时，  
在Python中，会对应生成一个特殊的`EnumDescriptor`描述其类；用于在运行时创建一系列  
值为整数的常量。 


#### 使用其他的消息类型

你可以用其他的消息类型作为字段类型，例如，我正打算在`SearchResponse`消息中包含`Result`消息，为此，  
你可在相同的`.proto`文件中定义一个`Result`消息类型，然后在`SearchResponse`中定义一个`Result`字段；

```
message SearchResponse {
  repeated Result results = 1;
}

message Result {
  string url = 1;
  string title = 2;
  repeated string snippets = 3;
}
```

#### 导入定义

在上面的例子中， `Result`消息类型是和`SearchResponse`定义在同一个文件中，  
如果你想使用的消息类型已经在另一个`.proto`文件中定义的话怎么办 ？ 

只要你导入一个文件就可以使用这个文件内定义的消息。在你的文件头部加上这样的语句来导入其他文件： 
`import "myproject/other_protos.proto";` 

默认情况下你只能使用直接导入的文件中的定义。  

然而有的时候你需要将一个文件从一个路径移动到另一个路径的时候，  
与其将所有的引用这个文件的地方都更新到新的路径，不如在原来的路径上留下一个假的文件，  
使用`import public`来指向新的路径。**`import public`语句可以将它导入的文件简介传递给导入本文件的文件**。比如 ：

```
// new.proto
// All definitions are moved here

```

```
// old.proto
// This is the proto that all clients are importing.
import public "new.proto";
import "other.proto";
```

```
// client.proto
import "old.proto";
// You use definitions from old.proto and new.proto, but not other.
```

在命令行中试用`-I/--proto_path`来指定一系列的编译器搜索路径，如果这个参数没有被设置，  
那么默认在命令执行的路径查找。通常情况下使用`-I/--proto_path`来指定到你项目的根目录，  
然后使用完整的路径来导入所需的文件。



#### 嵌套类型

你可以在一个消息中定义并使用其他类型的消息，如下：`Result`是在`SearchResponse`中定义的：

```
message SearchResponse {
  message Result {
    string url = 1;
    string title = 2;
    repeated string snippets = 3;
  }
  repeated Result results = 1;
}

```

如果你打算在这个消息的副消息之外冲用这个消息，你可以这样引用他，`Parent.Type`：

```
message SomeOtherMessage {
  SearchResponse.Result result = 1;
}
```

嵌套的级别没有限制：

```
message Outer {                  // Level 0
  message MiddleAA {  // Level 1
    message Inner {   // Level 2
      int64 ival = 1;
      bool  booly = 2;
    }
  }
  message MiddleBB {  // Level 1
    message Inner {   // Level 2
      int32 ival = 1;
      bool  booly = 2;
    }
  }
}
```


#### 更新一个消息类型

如果一个现有的消息不再满足你的所有需求，比如你需要额外的字段，但是你仍希望兼容旧代码生成的消息；  
不要担心，在不破坏你现有的代码的前提下更新消息是很简单的，但是要遵循以下规则：

- 不要改变任何已有的数字标签；

- 如果你新添加新的字段，任何使用旧代码序列化生成的消息任然可以被新的代码解析；  
  不过你应该记住这些元素的默认值，以便新代码可以正确地与旧代码生成的消息进行交互。  
  同样，新代码创建的消息也可以用旧代码解析：旧的二进制文件在解析时会忽略新的字段；

- 只要标签号码在更新的消息类型中不再使用，字段可以被删除。您可能需要重新命名该字段，  
  可能会添加前缀“OBSOLETE_”，或者保留标记，以便未来的`.proto`用户不会意外重复使用该数字。

- int32, uint32, int64, uint64, 和 bool这些类型是兼容的 —— 这意味着你可以将一个字段的类型从其中的一种转化为另一种，不会打破向前向后兼容！  

- sint32 sint64相互兼容，但是不和其他的数字类型兼容。  

- string bytes相互兼容 ，前提是二进制内容是有效的UTF-8 。

- 嵌入式消息与字节兼容，如果字节包含消息的编码版本

- fixed32 兼容 sfixed32,  fixed64 兼容sfixed64.

- `enum`和 `int32, uint32, int64, and uint64`在传输格式中相互兼容（如果值不合适将会被截断），但是在反序列化的时候，接收方可能以不同的方式对待；  
  例如：`proto3`中无法识别的枚举类型将保留在消息中，但消息反序列化时如何表示是语言相关的。 int域始终保持其值。


#### 未知字段


#### Any

Any消息类型允许你使用消息作为嵌入式类型，而无需在`.proto`中定义。   
Any包含一个任意的序列化的消息作为字节，以及一个充当全局唯一标识符并解析为该消息类型的URL。 
要使用Any类型，您需要import`google/protobuf/any.proto`。

```
import "google/protobuf/any.proto";

message ErrorStatus {
  string message = 1;
  repeated google.protobuf.Any details = 2;
}
```

#### Oneof

如果你有一个拥有多个字段的消息，但是同时只会有一个字段存在，你可以强制使用`oneof`特性以节省内存;

要在你的`.proto`中定义一个`oneof`，你需要使用`oneof`关键字，然后是 `oneof name `，在这个例子中，是`test_oneof`:

```
message SampleMessage {
  oneof test_oneof {
    string name = 4;
    SubMessage sub_message = 9;
  }
}
```
然后你可以在`oneof`定义中添加`oneof`字段，但是你**不能添加`repeated`字段**；


`oneof` 具有如下特性：

- 设置一个oneof字段会自动清理其他的oneof字段。如果你设置了多个oneof字段，只有最后一个有效。

- 如果解析器发现多个oneof字段被设置了，最后一个读到的算数。

- `oneof` 字段不能使`repeated`类型；

- 反射API对oneof字段有效。


#### Packages

为防止消息命名冲突，你可以在`.proto`文件中使用`package`说明符来区分，例如：

```
package foo.bar;
message Open { ... }
```

你可以在定义消息类型的字段时使用包说明符：

```
message Foo {
  ...
  foo.bar.Open open = 1;
  ...
}
```

包名的实现取决于具体的编程语言：

> 在 Python中,由于Python的模块是由它的文件系统来管理的，所以包名被忽略。


#### 定义服务

如果打算将你的消息配合一个`RPC(Remote Procedure Call 远程调用`系统联合使用的话，    
你可以在.proto文件中定义一个`RPC`服务接口然后`protobuf`就会给你生成一个服务接口和其他必要代码。  
比如你打算定义一个远程调用，接收`SearchRequest`返回`SearchResponse`， 那么你在你的文件中这样定义 ：

```
service SearchService {
  rpc Search (SearchRequest) returns (SearchResponse);
}
```


### Protobuf Example


#### 创建`.proto`文件，声明消息格式

命名为：`addressbook.proto`

```
syntax = "proto3";

package tutorial;

message Person {

    string name = 1;

    int32 id = 2;

    string email = 3;

    enum PhoneType {

        HOME = 0;

        MOBILE = 1;

        WORK = 2;
    }

    message PhoneNumber {

        string number = 1;

        PhoneType type = 2;
    }

    repeated PhoneNumber phones = 4;
}

message AddressBook {

	repeated Person people = 1;
}
```

#### 编译`.proto`文件，创建Python类

> protoc -I=./ --python_out=./ ./addressbook.proto

#### 测试使用

```python
from google.protobuf import json_format

import addressbook_pb2

person = addressbook_pb2.Person()

person.id = 1
person.name = "付登龙"
person.email = "1185694@qq.com"
person.phones.add(number="13386851858", type=addressbook_pb2.Person.MOBILE)

# 序列化成二进制
print(person.SerializeToString())

# 从二进制反序列化
person1 = addressbook_pb2.Person()
person1.ParseFromString(person.SerializeToString())

# 转换成字典
print(json_format.MessageToDict(person1, True))

# 从json数据反序列化
person2 = addressbook_pb2.Person()
json_format.Parse(json_format.MessageToJson(person1, True), person2)
print(person2)

```

输出结果如下：
```
b'\n\t\xe4\xbb\x98\xe7\x99\xbb\xe9\xbe\x99\x10\x01\x1a\x0e1185694@qq.com"\x0f\n\x0b13386851858\x10\x01'
{'name': '付登龙', 'id': 1, 'email': '1185694@qq.com', 'phones': [{'number': '13386851858', 'type': 'MOBILE'}]}
name: "\344\273\230\347\231\273\351\276\231"
id: 1
email: "1185694@qq.com"
phones {
  number: "13386851858"
  type: MOBILE
}
```

参考以下文章：

1. [Protocol Buffer Basics: Python](https://developers.google.com/protocol-buffers/docs/pythontutorial)
2. [Protocol Api for Python](https://developers.google.com/protocol-buffers/docs/reference/python/)



### gRPC 


参考文章如下：

1. [https://grpc.io/docs/quickstart/python.html](https://grpc.io/docs/quickstart/python.html)

2. [https://grpc.io/docs/](https://grpc.io/docs/)

3. [gRPC 官方文档中文版](http://doc.oschina.net/grpc?t=60138)


#### 什么是gRPC？

在 gRPC 里客户端应用可以像调用本地对象一样直接调用另一台不同的机器上服务端应用的方法，使得您能够更容易地创建分布式应用和服务。  与许多 RPC 系统类似，

gRPC 也是基于以下理念：定义一个服务，指定其能够被远程调用的方法（包含参数和返回类型）。
在服务端实现这个接口，并运行一个 gRPC 服务器来处理客户端调用。在客户端拥有一个存根能够像服务端一样的方法。

![rpc原理图](2.png)

gRPC 客户端和服务端可以在多种环境中运行和交互，从 google 内部的服务器到你自己的笔记本，并且可以用任何 gRPC 支持的语言来编写。  
所以，你可以很容易地用 Java 创建一个 gRPC 服务端，用 Go、Python、Ruby 来创建客户端。此外，Google 最新 API 将有 gRPC 版本的接口，使你很容易地将 Google 的功能集成到你的应用里。


#### Python3中使用gRPC服务


##### 环境及要求

> gRPC需要Python2.7或者3.4以上；

1. 升级`pip`，确保其为最新版：`pip3 install -U pip`

2. 安装`gRPC`，`pip3 install grpcio`

3. 安装`gRPC`，`pip3 install grpcio-tools`


##### 定义Service

> helloworld.proto

```proto
syntax = "proto3";

package helloworld;

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}

// The greeting service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply) {}

  // send another greeting
  rpc SayHelloAgain(HelloRequest) returns (HelloReply) {}
}
```

##### 生成gRPC代码以及消息类型


执行命令：`python3 -m grpc_tools.protoc -I . --python_out=. --grpc_python_out=. helloworld.proto`

将生成两个文件：`helloworld_pb2.py`和`helloworld_pb2_grpc.py`

##### 创建Server

```python
# -*- coding:utf-8 -*-

import time
from concurrent import futures

import grpc

import helloworld_pb2
import helloworld_pb2_grpc


class Greeter(helloworld_pb2_grpc.GreeterServicer):

    def SayHello(self, request, context):
        return helloworld_pb2.HelloReply(message="hello world, %s" % request.name)

    def SayHelloAgain(self, request, context):
        return helloworld_pb2.HelloReply(message="hello world, %s" % request.name)


def main():

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    helloworld_pb2_grpc.add_GreeterServicer_to_server(Greeter(), server)
    server.add_insecure_port("[::]:50051")
    server.start()

    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        server.stop(0)


if __name__ == '__main__':
    main()

```

运行server：`python3 rpc_server.py `


##### 创建client

```python
# -*- coding:utf-8 -*-

import grpc

import helloworld_pb2
import helloworld_pb2_grpc


def run():
    channel = grpc.insecure_channel("localhost:50051")
    stub = helloworld_pb2_grpc.GreeterStub(channel=channel)
    r = stub.SayHello(helloworld_pb2.HelloRequest(name="Gamelife"))
    print("Greeter client received: %s" % r.message)
    r = stub.SayHelloAgain(helloworld_pb2.HelloRequest(name="baby"))
    print("Greeter client received: %s" % r.message)


if __name__ == '__main__':
    run()

```

运行client：`python3 rpc_client.py `

输出：

    Greeter client received: hello world, Gamelife
    Greeter client received: hello world, baby


### 参考文章

1. [深入了解 gRPC：协议](http://www.jianshu.com/p/48ad37e8b4ed)
2. [gRPC in Production](https://about.sourcegraph.com/go/grpc-in-production-alan-shreve/)

