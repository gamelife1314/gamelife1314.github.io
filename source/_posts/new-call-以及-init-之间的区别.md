---
title: __new__，__call__以及__init__的区别
date: 2017-04-26 23:13:37
tags: 
  - Python 基础
categories:
  - 语言
---

ps: 解释全在代码里面了


```python
#!/usr/bin/env python
# encoding: utf-8

"""
@author: Gamelife
@contact: fudenglong1417@gmail.com
@file: hhh.py
@time: 2017/4/26 22:04
"""


class MetaClass(type):

    # __new__是方法其实是一个静态类方法，它的第一个参数是调用它的类自身，在本例中就是MetaClass本身
    # 这里用mcs表示MetaClass，cls 表示类，self表示类实例
    # 用于创建类实例，在本例中用于创建MetaClass的实例Child
    def __new__(mcs, name, bases, dct):
        print("元类中的__new__方法，用于创建%s实例" % name)
        return super(MetaClass, mcs).__new__(mcs, name, bases, dct)
        # return type(name, bases, dct),将导致不会继续调用Metaclass的__init__方法

    # __init__方法用于初始化实例对象的属性，这里第一个参数用了cls，而不是self，是因为
    # 元类是来创建类的，所以元类的实例其实是类，因此这里用了cls
    def __init__(cls, *args, **kwargs):
        print("元类__init__方法，用于实例化实例%s的属性" % cls.__name__)
        super(MetaClass, cls).__init__(*args, **kwargs)

    # __call__方法相当于重载()运算符，声明一个对象是可调用的
    # __call__不是一个静态方法，不用像__new__方法一样声明第一个参数
    # 对于元类的__call__方法，如果要继续生成实例，必须返回
    def __call__(cls, *args, **kwargs):
        print("类%s调用元类__call__方法" % cls.__name__)
        return super(MetaClass, cls).__call__(*args, **kwargs)


class Child(metaclass=MetaClass):

    def __init__(self):
        print("Child实例__init__方法")

    def __call__(self, *args, **kwargs):
        print("%s实例是可调用的" % self.__class__.__name__)


class Another(metaclass=MetaClass):

    # 一个实例的创建过程依次通过调用元类__call__，类自身__new__方法，类__init__方法
    # __new__ 可以返回一个不是本来的实例，但是就不会继续调用__init__方法
    def __new__(cls, *args, **kwargs):
        print("Another类__new__方法")
        return super(Another, cls).__new__(cls)

    def __init__(self):
        print("Another类实例__init__方法")

print("类是由元类创建的，元类是由元类创建的，这里MetaClass是由元类type创建的")

c = Child()
c()
a = Another()
# a()，但是Another的实例是不可调用的，因为Another类并没有实现__call__方法
```

程序输出：

        元类中的__new__方法，用于创建Child实例
        元类__init__方法，用于实例化实例Child的属性
        元类中的__new__方法，用于创建Another实例
        元类__init__方法，用于实例化实例Another的属性
        类是由元类创建的，元类是由元类创建的，这里MetaClass是由元类type创建的
        类Child调用元类__call__方法
        Child实例__init__方法
        Child实例是可调用的
        类Another调用元类__call__方法
        Another类__new__方法
        Another类实例__init__方法
