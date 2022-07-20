---
title: SOLID 设计原则
date: 2022-07-19 22:15:12
  - SOLID
categories:
  - 设计原则
---

`SOLID` 设计原则并非单纯的一个原则，它实际上包含5个设计原则：单一职责原则、开闭原则、里氏替换替换原则，接口隔离原则和依赖反转原则。

### 单一职责原则（`SRP`）

`SRP(Single Responsibility Principle)` 这个原则的意思是一个类或者一个模块只负责完成一个功能。所以，这里有两种理解方式，一种理解是把模块看做比类更加抽象的概念，类也可以看做是模块。另一种理解是把类看做是比类更加粗粒度的代码块，模块中包含多个类。

单一职责原则定义非常简单，不难理解。一个类只负责完成一个职责或者功能，也就是说，不要设计大而全的类，要设计粒度小、功能单一的类。换个角度来讲就是，一个雷包含了两个或者两个以上业务不相干的功能，那我们就说它职责不够单一，应该将它拆分成多个功能更加单一、粒度更细的类。举例来讲，如果一个类包含了用户和订单的一些操作，而用户和订单又是独立的业务领域模型，我们将它们放到一起就违反了单一职责原则，我们就需要进行拆分。

不同的应用场景、不同阶段的需求背景、不同的业务层面，对于同一个类的职责是否单一，可能会有不用的判定结果。实际上，一些侧面的判断指标更具有指导意义和可执行性，比如，代码行数过度，函数或者属性过多都可能是违反单一职责原则的表象。

例如，下面的 `UserInfo` 类，这个类里面除了用户的基本信息，还有地址信息。或许一个观点是都属于用户的基本信息应该放在一起，另一个观点是可以拆分出 `UserAddress` 类，`UserInfo` 只保留除 `Address` 之外的其他信息，拆分之后两个类的职责更加单一。是否应该拆分，取决于具体情况，如果实际中地址信息和基本信息总是同时出现，那放在一起没有问题。但是如果地址信息单独在其他模块中使用，就应该单独抽象成 `UserAddress`：

```java
public class UserInfo {
  private long userId;
  private String username;
  private String email;
  private String telephone;
  private long createTime;
  private long lastLoginTime;
  private String avatarUrl;
  private String provinveOfAddress;
  private String cityOfAddress;
  private String regionOfAddress;
  private String detailedAddress;
}
```

单一职责原则指导设计粒度较小的类，职责清晰的类，类的依赖以及被依赖的其他类也很会变少，从而降低代码的耦合性，实现高内聚、低耦合。但是如果拆分的过细，可能会适得其反，影响代码的可维护性。

