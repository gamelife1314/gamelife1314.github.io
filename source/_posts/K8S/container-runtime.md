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

在使用k8s的过程中，始终绕不开容器运行时这个关键组件，当通过`kubectl`创建一个应用时，节点上的`kubelet`组件接收到这个事件，然后调用容器运行时实现的`CRI`接口创建容器。当我们开始关注这个容器运行时的实现和生态的时候，发现存在很多关键词，例如：`docker`、`containerd`、`runc`、`OCI` 以及 `CRI` 等等，本篇文章主要记录厘清这些关键词所代表的概念及其出现的背景。

从公众的视野来看，`Docker`比`K8S`要早得多，2013年，`Docker` 就凭借着 `Build，Ship and Run Any App, Anywhere` 这句名满世界的广告语，迅速进入了开发者的视线中，方便、快速使它得到空前的发展，一时间内，容器化、微服务化成了各大公司技术团队主要的技术方向。由于 `Docker` 大火，有人比较眼红，`CoreOS` 实现了自己的容器引擎[rkt](https://www.redhat.com/en/topics/containers/what-is-rkt)，为了避免容器技术领域分裂和一家独大的场面出现，在2015年，Docker公司联合Linux基金会联合推动发起了[OCI（Open Container Initiative）](https://opencontainers.org/)倡议，其内容主要包括[OCI Runtime Spec（容器运行时规范）](https://github.com/opencontainers/runtime-spec)、[OCI Image Spec（镜像格式规范）](https://github.com/opencontainers/image-spec)、[OCI Distribution Spec（镜像分发规范）](https://github.com/opencontainers/distribution-spec)。同时，`Docker`公司将`libcontainer`模块捐给社区，作为`OCI`标准的实现，并改名为 `runc`，这就是我们常说的[runc](https://github.com/opencontainers/runc)的由来，后面交由在2015年成立的 `CNCF` 基金会管理，为其他玩家不依赖于`Docker`构建自家平台提供了可能性，所以说 `OCI` 是大家为了避免命脉被别人把住的协商结果。

k8s 和 `Docker` 的竞争主要是围绕容器编排领域展开，`Docker` 除了自身的容器引擎，后续还逐步发展出了 `docker swarm` 容器集群管理管理系统，以及配套的 `docker machine`、`docker compose` 等工具，但由于`Docker`公司始终在`Docekr`的规划中占据着话语权，让社区以及其他玩家不服，所以开始主推 `k8s`，由于 `k8s` 先进的`pod`、`sidecar` 设计理念以及在社区的民主化架构，从`API`到容器运行时的每一层，`Kubernetes`项目都为开发者暴露出了可以扩展的插件机制，鼓励用户通过代码的方式介入`Kubernetes`项目的每一个阶段。`Kubernetes`项目的这个变革的效果立竿见影，很快在整个容器社区中催生出了大量的、基于`Kubernetes API`和扩展接口的创新工作，涌现了一大批优秀的项目，比如：`Istio`、`Rook`。`Docekr`发现在和`k8s`竞争出现劣势的时候，强行将自家的容器编排系统`docker swarm` 内置到`docker`中，这种内置容器编排、集群管理和负载均衡能力，固然可以使得`Docker`项目的边界直接扩大到一个完整的`PaaS`项目的范畴，但这种变更带来的技术复杂度和维护难度，长远来看对`Docker`项目是不利的，从外界来看就是一条道走到黑，要保持霸权地位，不开放。 

由于 `k8s` 的茁壮成长，`Docker` 发现竞争无望，将自己的容器运行时 [containerd](https://containerd.io/) 从架构上独立出来，并且捐赠给社区维护，放弃和 `k8s` 的竞争，`Docker` 项目改名 `moby`，`Docker` 全面升级成 `PaaS` 平台，从此 `k8s` 一统江湖。

<!-- more -->

### dockershim

在 `Docker` 一鸣天下的时候，`k8s` 还是 `Google` 内部的项目，它负责容器编排，而 `Docker` 负责容器运行时，为了将容器编排和容器运行时解耦开来，让更多的人能参与进来共同建设，所以在2016年，自 `Kubernetes 1.5`开始，[Container Runtime Interface（CRI）](https://github.com/kubernetes/cri-api)发布，通过 `CRI` 可以支持 `kubelet` 使用不同的容器运行时，而不需要重新编译，所以这里的 `CRI` 也叫 `Kubelet Container Runtime Interface (CRI)`。但是由于那个时候，`Docker` 是大哥，`k8s` 是小弟，所以 `Docker` 没有实现 `CRI`，而且 `k8s` 要借 `Docker` 的势发展自身，所以在 `k8s` 自己就实现了 `dockershim`，用来将 `CRI` 请求转换为对 `Docker` 的调用，`shim` 中文垫片的意思，就是个适配层，在 `k8s` 早期的版本中（[v1.24.0之前](https://github.com/kubernetes/kubernetes/blob/v1.23.12/cmd/kubelet/app/options/options.go#L161C13-L161C13)），`dockershim` 还是默认选项：

```go
// NewKubeletFlags will create a new KubeletFlags with default values
func NewKubeletFlags() *KubeletFlags {
	remoteRuntimeEndpoint := ""
	if runtime.GOOS == "linux" {
		remoteRuntimeEndpoint = "unix:///var/run/dockershim.sock"
	} else if runtime.GOOS == "windows" {
		remoteRuntimeEndpoint = "npipe:////./pipe/dockershim"
	}
    ....
}
```

代码仓中也能发现 [dockershim](https://github.com/kubernetes/kubernetes/tree/v1.23.12/pkg/kubelet/dockershim) 的实现，但是自[`v1.24.0`](https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG/CHANGELOG-1.24.md#dockershim-removed-from-kubelet) 以来，`dockershim` 相关的代码彻底从 `kubelet` 的主干中移除，`k8s` 适配 `docker` 从此成为历史，因为通过 `dockershim` 创建容器的调用链实在太长了：

![容器运行时](容器运行时.png)

### cri-dockerd

`dockershim` 被从 `kubelet` 的主干代码中移除了，那么还想使用 `Docker` 作为容器运行时的人怎么办呢？所以就诞生了 [cri-dockerd](https://github.com/Mirantis/cri-dockerd) 这个项目，它的作用和 `dockershim` 类似，实现 `CRI` 接口，将 `CRI` 请求转换为对 `Docker Daemon` 的请求，从它的[配置文件](https://github.com/Mirantis/cri-dockerd/blob/master/cmd/cri/options/options.go)就可以看出这点，它自己的监听地址 `unix:///var/run/cri-dockerd.sock` 接收 `CRI`请求，转换之后转发给 `unix:///var/run/docker.sock`，官方也存在[指导文档](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/migrating-from-dockershim/migrate-dockershim-dockerd/)，有这部分需求的人可以按照这份指导进行适配，看完这篇文章，我估计你也没这个需求了。

### crictl

[`crictl`](https://github.com/kubernetes-sigs/cri-tools) 是用于 `CRI` 的客户端工具，就像通过 `docker` 这个命令行工具访问 `docker daemon` 一样，但是 `crictl` 在使用的过程中需要制定你使用哪个容器运行时作为你的后端，它的文件配置在 `/etc/crictl.yaml`：

```yaml
root@ctrlnode:/home/ubuntu# cat /etc/crictl.yaml
runtime-endpoint: "unix:///var/run/k3s/cri-dockerd/cri-dockerd.sock"
image-endpoint: "unix:///var/run/k3s/cri-dockerd/cri-dockerd.sock"
timeout: 0
debug: false
pull-image-on-create: false
disable-pull-on-run: false
```

本地测试环境使用 [k3s](https://docs.k3s.io/advanced#using-docker-as-the-container-runtime) 搭建的集群，使用 `docker` 作为容器运行时，`docker` 命令到 `crictl` 命令的映射可以看[这里](https://kubernetes.io/zh-cn/docs/reference/tools/map-crictl-dockercli/)，比起 `docker`，`crictrl` 可以管理 `pod`，`pod` 是 `CRI` 实现者要理解的概念，而向 `docker` 这样的底层容器运行时，不需要理解`pod`，只负责管理容器和镜像。

```
root@ctrlnode:/home/ubuntu# crictl pods
POD ID              CREATED              STATE               NAME                                         NAMESPACE              ATTEMPT             RUNTIME
835d13529e8d8       44 seconds ago       NotReady            hello-28385490-jk74x                         default                0                   (default)
ed0e9084e35c9       About a minute ago   NotReady            hello-28385489-dhvb2                         default                0                   (default)
e4004b9ae600b       2 minutes ago        NotReady            hello-28385488-ldtjs                         default                0                   (default)
```

### containerd

[containerd](https://containerd.io/)是行业标准的容器运行时，强调简单性、稳健性和可移植性。在这里要将容器运行运行时进一步分为高级别容器运行时和低级别容器运行时，高级别以 `containerd` 为代表的，实现了 `kubelet CRI` 标准的容器运行时，还有 [cri-o](https://cri-o.io/)，而低级别是以[runc](https://github.com/opencontainers/runc)为代表的，实现了 [OCI（Open Container Initiative）](https://opencontainers.org/) 的容器运行时，利用 `Linux` 提供的 `namespace` 、`cgroup` 等特性创建容器，高级容器运行时理解 `kubelet CRI`，转而调用低级别的 `runc` 等创建容器。 `containerd` 的架构图如下所示：

![containerd架构图](https://containerd.io/img/architecture.png)

`containerd` 和 `runc` 都是最初 `Docker` 贡献出来的，现在也存在于 `docker` 的架构中，所以安装 `Docker` 之后这些组件就存在了，当然也可以单独安装，更多的运行时请看[CNCF Contaienr Runtime](https://landscape.cncf.io/card-mode?category=container-runtime&grouping=category)。从 `containerd` 的[发布件](https://github.com/containerd/containerd/releases)来看，它里面包含这些工具：

- `bin/containerd`：`containerd` 的守护进程文件，用于启动 `containerd` 服务，一般位于配置 `/etc/systemd/system/containerd.service` 中；
- `bin/containerd-shim`：`containerd` 套件，其目的主要是隔离`containerd`和容器。`containerd`守护进程收到`gRPC`调用请求（比如来自`Kubelet`或`Docker`的创建容器请求），便会启动`/usr/bin/containerd-shim`套件；
- `bin/containerd-shim-runc-v2`：`containerd-shim` 启动后会去启动`/usr/bin/containerd-shim-runc-v2`，然后立即退出，此时`containerd-shim-runc-v2`的父进程就变成了`systemd(1)`，这样`containerd-shim-runc-v2`就和`containerd`脱离了关系，即便`containerd`退出也不会影响到容器，`v2` 版本的运行时架构及其原理可以查看[官方说明](https://github.com/containerd/containerd/blob/main/runtime/v2/README.md)；
- `bin/containerd-shim-runc-v1`：`contaienrd` 运行时的 `v1` 版本，`v2` 相比 `v1`会有更高的性能个更丰富的特性；
- `bin/ctr`： `containerd` 的客户端；

接下来我们使用 [ctr](https://labs.iximiuz.com/courses/containerd-cli/ctr/container-management) 命令创建两个容器，首先，查看 `containerd` 进程：

> systemctl status containerd

```
root@ctrlnode:/home/ubuntu# systemctl status containerd
● containerd.service - containerd container runtime
     Loaded: loaded (/etc/systemd/system/containerd.service; enabled; vendor preset: enabled)
    Drop-In: /usr/lib/systemd/system/containerd.service.d
             └─http-proxy.conf
     Active: active (running) since Wed 2023-12-20 15:40:53 CST; 24h ago
       Docs: https://containerd.io
    Process: 2985245 ExecStartPre=/sbin/modprobe overlay (code=exited, status=1/FAILURE)
   Main PID: 2985246 (containerd)
      Tasks: 253
     Memory: 474.5M
     CGroup: /system.slice/containerd.service
             ├─2985246 /usr/local/bin/containerd
```

这里获得的进程 `id` 是 `2985246`，然后使用下面的命令拉取镜像，不像 `docker` 那么友好，在发现没有镜像的时候自动拉取：

> ctr image pull docker.io/library/nginx:alpine

然后使用下面的命令，基于不同的运行时创建两个容器，使用 `--runtime` 参数指定 `runtime` 版本，可以使用版本号，也可以直接使用二进制文件：

> ctr run -d --runtime io.containerd.runc.v2 docker.io/library/nginx:alpine nginx1
> ctr run -d --runtime /usr/local/bin/containerd-shim-runc-v1 docker.io/library/nginx:alpine nginx2

可以使用 `ctr task` 命令查看容器中的首进程 `PID`，如下所示：

```
root@ctrlnode:/home/ubuntu# ctr task ls
TASK      PID        STATUS
nginx1    4021721    RUNNING
nginx2    4023266    RUNNING
```

然后可以进一步使用 `ps` 命令查看 `4021721` 的子进程和父进程，可以看到容器里面的`nginx`进程是`4021701`的子进程，而 `4021701` 已经和 `containerd` 脱离了关系。

> pstree -a -s -l -n -S -p 4021721

```
root@ctrlnode:/home/ubuntu# ps -ef | grep 4021701
root     4021701       1  0 16:03 ?        00:00:00 /usr/local/bin/containerd-shim-runc-v2 -namespace default -id nginx1 -address /run/containerd/containerd.sock
root     4021721 4021701  0 16:03 ?        00:00:00 nginx: master process nginx -g daemon off;
root     4038243  984674  0 16:26 pts/9    00:00:00 grep --color=auto 4021701
root@ctrlnode:/home/ubuntu#
root@ctrlnode:/home/ubuntu# ps -ef | grep 4021721
root     4021721 4021701  0 16:03 ?        00:00:00 nginx: master process nginx -g daemon off;
systemd+ 4021757 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021758 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021759 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021760 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021761 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021762 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021763 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021764 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021765 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021766 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021767 4021721  0 16:03 ?        00:00:00 nginx: worker process
systemd+ 4021768 4021721  0 16:03 ?        00:00:00 nginx: worker process
```

可以使用 `ctr task exec` 进入到容器内部执行命令：

>  ctr task exec --exec-id ps nginx1 ps -ef

要删除创建的容器，要执行下面这些命令，依次停止任务，删除任务，删除容器：

>  ctr t kill -s 9 nginx1
>  ctr t del nginx1
>  ctr c rm nginx1

这里如果要了解 `containerd` 中的 `task` 概念，可以查看[说明书](https://github.com/containerd/containerd/blob/main/runtime/v2/README.md)。 

### runc vs crun vs youki

[runc](https://github.com/opencontainers/runc)、[crun](https://github.com/containers/crun)、[youki](https://github.com/containers/youki) 都是实现了 `OCI` 规范的低级别容器运行时，`runc` 使用 `Go` 语言编写，`crun` 使用 `C` 语言编写，`youki` 使用 `Rust` 语言编写。

下面是直接使用 `youki` 创建容器的示例：

1. 创建一个包含 `roots` 的空目录，例如：

    > mkdir -p tutorial/rootfs

2. 进入到 `tutorial` 目录，借助 `docker` 构建一个完整的容器文件系统：

    > cd tutorial
    > docker export $(docker create busybox) | tar -C rootfs -xvf -

3. 现在需要一个 `config.json` 文件来描述进程的权限、配置和约束信息，下面的命令将生成一个默认的配置：

    > youki spec

4. 然后就可以手动修改这个文件定义容器进程的行为，如果不想修改保持默认也行；

5. 接下来可以创建容器，`-b` 参数指向包含 `config.json` 的目录：

    > youki create -b tutorial busybox_with_youki

6. 查看容器状态，现在是 `created`：

    > youki state busybox_with_youki

    ```
    root@ctrlnode:/home/ubuntu# youki state busybox_with_youki
    {
      "ociVersion": "v1.0.2",
      "id": "busybox_with_youki",
      "status": "created",
      "pid": 67532,
      "bundle": "/home/michael/tutorial",
      "annotations": {},
      "created": "2023-12-21T12:57:42.295654400Z",
      "creator": 0,
      "useSystemd": false,
      "cleanUpIntelRdtSubdirectory": false
    }
    ```

7. 启动容器：

    >  youki start busybox_with_youki

8. 列出容器：

    > youki list

    ```
    root@ctrlnode:/home/ubuntu# youki list
    ID                  PID    STATUS   BUNDLE                  CREATED                    CREATOR
    busybox_with_youki  81153  Created  /home/michael/tutorial  2023-12-21T21:17:24+08:00  root
    ```

9. 查看容器进程：

    > youki ps busybox_with_youki

    ```
    root@ctrlnode:/home/ubuntu# youki ps busybox_with_youki
    UID          PID    PPID  C STIME TTY          TIME CMD
    root       81153       1  0 21:17 ?        00:00:00 youki create -b tutorial busybox_with_youki
    ```

10. 删除容器：

    > youki delete busybox_with_youki

其实上面从第三步开始可以将 `youki` 换成 `runc` 执行，完全兼容，都实现的相同的标准。

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