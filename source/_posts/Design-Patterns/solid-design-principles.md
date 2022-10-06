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

### 开闭原则（`OCP`）

`OCP(Open Closed Principle)` 它的意思是软件实体应该对修改关闭，对扩展开放。详细描述就是，添加一个新功能应该是在已有代码基础上扩展代码（新增模块，类，方法等），而不是修改已有代码。

下面是一个 `API` 监控告警的例子，其中，`AlertRule` 存储告警规则，可以自由设置。`Notification` 是告警通知类，支持邮件、短信、微信、手机等多种通知渠道。`NotificationEmergencyLevel` 表示通知的紧急程度，包括 `SEVERE`（严重）、`URGENCY`（紧急）、`NORMAL`（普通）、`TRIVIAL`（无关紧要），不同的紧急程度对应不同的发送渠道。

```java
public class Alert {
  private AlertRule rule;
  private Notification notification;

  public Alert(AlertRule rule, Notification notification) {
    this.rule = rule;
    this.notification = notification;
  }

  public void check(String api, long requestCount, long errorCount, long durationOfSeconds) {
    long tps = requestCount / durationOfSeconds;
    if (tps > rule.getMatchedRule(api).getMaxTps()) {
      notification.notify(NotificationEmergencyLevel.URGENCY, "...");
    }
    if (errorCount > rule.getMatchedRule(api).getMaxErrorCount()) {
      notification.notify(NotificationEmergencyLevel.SEVERE, "...");
    }
  }
}
```

上面这段代码非常简单，业务逻辑主要集中在 `check()` 函数中。当接口的 `TPS` 超过某个预先设置的最大值时，以及当接口请求出错数大于某个最大允许值时，就会触发告警。

现在，如果我们需要添加一个功能，当每秒钟接口超时请求个数，超过某个预先设置的最大阈值时，我们也要触发告警发送通知。最能想到的则是下面的这种修改方案，主要的改动有两处：

1. 修改 `check()` 函数的入参，添加一个新的统计数据 `timeoutCount`，表示超时接口请求数；
2. 在 `check()` 函数中添加新的告警逻辑；

{% note warning %}
```java
public class Alert {
  // ...省略AlertRule/Notification属性和构造函数...
  
  // 改动一：添加参数timeoutCount
  public void check(String api, long requestCount, long errorCount, long timeoutCount, long durationOfSeconds) {
    long tps = requestCount / durationOfSeconds;
    if (tps > rule.getMatchedRule(api).getMaxTps()) {
      notification.notify(NotificationEmergencyLevel.URGENCY, "...");
    }
    if (errorCount > rule.getMatchedRule(api).getMaxErrorCount()) {
      notification.notify(NotificationEmergencyLevel.SEVERE, "...");
    }
    // 改动二：添加接口超时处理逻辑
    long timeoutTps = timeoutCount / durationOfSeconds;
    if (timeoutTps > rule.getMatchedRule(api).getMaxTimeoutTps()) {
      notification.notify(NotificationEmergencyLevel.URGENCY, "...");
    }
  }
}
```
{% endnote %}


这种修改方案存在两个问题：

1. 我们对接口进行了修改，这就意味着调用这个接口的代码都要做相应的修改；
2. 另一方面，修改了 `check()` 函数，相应的单元测试都需要修改;

这种代码的改动就是基于“修改”的方式来实现新功能，我们再来看一种基于 `OCP` 原则修改代码，但是这种修改需要对原有的代码进行重构，包含两方面：

1. 将 `check()` 函数的多个入参封装成 `ApiStatInfo` 类；
2. 引入 `handler` 的概念，将 `if` 判断逻辑分散在各个 `handler` 中；

{% note success %}
```java

public class Alert {
  private List<AlertHandler> alertHandlers = new ArrayList<>();
  
  public void addAlertHandler(AlertHandler alertHandler) {
    this.alertHandlers.add(alertHandler);
  }

  public void check(ApiStatInfo apiStatInfo) {
    for (AlertHandler handler : alertHandlers) {
      handler.check(apiStatInfo);
    }
  }
}

public class ApiStatInfo {//省略constructor/getter/setter方法
  private String api;
  private long requestCount;
  private long errorCount;
  private long durationOfSeconds;
}

public abstract class AlertHandler {
  protected AlertRule rule;
  protected Notification notification;
  public AlertHandler(AlertRule rule, Notification notification) {
    this.rule = rule;
    this.notification = notification;
  }
  public abstract void check(ApiStatInfo apiStatInfo);
}

public class TpsAlertHandler extends AlertHandler {
  public TpsAlertHandler(AlertRule rule, Notification notification) {
    super(rule, notification);
  }

  @Override
  public void check(ApiStatInfo apiStatInfo) {
    long tps = apiStatInfo.getRequestCount()/ apiStatInfo.getDurationOfSeconds();
    if (tps > rule.getMatchedRule(apiStatInfo.getApi()).getMaxTps()) {
      notification.notify(NotificationEmergencyLevel.URGENCY, "...");
    }
  }
}

public class ErrorAlertHandler extends AlertHandler {
  public ErrorAlertHandler(AlertRule rule, Notification notification){
    super(rule, notification);
  }

  @Override
  public void check(ApiStatInfo apiStatInfo) {
    if (apiStatInfo.getErrorCount() > rule.getMatchedRule(apiStatInfo.getApi()).getMaxErrorCount()) {
      notification.notify(NotificationEmergencyLevel.SEVERE, "...");
    }
  }
}
```
{% endnote %}

上面的代码是对 `Alert` 的重构，我们再来看下，重构之后的 `Alert` 该如何使用呢？具体的使用代码我也写在这里了。其中，`ApplicationContext` 是一个单例类，负责 `Alert` 的创建、组装（`alertRule` 和 `notification` 的依赖注入）、初始化（添加 `handlers`）工作。

```java

public class ApplicationContext {
  private AlertRule alertRule;
  private Notification notification;
  private Alert alert;
  
  public void initializeBeans() {
    alertRule = new AlertRule(/*.省略参数.*/); //省略一些初始化代码
    notification = new Notification(/*.省略参数.*/); //省略一些初始化代码
    alert = new Alert();
    alert.addAlertHandler(new TpsAlertHandler(alertRule, notification));
    alert.addAlertHandler(new ErrorAlertHandler(alertRule, notification));
  }
  public Alert getAlert() { return alert; }

  // 饿汉式单例
  private static final ApplicationContext instance = new ApplicationContext();
  private ApplicationContext() {
    initializeBeans();
  }
  public static ApplicationContext getInstance() {
    return instance;
  }
}

public class Demo {
  public static void main(String[] args) {
    ApiStatInfo apiStatInfo = new ApiStatInfo();
    // ...省略设置apiStatInfo数据值的代码
    ApplicationContext.getInstance().getAlert().check(apiStatInfo);
  }
}
```

基于重构之后的代码，如果再添加上面讲到的那个新功能，每秒钟接口超时请求个数超过某个最大阈值就告警，我们就容易扩展多了，主要的改动有下面四处。

1. 第一处改动是：在 `ApiStatInfo` 类中添加新的属性 `timeoutCount`；
2. 第二处改动是：添加新的 `TimeoutAlertHander `类；
3. 第三处改动是：在 `ApplicationContext` 类的 `initializeBeans()` 方法中，往` alert` 对象中注册新的 `timeoutAlertHandler`；
4. 第四处改动是：在使用 `Alert` 类的时候，需要给 `check()` 函数的入参 `apiStatInfo` 对象设置 `timeoutCount` 的值；


完整代码如下所示：

{% note success %}
```java

public class Alert { // 代码未改动... }
public class ApiStatInfo {//省略constructor/getter/setter方法
  private String api;
  private long requestCount;
  private long errorCount;
  private long durationOfSeconds;
  private long timeoutCount; // 改动一：添加新字段
}
public abstract class AlertHandler { //代码未改动... }
public class TpsAlertHandler extends AlertHandler {//代码未改动...}
public class ErrorAlertHandler extends AlertHandler {//代码未改动...}
// 改动二：添加新的handler
public class TimeoutAlertHandler extends AlertHandler {//省略代码...}

public class ApplicationContext {
  private AlertRule alertRule;
  private Notification notification;
  private Alert alert;
  
  public void initializeBeans() {
    alertRule = new AlertRule(/*.省略参数.*/); //省略一些初始化代码
    notification = new Notification(/*.省略参数.*/); //省略一些初始化代码
    alert = new Alert();
    alert.addAlertHandler(new TpsAlertHandler(alertRule, notification));
    alert.addAlertHandler(new ErrorAlertHandler(alertRule, notification));
    // 改动三：注册handler
    alert.addAlertHandler(new TimeoutAlertHandler(alertRule, notification));
  }
  //...省略其他未改动代码...
}

public class Demo {
  public static void main(String[] args) {
    ApiStatInfo apiStatInfo = new ApiStatInfo();
    // ...省略apiStatInfo的set字段代码
    apiStatInfo.setTimeoutCount(289); // 改动四：设置tiemoutCount值
    ApplicationContext.getInstance().getAlert().check(apiStatInfo);
}
```
{% endnote %}

重构之后的代码更加灵活和易扩展。如果我们要想添加新的告警逻辑，只需要基于扩展的方式创建新的 `handler` 类即可，不需要改动原来的 `check()` 函数的逻辑。而且，我们只需要为新的 `handler` 类添加单元测试，老的单元测试都不会失败，也不用修改。

`OCP` 原则实际上不是不让改，而是通过添加属性、类、方法等方式扩展代码，这个原则实际上讲的就是代码的扩展性问题。如果某段代码在应对未来需求变化的时候，能够做到“对扩展开放、对修改关闭”，那就说明这段代码的扩展性比较好。所以，问如何才能做到“对扩展开放、对修改关闭”，也就粗略地等同于在问，如何才能写出扩展性好的代码。

为了尽量写出扩展性好的代码，我们要时刻具备扩展意识、抽象意识、封装意识。

在写代码的时候后，我们要多花点时间往前多思考一下，这段代码未来可能有哪些需求变更、如何设计代码结构，事先留好扩展点，以便在未来需求变更的时候，不需要改动代码整体结构、做到最小代码改动的情况下，新的代码能够很灵活地插入到扩展点上，做到“对扩展开放、对修改关闭”。

在识别出代码可变部分和不可变部分之后，我们要**将可变部分封装起来，隔离变化，提供抽象化的不可变接口，给上层系统使用**。当具体的实现发生变化的时候，我们只需要基于相同的抽象接口，扩展一个新的实现，替换掉老的实现即可，上游系统的代码几乎不需要修改。

在众多的设计原则、思想、模式中，最常用来提高代码扩展性的方法有：**多态、依赖注入、基于接口而非实现编程**，以及大部分的设计模式（比如，装饰、策略、模板、职责链、状态等）。其中，多态、依赖注入、基于接口而非实现编程，以及前面提到的抽象意识，说的都是同一种设计思路，只是从不同的角度、不同的层面来阐述而已。这也体现了“很多设计原则、思想、模式都是相通的”这一思想。

#### Example

我们要实现一个基于 `kafka` 来发送异步消息的功能。对于这样一个功能的开发，我们要学会将其抽象成一组跟具体消息队列（`Kafka`）无关的异步消息接口。所有上层系统都依赖这组抽象的接口编程，并且通过依赖注入的方式来调用。当我们要替换新的消息队列的时候，比如将 `Kafka` 替换成 `RocketMQ`，可以很方便地拔掉老的消息队列实现，插入新的消息队列实现。具体代码如下所示：

```java

// 这一部分体现了抽象意识
public interface MessageQueue { //... }
public class KafkaMessageQueue implements MessageQueue { //... }
public class RocketMQMessageQueue implements MessageQueue {//...}

public interface MessageFromatter { //... }
public class JsonMessageFromatter implements MessageFromatter {//...}
public class ProtoBufMessageFromatter implements MessageFromatter {//...}

public class Demo {
  private MessageQueue msgQueue; // 基于接口而非实现编程
  public Demo(MessageQueue msgQueue) { // 依赖注入
    this.msgQueue = msgQueue;
  }
  
  // msgFormatter：多态、依赖注入
  public void sendNotification(Notification notification, MessageFormatter msgFormatter) {
    //...    
  }
}
```

### 里氏替换原则（`LSP`）

`LSP(Liskov Substitution Principle)` ，这条原则用中文描述出来，是这样的：子类对象能够替换程序中父类对象出现的任何地方，并且保证原来程序的逻辑行为不变及正确性不被破坏。

举例说明，如下代码中，父类 `Transporter` 使用 `org.apache.http` 库中的 `HttpClient` 类来传输网络数据。子类 `SecurityTransporter` 继承父类 `Transporter`，增加了额外的功能，支持传输 `appId` 和 `appToken` 安全认证信息。

```java

public class Transporter {
  private HttpClient httpClient;
  
  public Transporter(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public Response sendRequest(Request request) {
    // ...use httpClient to send request
  }
}

public class SecurityTransporter extends Transporter {
  private String appId;
  private String appToken;

  public SecurityTransporter(HttpClient httpClient, String appId, String appToken) {
    super(httpClient);
    this.appId = appId;
    this.appToken = appToken;
  }

  @Override
  public Response sendRequest(Request request) {
    if (StringUtils.isNotBlank(appId) && StringUtils.isNotBlank(appToken)) {
      request.addPayload("app-id", appId);
      request.addPayload("app-token", appToken);
    }
    return super.sendRequest(request);
  }
}

public class Demo {    
  public void demoFunction(Transporter transporter) {    
    Reuqest request = new Request();
    //...省略设置request中数据值的代码...
    Response response = transporter.sendRequest(request);
    //...省略其他逻辑...
  }
}

// 里式替换原则
Demo demo = new Demo();
demo.demofunction(new SecurityTransporter(/*省略参数*/););
```

在上面的代码中，子类 `SecurityTransporter` 的设计完全符合里式替换原则，可以替换父类出现的任何位置，并且原来代码的逻辑行为不变且正确性也没有被破坏。

从刚刚的例子和定义描述来看，里式替换原则跟多态看起来确实有点类似，但实际上它们完全是两回事。还是通过刚才这个例子来解释一下。不过，我们需要对 `SecurityTransporter` 类中 `sendRequest()` 函数稍加改造一下。改造前，如果 `appId` 或者 `appToken` 没有设置，我们就不做校验；改造后，如果 `appId` 或者 `appToken` 没有设置，则直接抛出 `NoAuthorizationRuntimeException` 未授权异常。改造前后的代码对比如下所示：

{% tabs 里氏替换改造前后 %}

<!-- tab 改造前 -->
```java
public class SecurityTransporter extends Transporter {
  //...省略其他代码..
  @Override
  public Response sendRequest(Request request) {
    if (StringUtils.isNotBlank(appId) && StringUtils.isNotBlank(appToken)) {
      request.addPayload("app-id", appId);
      request.addPayload("app-token", appToken);
    }
    return super.sendRequest(request);
  }
}
```
<!-- endtab -->

<!-- tab 改造后 -->
```java
public class SecurityTransporter extends Transporter {
  //...省略其他代码..
  @Override
  public Response sendRequest(Request request) {
    if (StringUtils.isBlank(appId) || StringUtils.isBlank(appToken)) {
      throw new NoAuthorizationRuntimeException(...);
    }
    request.addPayload("app-id", appId);
    request.addPayload("app-token", appToken);
    return super.sendRequest(request);
  }
}
```
<!-- endtab -->

{% endtabs %}

在改造之后的代码中，如果传递进 `demoFunction()` 函数的是父类 `Transporter` 对象，那 `demoFunction()` 函数并不会有异常抛出，但如果传递给 `demoFunction()` 函数的是子类 `SecurityTransporter` 对象，那 `demoFunction()` 有可能会有异常抛出。尽管代码中抛出的是运行时异常（`Runtime Exception`），我们可以不在代码中显式地捕获处理，但子类替换父类传递进 `demoFunction` 函数之后，整个程序的逻辑行为有了改变。

虽然改造之后的代码仍然可以通过 `Java` 的多态语法，动态地用子类 `SecurityTransporter` 来替换父类 `Transporter`，也并不会导致程序编译或者运行报错。但是，从设计思路上来讲，`SecurityTransporter` 的设计是不符合里式替换原则的。

**虽然从定义描述和代码实现上来看，多态和里式替换有点类似，但它们关注的角度是不一样的。多态是面向对象编程的一大特性，也是面向对象编程语言的一种语法，它是一种代码实现的思路。而里式替换是一种设计原则，是用来指导继承关系中子类该如何设计的，子类的设计要保证在替换父类的时候，不改变原有程序的逻辑以及不破坏原有程序的正确性。**

里式替换原则还有另外一个更加能落地、更有指导意义的描述，那就是 `Design By Contract`，中文翻译就是按照协议来设计。

子类在设计的时候，要遵守父类的行为约定（或者叫协议）。父类定义了函数的行为约定，那子类可以改变函数的内部实现逻辑，但不能改变函数原有的行为约定。这里的行为约定包括：函数声明要实现的功能；对输入、输出、异常的约定，甚至包括注释中所罗列的任何特殊说明。实际上，定义中父类和子类之间的关系，也可以替换成接口和实现类之间的关系。

常见的违反里氏替换原则的几个误区：

1. 子类违背父类声明要实现的功能：
    父类中提供的 `sortOrdersByAmount()` 订单排序函数，是按照金额从小到大来给订单排序的，而子类重写这个 `sortOrdersByAmount()` 订单排序函数之后，是按照创建日期来给订单排序的。那子类的设计就违背里式替换原则。

2. 子类违背父类对输入、输出、异常的约定：

    - 在父类中，某个函数约定：运行出错的时候返回 `null`；获取数据为空的时候返回空集合。而子类重载函数之后，实现变了，运行出错返回异常，获取不到数据返回 `null`。那子类的设计就违背里式替换原则；
    - 在父类中，某个函数约定，输入数据可以是任意整数，但子类实现的时候，只允许输入数据是正整数，负数就抛出，也就是说，子类对输入的数据的校验比父类更加严格，那子类的设计就违背了里式替换原则；
    - 在父类中，某个函数约定，只会抛出 `ArgumentNullException` 异常，那子类的设计实现中只允许抛出 `ArgumentNullException` 异常，任何其他异常的抛出，都会导致子类违背里式替换原则；

3. 子类违背父类注释中所罗列的任何特殊说明
    父类中定义的 `withdraw()` 提现函数的注释是这么写的：“用户的提现金额不得超过账户余额……”，而子类重写 `withdraw()` 函数之后，针对 `VIP` 账号实现了透支提现的功能，也就是提现金额可以大于账户余额，那这个子类的设计也是不符合里式替换原则的。

以上便是三种典型的违背里式替换原则的情况。除此之外，判断子类的设计实现是否违背里式替换原则，还有一个小窍门，那就是拿父类的单元测试去验证子类的代码。如果某些单元测试运行失败，就有可能说明，子类的设计实现没有完全地遵守父类的约定，子类有可能违背了里式替换原则。

里式替换这个原则是非常宽松的。一般情况下，我们写的代码都不怎么会违背它。

### 接口隔离原则（`ISP`）

`ISP(Interface Segregation Principle)`，客户端不应该被强迫依赖它不需要的接口。其中的客户端，可以理解为接口的调用者或者使用者。

接口这个名词可以用在很多场合中，在软件开发中，我们既可以把它看作一组抽象的约定，也可以具体指系统与系统之间的 `API` 接口，还可以特指面向对象编程语言中的接口等。理解接口隔离原则的关键，就是理解其中的“接口”二字。在这条原则中，我们可以把“接口”理解为下面三种东西： 一组 `API` 接口集合；单个 `API` 接口或函数；`OOP` 中的接口概念。

#### 把“接口”理解为一组 `API` 接口集合

举个例子，微服务用户系统提供了一组跟用户相关的 `API` 给其他系统使用，比如：注册、登录、获取用户信息等。具体代码如下所示：

```java

public interface UserService {
  boolean register(String cellphone, String password);
  boolean login(String cellphone, String password);
  UserInfo getUserInfoById(long id);
  UserInfo getUserInfoByCellphone(String cellphone);
}

public class UserServiceImpl implements UserService {
  //...
}
```

现在，我们的后台管理系统要实现删除用户的功能，希望用户系统提供一个删除用户的接口。这个时候我们该如何来做呢？你可能会说，这不是很简单吗，我只需要在 `UserService` 中新添加一个 `deleteUserByCellphone()` 或 `deleteUserById()` 接口就可以了。这个方法可以解决问题，但是也隐藏了一些安全隐患。

删除用户是一个非常慎重的操作，我们只希望通过后台管理系统来执行，所以这个接口只限于给后台管理系统使用。如果我们把它放到 `UserService` 中，那所有使用到 `UserService` 的系统，都可以调用这个接口。不加限制地被其他业务系统调用，就有可能导致误删用户。

当然，最好的解决方案是从架构设计的层面，通过接口鉴权的方式来限制接口的调用。不过，如果暂时没有鉴权框架来支持，我们还可以从代码设计的层面，尽量避免接口被误用。我们参照接口隔离原则，调用者不应该强迫依赖它不需要的接口，将删除接口单独放到另外一个接口 `RestrictedUserService` 中，然后将 `RestrictedUserService` 只打包提供给后台管理系统来使用。具体的代码实现如下所示：

```java

public interface UserService {
  boolean register(String cellphone, String password);
  boolean login(String cellphone, String password);
  UserInfo getUserInfoById(long id);
  UserInfo getUserInfoByCellphone(String cellphone);
}

public interface RestrictedUserService {
  boolean deleteUserByCellphone(String cellphone);
  boolean deleteUserById(long id);
}

public class UserServiceImpl implements UserService, RestrictedUserService {
  // ...省略实现代码...
}
```

在刚刚的这个例子中，我们把接口隔离原则中的接口，理解为一组接口集合，它可以是某个微服务的接口，也可以是某个类库的接口等等。在设计微服务或者类库接口的时候，如果部分接口只被部分调用者使用，那我们就需要将这部分接口隔离出来，单独给对应的调用者使用，而不是强迫其他调用者也依赖这部分不会被用到的接口。

#### 把“接口”理解为单个 `API` 接口或函数

把接口理解为单个接口或函数，那接口隔离原则就可以理解为：函数的设计要功能单一，不要将多个不同的功能逻辑在一个函数中实现。接下来，我们还是通过一个例子来解释一下：

```java

public class Statistics {
  private Long max;
  private Long min;
  private Long average;
  private Long sum;
  private Long percentile99;
  private Long percentile999;
  //...省略constructor/getter/setter等方法...
}

public Statistics count(Collection<Long> dataSet) {
  Statistics statistics = new Statistics();
  //...省略计算逻辑...
  return statistics;
}
```

在上面的代码中，`count()` 函数的功能不够单一，包含很多不同的统计功能，比如，求最大值、最小值、平均值等等。按照接口隔离原则，我们应该把 `count()` 函数拆成几个更小粒度的函数，每个函数负责一个独立的统计功能。拆分之后的代码如下所示：

```java
public Long max(Collection<Long> dataSet) { //... }
public Long min(Collection<Long> dataSet) { //... } 
public Long average(Colletion<Long> dataSet) { //... }
// ...省略其他统计函数...
```

在某种意义上讲，`count()` 函数也不能算是职责不够单一，毕竟它做的事情只跟统计相关。实际上，判定功能是否单一，除了很强的主观性，还需要结合具体的场景。

如果在项目中，对每个统计需求，`Statistics` 定义的那几个统计信息都有涉及，那 `count()` 函数的设计就是合理的。相反，如果每个统计需求只涉及 `Statistics` 罗列的统计信息中一部分，比如，有的只需要用到 `max`、`min`、`average` 这三类统计信息，有的只需要用到 `average`、`sum`。而 `count()` 函数每次都会把所有的统计信息计算一遍，就会做很多无用功，势必影响代码的性能，特别是在需要统计的数据量很大的时候。所以，在这个应用场景下，`count()` 函数的设计就有点不合理了，我们应该按照第二种设计思路，将其拆分成粒度更细的多个统计函数。

{% cq %} 接口隔离原则跟单一职责原则有点类似，不过稍微还是有点区别。单一职责原则针对的是模块、类、接口的设计。而接口隔离原则相对于单一职责原则，一方面它更侧重于接口的设计，另一方面它的思考的角度不同。它提供了一种判断接口是否职责单一的标准：通过调用者如何使用接口来间接地判定。如果调用者只使用部分接口或接口的部分功能，那接口的设计就不够职责单一。 {% endcq %}

#### 把“接口”理解为 `OOP` 中的接口概念

还可以把“接口”理解为 `OOP` 中的接口概念，比如 `Java` 中的 `interface`。假设我们的项目中用到了三个外部系统：`Redis`、`MySQL`、`Kafka`。每个系统都对应一系列配置信息，比如地址、端口、访问超时时间等。为了在内存中存储这些配置信息，供项目中的其他模块来使用，我们分别设计实现了三个 `Configuration` 类：`RedisConfig`、`MysqlConfig`、`KafkaConfig`。

```java

public class RedisConfig {
    private ConfigSource configSource; //配置中心（比如zookeeper）
    private String address;
    private int timeout;
    private int maxTotal;
    //省略其他配置: maxWaitMillis,maxIdle,minIdle...

    public RedisConfig(ConfigSource configSource) {
        this.configSource = configSource;
    }

    public String getAddress() {
        return this.address;
    }
    //...省略其他get()、init()方法...

    public void update() {
      //从configSource加载配置到address/timeout/maxTotal...
    }
}

public class KafkaConfig { //...省略... }
public class MysqlConfig { //...省略... }
```

现在，我们有一个新的功能需求，希望支持 `Redis` 和 `Kafka` 配置信息的热更新。所谓“热更新（`hot update`）”就是，如果在配置中心中更改了配置信息，我们希望在不用重启系统的情况下，能将最新的配置信息加载到内存中（也就是 `RedisConfig`、`KafkaConfig` 类中）。但是，因为某些原因，我们并不希望对 `MySQL` 的配置信息进行热更新。

为了实现这样一个功能需求，我们设计实现了一个 `ScheduledUpdater` 类，以固定时间频率（`periodInSeconds`）来调用 `RedisConfig`、`KafkaConfig` 的 `update()` 方法更新配置信息。具体的代码实现如下所示：

```java

public interface Updater {
  void update();
}

public class RedisConfig implemets Updater {
  //...省略其他属性和方法...
  @Override
  public void update() { //... }
}

public class KafkaConfig implements Updater {
  //...省略其他属性和方法...
  @Override
  public void update() { //... }
}

public class MysqlConfig { //...省略其他属性和方法... }

public class ScheduledUpdater {
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();;
    private long initialDelayInSeconds;
    private long periodInSeconds;
    private Updater updater;

    public ScheduleUpdater(Updater updater, long initialDelayInSeconds, long periodInSeconds) {
        this.updater = updater;
        this.initialDelayInSeconds = initialDelayInSeconds;
        this.periodInSeconds = periodInSeconds;
    }

    public void run() {
        executor.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                updater.update();
            }
        }, this.initialDelayInSeconds, this.periodInSeconds, TimeUnit.SECONDS);
    }
}

public class Application {
  ConfigSource configSource = new ZookeeperConfigSource(/*省略参数*/);
  public static final RedisConfig redisConfig = new RedisConfig(configSource);
  public static final KafkaConfig kafkaConfig = new KakfaConfig(configSource);
  public static final MySqlConfig mysqlConfig = new MysqlConfig(configSource);

  public static void main(String[] args) {
    ScheduledUpdater redisConfigUpdater = new ScheduledUpdater(redisConfig, 300, 300);
    redisConfigUpdater.run();
    
    ScheduledUpdater kafkaConfigUpdater = new ScheduledUpdater(kafkaConfig, 60, 60);
    kafkaConfigUpdater.run();
  }
}
```

当需要增加通过Web查看 `MySQL` 和 `Redis` 的配置信息时，我们可以在项目中开发一个内嵌的 `SimpleHttpServer`，输出项目的配置信息到一个固定的 `HTTP` 地址，比如：`http://127.0.0.1:2389/config`。我们只需要在浏览器中输入这个地址，就可以显示出系统的配置信息。不过，出于某些原因，我们只想暴露 `MySQL` 和 `Redis` 的配置信息，不想暴露 `Kafka` 的配置信息。

```java

public interface Updater {
  void update();
}

public interface Viewer {
  String outputInPlainText();
  Map<String, String> output();
}

public class RedisConfig implemets Updater, Viewer {
  //...省略其他属性和方法...
  @Override
  public void update() { //... }
  @Override
  public String outputInPlainText() { //... }
  @Override
  public Map<String, String> output() { //...}
}

public class KafkaConfig implements Updater {
  //...省略其他属性和方法...
  @Override
  public void update() { //... }
}

public class MysqlConfig implements Viewer {
  //...省略其他属性和方法...
  @Override
  public String outputInPlainText() { //... }
  @Override
  public Map<String, String> output() { //...}
}

public class SimpleHttpServer {
  private String host;
  private int port;
  private Map<String, List<Viewer>> viewers = new HashMap<>();
  
  public SimpleHttpServer(String host, int port) {//...}
  
  public void addViewers(String urlDirectory, Viewer viewer) {
    if (!viewers.containsKey(urlDirectory)) {
      viewers.put(urlDirectory, new ArrayList<Viewer>());
    }
    this.viewers.get(urlDirectory).add(viewer);
  }
  
  public void run() { //... }
}

public class Application {
    ConfigSource configSource = new ZookeeperConfigSource();
    public static final RedisConfig redisConfig = new RedisConfig(configSource);
    public static final KafkaConfig kafkaConfig = new KakfaConfig(configSource);
    public static final MySqlConfig mysqlConfig = new MySqlConfig(configSource);
    
    public static void main(String[] args) {
        ScheduledUpdater redisConfigUpdater =
            new ScheduledUpdater(redisConfig, 300, 300);
        redisConfigUpdater.run();
        
        ScheduledUpdater kafkaConfigUpdater =
            new ScheduledUpdater(kafkaConfig, 60, 60);
        redisConfigUpdater.run();
        
        SimpleHttpServer simpleHttpServer = new SimpleHttpServer(“127.0.0.1”, 2389);
        simpleHttpServer.addViewer("/config", redisConfig);
        simpleHttpServer.addViewer("/config", mysqlConfig);
        simpleHttpServer.run();
    }
}
```
{% cq %}我们设计了两个功能非常单一的接口：`Updater` 和 `Viewer`。`ScheduledUpdater` 只依赖 `Updater` 这个跟热更新相关的接口，不需要被强迫去依赖不需要的 `Viewer` 接口，满足接口隔离原则。同理，`SimpleHttpServer` 只依赖跟查看信息相关的 `Viewer` 接口，不依赖不需要的 `Updater` 接口，也满足接口隔离原则。{% endcq %}

但是如果设计一个大而全的 `Config` 接口又有什么错呢？

{% note warning %}
```java

public interface Config {
  void update();
  String outputInPlainText();
  Map<String, String> output();
}

public class RedisConfig implements Config {
  //...需要实现Config的三个接口update/outputIn.../output
}

public class KafkaConfig implements Config {
  //...需要实现Config的三个接口update/outputIn.../output
}

public class MysqlConfig implements Config {
  //...需要实现Config的三个接口update/outputIn.../output
}

public class ScheduledUpdater {
  //...省略其他属性和方法..
  private Config config;

  public ScheduleUpdater(Config config, long initialDelayInSeconds, long periodInSeconds) {
      this.config = config;
      //...
  }
  //...
}

public class SimpleHttpServer {
  private String host;
  private int port;
  private Map<String, List<Config>> viewers = new HashMap<>();
 
  public SimpleHttpServer(String host, int port) {//...}
  
  public void addViewer(String urlDirectory, Config config) {
    if (!viewers.containsKey(urlDirectory)) {
      viewers.put(urlDirectory, new ArrayList<Config>());
    }
    viewers.get(urlDirectory).add(config);
  }
  
  public void run() { //... }
}
```
{% endnote %}

这样的设计思路也是能工作的，但是对比前后两个设计思路，在同样的代码量、实现复杂度、同等可读性的情况下，第一种设计思路显然要比第二种好很多。原因如下：

{% tabs 接口隔离 %}

<!-- tab 原因一 -->

第一种设计思路更加灵活、易扩展、易复用。因为 `Updater`、`Viewer` 职责更加单一，**单一就意味了通用、复用性好**。比如，我们现在又有一个新的需求，开发一个 `Metrics` 性能统计模块，并且希望将 `Metrics` 也通过 `SimpleHttpServer` 显示在网页上，以方便查看。这个时候，尽管 `Metrics` 跟 `RedisConfig` 等没有任何关系，但我们仍然可以让 `Metrics` 类实现非常通用的 `Viewer` 接口，复用 `SimpleHttpServer` 的代码实现。具体的代码如下所示：

```java

public class ApiMetrics implements Viewer {//...}
public class DbMetrics implements Viewer {//...}

public class Application {
    ConfigSource configSource = new ZookeeperConfigSource();
    public static final RedisConfig redisConfig = new RedisConfig(configSource);
    public static final KafkaConfig kafkaConfig = new KakfaConfig(configSource);
    public static final MySqlConfig mySqlConfig = new MySqlConfig(configSource);
    public static final ApiMetrics apiMetrics = new ApiMetrics();
    public static final DbMetrics dbMetrics = new DbMetrics();
    
    public static void main(String[] args) {
        SimpleHttpServer simpleHttpServer = new SimpleHttpServer(“127.0.0.1”, 2389);
        simpleHttpServer.addViewer("/config", redisConfig);
        simpleHttpServer.addViewer("/config", mySqlConfig);
        simpleHttpServer.addViewer("/metrics", apiMetrics);
        simpleHttpServer.addViewer("/metrics", dbMetrics);
        simpleHttpServer.run();
    }
}
```
<!-- endtab -->

<!-- tab 原因二 -->

第二种设计思路在代码实现上做了一些无用功。因为 `Config` 接口中包含两类不相关的接口，一类是 `update()`，一类是 `output()` 和 `outputInPlainText()`。理论上，`KafkaConfig` 只需要实现 `update()` 接口，并不需要实现 `output()` 相关的接口。同理，`MysqlConfig `只需要实现 `output()` 相关接口，并需要实现 `update()` 接口。但第二种设计思路要求` RedisConfig`、`KafkaConfig`、`MySqlConfig` 必须同时实现 `Config` 的所有接口函数（`update`、`output`、`outputInPlainText`）。除此之外，如果我们要往 `Config `中继续添加一个新的接口，那所有的实现类都要改动。相反，如果我们的接口粒度比较小，那涉及改动的类就比较少。

<!-- endtab -->

{% endtabs %}

### 依赖反转

在 `SOLID` 最后一个原则依赖反转中，经常会提到另外两个相似的概念，控制反转(`IOC`) 和依赖注入。

#### 控制反转（`IOC`）

控制反转的英文翻译是 `Inversion Of Control`，缩写为 `IOC`，请看下面的示例：

```java
public class UserServiceTest {
  public static boolean doTest() {
    // ... 
  }
  
  public static void main(String[] args) {//这部分逻辑可以放到框架中
    if (doTest()) {
      System.out.println("Test succeed.");
    } else {
      System.out.println("Test failed.");
    }
  }
}
```

在上面的代码中，所有的流程都由程序员来控制。如果我们抽象出一个下面这样一个框架，我们再来看，如何利用框架来实现同样的功能。具体的代码实现如下所示：

```java

public abstract class TestCase {
  public void run() {
    if (doTest()) {
      System.out.println("Test succeed.");
    } else {
      System.out.println("Test failed.");
    }
  }
  
  public abstract boolean doTest();
}

public class JunitApplication {
  private static final List<TestCase> testCases = new ArrayList<>();
  
  public static void register(TestCase testCase) {
    testCases.add(testCase);
  }
  
  public static final void main(String[] args) {
    for (TestCase case: testCases) {
      case.run();
    }
  }
```

把这个简化版本的测试框架引入到工程中之后，我们只需要在框架预留的扩展点，也就是 `TestCase` 类中的 `doTest()` 抽象函数中，填充具体的测试代码就可以实现之前的功能了，完全不需要写负责执行流程的 `main()` 函数了。 具体的代码如下所示：

```java

public class UserServiceTest extends TestCase {
  @Override
  public boolean doTest() {
    // ... 
  }
}

// 注册操作还可以通过配置的方式来实现，不需要程序员显示调用register()
JunitApplication.register(new UserServiceTest();
```

刚刚举的这个例子，就是典型的通过框架来实现“控制反转”的例子。框架提供了一个可扩展的代码骨架，用来组装对象、管理整个执行流程。程序员利用框架进行开发的时候，只需要往预留的扩展点上，添加跟自己业务相关的代码，就可以利用框架来驱动整个程序流程的执行。

这里的“控制”指的是对程序执行流程的控制，而“反转”指的是在没有使用框架之前，程序员自己控制整个程序的执行。在使用框架之后，整个程序的执行流程可以通过框架来控制。流程的控制权从程序员“反转”到了框架。

实际上，实现控制反转的方法有很多，除了刚才例子中所示的类似于模板设计模式的方法之外，还有马上要讲到的依赖注入等方法，所以，**控制反转并不是一种具体的实现技巧，而是一个比较笼统的设计思想，一般用来指导框架层面的设计。**

#### 依赖注入（`DI`）

依赖注入跟控制反转恰恰相反，它是一种具体的编码技巧。依赖注入的英文翻译是 `Dependency Injection`，缩写为 `DI`。用一句话来概括就是：**不通过 `new()` 的方式在类内部创建依赖类对象，而是将依赖的类对象在外部创建好之后，通过构造函数、函数参数等方式传递（或注入）给类使用。**

举个例子，`Notification` 类负责消息推送，依赖 `MessageSender` 类实现推送商品促销、验证码等消息给用户。我们分别用依赖注入和非依赖注入两种方式来实现一下。具体的实现代码如下所示：

{% tabs 依赖注入 %}

<!-- tab 非依赖注入方式 -->

```java
// 非依赖注入实现方式
public class Notification {
  private MessageSender messageSender;
  
  public Notification() {
    this.messageSender = new MessageSender(); //此处有点像hardcode
  }
  
  public void sendMessage(String cellphone, String message) {
    //...省略校验逻辑等...
    this.messageSender.send(cellphone, message);
  }
}

public class MessageSender {
  public void send(String cellphone, String message) {
    //....
  }
}
// 使用Notification
Notification notification = new Notification();
```
<!-- endtab -->

<!-- tab 依赖注入方式 -->
```java
// 依赖注入的实现方式
public class Notification {
  private MessageSender messageSender;
  
  // 通过构造函数将messageSender传递进来
  public Notification(MessageSender messageSender) {
    this.messageSender = messageSender;
  }
  
  public void sendMessage(String cellphone, String message) {
    //...省略校验逻辑等...
    this.messageSender.send(cellphone, message);
  }
}
//使用Notification
MessageSender messageSender = new MessageSender();
Notification notification = new Notification(messageSender);
```
<!-- endtab -->

{% endtabs %}

通过依赖注入的方式来将依赖的类对象传递进来，这样就提高了代码的扩展性，我们可以灵活地替换依赖的类。这一点在我们之前讲“开闭原则”的时候也提到过。当然，上面代码还有继续优化的空间，我们还可以把 `MessageSender` 定义成接口，基于接口而非实现编程。改造后的代码如下所示：

```java

public class Notification {
  private MessageSender messageSender;
  
  public Notification(MessageSender messageSender) {
    this.messageSender = messageSender;
  }
  
  public void sendMessage(String cellphone, String message) {
    this.messageSender.send(cellphone, message);
  }
}

public interface MessageSender {
  void send(String cellphone, String message);
}

// 短信发送类
public class SmsSender implements MessageSender {
  @Override
  public void send(String cellphone, String message) {
    //....
  }
}

// 站内信发送类
public class InboxSender implements MessageSender {
  @Override
  public void send(String cellphone, String message) {
    //....
  }
}

//使用Notification
MessageSender messageSender = new SmsSender();
Notification notification = new Notification(messageSender);
```

#### 依赖注入框架

在采用依赖注入实现的 `Notification` 类中，虽然我们不需要用类似 `hard code` 的方式，在类内部通过 `new` 来创建 `MessageSender` 对象，但是，这个创建对象、组装（或注入）对象的工作仅仅是被移动到了更上层代码而已，还是需要我们程序员自己来实现。具体代码如下所示：

```java
public class Demo {
  public static final void main(String args[]) {
    MessageSender sender = new SmsSender(); //创建对象
    Notification notification = new Notification(sender);//依赖注入
    notification.sendMessage("13918942177", "短信验证码：2346");
  }
}
```

在实际的软件开发中，一些项目可能会涉及几十、上百、甚至几百个类，类对象的创建和依赖注入会变得非常复杂。如果这部分工作都是靠程序员自己写代码来完成，容易出错且开发成本也比较高。而对象创建和依赖注入的工作，本身跟具体的业务无关，我们完全可以抽象成“依赖注入框架”来自动完成。我们只需要通过依赖注入框架提供的扩展点，简单配置一下所有需要创建的类对象、类与类之间的依赖关系，就可以实现由框架来自动创建对象、管理对象的生命周期、依赖注入等原本需要程序员来做的事情。

现成的依赖注入框架有很多，比如 `Google Guice`、`Java Spring`、`Pico Container`、`Butterfly Container` 等。

#### 依赖反转原则（`DIP`）

依赖反转原则的英文翻译是 `Dependency Inversion Principle`，缩写为 `DIP`，中文翻译有时候也叫依赖倒置原则。大概意思就是：高层模块不要依赖低层模块。高层模块和低层模块应该通过抽象来互相依赖。除此之外，抽象不要依赖具体实现细节，具体实现细节依赖抽象。

所谓高层模块和低层模块的划分，简单来说就是，在调用链上，调用者属于高层，被调用者属于低层。在平时的业务代码开发中，高层模块依赖底层模块是没有任何问题的。实际上，这条原则主要还是用来指导框架层面的设计，跟前面讲到的控制反转类似。

我们拿 `Tomcat` 这个 `Servlet` 容器作为例子来解释一下。`Tomcat` 是运行 `Java Web` 应用程序的容器。我们编写的 `Web` 应用程序代码只需要部署在 `Tomcat` 容器下，便可以被 `Tomcat` 容器调用执行。按照之前的划分原则，`Tomcat` 就是高层模块，我们编写的 `Web` 应用程序代码就是低层模块。`Tomcat` 和应用程序代码之间并没有直接的依赖关系，两者都依赖同一个“抽象”，也就是 `Servlet` 规范。`Servlet` 规范不依赖具体的 `Tomcat` 容器和应用程序的实现细节，而 `Tomcat` 容器和应用程序依赖 `Servlet` 规范。

