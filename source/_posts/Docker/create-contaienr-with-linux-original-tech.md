---
title: 使用Linux原生技术创建容器
date: 2023-12-22 14:48:48
tags:
    - Container
categories:
    - Docker
    - Linux
---

容器其实是一种沙盒技术。顾名思义，沙盒就是能够像一个集装箱一样，把你的应用装起来的技术。这样，应用与应用之间，就因为有了边界而不至于相互干扰。对于应用来说，它的静态表现就是程序，平常都安安静静地待在磁盘上；而一旦运行起来，它就变成了计算机里的数据和状态的总和，这就是它的动态表现。容器技术的核心功能，就是通过约束和修改进程的动态表现，从而为其创造出一个边界。对于`Docker`等大多数`Linux`容器来说，`Cgroups`技术是用来制造约束的主要手段，而`Namespace`技术则是用来修改进程视图的主要方法。本篇文章的主要目标就是手动利用Linux提供的 `Cgroup` 和 `Namespace` 技术创建出一个容器。

### 容器镜像

首先我们从容器镜像开始，从我们对容器的认识来说，进入到容器之后，看到了一个独立的文件系统，和宿主机完全隔离，包含了应用程序所需要的数据和文件，而容器镜像就是包含来构造这个独立的，应用程序所需的文件系统。

### 参考链接

1. [Creating Your Own Containers](https://cesarvr.io/post/2018-05-22-create-containers/)
2. [Understanding Linux Namespaces](https://theboreddev.com/understanding-linux-namespaces/)
3. [How to Use Linux Network Namespace](https://linuxhint.com/use-linux-network-namespace/)
4. [Building containers by hand using namespaces: The net namespace](https://www.redhat.com/sysadmin/net-namespaces)
5. [Separation Anxiety: A Tutorial for Isolating Your System with Linux Namespaces](https://www.toptal.com/linux/separation-anxiety-isolating-your-system-with-linux-namespaces)