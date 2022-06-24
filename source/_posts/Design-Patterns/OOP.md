---
title: 面向对象
date: 2022-06-20 12:34:32
tags:
  - 面向对象
categories:
  - 设计原则
---


几年前在面试的时候，还经常被面试官问 `OOP` 的四个特征是什么以及他们背后代表的意思，几年过去了，除了不支持面向对象的语言之外，面向对象编程思想已经深入到了每个开发者的灵魂，只是做的好与不好罢了。

面向对象编程中有两个非常基础的概念，类和对象，面向对象编程是一种编程范式或者说编程风格，它以类或者对象作为组织代码的基本单元，并将封装，继承，抽象，多态作为代码设计和实现的基石，不像面向过程编程语言，以函数为程序中的基本单元。

面向对象编程只是一种编程思想，可以用不同的语言进行实现，即使我们用面向对象语言，也完全可以写出面向过程风格的代码。至于什么是面向对象编程语言，并没有严格的定义，只要它能实现 `OOP` 的四大特性，那它就是面向对象编程语言，例如：`Rust`，`C++`，`GO`，`Java`，`Python` 以及 `PHP` 等，

面向对象编程的前提是面向对象分析（`OOA`）和面向对象设计（`OOD`），这样才能进行面向对象编程（`OOP`），具备完整的面向对象编程的思维。面向对象分析和设计两个阶段的产物应该是类的设计，包括应用程序应该被分为哪些类，每个类该有哪些属性和方法，类与类之间如何交互等等，它们比较贴近代码，非常具体，容易落地实现。

在 `OOA` 和 `OOD` 的过程中，我们会经常用到 `UML（Unified Model Language）` 工具辅助我们进行工作。`UML` 是一种比较复杂的工具，除了包括我们常见的类图，还有用例图，顺序图，活动图，状态图，组件图等，即使是类图，类之间的关系就有泛化，实现，关联，聚合，组合以及依赖等，熟练掌握难度比较大，即便你掌握了，你同事不一定掌握，沟通成本依然很高，大多时候，我们会用草图实现我们的设计过程。


<!-- more -->

### 四要素

这四大特性，光知道它们的定义是不够的，我们还要知道每个特性存在的意义和目的，以及它们能解决哪些编程问题。对于这四大特性，尽管大部分面向对象编程语言都提供了相应的语法机制来支持，但不同的编程语言实现这四大特性的语法机制可能会有所不同。

#### 封装

封装，也叫做信息隐藏或者数据访问保护。类通过暴露有限的访问接口，授权外部仅能通过类提供的方法来访问内部信息或者数据。下面是一个钱包的 `Java` 实现：

```java
public class Wallet {
    private String id;
    private long createTime;
    private BigDecimal balance;
    private long balanceLastModifiedTime;

    public Wallet() {
        this.id = IdGenerator.getInstance().generate();
        this.createTime = System.currentTimeMillis();
        this.balance = BigDecimal.ZERO;
        this.balanceLastModifiedTime = System.currentTimeMillis();
    }

    public String getId() { return this.id; }
    public long getCreateTime() { return this.createTime; }
    public BigDecimal getBalance() { return this.balance; }
    public long getBalanceLastModifiedTime() { return this.balanceLastModifiedTime;  }

    public void increaseBalance(BigDecimal increasedAmount) {
        if (increasedAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidAmountException("...");
        }
        this.balance.add(increasedAmount);
        this.balanceLastModifiedTime = System.currentTimeMillis();
    }

    public void decreaseBalance(BigDecimal decreasedAmount) {
        if (decreasedAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidAmountException("...");
        }
        if (decreasedAmount.compareTo(this.balance) > 0) {
            throw new InsufficientAmountException("...");
        }
        this.balance.subtract(decreasedAmount);
        this.balanceLastModifiedTime = System.currentTimeMillis();
    }
}
```

从代码中，我们可以发现，`Wallet`类主要有四个属性（也可以叫作成员变量），也就是我们前面定义中提到的信息或者数据。其中，`id` 表示钱包的唯一编号，`createTime` 表示钱包创建的时间，`balance` 表示钱包中的余额，`balanceLastModifiedTime` 表示上次钱包余额变更的时间。

我们根据封装的目的，对钱包的这四个属性的访问方式进行了限制，调用者只允许通过上面六个方法来访问或者修改钱包里的数据。之所以这样设计，是因为从业务的角度来说，`id`、`createTime`在创建钱包的时候就确定好了，之后不应该再被改动，所以，我们并没有在`Wallet`类中，暴露`id`、`createTime`这两个属性的任何修改方法，比如`set`方法。而且，这两个属性的初始化设置，对于`Wallet`类的调用者来说，也应该是透明的，所以，我们在`Wallet`类的构造函数内部将其初始化设置好，而不是通过构造函数的参数来外部赋值。

封装意味着我们需要控制类的灵活性，仅通过暴露必要的操作，提高类的易用性。

#### 抽象

封装的目的是隐藏数据和信息，抽象的目的是隐藏方法实现，让调用这只需知道类提供了哪些能力，而不关注其具体实现。在不同的语言中，对于抽象有不同的实现，例如，`Go` 和 `Java` 中的接口，`Rust` 中的 `Trait` 或者其他语言中的抽象类。

```golang
type Picture struct {
	Id string
}

type PictureStorager interface {
	SavePicture(picture *Picture)
	GetPicture(id string) *Picture
	DeletePicture(id string)
}

type MemoryStorage struct{}

func (m *MemoryStorage) SavePicture(picture *Picture) {}

func (m *MemoryStorage) GetPicture(id string) *Picture {
	return &Picture{}
}

func (m *MemoryStorage) DeletePicture(id string) {}
```

在上面的这段代码中，对于调用者而言，在使用图片存储功能的时候，只需要了解 `PictureStorager` 这个接口暴露了哪些方法，而不用去查看具体类对应方法的实现逻辑。

抽象作为一个非常宽泛的设计思想，在代码设计中，起到了非常重要的指导作用，很多设计原则都体现了抽象这种设计思想，比如基于接口而非实现编程、开闭原则，代码解耦等。