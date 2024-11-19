---
title: 设计模式及其示例
date: 2024-11-19 14:34:17
tags:
  - 设计模式
categories:
  - 设计模式
searchOnlyTitle: true
---


本文介绍23设计模式使用场景及其示例。

### 单例模式

单例模式适用于整个系统只有一个实例的场景，比如数据库连接池、线程池、系统配置信息管理等。确保在任何时候只有一个对象被创建来提供统一的访问点，避免资源浪费和不一致性。

{% tabs 单例模式 %}

<!-- tab Rust -->
```Rust
use std::cell::RefCell;
use std::sync::{Mutex, MutexGuard};

use once_cell::sync::Lazy;

#[derive(Debug, Clone, Default)]
pub struct Connection {
    name: String,
}

pub struct DatabaseConnectionPool {
    connections: Vec<RefCell<Connection>>,
}

impl DatabaseConnectionPool {
    fn new(pool_size: usize) -> DatabaseConnectionPool {
        DatabaseConnectionPool {
            connections: Vec::with_capacity(pool_size),
        }
    }

    pub fn get_connection(&mut self) -> Option<RefCell<Connection>> {
        let length = self.connections.len();
        if length > 0 {
            Some(self.connections.remove(length - 1))
        } else {
            None
        }
    }

    pub fn release_connection(&mut self, connection: Connection) {
        self.connections.push(RefCell::new(connection))
    }

    pub fn count(&self) -> usize {
        self.connections.len()
    }
}

static GLOBAL_POOL: Lazy<Mutex<DatabaseConnectionPool>> =
    Lazy::new(|| Mutex::new(DatabaseConnectionPool::new(10)));

pub fn get_pool_instance() -> MutexGuard<'static, DatabaseConnectionPool> {
    GLOBAL_POOL.lock().unwrap()
}

fn main() {
    {
        let mut pool1 = get_pool_instance();
        pool1.release_connection(Connection::default());
        println!("Address of x: {:p}", std::ptr::addr_of!(pool1));
    }
    {
        let mut pool2 = get_pool_instance();
        pool2.release_connection(Connection::default());
        println!("Address of x: {:p}", std::ptr::addr_of!(pool2));
    }
    println!("connections length: {}", get_pool_instance().count());
}
```

这将输出：

    Address of x: 0x41330ff5f8
    Address of x: 0x41330ff678
    connections length: 2

<!-- endtab -->

<!-- tab Go -->
```go
package main

import "fmt"

// DatabaseConnectionPool结构体模拟数据库连接池
type DatabaseConnectionPool struct {
    connections []*Connection
}

// Connection结构体模拟数据库连接
type Connection struct{}

// 包级别的私有变量，用于存储单例的数据库连接池实例
var instance *DatabaseConnectionPool

// 获取数据库连接池单例实例的函数
func GetDatabaseConnectionPoolInstance() *DatabaseConnectionPool {
    if instance == nil {
        instance = &DatabaseConnectionPool{
            connections: make([]*Connection, 10), // 假设初始化10个连接
        }
    }
    return instance
}

func main() {
    pool1 := GetDatabaseConnectionPoolInstance()
    pool2 := GetDatabaseConnectionPoolInstance()

    // 验证两个实例是否相同
    if pool1 == pool2 {
        fmt.Println("数据库连接池实例是相同的，单例模式生效")
    } else {
        fmt.Println("数据库连接池实例不同，单例模式未生效")
    }
}
```
<!-- endtab -->

<!-- tab Java -->
```java
public class DatabaseConnectionPool {
    // 私有静态实例变量，初始化为null
    private static DatabaseConnectionPool instance = null;

    // 模拟数据库连接的列表
    private Connection[] connections;

    // 私有化构造函数，防止外部通过构造函数创建实例
    private DatabaseConnectionPool() {
        connections = new Connection[10]; // 假设初始化10个连接
    }

    // 静态方法用于获取单例实例
    public static DatabaseConnectionPool getInstance() {
        if (instance == null) {
            instance = new DatabaseConnectionPool();
        }
        return instance;
    }

    public static void main(String[] args) {
        DatabaseConnectionPool pool1 = DatabaseConnectionPool.getInstance();
        DatabaseConnectionPool pool2 = DatabaseConnectionPool.getInstance();

        // 验证两个实例是否相同
        if (pool1 == pool2) {
            System.out.println("数据库连接池实例是相同的，单例模式生效");
        } else {
            System.out.println("数据库连接池实例不同，单例模式未生效");
        }
    }
}

class Connection {}
```
<!-- endtab -->

{% endtabs %}

<!-- more -->

### 工厂模式

工厂设计模式是一种创建对象的设计模式，它提供了一种创建对象的方式，将对象的创建和使用分离。通过使用工厂类来负责创建对象，而不是在客户端代码中直接实例化对象，这样可以隐藏对象创建的复杂细节，使得客户端代码只需要关心如何使用对象，而不需要了解对象是如何被创建出来的。

工厂模式适用以下场景：

- 对象创建过程复杂：当创建一个对象需要进行复杂的初始化操作，如读取配置文件、连接数据库、进行复杂的计算等，使用工厂设计模式可以将这些复杂的创建过程封装在工厂类中，客户端只需从工厂获取创建好的对象即可。例如，创建一个数据库连接对象，可能需要配置数据库的各种参数、建立网络连接等复杂步骤，通过工厂模式可以让客户端简单地获取到可用的数据库连接对象。
- 根据不同条件创建不同类型对象：在某些应用场景中，需要根据不同的条件（如用户输入、系统配置等）创建不同类型的对象。比如在一个图形绘制应用中，根据用户选择的图形类型（圆形、矩形、三角形等）创建相应的图形对象，工厂模式可以根据传入的条件来决定创建哪种具体的图形对象。

工厂设计模式具有如下特点：

- 解耦对象创建和使用：客户端代码与对象的具体创建过程分离，降低了客户端代码对具体对象实现的依赖，使得代码的维护和扩展更加容易。如果对象的创建过程发生变化，只需要修改工厂类，而不需要在客户端代码中大量修改。
- 代码复用性高：工厂类可以被多个客户端代码复用，不同的客户端都可以通过同一个工厂类来获取所需的对象，提高了代码的复用程度。
- 便于对象管理：工厂模式可以对创建的对象进行统一管理，例如可以在工厂类中对创建的对象数量进行统计、对对象的生命周期进行控制等。

工厂设计模式遵循以下设计原则：

- 开闭原则：对扩展开放，对修改关闭。当需要添加新的对象类型时，只需创建新的具体工厂类或在现有工厂类中添加创建新对象的方法，而不需要修改客户端代码，使得系统能够方便地进行扩展。
- 依赖倒置原则：高层模块（客户端）不依赖于低层模块（具体对象的实现），而是依赖于抽象（工厂接口和抽象对象接口）。这样可以提高代码的灵活性，便于在不同的场景下替换不同的工厂类或具体对象实现。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XKzsBNywkP4hCwyajIWjCJbL8JWZiI1LePfB0GXIYXBBDJIvQe6gdxPkVx9tCaJr-pspdivfUxft4LToJc9niO9pPb5o3aoFTb5YIcPfiPL2ch4HH02tAS_dhqIO4fIQN9AObuumg3mpfIG3oPoCrCpqZ18i1iCzytJxqgTzJUYUSKjCBialgeGQcroKcbYI6byCaj7Gj88eGN8Sn0ou5o5SP8-YcQTDd85mtqAug7ucsaomePkVRzxD1GrpFRqQEsYKMIayNJVlUTy6BgYXE6HH_81G0HF1C8QWMan3TNNje445Kj4n--dkNU_tT00T_g9nolizdJ2JKJL01N7fSKZDIm6cMm00)查看使用工厂方法分离对象创建和使用的过程。

{% tabs 工厂方法 %}

<!-- tab Rust -->
```rust
pub trait Shape {
    fn draw(&self);
}

struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn draw(&self) {
        println!("绘制一个半径为：{:.2}的圆形", self.radius);
    }
}

struct Rectangle {
    width: f64,
    length: f64,
}

impl Shape for Rectangle {
    fn draw(&self) {
        println!(
            "绘制一个长:{:.2}，宽：{:.2}的长方形",
            self.length, self.width
        );
    }
}

pub trait Factory {
    fn create_shape(&self) -> Box<dyn Shape>;
}

struct CircleFactory;

impl Factory for CircleFactory {
    fn create_shape(&self) -> Box<dyn Shape> {
        Box::new(Circle { radius: 1.0 })
    }
}

struct RectangleFactory;

impl Factory for RectangleFactory {
    fn create_shape(&self) -> Box<dyn Shape> {
        Box::new(Rectangle {
            width: 1.0,
            length: 3.0,
        })
    }
}

fn main() {
    let circle_factory = CircleFactory;
    let rectangle_factory = RectangleFactory;

    let circle = circle_factory.create_shape();
    let rectangle = rectangle_factory.create_shape();

    circle.draw();
    rectangle.draw();
}
```
<!-- endtab -->

<!-- tab Go -->
```go
package main

import "fmt"

// 抽象图形接口，定义图形的通用行为
type Shape interface {
    Draw()
}

// 具体图形：圆形
type Circle struct {
    radius float64
}

func (c Circle) Draw() {
    fmt.Printf("绘制一个半径为%.2f的圆形\n", c.radius)
}

// 具体图形：矩形
type Rectangle struct {
    width  float64
    height float64
}

func (r Rectangle) Draw() {
    fmt.Printf("绘制一个宽为%.2f，高为%.2f的矩形\n", r.width, r.height)
}

// 抽象工厂接口，定义创建图形的方法
type ShapeFactory interface {
    CreateShape() Shape
}

// 具体工厂：圆形工厂
type CircleFactory struct{}

func (cf CircleFactory) CreateShape() Shape {
    return Circle{radius: 5.0}
}

// 具体工厂：矩形工厂
type RectangleFactory struct{}

func (rf RectangleFactory) CreateShape() Shape {
    return Rectangle{width: 4.0, height: 6.0}
}

func main() {
    // 创建圆形图形
    circleFactory := CircleFactory{}
    circleShape := circleFactory.CreateShape()
    circleShape.Draw()

    // 创建矩形图形
    rectangleFactory := RectangleFactory{}
    rectangleShape := rectangleFactory.CreateShape()
    rectangleShape.Draw()
}  rectangleProduct.Use()
```
<!-- endtab -->

<!-- tab Java -->
```java
// 抽象图形trait，定义图形的通用行为
trait Shape {
    fn draw(&self);
}

// 具体图形：圆形
struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn draw(&self) {
        println!("绘制一个半径为{}的圆形", self.radius);
    }
}

// 具体图形：矩形
struct Rectangle {
    width: f64,
    height: f64,
}

impl Shape for Rectangle {
    fn draw(&self) {
        println!("绘制一个宽为{}，高为{}的矩形", self.width, self.height);
    }
}

// 抽象工厂trait，定义创建图形的方法
trait ShapeFactory {
    fn create_shape(&self) -> Box<dyn Shape>;
}

// 具体工厂：圆形工厂
struct CircleFactory;

impl ShapeFactory for CircleFactory {
    fn create_shape(&self) -> Box<dyn Shape> {
        Box::new(Circle { radius: 5.0 })
    }
}

// 具体工厂：矩形工厂
struct RectangleFactory;

impl ShapeFactory for RectangleFactory {
    fn create_shape(&self) -> Box<dyn Shape> {
        Box::new(Rectangle { width: 4.0, height: 6.0 })
    }
}

fn main() {
    // 创建圆形图形
    let circle_factory = CircleFactory;
    let circle_shape = circle_factory.create_shape();
    circle_shape.draw();

    // 创建矩形图形
    let rectangle_factory = RectangleFactory;
    let rectangle_shape = rectangle_factory.create_shape();
    rectangle_shape.draw();
}
```
<!-- endtab -->

{% endtabs %}

### 抽象工厂

抽象工厂设计模式是一种创建对象的设计模式，它提供了一种创建一系列相关或相互依赖对象的方式，而无需指定它们具体的类。该模式通过抽象工厂接口定义创建不同产品对象的方法，具体工厂类实现这些接口来创建实际的产品对象，客户端代码则通过调用抽象工厂的方法来获取所需的产品对象，从而实现了对象创建和使用的解耦。

如下是一些示例的应用场景：

1. 跨平台应用开发：例如开发一款图形界面应用程序，需要在不同操作系统（如 Windows、Mac、Linux）上运行，每个操作系统的界面组件（如按钮、文本框、菜单等）外观和行为有所不同，但整体都属于界面组件这一系列产品。可以使用抽象工厂模式，为每个操作系统创建一个具体工厂，负责生产该平台对应的界面组件产品族；
2. 数据库访问层：当应用程序需要支持多种数据库系统（如 MySQL、PostgreSQL、SQLite 等）时，对于每种数据库，都有相关的连接对象、命令对象、结果集对象等一系列数据库操作相关对象。通过抽象工厂模式，可为每种数据库创建一个具体工厂，专门生产该数据库所需的这一系列相关对象；

具有下面一些特点：

- 解耦对象创建和使用：客户端不需要了解具体产品对象的创建细节，只依赖于抽象工厂和抽象产品接口，使得代码的依赖关系更清晰，易于维护和扩展。
- 产品族的一致性：确保创建的一组相关产品对象（即产品族）在风格、行为等方面保持一致。例如，在跨平台 UI 场景中，由一个具体工厂创建的所有 UI 组件都适配于该平台的风格和规范。
- 易于切换产品族：如果要切换到不同的产品族（如从使用 Windows 平台的 UI 组件切换到 Mac 平台的 UI 组件），只需更换使用的具体工厂实例，而不需要对客户端代码中关于产品使用的部分进行大量修改。

遵循以下的设计原则：

- 依赖倒置原则：高层模块（客户端）不依赖于低层模块（具体工厂和具体产品）的具体实现，而是依赖于抽象（抽象工厂和抽象产品接口）。这样可以降低模块之间的耦合度，提高代码的灵活性和可维护性。
- 开闭原则：对扩展开放，对修改关闭。当需要添加新的产品族（如支持新的操作系统或数据库系统）时，只需创建新的具体工厂和对应的新的具体产品类，实现相应的抽象接口，而无需修改现有的客户端代码和已有的抽象工厂、抽象产品接口。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XKzsBNywkV7zdbdFUZfVJbh7bPbNabgKbfYSgk1KMbAIdwTGpQK01CavcSdP6ffSjK2DJrktFzax6QunF3Cl9R-y6Ae_EIUnk5W1AePYX3OUCtmJar7q0_cuz68wV5hxipbhdYriGt9xI6f5YLD-1LHtPbv1QKby2L1C0qHOAGIN56NcfUFp3TnGL0-XcgkDrs1CBw8R2XGYra24lvzkN_gqhmd9h-wXdcw9oINvHPMmk2fAJIn9ZKy21w26fXKq9f7am3R49-LNW6IXJa1oCyGAH620h828eOO6XitQ-ApM9i5kI7XXs0iKewQTO4itFz-ycmirlUhfrTZ1ah-LmjDryvxtRU02serF6ZM1GDH0EIXcu5U04R0GTGW-YbcubU4pKLVN3XQ124zqp7wwUzVxFHt0y7ZHEENzdaxy6X4EnzG9Tnb25ppiID20rmg7rBmKO2a60000)查看Windows平台上和MAC平台上的GUI场景示例。

{% tabs 抽象工厂 %}
<!-- tab Rust -->
```rust
// 抽象产品：按钮
trait Button {
    fn click(&self);
}

// 具体产品：Windows按钮
struct WindowsButton;

impl Button for WindowsButton {
    fn click(&self) {
        println!("Windows按钮被点击");
    }
}

// 具体产品：Mac按钮
struct MacButton;

impl Button for MacButton {
    fn click(&self) {
        println!("Mac按钮被点击");
    }
}

// 抽象产品：文本框
trait TextBox {
    fn input_text(&self, text: &str);
}

// 具体产品：Windows文本框
struct WindowsTextBox;

impl TextBox for WindowsTextBox {
    fn input_text(&self, text: &str) {
        println!("在Windows文本框中输入: {}", text);
    }
}

// 具体产品：Mac文本框
struct MacTextBox;

impl TextBox for MacTextBox {
    fn input_text(&self, text: &str) {
        println!("在Mac文本框中输入: {}", text);
    }
}

// 抽象工厂
trait GUIFactory {
    fn create_button(&self) -> Box<dyn Button>;
    fn create_text_box(&self) -> Box<dyn TextBox>;
}

// 具体工厂：Windows GUI工厂
struct WindowsGUIFactory;

impl GUIFactory for WindowsGUIFactory {
    fn create_button(&self) -> Box<dyn Button> {
        Box::new(WindowsButton)
    }

    fn create_text_box(&self) -> Box<dyn TextBox> {
        Box::new(WindowsTextBox)
    }
}

// 具体工厂：Mac GUI工厂
struct MacGUIFactory;

impl GUIFactory for MacGUIFactory {
    fn create_button(&self) -> Box<dyn Button> {
        Box::new(MacButton)
    }

    fn create_text_box(&self) -> Box<dyn TextBox> {
        Box::new(MacTextBox)
    }
}

// 客户端代码
fn main() {
    let windows_factory = WindowsGUIFactory;
    let mac_factory = MacGUIFactory;

    let windows_button = windows_factory.create_button();
    let windows_text_box = windows_factory.create_text_box();

    let mac_button = mac_factory.create_button();
    let mac_text_box = mac_factory.create_text_box();

    windows_button.click();
    windows_text_box.input_text("Hello from Windows");

    mac_button.click();
    mac_text_box.input_text("Hello from Mac");
}
```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import "fmt"

// 抽象产品：按钮
type Button interface {
    Click()
}

// 具体产品：Windows按钮
type WindowsButton struct{}

func (w *WindowsButton) Click() {
    fmt.Println("Windows按钮被点击")
}

// 具体产品：Mac按钮
type MacButton struct{}

func (m *MacButton) Click() {
    fmt.Println("Mac按钮被点击")
}

// 抽象产品：文本框
type TextBox interface {
    InputText(text string)
}

// 具体产品：Windows文本框
type WindowsTextBox struct{}

func (w *WindowsTextBox) InputText(text string) {
    fmt.Println("在Windows文本框中输入: ", text)
}

// 具体产品：Mac文本框
type MacTextBox struct{}

func (m *MacTextBox) InputText(text string) {
    fmt.Println("在Mac文本框中输入: ", text)
}

// 抽象工厂
type GUIFactory interface {
    CreateButton() Button
    CreateTextBox() TextBox
}

// 具体工厂：Windows GUI工厂
type WindowsGUIFactory struct{}

func (w *WindowsGUIFactory) CreateButton() Button {
    return &WindowsButton{}
}

func (w *WindowsGUIFactory) CreateTextBox() TextBox {
    return &WindowsTextBox{}
}

// 具体工厂：Mac GUI工厂
type MacGUIFactory struct{}

func (m *MacGUIFactory) CreateButton() Button {
    return &MacButton{}
}

func (m *MacGUIFactory) CreateTextBox() TextBox {
    return &MacTextBox{}
}

// 客户端代码
func main() {
    windowsFactory := &WindowsGUIFactory{}
    macFactory := &MacGUIFactory{}

    windowsButton := windowsFactory.CreateButton()
    windowsTextBox := windowsFactory.CreateTextBox()

    macButton := macFactory.CreateButton()
    macTextBox := macFactory.CreateTextBox()

    windowsButton.Click()
    windowsTextBox.InputText("Hello from Windows")

    macButton.Click()
    macTextBox.InputText("Hello from Mac")
}
```
<!-- endtab -->
{% endtabs %}

### 建造者设计模式

建造者设计模式是一种创建对象的设计模式，它将一个复杂对象的构建过程与其表示分离，使得同样的构建过程可以创建不同的表示。该模式通过将复杂对象的构建步骤抽象出来，由不同的建造者来具体实现这些步骤，最后通过指挥者来协调建造者完成复杂对象的构建。

建造者设计模式适用场景举例：

- 复杂对象创建：当需要创建一个复杂对象，且该对象的创建过程涉及多个步骤或多个部件的组装时，比如创建一辆汽车，需要分别组装发动机、车身、轮胎等部件，就可以使用建造者设计模式。
- 配置对象生成：在软件配置管理中，对于一些具有多个可配置选项的复杂配置对象，如数据库连接配置对象，包含数据库类型、主机地址、端口号、用户名、密码等多个属性，使用建造者设计模式可以方便地按照不同需求构建出不同的配置对象。

建造者设计模式具有如下特点：

- 分离构建与表示：将对象的构建过程从其最终的表示形式中分离出来，使得构建过程可以被复用，并且可以通过不同的建造者创建出具有不同表示的同一类型对象。
- 逐步构建：允许按照特定的顺序逐步完成复杂对象的构建，每个建造者负责一个或多个特定的构建步骤，使得构建过程更加清晰和可控。
- 可扩展性：方便添加新的建造者来实现不同的构建方式，以创建出更多种类的复杂对象，而不需要修改指挥者和原有建造者的核心逻辑。

建造者设计模式遵循以下设计原则：

- 单一职责原则：每个建造者类只负责对象构建过程中的一部分工作，如专门负责安装发动机的建造者、负责安装车身的建造者等，使得每个类的职责更加单一明确。
- 开闭原则：对扩展开放，对修改关闭。当需要创建新类型的复杂对象或对现有对象的构建过程进行修改时，只需添加新的建造者类或修改现有建造者类的构建步骤，而不需要修改指挥者类和客户端代码。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUB9h-TF9ZU_tp7gsSU-BlSkuadCIYuiLd1EB5Agv5810EpKlFJClrKeXkAGeCoyT8fQKdrA9AbAIMPHQ31Ug1Hhyh6llYuqBd-xUzR9XmOk6LgxCl9BKehJ4v5IGuKwbcJafgJ0xaa2yU8X56ffMI0gGf45sufG4Muz5DZsr91ueKvfJ0fK4E-rfw_OdUoV3dGRq_8kDgvxsza6202uE3GkVqehIeaeCHsid9nQ1ZOJm2FX16wydjF7xGfjORpoRkUvbmopitWXAJI_DIImQXFvurjF-h6SfmgKkGEt99Vbm1oP1ZC0qBZa_hxYag3Iv91xe1uI9uA3P_7ppRYwCgDFJgx53JdzM2a_NpNlUju4B7Zg4bSATfwkBgW1awul6AU_tTC1zz6JVt1TRfq6p0YAYEj5T1ZCCnHIq-7tQq_fqmcf8VWKwvSc-Rg11S8TJRf93QbuAi4m00000)查看使用构建者设计模式构建豪华车与普通车的类图。

{% tabs 建造者设计模式 %}

<!-- tab Rust -->
```go
// 产品：汽车
struct Car {
    engine: String,
    body: String,
    tires: String,
}

// 抽象建造者
trait CarBuilder {
    fn build_engine(&mut self) -> &mut Self;
    fn build_body(&mut self) -> &mut Self;
    fn build_tires(&mut self) -> &mut Self;
    fn get_result(&self) -> Car;
}

// 具体建造者：豪华汽车建造者
struct LuxuryCarBuilder {
    car: Car,
}

impl LuxuryCarBuilder {
    fn new() -> Self {
        LuxuryCarBuilder {
            car: Car {
                engine: String::from("高性能发动机"),
                body: String::from("豪华车身"),
                tires: String::from("高级轮胎"),
            },
        }
    }
}

impl CarBuilder for LuxuryCarBuilder {
    fn build_engine(&mut self) -> &mut Self {
        self.car.engine = String::from("更强大的高性能发动机");
        self
    }

    fn build_body(&mut self) -> &mut Self {
        self.car.body = String::from("更精致的豪华车身");
        self
    }

    fn build_tires(&mut self) -> &mut Self {
        self.car.tires = String::from("更舒适的高级轮胎");
        self
    }

    fn get_result(&self) -> Car {
        self.car.clone()
    }
}

// 具体建造者：普通汽车建造者
struct RegularCarBuilder {
    car: Car,
}

impl RegularCarBuilder {
    fn new() -> Self {
        RegularCarBuilder {
            car: Car {
                engine: String::from("普通发动机"),
                body: String::from("普通车身"),
                tires: String::from("普通轮胎"),
            },
        }
    }
}

impl CarBuilder for RegularCarBuilder {
    fn build_engine(&mut self) -> &mut Self {
        self.car.engine = String::from("稍强一些的普通发动机");
        self
    }

    fn build_body(&mut self) -> &mut Self {
        self.car.body = String::from("稍好一些的普通车身");
        self
    }

    fn build_tires(&mut self) -> &mut Self {
        self.car.tires = String::from("稍好一些的普通轮胎");
        self
    }

    fn get_result(&self) -> Car {
        self.car.clone()
    }
}

// 指挥者
struct Director {
    builder: Box<dyn CarBuilder>,
}

impl Director {
    fn new(builder: Box<dyn CarBuilder>) -> Self {
        Director { builder }
    }

    fn construct_car(&self) -> Car {
        self.builder
           .build_engine()
           .build_body()
           .build_tires()
           .get_result()
    }
}

// 客户端代码
fn main() {
    // 创建豪华汽车
    let luxury_builder = Box::new(LuxuryCarBuilder::new());
    let luxury_director = Director::new(luxury_builder);
    let luxury_car = luxury_director.construct_car();

    println!("豪华汽车配置：");
    println!("发动机：{}", luxury_car.engine);
    println!("车身：{}", luxury_car.body);
    println!("轮胎：{}", luxury_car.tires);

    // 创建普通汽车
    let regular_builder = Box::new(RegularCarBuilder::new());
    let regular_director = Director::new(regular_builder);
    let regular_car = regular_director.construct_car();

    println!("普通汽车配置：");
    println!("发动机：{}", regular_car.engine);
    println!("车身：{}", regular_car.body);
    println!("轮胎：{}", regular_car.tires);
}
```

<!-- endtab -->

<!-- tab Go -->
```go
package main

import "fmt"

// 产品：汽车
type Car struct {
    Engine string
    Body   string
    Tires  string
}

// 抽象建造者
type CarBuilder interface {
    BuildEngine() CarBuilder
    BuildBody() CarBuilder
    BuildTires() CarBuilder
    GetResult() Car
}

// 具体建造者：豪华汽车建造者
type LuxuryCarBuilder struct {
    car Car
}

func NewLuxuryCarBuilder() *LuxuryCarBuilder {
    return &LuxuryCarBuilder{
        car: Car{
            Engine: "高性能发动机",
            Body:   "豪华车身",
            Tires:  "高级轮胎",
        },
    }
}

func (l *LuxuryCarBuilder) BuildEngine() CarBuilder {
    l.car.Engine = "更强大的高性能发动机"
    return l
}

func (l *LuxuryCarBuilder) BuildBody() CarBuilder {
    l.car.Body = "更精致的豪华车身"
    return l
}

func (l *LuxuryCarBuilder) BuildTires() CarBuilder {
    l.car.Tires = "更舒适的高级轮胎"
    return l
}

func (l *LuxuryCarBuilder) GetResult() Car {
    return l.car
}

// 具体建造者：普通汽车建造者
type RegularCarBuilder struct {
    car Car
}

func NewRegularCarBuilder() *RegularCarBuilder {
    return &RegularCarBuilder{
        car: Car{
            Engine: "普通发动机",
            Body:   "普通车身",
            Tires:  "普通轮胎",
        },
    }
}

func (r *RegularCarBuilder) BuildEngine() CarBuilder {
    r.car.Engine = "稍强一些的普通发动机"
    return r
}

func (r *RegularCarBuilder) BuildBody() CarBuilder {
    r.car.Body = "稍好一些的普通车身"
    return r
}

func (r *RegularCarBuilder) BuildTires() CarBuilder {
    r.car.Tires = "稍好一些的普通轮胎"
    return r
}

func (r *RegularCarBuilder) GetResult() Car {
    return r.car
}

// 指挥者
type Director struct {
    builder CarBuilder
}

func NewDirector(builder CarBuilder) *Director {
    return &Director{
        builder: builder,
    }
}

func (d *Director) ConstructCar() Car {
    return d.builder.
        BuildEngine().
        BuildBody().
        BuildTires().
        GetResult()
}

// 客户端代码
func main() {
    // 创建豪华汽车
    luxuryBuilder := NewLuxuryCarBuilder()
    luxuryDirector := NewDirector(luxuryBuilder)
    luxuryCar := luxuryDirector.ConstructCar()

    fmt.Println("豪华汽车配置：")
    fmt.Println("发动机：", luxuryCar.Engine)
    fmt.Println("车身：", luxuryCar.Body)
    fmt.Println("轮胎：", luxuryCar.Tires)

    // 创建普通汽车
    regularBuilder := NewRegularCarBuilder()
    regularDirector := NewDirector(regularBuilder)
    regularCar := regularDirector.ConstructCar()

    fmt.Println("普通汽车配置：")
    fmt.Println("发动机：", regularCar.Engine)
    fmt.Println("车身：", regularCar.Body)
    fmt.Println("轮胎：", regularCar.Tires)
}
```
<!-- endtab -->

{% endtabs %}

### 原型设计模式

原型设计模式是一种创建对象的设计模式，它通过复制现有的对象（原型）来创建新的对象，而不是通过传统的使用构造函数来实例化对象。这种模式允许在运行时基于已有的对象实例快速创建出相似的对象，并且可以根据需要对复制后的对象进行个性化的修改。

原型设计模式适用场景如下：

- 对象创建成本高：当创建一个对象的过程比较复杂，例如涉及到大量的计算、数据库查询、网络请求等操作，且需要频繁创建相似的对象时，使用原型设计模式可以通过复制已有对象来避免重复执行这些复杂的创建过程，从而提高效率。比如创建复杂的图形对象，每次从头开始创建图形并设置其属性可能很耗时，通过复制已创建好的图形原型并进行微调就可以快速得到新的图形对象。
- 动态配置对象：在一些需要根据不同场景动态生成相似对象的情况下，如根据用户的不同设置生成不同配置的系统设置对象，先创建一个基础的设置对象原型，然后根据用户的具体选择复制该原型并修改相应的属性，就可以快速生成符合用户需求的设置对象。

原型设计模式特点如下：

- 高效创建相似对象：无需重新执行复杂的对象创建过程，直接通过复制原型对象就能快速得到新的对象，节省了创建时间，尤其适用于创建成本高的对象。
- 灵活修改复制对象：复制得到的新对象可以独立于原型对象进行属性修改等操作，能够根据具体需求灵活调整新对象的特性，以满足不同的应用场景。
- 保持对象结构一致性：新创建的对象与原型对象在结构上基本相同，保证了对象体系的一致性，便于管理和使用。

原型设计模式遵循的设计原则如下：

- 开闭原则：对扩展开放，对修改关闭。当需要创建新类型的相似对象时，只需提供相应的原型对象，无需修改现有创建对象的核心逻辑，通过复制和修改原型即可满足需求。
- 依赖倒置原则：高层模块（如使用对象的客户端）不依赖于具体的对象创建方式（如通过构造函数或其他复杂方式），而是依赖于抽象的原型接口，这样使得代码更具灵活性，便于替换不同的原型实现。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XK_xvZ-TrysLcLUIMfIMc9og452KNv9VKbcGgb3DfG04oJdvUQaQcWfM21ckMg3sfwtRd-oT3D7-Vi-ifxFtFTsxwEdwdK0pkP9p4ekB5ToB4WioCfFzax9IaqkWfcadv-Va5raf19SKPUQbGuIACwjIhHGqCesDT1I0X2P45BkzO8itFz-ycmlLT5tT6Zk4Gg2cf-lcFU_RmEMGcfS2z2u0)查看原型设计模式的类图。

{% tabs 原型设计模式 %}

<!-- tab Rust -->
```rust
// 抽象原型
trait Prototype {
    fn clone(&self) -> Box<dyn Prototype>;
}

// 具体原型：图形对象
struct GraphicObject {
    color: String,
    size: (i32, i32),
}

impl Prototype for GraphicObject {
    fn clone(&self) -> Box<dyn Prototype> {
        Box::new(GraphicObject {
            color: self.color.clone(),
            size: self.size,
        })
    }
}

// 客户端代码
fn main() {
    let original_graphic = GraphicObject {
        color: String::from("red"),
        size: (100, 100),
    };

    let cloned_graphic = original_graphic.clone();

    println!("原始图形颜色: {}", original_graphic.color);
    println!("原始图形大小: {:?}", original_graphic.size);

    println!("克隆图形颜色: {}", cloned_graphic.color);
    println!("克隆图形大小: {:?}", cloned_graphic.size);
}
```
<!-- endtab -->

<!-- tab Go -->
```go
package main

import "fmt"

// 抽象原型
type Prototype interface {
    Clone() Prototype
}

// 具体原型：图形对象
type GraphicObject struct {
    Color string
    Size  [2]int
}

func (g *GraphicObject) Clone() Prototype {
    return &GraphicObject{
        Color: g.Color,
        Size:  g.Size,
    }
}

// 客户端代码
func main() {
    originalGraphic := GraphicObject{
        Color: "red",
        Size:  [2]int{100, 100},
    }

    clonedGraphic := originalGraphic.Clone()

    fmt.Println("原始图形颜色: ", originalGraphic.Color)
    fmt.Println("原始图形大小: ", originalGraphic.Size)

    fmt.Println("克隆图形颜色: ", clonedGraphic.Color)
    fmt.Println("克隆图形大小: ", clonedGraphic.Size)
}
```
<!-- endtab -->

{% endtabs %}