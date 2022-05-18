---
title: 【Golang】幽灵数据（PhantomData）
date: 2022-05-17 23:22:16
tags:
    - phantom-data
categories:
    - rust
---

[`std::marker::PhantomData`](https://doc.rust-lang.org/std/marker/struct.PhantomData.html) 是一个零大小的类型，用于标记一些类型，这些类型看起来拥有类型 `T`，但实际上并没有：

```rust
pub struct PhantomData<T>
 where
    T: ?Sized;
```

**`Rust` 并不希望在定义类型时，出现目前还没使用，但未来会被使用的泛型参数，例如未使用的生命周期参数以及未使用的类型。**

`PhantomData` 最常见的用例可能是具有未使用的生命周期参数的结构体，例如，这儿有一个结构体 `Slice`，它有两个 `*const T` 类型的指针，可能指向某个地方的数组，我们期望 `Slice` 类型的值在生命周期 `'a` 内仅仅有效，但是如果像下面这样，`'a` 我们又无处安放：

{% note danger %}
```rust
struct Slice<'a, T> {
    start: *const T,
    end: *const T,
}
```
{% endnote %}

我们可以使用 `PhantomData` 告诉编译器就像 `Slice` 结构包含引用 `&'a T` 一样来纠正这个问题：

{% note success %}
```rust
use std::marker::PhantomData;

struct Slice<'a, T: 'a> {
    start: *const T,
    end: *const T,
    phantom: PhantomData<&'a T>,
}
```
{% endnote %}

这反过来要求 `T` 类型中的任何引用在生命周期 `'a` 内都是有效的，初始化 `Slice` 时，仅需要为 `phantom` 字段提供值 `PhantomData` 即可：

```rust
fn borrow_vec<T>(vec: &Vec<T>) -> Slice<'_, T> {
    let ptr = vec.as_ptr();
    Slice {
        start: ptr,
        end: unsafe { ptr.add(vec.len()) },
        phantom: PhantomData,
    }
}
```

<!-- more -->

### 示例一

我们现在想设计一个 `User` 和 `Product` 的结构体，它们都有数据为 `u64` 的 `id` 字段，但是我们不希望 `user.id` 和 `product.id` 可以比较：

```rust
use std::marker::PhantomData;

#[derive(Debug, Eq, PartialEq, Default)]
pub struct Identifier<T> {
    inner: u64,
    phantom: PhantomData<T>,
}

#[derive(Debug, Eq, PartialEq, Default)]
pub struct User {
    id: Identifier<Self>,
}

#[derive(Debug, Eq, PartialEq, Default)]
pub struct Product {
    id: Identifier<Self>,
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn id_should_not_be_the_same() {
        let user = User::default();
        let product = Product::default();
        // 两个 id 不能比较，因为他们属于不同的类型
        // assert_ne!(user.id, product.id);

        assert_eq!(user.id.inner, product.id.inner);
    }
}
```

`Identifier` 中 `phantom` 字段的引入让 `Identifier` 在使用时具有了不同的静态类型，但 `Identifier` 中又实际没有使用类型 `T`。

### 示例二

我们可以使用泛型结构体来实现对同一种类对象不同子类对象的区分，例如，我们的系统中要设计这样一个功能，将用户分为免费用户和付费用户，而且免费用户在体验免费功能之后，如果想升级成付费用户也是可以的。按照我们常规的思维，可能是定义两个结构体 `FreeCustomer` 以及 `PaidCustomer`，但是我们可以通过泛型结构体来实现，例如：

{% note danger %}
```rust
struct Customer<T> {
    id: u64,
    name: String,
}
```
{% endnote %}

不过，我们这里的 `T` 又无处安放，所以又不得不使用 `PhantomData`，它就像一个占位符，但是又没有大小，可以为我们持有在声明时使用不到的数据：

```rust
use std::{
    marker::PhantomData,
    sync::atomic::{self, AtomicU64},
};

static NEXT_ID: AtomicU64 = AtomicU64::new(0);

struct Customer<T> {
    id: u64,
    name: String,
    phantom: PhantomData<T>,
}

struct FreeFeature;
struct PaidFeature;

trait Free {
    fn feature1(&self);
    fn feature2(&self);
}

trait Paid: Free {
    fn paid_feature(&self);
}

/// 为 Customer<T> 实现需要的方法
impl<T> Customer<T> {
    fn new(name: String) -> Self {
        Self {
            id: NEXT_ID.fetch_add(1, atomic::Ordering::Relaxed),
            name,
            phantom: PhantomData,
        }
    }
}

/// 免费用户可以升级到付费用户
impl Customer<FreeFeature> {
    fn advance(self, payment: f64) -> Customer<PaidFeature> {
        println!(
            "{}（{}） 将花费 {:.2} 元升级到付费用户",
            self.name, self.id, payment
        );
        self.into()
    }
}

/// 所有客户都有权使用免费功能
impl<T> Free for Customer<T> {
    fn feature1(&self) {
        println!("{} 正在使用免费功能一", self.name)
    }

    fn feature2(&self) {
        println!("{} 正在使用免费功能二", self.name)
    }
}

/// 付费用户才能使用的功能
impl Paid for Customer<PaidFeature> {
    fn paid_feature(&self) {
        println!("{} 正在使用付费功能", self.name)
    }
}

/// 允许使用免费用户转换成付费用户
impl From<Customer<FreeFeature>> for Customer<PaidFeature> {
    fn from(c: Customer<FreeFeature>) -> Self {
        Self::new(c.name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_customer() {
        // 一开始是免费用户
        let customer = Customer::<FreeFeature>::new("MichaelFu".to_owned());
        customer.feature1();
        customer.feature2();

        // 升级成付费用户，可能使用付费功能和普通功能
        let customer = customer.advance(99.99);
        customer.feature1();
        customer.feature2();
        customer.paid_feature();
    }
}
```

运行测试案例，这将输出：

    MichaelFu 正在使用免费功能一
    MichaelFu 正在使用免费功能二
    MichaelFu（0） 将花费 99.99 元升级到付费用户
    MichaelFu 正在使用免费功能一
    MichaelFu 正在使用免费功能二
    MichaelFu 正在使用付费功能


### 注意

使用 `PhantomData<T>` 表示我们的结构体拥有 `T` 类型的数据，当我们的结构体删除的时候，可能会删除一个或者多个 `T` 类型的实例。

但是，如果我们的结构体实际上并不拥有类型 `T` 的数据，那么我们最好使用 `PhantomData<&'a T>` 或者 `PhantomData<*const T> `。

