---
title: 设计模式
date: 2022-10-07 19:25:49
tags:
  - 设计模式
categories:
  - 设计原则
---


设计模式是软件设计中常见问题的典型解决方案。它们就像能根据需求进行调整的预制蓝图，可用于解决代码中反复出现的设计问题。

设计模式与方法或库的使用方式不同，很难直接在自己的程序中套用某个设计模式。模式并不是一段特定的代码，而是解决特定问题的一般性概念。可以根据模式来实现符合自己程序实际所需的解决方案。

人们常常会混淆模式和算法， 因为两者在概念上都是已知特定问题的典型解决方案。但算法总是明确定义达成特定目标所需的一系列步骤，而模式则是对解决方案的更高层次描述，同一模式在两个不同程序中的实现代码可能会不一样。

算法更像是菜谱：提供达成目标的明确步骤。而模式更像是蓝图：可以看到最终的结果和模式的功能，但需要自己确定实现步骤。

设计模式从分类上来讲，可以分为创建型、结构型和行为型。

<!-- more -->

### 创建型

#### 单例模式

单例设计模式（`Singleton Design Pattern`）理解起来非常简单。一个类只允许创建一个对象（或者实例），那这个类就是一个单例类，这种设计模式就叫作单例设计模式，简称单例模式。

下面举两个例子来说明单例模式能解决的问题。

{% tabs 单例模式场景 %}

<!-- tab 处理资源冲突 -->

打印日志是应用程序基本的需求，为了将日志信息打印到文件中，我们可能会写出下面这样的代码：

{% note warning %}
```java
public class Logger {
  private FileWriter writer;
  
  public Logger() {
    File file = new File("/Users/wangzheng/log.txt");
    writer = new FileWriter(file, true); //true表示追加写入
  }
  
  public void log(String message) {
    writer.write(message);
  }
}

// Logger类的应用示例：
public class UserController {
  private Logger logger = new Logger();
  
  public void login(String username, String password) {
    // ...省略业务逻辑代码...
    logger.log(username + " logined!");
  }
}

public class OrderController {
  private Logger logger = new Logger();
  
  public void create(OrderVo order) {
    // ...省略业务逻辑代码...
    logger.log("Created an order: " + order.toString());
  }
}
```
{% endnote %}

这段代码看起来貌似没什么问题，但是在多线程环境中会出现日志覆盖的情况。那如何解决呢，资源抢占访问的最直接的解决方案就是加锁，所以我们可能给出下面这样的解决方案，对象级别的锁或者类级别的锁：

{% tabs 单例模式解决方案一两种处理方式 %}

<!-- tab 对象级别的锁 -->
{% note warning %}
```java
public class Logger {
  private FileWriter writer;

  public Logger() {
    File file = new File("/Users/wangzheng/log.txt");
    writer = new FileWriter(file, true); //true表示追加写入
  }
  
  public void log(String message) {
    synchronized(this) {
      writer.write(mesasge);
    }
  }
}
```
{% endnote %}
对象级别的锁明显解决不了问题，两个线程两个对象，毫不相干。
<!-- endtab -->

<!-- tab 类级别的锁 -->
{% note success %}
```java
public class Logger {
  private FileWriter writer;

  public Logger() {
    File file = new File("/Users/wangzheng/log.txt");
    writer = new FileWriter(file, true); //true表示追加写入
  }
  
  public void log(String message) {
    synchronized(Logger.class) { // 类级别的锁
      writer.write(mesasge);
    }
  }
}
```
{% endnote %}

类级别的锁可以解决问题，让所有的对象都共享同一把锁。这样就避免了不同对象之间同时调用 `log()` 函数，而导致的日志覆盖问题。
<!-- endtab -->
{% endtabs %}

对比这两种解决方案，单例模式的解决思路就简单一些了。单例模式相对于之前类级别锁的好处是，不用创建那么多 `Logger` 对象，一方面节省内存空间，另一方面节省系统文件句柄。

按照这个思路，我们可以设计出下面这样的单例模式解决方案，既然加锁能解决，全局创建一个对象也可以解决咯：

{% note success %}
```java
public class Logger {
  private FileWriter writer;
  private static final Logger instance = new Logger();

  private Logger() {
    File file = new File("/Users/wangzheng/log.txt");
    writer = new FileWriter(file, true); //true表示追加写入
  }
  
  public static Logger getInstance() {
    return instance;
  }
  
  public void log(String message) {
    writer.write(mesasge);
  }
}

// Logger类的应用示例：
public class UserController {
  public void login(String username, String password) {
    // ...省略业务逻辑代码...
    Logger.getInstance().log(username + " logined!");
  }
}

public class OrderController {  
  public void create(OrderVo order) {
    // ...省略业务逻辑代码...
    Logger.getInstance().log("Created a order: " + order.toString());
  }
}
```
{% endnote %}

<!-- endtab -->

<!-- tab 表示全局唯一类 -->

从业务概念上，如果有些数据在系统中只应保存一份，那就比较适合设计为单例类。比如，配置信息类。在系统中，我们只有一个配置文件，当配置文件被加载到内存之后，以对象的形式存在，也理所应当只有一份。再比如，唯一递增 `ID` 号码生成器，如果程序中有两个对象，那就会存在生成重复 `ID` 的情况，所以，我们应该将 `ID` 生成器类设计为单例。

```java

import java.util.concurrent.atomic.AtomicLong;
public class IdGenerator {
  // AtomicLong是一个Java并发库中提供的一个原子变量类型,
  // 它将一些线程不安全需要加锁的复合操作封装为了线程安全的原子操作，
  // 比如下面会用到的incrementAndGet().
  private AtomicLong id = new AtomicLong(0);
  private static final IdGenerator instance = new IdGenerator();
  private IdGenerator() {}
  public static IdGenerator getInstance() {
    return instance;
  }
  public long getId() { 
    return id.incrementAndGet();
  }
}

// IdGenerator使用举例
long id = IdGenerator.getInstance().getId();
```

<!-- endtab -->
{% endtabs %}

讲到这里，如何实现单例模式呢，通用的解决方案有两个步骤：

1. 将默认构造函数设为私有，防止其他对象使用单例类的 `new` 运算符创建新的对象，也就是禁止创建新对象；
2. 新建一个静态构建方法作为构造函数。该函数会 “偷偷” 调用私有构造函数来创建对象，并将其保存在一个静态成员变量中。此后所有对于该函数的调用都将返回这一缓存对象；

例如：

```java
public class IdGenerator { 
  private AtomicLong id = new AtomicLong(0);
  private static IdGenerator instance;
  private IdGenerator() {}
  public static IdGenerator getInstance() {
    if (instance == null) {
      synchronized(IdGenerator.class) { // 此处为类级别的锁
        if (instance == null) {
          instance = new IdGenerator();
        }
      }
    }
    return instance;
  }
  public long getId() { 
    return id.incrementAndGet();
  }
}
```

### 参考链接

1. [设计模式](https://refactoringguru.cn/design-patterns)