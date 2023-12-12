---
title: 容器网络-跨主机容器通信
date: 2023-12-12 11:05:38
tags:
    - 容器网络
categories:
    - Linux
---

单机场景下，相同主机上的容器会通过 `Docker` 默认创建的 `veth pair` 设备以及 `docker0` 网桥实现互通。而对于跨主机容器通信，社区提供了很多种不同的方案，例如 [`weave`](https://github.com/weaveworks/weave)、[`flannel`](https://github.com/flannel-io/flannel)，本篇文章将以 `flannel` 为例，实现跨主机容器通信，该项目的核心个人总结为以下几点：

1. 为不同主机上 `Docker` 规划具有相同网络前缀的子网，这样当 `docker0` 网桥发现目的 `IP` 不在自己的网络时，会借用操作系统的路由规则，将该网络报文发往 `flannel0` 设备；
2. `flannel` 进程在启动时，会创建 `flannel0` 这样的 `TUN` 设备，`TUN` 设备是一种工作在三层（`Network Layer`）的虚拟网络设备，`TUN` 设备用于在操作系统内核和用户应用程序之间传递 `IP` 包。当操作系统将一个 `IP` 包发送给 `flannel0` 设备之后，`flannel0` 就会把这个 `IP`包，交给创建这个设备的应用程序，也就是 `flannel` 进程，这是一个从内核态向用户态的流动方向。反之，如果 `flannel` 进程向 `flannel0` 设备发送了一个 `IP` 包，那么这个 `IP` 包就会出现在宿主机网络栈中，然后根据宿主机的路由表进行下一步处理，这是一个从用户态向内核态的流动方向；
3. `flannel` 进程在启动时除了创建 `TUN` 设备，还会监听一个端口，当它从 `flannel0` 这样的 `TUN` 收到原始报文之后，从 `ETCD` 中查询目的 `IP` 所在主机的公网地址，然后把这个报文通过发送目的主机 `flannel` 进程监听的端口；
4. 对端 `flannel` 进程在收到报文后，会通过路由匹配，发送给 `docker0`，然后再进一步发送给对应的容器；

`flannel` 还有多种后端实现，本篇文章以 `UDP` 和 `VXLAN` 为例，动手实践。

### 参考链接

1. [weave net](https://cloud.tencent.com/developer/article/1027318)