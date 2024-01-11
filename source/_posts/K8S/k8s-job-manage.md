---
title: K8S 容器编排
date: 2024-01-10 15:37:54
tags:
    - pod
    - deployment
    - statefulset
    - replicaset
    - job
    - cronjob
    - daemonset
categories:
    - k8s
---

`Pod` 是`K8S`中的调度单位，它是一个逻辑概念，用于将一些关系密切的容器部署在一起提供对外服务，这些容器互相之间会发生直接的文件交换、使用`localhost`或者`Socket`文件进行本地通信、会发生非常频繁的远程调用、需要共享某些Linux Namespace等等，`Pod` 中的所有容器都共享同一个`Network Namespace`。`K8S` 中为了实现不同的目的，在`Pod`基础之上衍生出了不同的部署模型，例如，常见的 `Deployment`、`Replicaset`、以及`StatefulSet`等等，本文就来举例并且说明它们之间的区别。

### Pod

[Pod](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/) 是集群中基础的调度模型，依据[PodAPI](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/workload-resources/pod-v1/) 编写一个`Pod`模板，然后使用`kubectl`提交到急群众，这个`Pod`里面包含两个容器，`whoami`监听`80`端口，提供一个简单的服务返回主机名，`nettool` 是一个简单的工具容器，提供了很多可用的网络工具供测试使用：

{% note success 点击查看命令 %}
```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: whoami
  labels:
    app.kubernetes.io/part-of: whoami
    app.kubernetes.io/name: whoami
---
apiVersion: v1
kind: Pod
metadata:
  name: whoami
  namespace: whoami
  labels:
    app.kubernetes.io/part-of: whoami
    app.kubernetes.io/name: whoami
spec:
  containers:
  - name: whoami
    image: traefik/whoami
    imagePullPolicy: IfNotPresent
    ports:
    - containerPort: 80
  - name: nettool
    image: praqma/network-multitool
    imagePullPolicy: IfNotPresent
    command: ["sleep"]
    args: ["86400"]
EOF
```
{% endnote %}

执行之后，使用下面的命令查看创建成功的`Pod`：

```
$ kubectl get pods -n whoami -owide
NAME     READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
whoami   2/2     Running   0          92s   10.42.0.221   ctrlnode       <none>           <none>
```

查看`Pod`中的容器：

```
$ kubectl get pods -n whoami whoami -o jsonpath={.spec.containers[*].name}
whoami nettool
```

进入`nettool`，通过`localhost`就能访问`whoami`容器中的服务，因为它们共享网络栈，在同一个网络空间内：

```
$ kubectl exec whoami -n whoami -it -c nettool -- /bin/bash
bash-5.1#
bash-5.1# netstat -tualnp | grep LISTEN
tcp6       0      0 :::80                   :::*                    LISTEN      -
bash-5.1# curl localhost
Hostname: whoami
IP: 127.0.0.1
IP: 10.42.0.221
RemoteAddr: 127.0.0.1:34488
GET / HTTP/1.1
Host: localhost
User-Agent: curl/7.79.1
Accept: */*

bash-5.1#
```

测试环境中使用`docker`作为容器运行时，查看`Pod`中的容器时，会存在一个`pause`容器，它使用的是一个非常特殊的镜像，叫作：`k8s.gcr.io/pause`，这个镜像是一个用汇编语言编写的、永远处于暂停状态的容器，解压后的大小也只有100~200 KB左右。在这`Pause`容器启动之后，`Pod`中的其他容器就可以加入这个`Pause`容器的命名空间，从而实现共享，但是`mnt`、`pid`以及`uts`这三个命名空间默认不共享，`pid`可以通过`spec.shareProcessNamespace`单独设置：

```
$ docker ps | grep whoami
52d2b3478c88        1631e536ed7d                 "sleep 86400"            15 minutes ago      Up 15 minutes                           k8s_nettool_whoami_whoami_..
089341cdc151        e21a57f872ce                 "/whoami"                15 minutes ago      Up 15 minutes                           k8s_whoami_whoami_whoami_..
0bd146217958        rancher/mirrored-pause:3.6   "/pause"                 15 minutes ago      Up 15 minutes                           k8s_POD_whoami_whoami_..
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 52d2b3478c88)"/ns
total 0
dr-x--x--x 2 root root 0 Jan 11 20:16 ./
dr-xr-xr-x 9 root root 0 Jan 11 20:11 ../
lrwxrwxrwx 1 root root 0 Jan 11 20:28 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 mnt -> 'mnt:[4026533901]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 net -> 'net:[4026533557]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 pid -> 'pid:[4026533903]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 pid_for_children -> 'pid:[4026533903]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 uts -> 'uts:[4026533902]'
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 089341cdc151)"/ns
total 0
dr-x--x--x 2 root root 0 Jan 11 20:28 ./
dr-xr-xr-x 9 root root 0 Jan 11 20:11 ../
lrwxrwxrwx 1 root root 0 Jan 11 20:29 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 mnt -> 'mnt:[4026533778]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 net -> 'net:[4026533557]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 pid -> 'pid:[4026533780]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 pid_for_children -> 'pid:[4026533780]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 uts -> 'uts:[4026533779]'
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 0bd146217958)"/ns
total 0
dr-x--x--x 2 65535 65535 0 Jan 11 20:11 ./
dr-xr-xr-x 9 65535 65535 0 Jan 11 20:11 ../
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:11 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 mnt -> 'mnt:[4026533552]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:11 net -> 'net:[4026533557]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 pid -> 'pid:[4026533555]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 pid_for_children -> 'pid:[4026533555]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 user -> 'user:[4026531837]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 uts -> 'uts:[4026533553]'
```


### 参考链接

1. [Understanding ReplicaSet vs. StatefulSet vs. DaemonSet vs. Deployments](https://semaphoreci.com/blog/replicaset-statefulset-daemonset-deployments)
2. [Kubernetes Service Account: What It Is and How to Use It](https://loft.sh/blog/kubernetes-service-account-what-it-is-and-how-to-use-it/)