---
title: 【Rust】Mutex 使用示例
date: 2022-05-15 11:38:52
tags:
    - mutex
categories:
    - rust
---

使用 [`std::sync::Mutex`](https://doc.rust-lang.org/std/sync/struct.Mutex.html) 可以多线程共享可变数据，`Mutex`、`RwLock` 和原子类型，即使声明为 `non-mut`，这些类型也可以修改：

```rust
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    // 用 Arc 来提供并发环境下的共享所有权（使用引用计数）
    let metrics: Arc<Mutex<HashMap<Cow<'static, str>, usize>>> =
        Arc::new(Mutex::new(HashMap::new()));
    for _ in 0..32 {
        let m = metrics.clone();
        thread::spawn(move || {
            let mut g = m.lock().unwrap();

            // 此时只有拿到 MutexGuard 的线程可以访问 HashMap
            let data = &mut *g;

            // Cow 实现了很多数据结构的 From trait，
            // 所以我们可以用 "hello".into() 生成 Cow
            let value = data.entry("hello".into()).or_insert(0);
            *value += 1;

            // MutexGuard 被 Drop，锁被释放
        });
    }

    thread::sleep(Duration::from_millis(100));
    println!("metrics: {:?}", metrics.lock().unwrap());
}
```