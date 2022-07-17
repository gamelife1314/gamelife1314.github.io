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

### 特征

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

抽象作为一个非常宽泛的设计思想，在代码设计中，起到了非常重要的指导作用，很多设计原则都体现了抽象这种设计思想，比如基于接口而非实现编程、开闭原则，代码解耦等。我们在定义（或者叫命名）类的方法的时候，也要有抽象思维，不要在方法定义中，暴露太多的实现细节，以保证在某个时间点需要改变方法的实现逻辑的时候，不用去修改其定义。举个简单例子，比如`getAliyunPictureUrl()`就不是一个具有抽象思维的命名，因为某一天如果我们不再把图片存储在阿里云上，而是存储在私有云上，那这个命名也要随之被修改。相反，如果我们定义一个比较抽象的函数，比如叫作`getPictureUrl()`，那即便内部存储方式修改了，我们也不需要修改命名。

#### 继承

继承最大的一个好处就是代码复用。假如两个类有一些相同的属性和方法，我们就可以将这些相同的部分，抽取到父类中，让两个子类继承父类。这样，两个子类就可以重用父类中的代码，避免代码重复写多遍。不过，这一点也并不是继承所独有的，我们也可以通过其他方式来解决这个代码复用的问题，比如利用组合关系而不是继承关系。

集成呈现的是一种 `is-a` 关系，我们通过继承来关联两个类，反应真实世界中的这种关系，非常符合人类的认知，而且，从设计的角度来说，也有一种结构美感。例如，我们代码中有一个猫类，有一个哺乳动物类，猫属于哺乳动物，它们之间就属于集成关系。

从继承关系上来讲，继承可以分为两种模式，单继承和多继承。单继承表示一个子类只继承一个父类，多继承表示一个子类可以继承多个父类，比如猫既是哺乳动物，又是爬行动物。

为了实现继承这个特性，编程语言需要提供特殊的语法机制来支持，比如`Java`使用`extends`关键字来实现继承，`C++`使用冒号（`class B : public A`），`Python`使用`parentheses ()`，`Ruby`使用`<`。

#### 多态

多态是指，子类可以替换父类，在实际的代码运行过程中，调用子类的方法实现。举个例子：

```java
public class DynamicArray {
  private static final int DEFAULT_CAPACITY = 10;
  protected int size = 0;
  protected int capacity = DEFAULT_CAPACITY;
  protected Integer[] elements = new Integer[DEFAULT_CAPACITY];
  
  public int size() { return this.size; }
  public Integer get(int index) { return elements[index];}
  
  public void add(Integer e) {
    ensureCapacity();
    elements[size++] = e;
  }
  
  protected void ensureCapacity() {
    //...如果数组满了就扩容...代码省略...
  }
}

public class SortedDynamicArray extends DynamicArray {
  @Override
  public void add(Integer e) {
    ensureCapacity();
    int i;
    for (i = size-1; i>=0; --i) { //保证数组中的数据有序
      if (elements[i] > e) {
        elements[i+1] = elements[i];
      } else {
        break;
      }
    }
    elements[i+1] = e;
    ++size;
  }
}

public class Example {
  public static void test(DynamicArray dynamicArray) {
    dynamicArray.add(5);
    dynamicArray.add(1);
    dynamicArray.add(3);
    for (int i = 0; i < dynamicArray.size(); ++i) {
      System.out.println(dynamicArray.get(i));
    }
  }
  
  public static void main(String args[]) {
    DynamicArray dynamicArray = new SortedDynamicArray();  // 使用子类替换父类
    test(dynamicArray); // 打印结果：1、3、5
  }
}
```

多态这种特性也需要编程语言提供特殊的语法机制来实现。在上面的例子中，我们用到了三个语法机制来实现多态。

1. 编程语言要支持父类对象可以引用子类对象，也就是可以将`SortedDynamicArray`传递给`DynamicArray`；
2. 编程语言要支持继承，也就是`SortedDynamicArray`继承了`DynamicArray`，才能将`SortedDyamicArray`传递给`DynamicArray`；
3. 编程语言要支持子类可以重写（`override`）父类中的方法，也就是`SortedDyamicArray`重写了`DynamicArray`中的`add()`方法；

对于多态特性的实现方式，除了利用“继承加方法重写”这种实现方式之外，我们还有其他两种比较常见的的实现方式，一个是利用接口类语法，另一个是利用`duck-typing`语法。不过，并不是每种编程语言都支持接口类或者`duck-typing`这两种语法机制，比如`C++`就不支持接口类语法，而`duck-typing`只有一些动态语言才支持，比如`Python`、`JavaScript`等。

##### 接口实现多态

```java
public interface Iterator {
  boolean hasNext();
  String next();
  String remove();
}

public class Array implements Iterator {
  private String[] data;
  
  public boolean hasNext() { ... }
  public String next() { ... }
  public String remove() { ... }
  //...省略其他方法...
}

public class LinkedList implements Iterator {
  private LinkedListNode head;
  
  public boolean hasNext() { ... }
  public String next() { ... }
  public String remove() { ... }
  //...省略其他方法... 
}

public class Demo {
  private static void print(Iterator iterator) {
    while (iterator.hasNext()) {
      System.out.println(iterator.next());
    }
  }
  
  public static void main(String[] args) {
    Iterator arrayIterator = new Array();
    print(arrayIterator);
    
    Iterator linkedListIterator = new LinkedList();
    print(linkedListIterator);
  }
}
```

在这段代码中，`Iterator`是一个接口类，定义了一个可以遍历集合数据的迭代器。`Array`和`LinkedList`都实现了接口类`Iterator`。我们通过传递不同类型的实现类（`Array`、`LinkedList`）到`print(Iterator iterator)`函数中，支持动态的调用不同的`next()`、`hasNext()`实现。

##### duck-typing 实现多态

`duck-typing` 实现多态的方式非常灵活，即使两个没有继承关系，也没有接口实现关系，只要有相同的方法就能表示它们有相同的特征。也就是说，只要两个类具有相同的方法，就可以实现多态，并不要求两个类之间有任何关系，这就是所谓的`duck-typing`，是一些动态语言所特有的语法机制。

```python
class Logger:
    def record(self):
        print(“I write a log into file.”)
        
class DB:
    def record(self):
        print(“I insert data into db. ”)
        
def test(recorder):
    recorder.record()

def demo():
    logger = Logger()
    db = DB()
    test(logger)
    test(db)
```

### 优势

面向对象编程是一种编程范式或编程风格。它以类或对象作为组织代码的基本单元，并将封装、抽象、继承、多态四个特性，作为代码设计和实现的基石 。面向对象编程语言是支持类或对象的语法机制，并有现成的语法机制，能方便地实现面向对象编程四大特性（封装、抽象、继承、多态）的编程语言。

相比之下，面向过程编程也是一种编程范式或编程风格。它以过程（可以理解为方法、函数、操作）作为组织代码的基本单元，以数据（可以理解为成员变量、属性）与方法相分离为最主要的特点。面向过程风格是一种流程化的编程风格，通过拼接一组顺序执行的方法来操作数据完成一项功能。面向过程编程语言最大的特点是不支持类和对象两个语法概念，不支持丰富的面向对象编程特性（比如继承、多态、封装），仅支持面向过程编程。

从代码示例中可以看出，面向过程和面向对象最基本的区别就是，代码的组织方式不同。面向过程风格的代码被组织成了一组方法集合及其数据结构，方法和数据结构的定义是分开的。面向对象风格的代码被组织成一组类，方法和数据结构被绑定一起，定义在类中。

{% tabs 面向对象和面向过程 %}

<!-- tab 面向过程 -->
```c
struct User {
  char name[64];
  int age;
  char gender[16];
};

struct User parse_to_user(char* text) {
  // 将text(“小王&28&男”)解析成结构体struct User
}

char* format_to_text(struct User user) {
  // 将结构体struct User格式化成文本（"小王\t28\t男"）
}

void sort_users_by_age(struct User users[]) {
  // 按照年龄从小到大排序users
}
```
<!-- endtab-->

<!-- tab 面向对象 -->
```java
public class User {
  private String name;
  private int age;
  private String gender;
  
  public User(String name, int age, String gender) {
    this.name = name;
    this.age = age;
    this.gender = gender;
  }
  
  public static User praseFrom(String userInfoText) {
    // 将text(“小王&28&男”)解析成类User
  }
  
  public String formatToText() {
    // 将类User格式化成文本（"小王\t28\t男"）
  }
}
```
<!-- endtab -->

{% endtabs %}

对于简单程序的开发来说，不管是用面向过程编程风格，还是用面向对象编程风格，差别确实不会很大，甚至有的时候，面向过程的编程风格反倒更有优势。因为需求足够简单，整个程序的处理流程只有一条主线，很容易被划分成顺序执行的几个步骤，然后逐句翻译成代码，这就非常适合采用面向过程这种面条式的编程风格来实现。

相比起面向过程语言，面向对象语言有以下优势：

1. 思维方式上的变更，在面向过程语言的编程中，我们首先考虑的是流程的划分，将整个程序要实现的功能分成几大模块，模块内的流程该如何划分。面向对象编程是以类为思考对象，在进行面向对象编程的时候，先去思考如何给业务建模，如何将需求翻译为类，如何给类之间建立交互关系。当我们有了类的设计之后，然后再像搭积木一样，按照处理流程，将类组装起来形成整个程序。这种开发模式、思考问题的方式，能让我们在应对复杂程序开发的时候，思路更加清晰；

2. 面向对象编程还提供了一种更加清晰的、更加模块化的代码组织方式。类就是一种非常好的组织些函数和数据结构的方式，是一种将代码模块化的有效手段；

3. 代码更加容易维护，封装特性是面向对象编程相比于面向过程编程的一个最基本的区别，因为它基于的是面向对象编程中最基本的类的概念。面向对象编程通过类这种组织代码的方式，将数据和方法绑定在一起，通过访问权限控制，只允许外部调用者通过类暴露的有限方法访问数据，而不会像面向过程编程那样，数据可以被任意方法随意修改。因此，面向对象编程提供的封装特性更有利于提高代码的易维护性；

4. 代码更加容易扩展，借助面向对象的抽象特性，我们隐藏函数的具体实现，在使用函数的时候，只需要了解函数具有什么功能，而不需要了解它是怎么实现的。从这一点上，不管面向过程编程还是是面向对象编程，都支持抽象特性。不过，面向对象编程还提供了其他抽象特性的实现方式。这些实现方式是面向过程编程所不具备的，比如基于接口实现的抽象。基于接口的抽象，可以让我们在不改变原有实现的情况下，轻松替换新的实现逻辑，提高了代码的可扩展性；

5. 代码更容易复用，继承特性是面向对象编程相比于面向过程编程所特有的两个特性之一（另一个是多态）。如果两个类有一些相同的属性和方法，我们就可以将这些相同的代码，抽取到父类中，让两个子类继承父类。这样两个子类也就可以重用父类中的代码，避免了代码重复写多遍，提高了代码的复用性；

6. 基于多态特性，在需要修改一个功能实现的时候，可以通过实现一个新的子类的方式，在子类中重写原来的功能逻辑，用子类替换父类。在实际的代码运行过程中，调用子类新的功能逻辑，而不是在原有代码上做修改。这就遵从了“对修改关闭、对扩展开放”的设计原则，提高代码的扩展性。除此之外，利用多态特性，不同的类对象可以传递给相同的方法，执行不同的代码逻辑，提高了代码的复用性；

### 注意

有几个在面向对象编程中常犯的错误，会导致最终写出的代码跟面向过程没什么却别。

1. 不要滥用 `getter` 和 `setter` 方法，面向对象语言提供了封装特性，可以将一些数据进行隐藏，不对外公开，为的是对重要数据的保护。但是如果我们对所有内部状态都提供一个 `getter` 和 `setter` 方法，相当于公开属性了。例如：

    {% note warning %}
    ```java
      public class ShoppingCart {
        private int itemsCount;
        private double totalPrice;
        private List<ShoppingCartItem> items = new ArrayList<>();
        
        public int getItemsCount() {
          return this.itemsCount;
        }
        
        public void setItemsCount(int itemsCount) {
          this.itemsCount = itemsCount;
        }
        
        public double getTotalPrice() {
          return this.totalPrice;
        }
        
        public void setTotalPrice(double totalPrice) {
          this.totalPrice = totalPrice;
        }

        public List<ShoppingCartItem> getItems() {
          return this.items;
        }
        
        public void addItem(ShoppingCartItem item) {
          items.add(item);
          itemsCount++;
          totalPrice += item.getPrice();
        }
        // ...省略其他方法...
      }
    ```
    {% endnote %}

   `itemsCount`和`totalPrice`。虽然我们将它们定义成`private`私有属性，但是提供了`public`的`getter`、`setter`方法，这就跟将这两个属性定义为`public`公有属性，没有什么两样了。外部可以通过`setter`方法随意地修改这两个属性的值。除此之外，任何代码都可以随意调用`setter`方法，来重新设置`itemsCount`、`totalPrice`属性的值，这也会导致其跟`items`属性的值不一致。

   面向对象封装的定义是：通过访问权限控制，隐藏内部数据，外部仅能通过类提供的有限的接口访问、修改内部数据。所以，暴露不应该暴露的`setter`方法，明显违反了面向对象的封装特性。

   对于`items`这个属性，我们定义了它的`getter`方法和`addItem()`方法，并没有定义它的`setter`方法。这样的设计貌似看起来没有什么问题，但实际上并不是。对于`itemsCount`和`totalPrice`这两个属性来说，定义一个`public`的`getter`方法，确实无伤大雅，毕竟`getter`方法不会修改数据。但是，对于`items`属性就不一样了，这是因为`items`属性的`getter`方法，返回的是一个`List`集合容器。外部调用者在拿到这个容器之后，是可以操作容器内部数据的，也就是说，外部代码还是能修改`items`中的数据：

   ```java
   ShoppingCart cart = new ShoppCart();
   ...
   cart.getItems().clear(); // 清空购物车
   ```

2. 不要滥用全局变量和全局方法。在使用`C`语言这样的面向过程语言开发时，应该随处可见全局变量和全局方法。在面向对象编程中，常见的全局变量有单例类对象、静态成员变量、常量等，常见的全局方法有静态方法。单例类对象在全局代码中只有一份，所以，它相当于一个全局变量。静态成员变量是归属于类上的数据，被所有的实例化对象所共享，也相当于一定程度上的全局变量。而常量是一种非常常见的全局变量，比如一些代码中的配置参数，一般都设置为常量，放到一个 `Constants` 类中，静态方法一般用来操作静态变量或者外部数据。静态方法将方法与数据分离，破坏了封装特性，是典型的面向过程风格。当然不能说面向过程风格就不好，有时候一些必要的 `Utils` 类（没有自己的属性），定义了一大部分静态方法处理公共数据能极大提高我们的开发效率。

3. 不要定义数据和方法分离的类。不过话虽这么说，干`WEB`的程序员应该都知道，前后端分离的项目一般被分为：`Controller`层、`Service`层、`Repository`层，`Controller`层负责暴露接口给前端调用，`Service`层负责核心业务逻辑，`Repository`层负责数据读写。而在每一层中，我们又会定义相应的`VO（View Object）`、`BO（Business Object）`、`Entity`。一般情况下，`VO`、`BO`、`Entity`中只会定义数据，不会定义方法，所有操作这些数据的业务逻辑都定义在对应的`Controller`类、`Service`类、`Repository`类中。这就是典型的面向过程的编程风格。

### 接口、抽象类

不同的编程语言对接口和抽象类的定义可能有些区别，但是大多数面向对象语言都支持接口。抽象类有以下特点：

- 抽象类不允许被实例化，只能被继承；
- 抽象类可以包含属性和方法，方法既可以包含代码实现，也可以不包含代码实现，不包含代码实现的方法叫作抽象方法；
- 子类继承抽象类，必须实现抽象类中的所有抽象方法；

相比抽象类，接口简单很多：

- 接口不能包含属性（也就是成员变量）；
- 接口只能声明方法，方法不能包含代码实现；
- 类实现接口的时候，必须实现接口中声明的所有方法；

抽象类也是为代码复用而生的。多个子类可以继承抽象类中定义的属性和方法，避免在子类中，重复编写相同的代码，结合了抽象和继承的优点。

如果我们要表示一种`is-a`的关系，并且是为了解决代码复用的问题，我们就用抽象类；如果我们要表示一种`has-a`关系，并且是为了解决抽象而非代码复用的问题，那我们就可以使用接口。

从类的继承层次上来看，抽象类是一种自下而上的设计思路，先有子类的代码重复，然后再抽象成上层的父类（也就是抽象类）。而接口正好相反，它是一种自上而下的设计思路。我们在编程的时候，一般都是先设计接口，再去考虑具体的实现。

### 基于接口编程

基于接口而非实现编程这条原则的另一个表述方式，是基于抽象而非实现编程。后者的表述方式其实更能体现这条原则的设计初衷。在软件开发中，最大的挑战之一就是需求的不断变化，这也是考验代码设计好坏的一个标准。越抽象、越顶层、越脱离具体某一实现的设计，越能提高代码的灵活性，越能应对未来的需求变化。好的代码设计，不仅能应对当下的需求，而且在将来需求发生变化的时候，仍然能够在不破坏原有代码设计的情况下灵活应对。而抽象就是提高代码扩展性、灵活性、可维护性最有效的手段之一。

举个例子，假设我们的系统中有很多涉及图片处理和存储的业务逻辑。图片经过处理之后被上传到阿里云上。为了代码复用，我们封装了图片存储相关的代码逻辑，提供了一个统一的`AliyunImageStore`类，供整个系统来使用。具体的代码实现如下所示：

{% note warning %}
```java
public class AliyunImageStore {
  //...省略属性、构造函数等...
  
  public void createBucketIfNotExisting(String bucketName) {
    // ...创建bucket代码逻辑...
    // ...失败会抛出异常..
  }
  
  public String generateAccessToken() {
    // ...根据accesskey/secrectkey等生成access token
  }
  
  public String uploadToAliyun(Image image, String bucketName, String accessToken) {
    //...上传图片到阿里云...
    //...返回图片存储在阿里云上的地址(url）...
  }
  
  public Image downloadFromAliyun(String url, String accessToken) {
    //...从阿里云下载图片...
  }
}

// AliyunImageStore类的使用举例
public class ImageProcessingJob {
  private static final String BUCKET_NAME = "ai_images_bucket";
  //...省略其他无关代码...
  
  public void process() {
    Image image = ...; //处理图片，并封装为Image对象
    AliyunImageStore imageStore = new AliyunImageStore(/*省略参数*/);
    imageStore.createBucketIfNotExisting(BUCKET_NAME);
    String accessToken = imageStore.generateAccessToken();
    imagestore.uploadToAliyun(image, BUCKET_NAME, accessToken);
  }
  
}
```
{% endnote %}

整个上传流程包含三个步骤：创建`bucket`（你可以简单理解为存储目录）、生成`access token`访问凭证、携带`access token`上传图片到指定的`bucket`中。代码实现非常简单，类中的几个方法定义得都很干净，用起来也很清晰，乍看起来没有太大问题，完全能满足我们将图片存储在阿里云的业务需求。

但是，如果随着需求的变化，我们要将图片上传到私有云，所以我们可能会实现一个 `PrivateImageStore` 类，并且将原来的 `AliyunImageStore` 替换，这样的修改听起来并不复杂，只是简单替换而已，对整个代码的改动并不大。不过，我们经常说细节是魔鬼。这句话在软件开发中特别适用。实际上，刚刚的设计实现方式，就隐藏了很多容易出问题的魔鬼细节：

- `AliyunImageStore`类中有些函数命名暴露了实现细节，比如，`uploadToAliyun()`和`downloadFromAliyun()`。如果开发这个功能的同事没有接口意识、抽象思维，那这种暴露实现细节的命名方式就不足为奇了，毕竟最初我们只考虑将图片存储在阿里云上。而我们把这种包含“aliyun”字眼的方法，照抄到`PrivateImageStore`类中，显然是不合适的；如果我们在新类中重新命名`uploadToAliyun()`、`downloadFromAliyun()`这些方法，那就意味着，我们要修改项目中所有使用到这两个方法的代码，代码修改量可能就会很大；

- 其次，将图片存储到阿里云的流程，跟存储到私有云的流程，可能并不是完全一致的。比如，阿里云的图片上传和下载的过程中，需要生产`access token`，而私有云不需要`access token`。一方面，`AliyunImageStore`中定义的`generateAccessToken()`方法不能照抄到`PrivateImageStore`中；另一方面，我们在使用`AliyunImageStore`上传、下载图片的时候，代码中用到了`generateAccessToken()`方法，如果要改为私有云的上传下载流程，这些代码都需要做调整；

解决这个问题的根本方法就是，在编写代码的时候，要遵从基于接口而非实现编程的原则，具体来讲，我们需要做到下面这`3`点：

1. 函数的命名不能暴露任何实现细节。比如，前面提到的`uploadToAliyun()`就不符合要求，应该改为去掉`aliyun`这样的字眼，改为更加抽象的命名方式，比如：`upload()`；
2. 封装具体的实现细节。比如，跟阿里云相关的特殊上传（或下载）流程不应该暴露给调用者。我们对上传（或下载）流程进行封装，对外提供一个包裹所有上传（或下载）细节的方法，给调用者使用；
3. 为实现类定义抽象的接口。具体的实现类都依赖统一的接口定义，遵从一致的上传功能协议。使用者依赖接口，而不是具体的实现类来编程；

重构之后的代码如下：

{% note success %}
```java
public interface ImageStore {
  String upload(Image image, String bucketName);
  Image download(String url);
}

public class AliyunImageStore implements ImageStore {
  //...省略属性、构造函数等...

  public String upload(Image image, String bucketName) {
    createBucketIfNotExisting(bucketName);
    String accessToken = generateAccessToken();
    //...上传图片到阿里云...
    //...返回图片在阿里云上的地址(url)...
  }

  public Image download(String url) {
    String accessToken = generateAccessToken();
    //...从阿里云下载图片...
  }

  private void createBucketIfNotExisting(String bucketName) {
    // ...创建bucket...
    // ...失败会抛出异常..
  }

  private String generateAccessToken() {
    // ...根据accesskey/secrectkey等生成access token
  }
}

// 上传下载流程改变：私有云不需要支持access token
public class PrivateImageStore implements ImageStore  {
  public String upload(Image image, String bucketName) {
    createBucketIfNotExisting(bucketName);
    //...上传图片到私有云...
    //...返回图片的url...
  }

  public Image download(String url) {
    //...从私有云下载图片...
  }

  private void createBucketIfNotExisting(String bucketName) {
    // ...创建bucket...
    // ...失败会抛出异常..
  }
}

// ImageStore的使用举例
public class ImageProcessingJob {
  private static final String BUCKET_NAME = "ai_images_bucket";
  //...省略其他无关代码...
  
  public void process() {
    Image image = ...;//处理图片，并封装为Image对象
    ImageStore imageStore = new PrivateImageStore(...);
    imagestore.upload(image, BUCKET_NAME);
  }
}
```
{% endnote %}

基于接口而非实现编程，并不是说需要给每个实现类都定义对应的接口，过度使用这条原则，非得给每个类都定义接口，接口满天飞，也会导致不必要的开发负担。

至于什么时候，该为某个类定义接口，实现基于接口的编程，什么时候不需要定义接口，直接使用实现类编程，我们做权衡的根本依据，还是要回归到设计原则诞生的初衷上来。只要搞清楚了这条原则是为了解决什么样的问题而产生的，你就会发现，很多之前模棱两可的问题，都会变得豁然开朗。

前面我们也提到，这条原则的设计初衷是，将接口和实现相分离，封装不稳定的实现，暴露稳定的接口。上游系统面向接口而非实现编程，不依赖不稳定的实现细节，这样当实现发生变化的时候，上游系统的代码基本上不需要做改动，以此来降低代码间的耦合性，提高代码的扩展性。

从这个设计初衷上来看，如果在我们的业务场景中，某个功能只有一种实现方式，未来也不可能被其他实现方式替换，那我们就没有必要为其设计接口，也没有必要基于接口编程，直接使用实现类就可以了。

除此之外，越是不稳定的系统，我们越是要在代码的扩展性、维护性上下功夫。相反，如果某个系统特别稳定，在开发完之后，基本上不需要做维护，那我们就没有必要为其扩展性，投入不必要的开发时间。

### 组合或许优于继承

继承是面向对象的四大特性之一，用来表示类之间的 `is-a` 关系，可以解决代码复用的问题，但是如果继承层次过深，过复杂，继承了不必要的功能，也会影响到代码的可维护性。

举个例子，我们如果要写一个关于鸟的类，首先定义一个 `AbsctractBird`，具体的麻雀，鸽子，乌鸦都会继承自这个类，那么我们能否在这个抽象类中定义一个 `fly()` 方法？当然不能，因为还有不会飞的鸟，比如说鸵鸟。如果鸵鸟类继承自 `AbsctractBird`，鸵鸟就能飞了，不符合事实。有人可能说，我们重写 `fly()` 让它抛出异常岂不是就可以了，可以是可以，但是不够优雅：

{% note warning %}
```java
public class AbsctractBird {
  // ... 省略其他方法
  public void fly() { 
    // ...
  }
}

public class Ostrich extends AbsctractBird {
  
  public void fly() {
    throw new UnSupportedMethodException("I cant't fly");
  }
}
```
{% endnote %}

而且，不会飞的鸟有很多，还有企鹅，我们都需要重写 `fly()` 方法，抛出异常。到这里，支持继承的一方可能还会提出，可将鸟类分成能飞的鸟（`AbsctractFlyableBird`），和不能飞的鸟（`AbsctractUnFlyableBird`），它们都继承自 `AbsctractBird`，那么再实现具体类，这个时候继承深度已经达到三层了。如果再要区分能不能下蛋，能不能叫，我们就得设计能飞能下蛋能叫的鸟这种抽象类，继承爆炸：

![](继承爆炸.png)

如何使用组合来优化这种继承爆炸的问题呢？我们可以将飞，叫，下蛋定义为一种能力，哪种鸟有就给哪种鸟加上。我们会使用接口，组合，委托的技术来实现我们的诉求：

```java
public interface Flyable {
  void fly();
}

public interface Tweetable {
  void tweet();
}

public interface EggLayable {
  void layEgg();
}

public class FlyAbility implements Flyable {
  @Override
  public void fly() {
    // ...
  }
}

// 省略，TweetAbility 和 EgglayAbility 的实现

public class Pigeon implements Tweetable, EggLayable, Flyable {

  private FlyAbility flyAbility = new FlyAbility();
  private TweetAbility tweetAbility = new TweetAbility();
  private EgglayAbility egglayAbility = new EgglayAbility();

  @Override
  public void fly() {
    flyAbility.fly();
  }

  @Override
  public void tweet() {
    tweetAbility.tweet();
  }

  @Override
  public void layEgg() {
    egglayAbility.layEgg();  // 委托
  }
}
```

继承的三个作用：表示 `is-a` 关系，支持多态，代码复用。这三个作用都可以通过其他技术手段来实现。例如，我们可以用组合和接口的 `has-a` 来实现 `is-a`，多态可以用接口来实现；代码复用可以用组合和委托来实现。

上面的例子虽然证明了组合优于继承，但不是说继承一无是处。如果类的继承结构稳定，继承层次比较浅，继承关系也不复杂，我们可以用继承。反之，如果系统不稳定，继承层次还比较深，继承关系比较复杂，我们就考虑使用组合替换它。

关于继承可以实现代码复用，需要就具体情况具体分析，因为继承首先表明一种 `is-a` 关系，然后才考虑复用，例如，我们可以将能飞的鸟，飞，这个功能提取到父类中，实现代码复用。但是，对于 `Crawler` 和 `PageAnalyzer` 这两个都用到了 `URL` 拼接功能的类，我们没法抽象出一个父类，将这个公共的方法提取到父类中达到代码复用的目的，因为这个两个类不同宗也不同源，没有任何关系，硬生生扯出一个公共的类，只会影响代码的可读性。

所以，结论是，虽然鼓励多用组合少用继承，但组合也并不完美，继承也不是说一无是处，实际项目中，还要根据具体的情况进行分析。

