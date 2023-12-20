---
title: 容器运行时
date: 2023-12-20 14:58:49
tags:
    - 容器运行时
    - OCI
    - CRI
    - containerd
    - dockershim
    - ctr
    - crictl
    - containerd-shim-runc-v2
    - crun
    - runc
    - youki
    - gvisor
    - podman
    - cri-o
categories:
    - k8s
---

在使用k8s的过程中，始终绕不开容器运行时这个关键组件，当通过 `kubectl` 创建一个应用时，节点上的 `kubelet` 组件接收到这个事件，然后调用容器运行时实现的`CRI`接口创建容器。当我们开始关注这个容器运行时的实现和生态的时候，发现存在很多关键词，例如：`docker`、`containerd`、`runc`、`OCI` 以及 `CRI` 等等，本篇文章主要记录厘清这些关键词所代表的概念及其出现的背景。

从公众的视野来看，`Docker`比`K8S`要早得多，2013年，`Docker` 就凭借这 `Build，Ship and Run Any App, Anywhere` 这句名满世界的广告语，迅速进入了开发者的视线中，方便、快速使它得到空前的发展，一时间内，容器化、微服务化成了各大公司技术团队主要的技术方向。由于 `Docker` 大火，有人比较眼红，`CoreOS` 实现了自己的容器引擎[rkt](https://www.redhat.com/en/topics/containers/what-is-rkt)，为了避免容器技术领域分裂，在2015年，Docker公司联合Linux基金会联合推动发起了[OCI（Open Container Initiative）](https://opencontainers.org/)倡议，其内容主要包括[OCI Runtime Spec（容器运行时规范）](https://github.com/opencontainers/runtime-spec)、[OCI Image Spec（镜像格式规范）](https://github.com/opencontainers/image-spec)、[OCI Distribution Spec（镜像分发规范）](https://github.com/opencontainers/distribution-spec)。同时，`Docker`公司将`libcontainer`模块捐给社区，作为`OCI`标准的实现，这就是我们常说的[runc](https://github.com/opencontainers/runc)的由来。


### 参考文章

1. [cri-tools(crictl)](https://github.com/kubernetes-sigs/cri-tools)
2. [Docker vs Containerd vs RunC](https://medium.com/@bibhup_mishra/docker-vs-containerd-vs-runc-c39ffd4156fb)
3. [Youki User and Developer Documentation](https://containers.github.io/youki/user/basic_usage.html)
4. [Alternative container runtimes](https://docs.docker.com/engine/alternative-runtimes/#youki)
5. [Containerd组件 —— containerd-shim-runc-v2作用](https://www.cnblogs.com/zhangmingcheng/p/17524721.html)
6. [浅谈dockerd、contaierd、containerd-shim、runC之间的关系](https://www.jxhs.me/2019/08/05/%E6%B5%85%E8%B0%88dockerd%E3%80%81contaierd%E3%80%81containerd-shim%E3%80%81runC%E4%B9%8B%E9%97%B4%E7%9A%84%E5%85%B3%E7%B3%BB/)
7. [CRI Plugin Config Guide](https://github.com/containerd/containerd/blob/main/docs/cri/config.md#runtime-classes)
8. [containerd-runtimeV2](https://github.com/Mirantis/cri-dockerd)
9. [容器运行时探讨--从dockershim正式从K8s移除说起](https://zhuanlan.zhihu.com/p/510629380)
10. [cri-o](https://github.com/cri-o/cri-o)
11. [How to run and manage containers using ctr](https://labs.iximiuz.com/courses/containerd-cli/ctr/container-management)