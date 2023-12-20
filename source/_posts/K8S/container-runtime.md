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

从公众的视野来看，`Docker`比`K8S`要早得多，2013年，`Docker` 就凭借着 `Build，Ship and Run Any App, Anywhere` 这句名满世界的广告语，迅速进入了开发者的视线中，方便、快速使它得到空前的发展，一时间内，容器化、微服务化成了各大公司技术团队主要的技术方向。由于 `Docker` 大火，有人比较眼红，`CoreOS` 实现了自己的容器引擎[rkt](https://www.redhat.com/en/topics/containers/what-is-rkt)，同时也为了避免容器技术领域分裂，在2015年，Docker公司联合Linux基金会联合推动发起了[OCI（Open Container Initiative）](https://opencontainers.org/)倡议，其内容主要包括[OCI Runtime Spec（容器运行时规范）](https://github.com/opencontainers/runtime-spec)、[OCI Image Spec（镜像格式规范）](https://github.com/opencontainers/image-spec)、[OCI Distribution Spec（镜像分发规范）](https://github.com/opencontainers/distribution-spec)。同时，`Docker`公司将`libcontainer`模块捐给社区，作为`OCI`标准的实现，这就是我们常说的[runc](https://github.com/opencontainers/runc)的由来。

k8s 和 `Docker` 的竞争主要是围绕容器编排领域展开，`Docker` 除了自身的容器引擎，后续还逐步发展出了 `docker swarm` 容器集群管理管理系统， 以及配套的 `docker machine`、`docker compose` 等工具，想和 `K8S` 展开全面的竞争。由于 `Docker` 的商业化战略以及始终在 `Docker` 项目中绝对霸权，让社区和其他头部玩家（`CoreOS`、以及 `Google`、`RedHat`、微软等）看不下去了，倡议制定标准，成立中立的容器运行时交由社区维护，`Docker` 为了战略考虑，同意将 `libcontainer` 捐出，改名 `runc` 交由在2015年成立的 `CNCF` 基金会管理，这既改变了`Docker`一家独大的现状，也为其他玩家不依赖于`Docker`构建自家平台提供了可能性，所以说 `OCI` 是大家为了避免命脉被别人把住的协商结果。

在容器编排领域中，由于 `Docker` 内心的小九九，发现在和`k8s`竞争出现劣势的时候，强行将自家的容器编排系统`docker swarm` 内置到 `docker` 中，这种内置容器编排、集群管理和负载均衡能力，固然可以使得`Docker`项目的边界直接扩大到一个完整的`PaaS`项目的范畴，但这种变更带来的技术复杂度和维护难度，长远来看对`Docker`项目是不利的，从外界来看就是一条道走到黑，要保持霸权地位，不开放。 相反此时由于 `k8s` 先进的`pod`、`sidecar` 设计理念以及在社区的民主化架构，从API到容器运行时的每一层，`Kubernetes`项目都为开发者暴露出了可以扩展的插件机制，鼓励用户通过代码的方式介入`Kubernetes`项目的每一个阶段。`Kubernetes`项目的这个变革的效果立竿见影，很快在整个容器社区中催生出了大量的、基于`Kubernetes API`和扩展接口的创新工作，涌现了一大批优秀的项目，比如：`Istio`、`Rook`。

由于 `k8s` 的茁壮成长，`Docker` 发现竞争无望，将自己的容器运行时 [containerd](https://containerd.io/) 捐赠给社区维护，放弃和 `k8s` 的竞争，`Docker` 项目改名 `moby`，`Docker` 全面升级成 `PaaS` 平台。
 

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