---
title: 【Golang】Dependency Injection
date: 2022-03-28 19:38:05
tags:
  - golang
---

[依赖注入](https://en.wikipedia.org/wiki/Dependency_injection)是一种通用技术，通过显式地为组件提供它们工作所需的所有依赖关系，生成灵活且松耦合的代码。在Go语言中，我们经常采用下面这样的方式为构造器传递依赖：

```go
// NewUserStore returns a UserStore that uses cfg and db as dependencies.
func NewUserStore(cfg *Config, db *mysql.DB) (*UserStore, error) {...}
```

这种技术在小规模上效果很好，但较大的应用程序可能有一个复杂的依赖关系图，导致一大块初始化代码依赖于顺序。通常很难干净地分解这段代码，尤其是某些依赖项被多次使用。如果涉及到服务替换可能会更痛苦，因为它涉及通过添加一组全新的依赖项，我们需要修改依赖关系图。如果大家干过这种事情，发现这种代码的修改很繁琐。

依赖注入工具旨在简化初始化代码的管理，我们只需要将自己的服务及其依赖关系描述为代码或配置，然后依赖注入工具会处理生成的依赖关系图，确定排序并且为每个服务自动传递所需要的依赖。通过更改函数签名，添加或删除初始化程序就可以更改应用程序的依赖项，然后依赖注入完成为整个依赖关系图生成初始化代码的繁琐工作。

在Go语言中，这样依赖工具有不少，例如：[dig](https://github.com/uber-go/dig)，[inject](https://github.com/facebookgo/inject) 以及 [wire](https://github.com/google/wire)。这次我们着重介绍 `wire`，相对其他两个有如下优势：

1. `wire` 使用代码生成而不是运行时反射。因为当依赖图变得复杂时，运行时依赖注入可能很难跟踪和调试。使用代码生成意味着在运行时执行的初始化代码是常规的、惯用的 Go 代码，易于理解和调试；

2. `wire` 使用Go类型名称识别依赖项，不用像其他的[服务定位器](https://en.wikipedia.org/wiki/Service_locator_pattern)，需要为每个依赖项定义一个名称；

3. `wire` 更容易避免依赖膨胀。 `Wire` 生成的代码只会导入需要的依赖项，因此二进制文件不会有未使用的导入。然而运行时依赖注入器直到运行时才能识别未使用的依赖项；

4. `Wire` 的依赖图是静态可知的，便于工具可视化；