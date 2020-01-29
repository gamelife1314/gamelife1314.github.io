---
title: python3-实现单例模式
date: 2017-03-30 23:33:38
tags: 
- Python
---

单例模式，顾名思义，程序运行期间，类只有一个示例存在

Python 中实现单例模式是通过控制类的创建进而控制对象的生成，因为Python中，所有，记着，所有都是对象，
看个例子吧就明白了

<!-- more -->

Python中用于生成类的类，我们称之为`元类`

##### <p style="color:red">Python单例模式实现示例</p>

```python
#!/usr/bin/env python
# encoding: utf-8

"""
python 单例模式示例
@author: Gamelife
@contact: fudenglong1417@gmail.com
@file: singleton.py
@time: 2017/3/30 23:26
"""


class Singleton(type):

    def __init__(cls, *args, **kwargs):
        cls.__instance = None
        super().__init__(*args, **kwargs)

    def __call__(cls, *args, **kwargs):
        if cls.__instance is None:
            cls.__instance = super().__call__(*args, **kwargs)
        return cls.__instance


class Logger(metaclass=Singleton):

    def __init__(self, name, *args, **kwargs):
        self.name = name
        print("Init completely!")


logger1 = Logger(name="test")

logger2 = Logger(name="test2")

print(logger1.name, logger2.name, logger1 is logger2, id(logger1), id(logger2))


```

程序输出如下：

    "C:\Program Files (x86)\Python35-32\python.exe" E:/python/python_test/singleton.py
    Init completely!
    test test True 28887152 28887152

    Process finished with exit code 0

可以看到类`Logger`的构造函数只运行了**一次**，而且对象`logger2` 和 `logger1` 完全一样，元类中的__call__会在它的实例每次实例化新的对象的时候调用


##### <p style="color:blue">利用类__new__方法控制示例的生成实现单例模式</p>

```python
class MyClass(object):

    def __new__(cls, *args, **kwargs):

        if not hasattr(cls, "instance"):
            cls.instance = super(MyClass, cls).__new__(cls)

        return cls.instance

    def __init__(self, name):
        self.name = name


b = MyClass("hello")
print(b.name)

c = MyClass("hahahha")

print(id(b), id(c), b.name, c.name)
```

记着，用`__new__`控制新的实例的生成，用`__init__`控制产生的新的实例的初始化，这里__new__和__init__是每次都会被调用的，类中的__new__方法会在每次实例化新的实例时被调用


##### <p style="color:blue">利用装饰器实现单例模式</p>

```python
def singleton(cls):

    instance = {}
    print(instance)

    def geninstance(*args, **kwargs):

        if cls not in instance:
            instance[cls] = cls(*args, **kwargs)

        return instance[cls]

    return geninstance


@singleton
class MyClass(object):

    def __init__(self, name):
        self.name = name


b = MyClass("hello")
print(b.name)

c = MyClass("hahahha")

print(id(b), id(c), b.name, c.name)
```

