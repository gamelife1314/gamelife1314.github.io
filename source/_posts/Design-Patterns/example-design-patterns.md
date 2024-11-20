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

### 建造者模式

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

### 原型模式

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


### 适配器模式

适配器模式是一种结构型设计模式，它的主要作用是将一个类的接口转换成客户期望的另一个接口，使得原本不兼容的类可以协同工作。就好比给不同规格的插头（被适配者）配上对应的转换插头（适配器），使其能插入特定的插座（客户端期望的接口）。

适配器模式适用以下场景：

- 系统集成：当需要将新开发的系统与现有遗留系统进行集成时，新系统和遗留系统的接口可能不兼容。例如，新开发的支付系统使用的是基于 RESTful API 的接口规范，而公司现有的财务系统使用的是基于 SOAP 协议的接口，通过适配器模式可以创建一个适配器，将新支付系统的接口适配成财务系统能够理解和处理的接口形式，从而实现两者的集成。

- 第三方库使用：在使用第三方库时，其提供的接口可能与项目中其他部分所期望的接口不一致。比如，项目中使用的图形绘制框架期望接收以某种特定格式（如结构体数组）表示的图形数据，而引入的一个第三方图形库返回的图形数据格式是对象链表，这时就可以利用适配器模式创建一个适配器类，将第三方库返回的数据格式转换为项目框架所期望的格式。


该模式具有以下特点：

- 接口转换：适配器模式的核心功能是实现接口的转换，让原本不兼容的接口能够相互适配，使得不同接口规范的类或系统可以协同工作。
- 复用性：一旦创建了合适的适配器，它可以在多个需要进行相同接口转换的场景中被复用，提高了代码的复用率。
- 解耦：通过适配器将不兼容的部分隔离开来，使得客户端代码不需要了解被适配对象的具体实现细节，降低了客户端与被适配对象之间的耦合度。

适配器模式遵循以下设计原则：

- 开闭原则：对扩展开放，对修改关闭。当需要适配新的不兼容接口时，只需创建新的适配器类来实现接口转换，而不需要修改客户端代码和被适配对象的原有实现。
- 依赖倒置原则：高层模块（客户端）不依赖于低层模块（被适配对象的具体实现），而是依赖于抽象（适配器接口和被适配对象的抽象接口，如果有的话）。这样可以提高代码的灵活性，便于在不同场景下替换不同的适配器或被适配对象。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NU3vxtRC5xS_wbZxjNyoLcLUIMfIMc9og499Ob9vQeb3DfG04HQc5fQd59HgQ2bOAmIL5cNdfNBL0hIyMhNxPqFIojVT5GojNSavYSR62OqfYGKbgAbIVTd51Qd9cMcPoFDG4k7uqQHmMG4n_EdC5Ykb5CDCJePPPmQo526Cr36ZQqzRDppVlve8QegTNOmVr9L3TqtNpdlTjWCafwEhQmRrY1TBued7A-pqTSFSyxMbzEc4ril-11ZpPr_r-JoUNGsfU2Z1e0G00)查看适配器设计模式的UML图。


{% tabs 适配器模式 %}
<!-- tab Rust -->
```rust
// 目标接口，客户端期望的接口形式
trait Target {
    fn request(&self) -> String;
}

// 被适配者，现有不兼容的接口形式
struct Adaptee {
    specific_request: String,
}

impl Adaptee {
    fn specific_request(&self) -> String {
        self.specific_request.clone()
    }
}

// 适配器
struct Adapter {
    adaptee: Adaptee,
}

impl Adapter {
    fn new(adaptee: Adaptee) -> Self {
        Adapter { adaptee }
    }
}

impl Target for Adapter {
    fn request(&self) -> String {
        // 在这里进行接口转换，将被适配者的接口调用结果转换为目标接口期望的形式
        let result = self.adaptee.specific_request();
        format!("Adapter: {}", result)
    }
}

// 客户端代码
fn main() {
    let adaptee = Adaptee {
        specific_request: String::from("原始请求数据"),
    };

    let adapter = Adapter::new(adaptee);

    let result = adapter.request();

    println!("{}", result);
}
```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import "fmt"

// 目标接口，客户端期望的接口形式
type Target interface {
    Request() string
}

// 被适配者，现有不兼容的接口形式
type Adaptee struct {
    SpecificRequest string
}

func (a *Adaptee) SpecificRequest() string {
    return a.SpecificRequest
}

// 适配器
type Adapter struct {
    Adaptee *Adaptee
}

func (a *Adapter) New(adaptee *Adaptee) *Adapter {
    return &Adapter{Adaptee: adaptee}
}

func (a *Adapter) Request() string {
    // 在这里进行接口转换，将被适配者的接口调用结果转换为目标接口期望的形式
    result := a.Adaptee.SpecificRequest()
    return fmt.Sprintf("Adapter: %s", result)
}

// 客户端代码
func main() {
    adaptee := &Adaptee{
        SpecificRequest: "原始请求数据",
    }

    adapter := &Adapter{}.New(adaptee)

    result := adapter.Request()

    fmt.Println(result)
}
```
<!-- endtab -->
{% endtabs %}

### 桥接模式

桥接模式是一种结构型设计模式，它将抽象部分与它的实现部分分离，使它们可以独立地变化。通过提供抽象化和实现化之间的桥接结构，使得在系统扩展或变化时，能够灵活地组合不同的抽象和实现，而不需要修改大量的现有代码。

桥接模式适用以下场景：

- 图形绘制系统：在图形绘制系统中，有不同类型的图形（如圆形、矩形、三角形等），并且每种图形可以有不同的绘制方式（如使用不同的图形库、不同的渲染算法等）。可以使用桥接模式，将图形的抽象概念（如形状接口）与具体的绘制实现（如不同的绘制算法类）分离，这样当需要添加新的图形类型或新的绘制方式时，只需要分别在对应的抽象和实现部分进行扩展，而不会影响到其他部分的代码。
- 跨平台应用开发：对于需要在不同操作系统平台（如 Windows、Mac、Linux）上运行的应用程序，并且在不同平台上有不同的实现方式（如窗口管理、文件系统操作等）。通过桥接模式，可以将应用程序的业务逻辑抽象（如界面布局、功能模块等）与具体的平台实现分离，使得在支持新的平台或对现有平台的实现进行修改时，能够更方便地进行操作，而不会对业务逻辑造成太大的影响。

桥接模式具有以下特点：

- 分离抽象和实现：将抽象部分与实现部分解耦，使得它们能够独立发展和变化，一方的改变不会直接影响到另一方，提高了代码的灵活性和可维护性。
- 可扩展性：方便添加新的抽象类型或新的实现方式，只需要按照桥接模式的结构创建新的类并实现相应的接口，就可以轻松地将新的抽象和实现组合在一起，而不需要对现有代码进行大规模的修改。
- 符合开闭原则：对扩展开放，对修改关闭。当有新的需求时，通过添加新的类来满足，而不是修改现有的核心代码，使得系统能够更好地适应变化。

该模式遵循以下设计原则：

- 开闭原则：如前面所述，在需要扩展系统功能时，通过添加新的抽象类或实现类来实现，而不修改现有代码，保证了系统对扩展开放，对修改关闭。
- 依赖倒置原则：高层模块（如使用桥接模式的客户端）不依赖于低层模块（具体的抽象和实现类）的具体实现，而是依赖于抽象（抽象类和接口）。这样可以提高代码的灵活性，便于在不同场景下替换不同的抽象和实现组合。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XI-RLppjQ7k_PzRJlOkUTsrxrhVqQVzYhioyajIYjCJaL8NWZCI2L8LgBWKWI2bABDVGvAe5QdxQklt9tiaGFK_NpNlUjm5an9mse0XNSavYSR62SsPHSWvCftPHQbvAQb5gaPL249G54ITavFFvA-560hKcboJcfPDaAiGak2-VxTZqRFxafpDNe7iKRWBKR8ZHySbWNsXe8eiLmPo1ud2uoN2t-nUavhdxmCMXde28ejccZSqwRHBj2olDoKxCGxSF8ag-VM0BDp_Vl9iB4gDwUZLsq5HX1GrTBcZ4O9T4zJ1O1Oo3K0Hn9G55q2IbguigsRhvHUEKztiw8CdlQK_hqmchaKFdoRxkztiwOOx4Om0miQ4Pa5g4qEy0r07CEG00)查看桥接模式的UML图。

{% tabs 桥接模式 %}
<!-- tab Rust-->
```Rust
use std::rc::Rc;

// 抽象部分：形状接口
trait Shape {
    fn draw(&self);
}

// 具体形状实现：圆形
struct Circle {
    renderer: Rc<dyn Renderer>,
}

impl Shape for Circle {
    fn draw(&self) {
        self.renderer.render_circle();
    }
}

// 具体形状实现：矩形
struct Rectangle {
    renderer: Rc<dyn Renderer>,
}

impl Shape for Rectangle {
    fn draw(&self) {
        self.renderer.render_rectangle();
    }
}

// 实现部分：渲染器接口
trait Renderer {
    fn render_circle(&self);
    fn render_rectangle(&self);
}

// 具体渲染器实现：OpenGL渲染器
struct OpenGLRenderer;

impl Renderer for OpenGLRenderer {
    fn render_circle(&self) {
        println!("使用OpenGL渲染圆形");
    }

    fn render_rectangle(&self) {
        println!("使用OpenGL渲染矩形");
    }
}

// 具体渲染器实现：Vulkan渲染器
struct VulkanRenderer;

impl Renderer for VulkanRenderer {
    fn render_circle(&self) {
        println!("使用Vulkan渲染圆形");
    }

    fn render_rectangle(&self) {
        println!("使用Vulkan渲染矩形");
    }
}

// 客户端代码
fn main() {
    let opengl_renderer = Rc::new(OpenGLRenderer);
    let vulkan_renderer = Rc::new(VulkanRenderer);

    let circle_with_opengl = Circle {
        renderer: opengl_renderer.clone(),
    };
    let rectangle_with_opengl = Rectangle {
        renderer: opengl_renderer.clone(),
    };

    let circle_with_vulkan = Circle {
        renderer: vulkan_renderer.clone(),
    };
    let rectangle_with_vulkan = Rectangle {
        renderer: vulkan_renderer.clone(),
    };

    circle_with_opengl.draw();
    rectangle_with_opengl.draw();

    circle_with_vulkan.draw();
    rectangle_with_vulkan.draw();
}
```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import "fmt"

// 抽象部分：形状接口
type Shape interface {
    Draw()
}

// 具体形状实现：圆形
type Circle struct {
    Renderer Renderer
}

func (c *Circle) Draw() {
    c.Renderer.RenderCircle()
}

// 具体形状实现：矩形
type Rectangle struct {
    Renderer Renderer
}

func (r *Rectangle) Draw() {
    r.Renderer.RenderRectangle()
}

// 实现部分：渲染器接口
type Renderer interface {
    RenderCircle()
    RenderRectangle()
}

// 具体渲染器实现：OpenGL渲染器
type OpenGLRenderer struct{}

func (o *OpenGLRenderer) RenderCircle() {
    fmt.Println("使用OpenGL渲染圆形")
}

func (o *OpenGLRenderer) RenderRectangle() {
    fmt.Println("使用OpenGL渲染矩形")
}

// 具体渲染器实现：Vulkan渲染器
type VulkanRenderer struct{}

func (v *VulkanRenderer) RenderCircle() {
    fmt.Println("使用Vulkan渲染圆形")
}

func (v *VulkanRenderer) RenderRectangle() {
    fmt.Println("使用Vulkan渲染矩形")
}

// 客户端代码
func main() {
    openglRenderer := &OpenGLRenderer{}
    vulkanRenderer := &VulkanRenderer{}

    circleWithOpenGL := &Circle{
        Renderer: openglRenderer,
    }
    rectangleWithOpenGL := &Rectangle{
        Renderer: openglRenderer,
    }

    circleWithVulkan := &Circle{
    Renderer: vulkanRenderer,
    }
    rectangleWithVulkan := &Rectangle{
    Renderer: vulkanRenderer,
    }

    circleWithOpenGL.Draw()
    rectangleWithOpenGL.Draw()

    circleWithVulkan.Draw()
    rectangleWithVulkan.Draw()
}
```
<!-- endtab -->
{% endtabs %}

### 组合模式

组合设计模式是一种结构型设计模式，它允许将对象组合成树形结构来表示 “部分 - 整体” 的层次关系。在该模式中，单个对象（叶子节点）和由对象组成的组合对象（树枝节点）都可以被统一对待，客户端可以以一致的方式处理它们，而无需区分是单个对象还是组合对象。

该模式具有以下的适用场景（但不局限于此）：

- 文件系统：文件系统是典型的树形结构，文件和文件夹可以看作是组合模式中的对象。文件相当于叶子节点，文件夹相当于组合节点，文件夹可以包含文件和其他文件夹。通过使用组合模式，在遍历文件系统、计算文件大小总和、权限管理等操作时，可以用统一的方式处理文件和文件夹，而不需要针对文件和文件夹分别编写不同的处理逻辑。
- 组织结构图：企业或组织的组织结构通常呈现出树形结构，员工可以看作是叶子节点，部门可以看作是组合节点，部门可以包含员工以及其他子部门。采用组合模式，在进行人员统计、权限分配、组织架构展示等操作时，能够以相同的方式对待员工和部门，简化了代码逻辑和处理流程。


该模式具有如下特点：

- 统一处理：客户端可以用相同的操作方式处理单个对象（叶子节点）和组合对象（树枝节点），无需关心对象的具体类型是单个还是组合的，提高了代码的简洁性和可维护性。
- 树形结构表示：以树形结构清晰地表示出 “部分 - 整体” 的层次关系，便于理解和管理复杂的对象关系，如文件系统中的文件与文件夹的嵌套关系、组织结构图中的员工与部门的隶属关系等。
- 递归处理：由于对象组合成树形结构，很多操作（如遍历、计算等）往往需要采用递归的方式进行，这种递归处理方式能够自然地适应组合模式的树形结构特点，有效地处理各级对象。

组合模式遵循以下设计原则：

- 开闭原则：对扩展开放，对修改关闭。当需要添加新的类型的对象（如在文件系统中新增一种特殊文件类型，或在组织结构图中新增一种特殊部门类型）时，只需创建新的类实现相应的接口或继承自相关基类，并按照组合模式的结构进行组合即可，无需修改现有的客户端代码和核心处理逻辑。
- 依赖倒置原则：高层模块（如进行文件系统操作或组织架构管理的客户端代码）不依赖于低层模块（具体的文件、文件夹、员工、部门等对象的实现）的具体实现，而是依赖于抽象（抽象的组件接口、文件或员工等的抽象类或接口）。这样可以提高代码的灵活性，便于在不同场景下替换不同的具体对象实现，而不影响客户端代码的正常运行。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XSztjppPlUrPtzAd_OkvClDAKelI4fDJ5PppSmloyrBpIXIgkHI08ByWjIYn93C_JqEJgnQe-Md_jgTh9xpeQdhUjFFzdbdFfhK3JU5ApaaiBbPmoyn9XMhJpalCJRLI22ufoinBXuYWcmHqmDC97MWcFLso4sPOVavAQX5kuv8pCdDIYbBph11EZex5PXF8qQsRds_UpGLodvvUZHsI9wqKdgwRzxnl0nV4Eloo2bgwkiYoK2-ytzC1T_pJdjQd4rP3mXQezyc-xcTJDm2vx_VqFDax6MZKo-OLJplQ57GLdatT0XI1kEpzdaukXzIy563y0000)查看组合模式的UML关系图。

{% tabs 组合模式 %}
<!-- tab Rust -->
```Rust
// 抽象组件接口，用于统一处理叶子节点和组合节点
trait Component {
    fn operation(&self);
}

// 叶子节点：文件
struct File {
    name: String,
}

impl Component for File {
    fn operation(&self) {
        println!("正在处理文件: {}", self.name);
    }
}

// 组合节点：文件夹
struct Folder {
    name: String,
    children: Vec<Box<dyn Component>>,
}

impl Component for Folder {
    fn operation(&self) {
        println!("正在处理文件夹: {}", self.name);
        for child in &self.children {
            child.operation();
        }
    }
}

// 客户端代码
fn main() {
    let file1 = File {
        name: String::from("file1.txt"),
    };
    let file2 = File {
        name: String::from("file2.txt"),
    };

    let folder1 = Folder {
        name: String::from("folder1"),
        children: vec![
            Box::new(file1),
            Box::new(file2),
        ],
    };

    let file3 = File {
        name: String::from("file3.txt"),
    };

    let folder2 = Folder {
        name: String::from("folder2"),
        children: vec![
            Box::new(folder1),
            Box::new(file3),
        ],
    };

    folder2.operation();
}
```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import "fmt"

// 抽象组件接口，用于统一处理叶子节点和组合节点
type Component interface {
    Operation()
}

// 叶子节点：文件
type File struct {
    Name string
}

func (f *File) Operation() {
    fmt.Printf("正在处理文件: %s\n", f.Name)
}

// 组合节点：文件夹
type Folder struct {
    Name     string
    Children []Component
}

func (f *Folder) Operation() {
    fmt.Printf("正在处理文件夹: %s\n", f.Name)
    for _, child := range f.Children {
    child.Operation()
    }
}

// 客户端代码
func main() {
    file1 := &File{
        Name: "file1.txt",
    }
    file2 := &File{
        Name: "file2.txt",
    }

    folder1 := &Folder{
        Name: "folder1",
        Children: []Component{
            file1,
            file2,
    },
    }

    file3 := &File{
        Name: "file3.txt",
    }

    folder2 := &Folder{
        Name: "folder2",
        Children: []Component{
            folder1,
            file3,
    },
    }

    folder2.Operation()
}
```
<!-- endtab -->
{% endtabs %}

### 装饰器模式

装饰器设计模式是一种结构型设计模式，它允许在不改变原有对象结构和行为的基础上，动态地给对象添加额外的功能。通过将功能的扩展从对象本身的类中分离出来，使用装饰器类来包裹原始对象，从而实现对对象功能的逐步增强。

该模式具有以下的应用场景：

- 输入输出流处理：在处理文件读写、网络数据传输等场景中，例如对文件读取操作，可能需要在基本的读取功能基础上，添加缓存功能以提高读取效率，或者添加加密功能以保证数据安全。可以使用装饰器模式，将缓存、加密等功能作为装饰器添加到基本的文件读取流对象上，而无需修改原有的文件读取类。
- 图形绘制扩展：在图形绘制系统中，对于基本的图形绘制对象，如绘制一个简单的圆形，可能后续需要添加额外的效果，比如给圆形添加阴影效果、发光效果等。通过装饰器模式，可以将这些额外效果的实现作为装饰器，动态地添加到基本的圆形绘制对象上，灵活地扩展图形的绘制功能。

该模式具有以下特点：

- 动态扩展功能：能够在运行时根据需要动态地给对象添加新的功能，而不是在编译时就确定好所有功能。这使得系统更加灵活，可以根据不同的使用场景和需求灵活组合各种功能。
- 保持对象接口一致性：装饰器类和被装饰的原始对象实现相同的接口，这样对于客户端来说，无论是使用原始对象还是经过装饰后的对象，调用方式都是一样的，不需要对客户端代码进行修改来适应装饰后的对象。
- 可叠加性：可以将多个装饰器依次应用到一个对象上，实现多种功能的叠加。例如，既可以给文件读取流添加缓存装饰器，又可以在其上再添加加密装饰器，从而实现既有缓存又有加密的文件读取功能。

遵循以下设计原则：

- 开闭原则：对扩展开放，对修改关闭。当需要添加新的功能时，只需创建新的装饰器类实现与原始对象相同的接口，并在装饰器类中实现新的功能逻辑，而不需要修改原始对象的类以及使用该对象的客户端代码。
- 单一职责原则：每个装饰器类只负责添加一种特定的功能，使得功能的扩展更加清晰和易于维护。例如，缓存装饰器只负责处理缓存相关的逻辑，加密装饰器只负责加密相关的逻辑。

点击[链接](//www.plantuml.com/plantuml/png/SoWkIImgAStDuL9NUDQrzyN6XSztjppPlUrPtzAd_OkvClDAKelI4fDJ5PppSmloyrBpIXIgkHI08BKYDRcq95L3awiMgFLfw_OdUoT3j78bvoGM5olufPQKvnTb1wKMbgOMmtHfbnRbM2a4bnHbvgL3179JIpBoKr35aCo6E-l5ujQNIpSydRa2oKqkgSdvHOab-KLGqzDJI-AJOUxKqBH2E1gda-76ljypwzdstK-x5ZpVC_dfsXbFk-Q_QDuBzOfpOd86q77ercd3xKAo2Ie3r95gfU2HM9pXcrXW0_6S3jIJTX0r15ohJPnpdqrV-dJ_z1VhDZpTEnN5qJxvwUd4Effq1u5TjFdvvjrSgF6ifrTZXvHMh1IUhfltl6y35teGubA7xcgIp8FpqCqZh0uZYdLrqUnjtVoYSShxFHtmA7ZMq_XiJkUBHQkX8kjt0fCfqBWd-xhVx-a4sqnT4nrIyrA0EHK0)查看装饰器模式UML类的关系图。

{% tabs 装饰器模式 %}
<!-- tab Rust -->
```Rust
// 抽象组件接口，被装饰对象和装饰器都要实现这个接口
trait Component {
    fn execute(&mut self) -> String;

    fn get_cache_key(&self) -> String;
}

// 具体组件：代表一个基础的网络请求操作
struct NetworkRequest {
    url: String,
    method: String,
}

impl Component for NetworkRequest {
    fn execute(&mut self) -> String {
        format!("正在执行网络请求：{} - {}", self.method, self.url)
    }

    fn get_cache_key(&self) -> String {
        format!("{}-{}", self.method, self.url)
    }
}

// 抽象装饰器，实现Component接口，并持有一个Component类型的对象
trait Decorator: Component {
    fn get_component(&self) -> &dyn Component;
}

// 具体装饰器：添加缓存功能
struct CachingDecorator {
    component: Box<dyn Component>,
    cache: std::collections::HashMap<String, String>,
}

impl Decorator for CachingDecorator {
    fn get_component(&self) -> &dyn Component {
        self.component.as_ref()
    }
}

impl Component for CachingDecorator {
    fn execute(&mut self) -> String {
        let mut result = String::new();
        let cache_key = self.component.get_cache_key();
        if let Some(cached_result) = self.cache.get(&cache_key) {
            println!("从缓存中获取结果：{}", cached_result);
        } else {
            result = self.component.execute();
            self.cache.insert(cache_key.clone(), result.clone());
            println!("缓存新结果：{}", result);
        }
        result
    }

    fn get_cache_key(&self) -> String {
        self.component.get_cache_key()
    }
}

// 具体装饰器：添加日志记录功能
struct LoggingDecorator {
    component: Box<dyn Component>,
}

impl Decorator for LoggingDecorator {
    fn get_component(&self) -> &dyn Component {
        self.component.as_ref()
    }
}

impl Component for LoggingDecorator {
    fn execute(&mut self) -> String {
        println!("开始执行操作，时间：{}", chrono::Local::now());
        let result = self.component.execute();
        println!("操作执行完毕，时间：{}", chrono::Local::now());
        result
    }

    fn get_cache_key(&self) -> String {
        self.component.get_cache_key()
    }
}

// 客户端代码
fn main() {
    let network_request = NetworkRequest {
        url: "https://example.com/api/data".to_string(),
        method: "GET".to_string(),
    };

    let cached_network_request = CachingDecorator {
        component: Box::new(network_request),
        cache: std::collections::HashMap::new(),
    };

    let mut logged_cached_network_request = LoggingDecorator {
        component: Box::new(cached_network_request),
    };

    logged_cached_network_request.execute();
}

```
这将输出：

    开始执行操作，时间：2024-11-20 19:52:39.739845100 +08:00
    缓存新结果：正在执行网络请求：GET - https://example.com/api/data
    操作执行完毕，时间：2024-11-20 19:52:39.740418900 +08:00

<!-- endtab -->
<!-- tab Go -->
```Go
package main

import (
	"fmt"
	"time"
)

// 抽象组件接口，被装饰对象和装饰器都要实现这个接口
type Component interface {
	Execute()
}

// 具体组件：代表一个基础的网络请求操作
type NetworkRequest struct {
	URL    string
	Method string
}

func (n *NetworkRequest) Execute() {
	fmt.Printf("正在执行网络请求：%s - %s\n", n.Method, n.URL)
}

// 抽象装饰器，实现Component接口，并持有一个Component类型的对象
type Decorator interface {
	Component
	GetComponent() Component
}

// 具体装饰器：添加缓存功能
type CachingDecorator struct {
	Component Component
	Cache     map[string]string
}

func (c *CachingDecorator) GetComponent() Component {
	return c.Component
}

func (c *CachingDecorator) Execute() {
	cacheKey := fmt.Sprintf("%v-%s", c.Component.(*NetworkRequest).Method, c.Component.(*NetworkRequest).URL)
	if result, ok := c.Cache[cacheKey]; ok {
		fmt.Printf("从缓存中获取结果：%s\n", result)
	} else {
		c.Component.Execute()
		result := "模拟网络请求结果"
		c.Cache[cacheKey] = result
		fmt.Printf("缓存新结果：%s\n", result)
	}
}

// 具体装饰器：添加日志记录功能
type LoggingDecorator struct {
	Component Component
}

func (l *LoggingDecorator) GetComponent() Component {
	return l.Component
}

func (l *LoggingDecorator) Execute() {
	fmt.Printf("开始执行操作，时间：%v\n", time.Now())
	l.Component.Execute()
	fmt.Printf("操作执行完毕，时间：%v\n", time.Now())
}

// 客户端代码
func main() {
	networkRequest := &NetworkRequest{
		URL:    "https://example.com/api/data",
		Method: "GET",
	}

	cachedNetworkRequest := &CachingDecorator{
		Component: networkRequest,
		Cache:     make(map[string]string),
	}

	loggedCachingNetworkRequest := &LoggingDecorator{
		Component: cachedNetworkRequest,
	}

	loggedCachingNetworkRequest.Execute()
}
```
<!-- endtab -->
{% endtabs %}

### 外观设计模式

外观设计模式是一种结构型设计模式，它为复杂的子系统提供了一个简化的、统一的接口，隐藏了子系统内部的复杂性和实现细节。客户端只需要与这个外观接口进行交互，而无需了解子系统中各个具体类的复杂操作和相互关系，就如同为复杂的机器设备提供了一个简单易用的控制面板，用户通过控制面板上的几个按钮就能完成一系列复杂的操作，而不需要深入了解机器内部各个零部件的具体运作原理。

该模式具有以下应用场景：

- 复杂系统集成：当需要将多个不同的子系统集成在一起使用时，这些子系统可能各自具有复杂的接口和交互逻辑。例如，在一个智能家居系统中，包含了照明系统、温度控制系统、安防系统等多个子系统，每个子系统都有自己的一套控制接口和操作方式。通过使用外观设计模式，可以创建一个智能家居外观类，为用户提供诸如 “开启家居模式”“关闭家居模式” 等简单统一的操作接口，在这些接口的实现中协调各个子系统的具体操作，使得用户无需分别了解每个子系统的详细控制方法就能方便地控制整个智能家居系统。
- 简化第三方库使用：在使用一些功能强大但接口复杂的第三方库时，为了让项目中的其他开发人员能够更轻松地使用这些库的功能，可以应用外观设计模式。比如，一个图像处理库可能提供了众多用于图像加载、处理、保存等的细粒度接口，但对于项目中只需要进行一些基本图像处理操作（如加载图像、调整亮度、保存图像）的开发人员来说，这些接口过于复杂。此时可以创建一个外观类，将这些基本操作封装成几个简单的方法，如 “简单处理图像” 方法，在这个方法内部调用图像处理库的相关接口来完成一系列操作，这样其他开发人员只需调用外观类的简单方法即可，无需深入了解图像处理库的复杂接口。

该模式具有以下特点：

- 简化接口：提供了一个简洁、统一的接口给客户端，隐藏了子系统的复杂性，降低了客户端使用子系统的难度，使得客户端代码更加简洁明了，易于理解和维护。
- 解耦客户端与子系统：客户端只依赖于外观类，而不直接依赖于子系统中的各个具体类，这样当子系统内部发生变化（如某个子系统的接口修改、新增或删除某个子系统等）时，只要外观类的接口保持不变，客户端代码通常不需要进行大量修改，提高了系统的可维护性和可扩展性。
- 封装子系统逻辑：在外观类中封装了子系统的复杂逻辑和交互过程，将原本分散在多个子系统中的操作整合在一起，按照一定的业务逻辑顺序进行调用，使得整个系统的业务流程更加清晰，便于管理和控制。

该模式遵循以下设计原则：

- 迪米特法则：只与你的直接朋友交流，不与“陌生人”交谈。外观模式通过提供一个简化的接口，减少了客户端与子系统之间的交互。
- 单一职责原则：外观类具有单一职责，即提供子系统的简化接口。

打开[链接](//www.plantuml.com/plantuml/png/XL8_IyD05D_pAR9PaGwsMmOf2EBWLlTmDgzj99UJkyjGn46XqAAK3YB5GHUnY5ZGWeWjVXglgLE_Wg-cqUHgIRPxx-Ntv_TUIKZ2PK0zOyrKJzrmE0f7jvkpyNNOx4zwdUXjL3mYXBddrkhIzMlbXf10pMF3n6_35JRpBVE0CIygo83xMCgj9v_LAhvFaYG599cyFQZt-qcdhrglAQfze4V02VuBsyoNd7bfqah0EVZIbdzpbbaj5XQKXDTWLLDWPtaW5vL-vXR2YNCOYDIGRg685jIW_TLxIOal0yfpPMCf9y8fECcei137vBW2Np73tTMqVnO-Zs94YalQPHHsI8Ku44DwYuLOscgYRjB-oa3ZJ2B5bgOzjL2xZW9ioXpGLvlieFwvWUOG8p5qtVdybdv5rdnsUdev6xT-NQkBfke-9YzG3Mu-Fyvdu_Q_aClcCi6roykaY7F918xkGOSiWUy4rFi6)查看外观模式的UML类之间的关系。

{% tabs 外观设计模式 %}
<!-- tab Rust -->
```Rust
// 子系统1：照明系统
struct LightingSystem {
    is_on: bool,
}

impl LightingSystem {
    fn new() -> Self {
        LightingSystem { is_on: false }
    }

    fn turn_on(&mut self) {
        self.is_on = true;
        println!("照明系统已开启");
    }

    fn turn_off(&mut self) {
        self.is_on = false;
        println!("照明系统已关闭");
    }
}

// 子系统2：温度控制系统
struct TemperatureControlSystem {
    current_temperature: f32,
    target_temperature: f32,
}

impl TemperatureControlSystem {
    fn new() -> Self {
        TemperatureControlSystem {
            current_temperature: 25.0,
            target_temperature: 22.0,
        }
    }

    fn set_target_temperature(&mut self, target: f32) {
        self.target_temperature = target;
        println!("设置目标温度为 {}", target);
    }

    fn adjust_temperature(&mut self) {
        if self.current_temperature > self.target_temperature {
            println!("温度控制系统正在降温");
        } else if self.current_temperature < self.target_temperature {
            println!("温度控制系统正在升温");
        } else {
            println!("温度已达到目标温度");
        }
    }
}

// 子系统3：安防系统
struct SecuritySystem {
    is_armed: bool,
}

impl SecuritySystem {
    fn new() -> Self {
        SecuritySystem { is_armed: false }
    }

    fn arm(&mut self) {
        self.is_armed = true;
        println!("安防系统已设防");
    }

    fn disarm(&mut self) {
        self.is_armed = false;
        println!("安防系统已撤防");
    }
}

// 外观类
struct SmartHomeFacade {
    lighting: LightingSystem,
    temperature: TemperatureControlSystem,
    security: SecuritySystem,
}

impl SmartHomeFacade {
    fn new() -> Self {
        SmartHomeFacade {
            lighting: LightingSystem::new(),
            temperature: TemperatureControlSystem::new(),
            security: SecuritySystem::new(),
        }
    }

    fn turn_on_home_mode(&mut self) {
        self.lighting.turn_on();
        self.temperature.set_target_temperature(22.0);
        self.security.arm();
    }

    fn turn_off_home_mode(&mut self) {
        self.lighting.turn_off();
        self.temperature.set_target_temperature(25.0);
        self.security.disarm();
    }
}

// 客户端代码
fn main() {
    let mut smart_home = SmartHomeFacade::new();

    smart_home.turn_on_home_mode();

    smart_home.turn_off_home_mode();
}
```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import "fmt"

// 子系统1：照明系统
type LightingSystem struct {
    IsOn bool
}

func NewLightingSystem() *LightingSystem {
    return &LightingSystem{IsOn: false}
}

func (l *LightingSystem) TurnOn() {
    l.IsOn = true
    fmt.Println("照明系统已开启")
}

func (l *LightingSystem) TurnOff() {
    l.IsOn = false
    fmt.Println("照明系统已关闭")
}

// 子系统2：温度控制系统
type TemperatureControlSystem struct {
    CurrentTemperature float32
    TargetTemperature  float32
}

func NewTemperatureControlSystem() *TemperatureControlSystem {
    return &TemperatureControlSystem{
        CurrentTemperature: 25.0,
        TargetTemperature:  22.0,
    }
}

func (t *TemperatureControlSystem) SetTargetTemperature(target float32) {
    t.TargetTemperature = target
    fmt.Println("设置目标温度为", target)
}

func (t *TemperatureControlSystem) AdjustTemperature() {
    if t.CurrentTemperature > t.TargetTemperature {
        fmt.Println("温度控制系统正在降温")
    } else if t.CurrentTemperature < t.TargetTemperature {
        fmt.Println("温度控制系统正在升温")
    } else {
        fmt.Println("温度已达到目标温度")
    }
}

// 子系统3：安防系统
type SecuritySystem struct {
    IsArmed bool
}

func NewSecuritySystem() *SecuritySystem {
    return &SecuritySystem{IsArmed: false}
}

func (s *SecuritySystem) Arm() {
    s.IsArmed = true
    fmt.Println("安防系统已设防")
}

func (s *SecuritySystem) Disarm() {
    s.IsArmed = false
    fmt.Println("安防System已撤防")
}

// 外观类
type SmartHomeFacade struct {
    Lighting    *LightingSystem
    Temperature *TemperatureControlSystem
    Security    *SecuritySystem
}

func NewSmartHomeFacade() *SmartHomeFacade {
    return &SmartHomeFacade{
        Lighting:    NewLightingSystem(),
        Temperature: NewTemperatureControlSystem(),
        Security:    NewSecuritySystem(),
    }
}

func (s *SmartHomeFacade) TurnOnHomeMode() {
    s.Lighting.TurnOn()
    s.Temperature.SetTargetTemperature(22.0)
    s.Security.Arm()
}

func (s *SmartHomeFacade) TurnOffHomeMode() {
    s.Lighting.TurnOff()
    s.Temperature.SetTargetTemperature(25.0)
    s.Security.Disarm()
}

// 客户端代码
func main() {
    smartHome := NewSmartHomeFacade()

    smartHome.TurnOnHomeMode()

    smartHome.TurnOffHomeMode()
}
```
<!-- endtab -->
{% endtabs %}


### 享元模式

享元设计模式是一种结构型设计模式，它主要用于通过共享对象来减少内存使用和提高性能。其核心思想是将对象的状态分为内部状态和外部状态，内部状态是对象可共享的部分，不随环境变化而改变；外部状态是对象依赖于具体场景而变化的部分，通过在运行时将外部状态传递给共享对象来实现不同场景下的特定功能。这样可以避免创建大量相似的对象，而是共享那些具有相同内部状态的对象，从而节省内存空间。

该模式具有以下应用场景：

- 图形绘制系统：在图形绘制应用中，比如绘制一幅地图，地图上可能有大量相同类型的图形元素，如众多的树木图标、建筑物图标等。这些图标在外观和基本属性上是相同的（内部状态相同），只是在地图中的位置等信息不同（外部状态不同）。使用享元设计模式，可以创建一个图形元素的享元对象池，将相同类型的图形元素共享使用，只在绘制时根据具体位置等外部状态信息进行相应的绘制操作，大大减少了内存中图形对象的数量，提高了绘制效率。
- 文本处理系统：在处理文档排版等文本处理任务时，可能会频繁使用到一些相同样式的字符格式，如某种字体、字号、颜色的文字。这些具有相同样式的文字可以看作是具有相同内部状态的对象，而它们在文档中的具体位置则是外部状态。通过享元设计模式，创建一个字符格式的享元对象池，共享这些相同样式的字符格式对象，在排版时根据文字在文档中的具体位置等外部状态来应用相应的格式，既能节省内存，又能提高文本处理的效率。

该模式具有以下特点：

- 共享对象：通过识别对象可共享的内部状态，将具有相同内部状态的对象进行共享，避免了重复创建大量相似对象，有效减少了内存占用。
- 分离状态：明确区分对象的内部状态和外部状态，内部状态存储在共享对象中，外部状态在运行时传递给共享对象，使得共享对象能够根据不同的外部状态实现多样化的功能。
- 提高性能：由于减少了对象的创建数量，降低了内存开销，同时在某些情况下（如频繁创建和销毁相似对象的场景）还能减少对象创建和销毁的时间开销，从而提高了系统的整体性能。

遵循以下设计原则：

- 单一职责原则：享元模式通过分离内部状态和外部状态，使得享元对象只负责内部状态的管理，符合单一职责原则。
- 开闭原则：享元模式通过扩展内部状态来适应新的需求，而不需要修改现有的享元对象，符合开闭原则。

打开[链接](//www.plantuml.com/plantuml/png/ZP9T2z9G6CVlpwSuTzdB_00IuatMJLTz03cieuxcbEr8IGcPpLR8b58l9eGMWY1OCi5yiRwCppQl_0eT7NCw2ThLTixpxFTx_ZmfZH6LbGiokeDtgmdeTVYnz6P3rthlVDho5ySSGUixaXH6rImHAKxBbPTKokKPVeqmVuebgX8c5PKOVSLKIT4aCQCnmcW2Fpj-v-wYAlyvw8lTziibuh2neFyRjj_uYJiV-5T8b8ccuSSgAUKbyP5C2rHXKUJzaur2v6kGV_T_Fi6mYn6OxmwRfjiPxrOc67rOh-1pqvqEtNRZqjQP3NotC80q4LbHhGHIsU1SI-0dHCi_9QM7Fl51s9FqQtEKPSxriHUqSfR3YR0OLT4fETkrr-WVaSJZRv9X1--6wLVN_8bkB0KXKgVRNgrps1YNITpEpRFPlxMyFnyySm6jdjDREdOtwFruYxad25SOhsP1suXWeAb3UnA9bvFuXd1tfpi_hielSryVWz7mvp_2KbHvNYx8Vm40)查看享元模式的UML类图。

{% tabs 享元设计模式 %}

<!-- tab Rust -->
```Rust
use std::collections::HashMap;

// 享元对象的抽象接口
trait Flyweight {
    fn operation(&self, extrinsic_state: &str);
}

// 具体享元对象：图形元素享元
struct GraphicElementFlyweight {
    internal_state: String, // 假设这里可以存储图形元素的一些基本属性，如颜色、形状等
}

impl Flyweight for GraphicElementFlyweight {
    fn operation(&self, extrinsic_state: &str) {
        println!(
            "使用内部状态 {} 并结合外部状态 {} 进行图形元素操作",
            self.internal_state, extrinsic_state
        );
    }
}

// 享元工厂，用于创建和管理享元对象池
struct FlyweightFactory {
    flyweights: HashMap<String, Box<dyn Flyweight>>,
}

impl FlyweightFactory {
    fn new() -> Self {
        FlyweightFactory {
            flyweights: HashMap::new(),
        }
    }

    fn get_flyweight(&mut self, key: &str) -> &Box<dyn Flyweight> {
        if let Some(flyweight) = self.flyweights.get(key) {
            flyweight // 如果存在，直接返回引用
        } else {
            // 根据具体情况创建新的享元对象并放入池中
            let new_flyweight: Box<dyn Flyweight> = match key {
                "tree" => Box::new(GraphicElementFlyweight {
                    internal_state: "绿色圆形图标".to_string(),
                }),
                "building" => Box::new(GraphicElementFlyweight {
                    internal_state: "灰色矩形图标".to_string(),
                }),
                _ => panic!("未知的享元对象类型"),
            };
            self.flyweights.insert(key.to_string(), new_flyweight);
            &new_flyweight // 如果不存在，返回新创建的享元对象的引用
        }
    }
}

// 客户端代码
fn main() {
    let mut factory = FlyweightFactory::new();

    let tree_flyweight = factory.get_flyweight("tree");
    tree_flyweight.operation("地图左上角位置");

    let building_flyweight = factory.get_flyweight("building");
    building_flyweight.operation("地图右下角位置");

    // 再次获取相同类型的享元对象，验证是否共享
    let another_tree_flyweight = factory.get_flyweight("tree");
    another_tree_flyweight.operation("地图右上角位置");
}

```
<!-- endtab -->
<!-- tab Go -->
```go
package main

import (
    "fmt"
    "sync"
)

// 享元对象的抽象接口
type Flyweight interface {
    Operation(extrinsicState string)
}

// 具体享元对象：图形元素享元
type GraphicElementFlyweight struct {
    InternalState string
    // 假设这里可以存储图形元素的一些基本属性，如颜色、形状等
}

func (g *GraphicElementFlyweight) Operation(extrinsicState string) {
    fmt.Printf(
        "使用内部状态 %s 并结合外部状态 %s 进行图形元素操作\n",
        g.InternalState, extrinsicState,
    )
}

// 享元工厂，用于创建和管理享元对象池
type FlyweightFactory struct {
    flyweights map[string]Flyweight
    mutex      sync.Mutex
}

func NewFlyweightFactory() *FlyweightFactory {
    return &FlyweightFactory{
        flyweights: make(map[string]Flyweight),
    }
}

func (f *FlyweightFactory) GetFlyweight(key string) Flyweight {
    f.mutex.Lock()
    defer f.mutex.Unlock()

    if flyweight, ok := f.flyweights[key]; ok {
        return flyweight
    } else {
        // 根据具体情况创建新的享元对象并放入池中
        var newFlyweight Flyweight
        switch key {
        case "tree":
            newFlyweight = &GraphicElementFlyweight{
                InternalState: "绿色圆形图标",
            }
        case "building":
            newFlyweight = &GraphicElementFlyweight{
                InternalState: "灰色矩形图标",
            }
        default:
            panic("未知的享元对象类型")
        }
        f.flyweights[key] = newFlyweight
        return newFlyweight
    }
}

// 客户端代码
func main() {
    factory := NewFlyweightFactory()

    treeFlyweight := factory.GetFlyweight("tree")
    treeFlyweight.Operation("地图左上角位置")

    buildingFlyweight := factory.GetFlyweight("building")
    buildingFlyweight.Operation("地图右下角位置")

    // 再次获取相同类型的享元对象，验证是否共享
    anotherTreeFlyweight := factory.GetFlyweight("tree")
    anotherTreeFlyweight.Operation("地图右上角位置")
}
```
<!-- endtab -->

{% endtabs %}